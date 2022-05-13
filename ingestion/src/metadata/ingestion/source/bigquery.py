#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import os
import traceback
import uuid
from typing import Iterable, Optional, Tuple

from google.cloud.datacatalog_v1 import PolicyTagManagerClient
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy_bigquery import _types
from sqlalchemy_bigquery._struct import STRUCT
from sqlalchemy_bigquery._types import (
    _get_sqla_column_type,
    _get_transitive_schema_fields,
)

from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.source.sql_source import SQLSource, _get_table_description
from metadata.utils.column_type_parser import create_sqlalchemy_type
from metadata.utils.filters import filter_by_schema, filter_by_table
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
GEOGRAPHY = create_sqlalchemy_type("GEOGRAPHY")
_types._type_map["GEOGRAPHY"] = GEOGRAPHY


def get_columns(bq_schema):
    fields = _get_transitive_schema_fields(bq_schema)
    col_list = []
    for field in fields:
        col_obj = {
            "name": field.name,
            "type": _get_sqla_column_type(field)
            if "STRUCT" or "RECORD" not in field
            else STRUCT,
            "nullable": field.mode == "NULLABLE" or field.mode == "REPEATED",
            "comment": field.description,
            "default": None,
            "precision": field.precision,
            "scale": field.scale,
            "max_length": field.max_length,
            "raw_data_type": str(_get_sqla_column_type(field)),
            "policy_tags": None,
        }
        try:
            if field.policy_tags:
                col_obj["policy_tags"] = (
                    PolicyTagManagerClient()
                    .get_policy_tag(name=field.policy_tags.names[0])
                    .display_name
                )
        except Exception as err:
            logger.info(f"Skipping Policy Tag: {err}")
        col_list.append(col_obj)
    return col_list


_types.get_columns = get_columns


class BigquerySource(SQLSource):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)
        self.connection_config: BigQueryConnection = (
            self.config.serviceConnection.__root__.config
        )
        self.temp_credentials = None

    #  and "policy_tags" in column and column["policy_tags"]
    def prepare(self):
        try:
            if self.connection_config.enablePolicyTagImport:
                self.metadata.create_tag_category(
                    CreateTagCategoryRequest(
                        name=self.connection_config.tagCategoryName,
                        description="",
                        categoryType="Classification",
                    )
                )
        except Exception as err:
            logger.error(err)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: BigQueryConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, BigQueryConnection):
            raise InvalidSourceException(
                f"Expected BigQueryConnection, but got {connection}"
            )

        return cls(config, metadata_config)

    def standardize_schema_table_names(
        self, schema: str, table: str
    ) -> Tuple[str, str]:
        segments = table.split(".")
        if len(segments) != 2:
            raise ValueError(f"expected table to contain schema name already {table}")
        if segments[0] != schema:
            raise ValueError(f"schema {schema} does not match table {table}")
        return segments[0], segments[1]

    def fetch_sample_data(self, schema: str, table: str) -> Optional[TableData]:
        partition_details = self.inspector.get_indexes(table, schema)
        if partition_details and partition_details[0].get("name") == "partition":
            try:
                logger.info("Using Query for Partitioned Tables")
                partition_details = self.inspector.get_indexes(table, schema)
                start, end = get_start_and_end(
                    self.connection_config.partitionQueryDuration
                )

                query = self.connection_config.partitionQuery.format(
                    schema,
                    table,
                    partition_details[0]["column_names"][0]
                    or self.connection_config.partitionField,
                    start.strftime("%Y-%m-%d"),
                )
                logger.info(query)
                results = self.connection.execute(query)
                cols = []
                for col in results.keys():
                    cols.append(col)
                rows = []
                for res in results:
                    row = list(res)
                    rows.append(row)
                return TableData(columns=cols, rows=rows)
            except Exception as err:
                logger.error(err)
        else:
            return super().fetch_sample_data(schema, table)

    def _get_database(self, database: Optional[str]) -> Database:
        if not database:
            database = (
                self.connection_config.projectId
                or self.connection_config.credentials.gcsConfig.projectId
            )
        return Database(
            name=database,
            service=EntityReference(
                id=self.service.id, type=self.service_connection.type.value
            ),
        )

    def next_record(self) -> Iterable[Entity]:
        for inspector in self.get_databases():
            schema_names = inspector.get_schema_names()
            for schema in schema_names:
                # clear any previous source database state
                try:
                    self.database_source_state.clear()
                    if filter_by_schema(
                        self.source_config.schemaFilterPattern, schema_name=schema
                    ):
                        self.status.filter(schema, "Schema pattern not allowed")
                        continue

                    if self.source_config.includeTables:
                        yield from self.fetch_tables(inspector, schema)

                    if self.source_config.includeViews:
                        yield from self.fetch_views(inspector, schema)
                    if self.source_config.markDeletedTables:
                        schema_fqdn = f"{self.config.serviceName}.{self.service_connection.projectId}.{schema}"
                        yield from self.delete_tables(schema_fqdn)
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(err)

    def fetch_views(
        self, inspector: Inspector, schema: str
    ) -> Iterable[OMetaDatabaseAndTable]:
        """
        Get all views in the SQL schema and prepare
        Database & Table OpenMetadata Entities
        """
        for view_name in inspector.get_view_names(schema):
            try:
                schema, view_name = self.standardize_schema_table_names(
                    schema, view_name
                )

                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=view_name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{view_name}",
                        "View pattern not allowed",
                    )
                    continue
                try:
                    view_definition = inspector.get_view_definition(
                        f"{self.service_connection.projectId}.{schema}.{view_name}"
                    )

                    view_definition = (
                        "" if view_definition is None else str(view_definition)
                    )
                except NotImplementedError:
                    view_definition = ""

                table = Table(
                    id=uuid.uuid4(),
                    name=view_name,
                    tableType="View",
                    description=_get_table_description(schema, view_name, inspector)
                    or "",
                    # This will be generated in the backend!! #1673
                    columns=self._get_columns(schema, view_name, inspector),
                    viewDefinition=view_definition,
                )
                if self.source_config.generateSampleData:
                    table_data = self.fetch_sample_data(schema, view_name)
                    table.sampleData = table_data

                try:
                    if self.source_config.enableDataProfiler:
                        profile = self.run_profiler(table=table, schema=schema)
                        table.tableProfile = [profile] if profile else None
                # Catch any errors during the profile runner and continue
                except Exception as err:
                    logger.error(err)

                database = self._get_database(self.service_connection.database)
                table_schema_and_db = OMetaDatabaseAndTable(
                    table=table,
                    database=database,
                    database_schema=self._get_schema(schema, database),
                )

                self.register_record(table_schema_and_db)

                yield table_schema_and_db
            # Catch any errors and continue the ingestion
            except Exception as err:  # pylint: disable=broad-except
                logger.error(err)
                self.status.warnings.append(f"{self.config.serviceName}.{view_name}")
                continue

    def parse_raw_data_type(self, raw_data_type):
        return raw_data_type.replace(", ", ",").replace(" ", ":").lower()

    def close(self):
        super().close()
        if self.temp_credentials:
            os.unlink(self.temp_credentials)
