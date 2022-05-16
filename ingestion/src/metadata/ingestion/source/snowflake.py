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
import traceback
import uuid
from typing import Iterable, Optional, Union

from snowflake.sqlalchemy.custom_types import VARIANT
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect, ischema_names
from sqlalchemy.engine import reflection
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect
from sqlalchemy.sql import text

from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.source.sql_source import SQLSource
from metadata.utils.column_type_parser import create_sqlalchemy_type
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.fqdn_generator import get_fqdn
from metadata.utils.logger import ingestion_logger
from metadata.utils.sql_queries import (
    FETCH_SNOWFLAKE_ALL_TAGS,
    FETCH_SNOWFLAKE_METADATA,
)

GEOGRAPHY = create_sqlalchemy_type("GEOGRAPHY")
ischema_names["VARIANT"] = VARIANT
ischema_names["GEOGRAPHY"] = GEOGRAPHY

logger = ingestion_logger()


class SnowflakeSource(SQLSource):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    def get_databases(self) -> Iterable[Inspector]:
        if self.config.serviceConnection.__root__.config.database:
            yield from super().get_databases()
        else:
            query = "SHOW DATABASES"
            results = self.connection.execute(query)
            for res in results:
                row = list(res)
                if filter_by_database(
                    self.source_config.databaseFilterPattern, database_name=row[1]
                ):
                    self.status.filter(row[1], "Database pattern not allowed")
                    continue
                use_db_query = f"USE DATABASE {row[1]}"
                self.connection.execute(use_db_query)
                logger.info(f"Ingesting from database: {row[1]}")
                self.config.serviceConnection.__root__.config.database = row[1]
                self.engine = get_connection(self.service_connection)
                yield inspect(self.engine)

    def fetch_tags(self, schema, table_name: str, column_name: str = ""):
        try:
            result = self.connection.execute(
                FETCH_SNOWFLAKE_ALL_TAGS.format(table_name)
            )
        except Exception as err:
            logger.warning("Trying tags for tables with quotes")
            result = self.connection.execute(
                FETCH_SNOWFLAKE_ALL_TAGS.format(f'"{table_name}"')
            )
        tags = []
        for res in result:
            row = list(res)
            tag_category = row[2]
            primary_tag = row[3]
            if row[4] == "COLUMN" or column_name and row[9] != column_name:
                continue
            tags.append(
                OMetaTagAndCategory(
                    category_name=CreateTagCategoryRequest(
                        name=tag_category,
                        description="SNOWFLAKE TAG NAME",
                        categoryType="Descriptive",
                    ),
                    category_details=CreateTagRequest(
                        name=primary_tag, description="SNOWFLAKE TAG VALUE"
                    ),
                )
            )
            logger.info(
                f"Tag Category {tag_category}, Primary Tag {primary_tag} Ingested"
            )
        return tags

    def fetch_sample_data(self, schema: str, table: str) -> Optional[TableData]:
        resp_sample_data = super().fetch_sample_data(schema, table)
        if not resp_sample_data:
            try:
                logger.info("Using Table Name with quotes to fetch the data")
                query = self.source_config.sampleDataQuery.format(schema, f'"{table}"')
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
        return resp_sample_data

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SnowflakeConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SnowflakeConnection):
            raise InvalidSourceException(
                f"Expected SnowflakeConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def next_record(self) -> Iterable[Entity]:
        for inspector in self.get_databases():
            for schema in inspector.get_schema_names():
                try:
                    if filter_by_schema(
                        self.source_config.schemaFilterPattern, schema_name=schema
                    ):
                        self.status.filter(
                            f"{self.config.serviceName}.{self.service_connection.database}.{schema}",
                            "{} pattern not allowed".format("Schema"),
                        )
                        continue
                    self.connection.execute(
                        f"USE {self.service_connection.database}.{schema}"
                    )
                    yield from self.fetch_tables(inspector=inspector, schema=schema)
                    if self.source_config.markDeletedTables:
                        schema_fqdn = f"{self.config.serviceName}.{self.service_connection.database}.{schema}"
                        yield from self.delete_tables(schema_fqdn)
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.info(err)

    def add_tags_to_table(self, schema: str, table_name: str, table_entity):
        tag_category_list = self.fetch_tags(schema=schema, table_name=table_name)
        table_entity.tags = []
        for tags in tag_category_list:
            yield tags
            table_entity.tags.append(
                TagLabel(
                    tagFQN=get_fqdn(
                        Tag,
                        tags.category_name.name.__root__,
                        tags.category_details.name.__root__,
                    ),
                    labelType="Automated",
                    state="Suggested",
                    source="Tag",
                )
            )

    def fetch_tables(
        self,
        inspector: Inspector,
        schema: str,
    ) -> Iterable[Union[OMetaDatabaseAndTable, OMetaTagAndCategory]]:
        entities = inspector.get_table_names(schema)
        for table_name, entity_type, comment in entities:
            try:
                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=table_name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{self.service_connection.database}.{schema}.{table_name}",
                        "{} pattern not allowed".format(entity_type),
                    )
                    continue
                if entity_type == "VIEW" and not self.source_config.includeViews:
                    continue
                table_columns = self._get_columns(schema, table_name, inspector)
                view_definition = inspector.get_view_definition(table_name, schema)
                view_definition = (
                    "" if view_definition is None else str(view_definition)
                )
                table_entity = Table(
                    id=uuid.uuid4(),
                    name=table_name,
                    tableType="Regular" if entity_type == "Base Table" else "View",
                    description=comment,
                    columns=table_columns,
                    viewDefinition=view_definition,
                )
                yield from self.add_tags_to_table(
                    schema=schema, table_name=table_name, table_entity=table_entity
                )
                if self.source_config.generateSampleData:
                    table_data = self.fetch_sample_data(schema, table_name)
                    table_entity.sampleData = table_data
                if self.source_config.enableDataProfiler:
                    profile = self.run_profiler(table=table_entity, schema=schema)
                    table_entity.tableProfile = [profile] if profile else None
                database = self._get_database(self.service_connection.database)
                table_schema_and_db = OMetaDatabaseAndTable(
                    table=table_entity,
                    database=database,
                    database_schema=self._get_schema(schema, database),
                )
                self.register_record(table_schema_and_db)
                yield table_schema_and_db
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)


def get_table_names(self, connection, schema, **kw):
    result = connection.execute(FETCH_SNOWFLAKE_METADATA.format(schema))
    return result.fetchall()


@reflection.cache
def _get_table_comment(self, connection, table_name, schema=None, **kw):
    """
    Returns comment of table.
    """
    sql_command = "select * FROM information_schema.tables WHERE TABLE_SCHEMA ILIKE '{}' and TABLE_NAME ILIKE '{}'".format(
        self.normalize_name(schema),
        table_name,
    )

    cursor = connection.execute(text(sql_command))
    return cursor.fetchone()  # pylint: disable=protected-access


@reflection.cache
def get_unique_constraints(self, connection, table_name, schema=None, **kw):
    return []


def normalize_names(self, name):
    return name


SnowflakeDialect.get_table_names = get_table_names
SnowflakeDialect.normalize_name = normalize_names
SnowflakeDialect._get_table_comment = _get_table_comment
SnowflakeDialect.get_unique_constraints = get_unique_constraints
