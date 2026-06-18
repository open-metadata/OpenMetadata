#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Salesforce Data 360 metadata ingestion source
"""

import traceback
from collections.abc import Iterable
from typing import Any

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.generated.schema.entity.services.connections.database.data360Connection import (
    Data360Connection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SqlQuery,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_test_connection_fn
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.data360.client import (
    get_calculated_insight_by_name,
    get_dataspaces,
    get_metadata_by_type,
)
from metadata.ingestion.source.database.data360.connection import get_connection
from metadata.ingestion.source.database.data360.constant import (
    Constant,
    MetadataTypesConstant,
    ResponseConstant,
)
from metadata.ingestion.source.database.data360.utils import (
    combine_ci_fields,
    get_metadata_type,
    get_table_constraints,
    get_table_partition,
)
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_table
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

DATA360_TABLE_TYPE_MAP = {
    MetadataTypesConstant.DATA_LAKE_OBJECT: TableType.Regular,
    MetadataTypesConstant.DATA_MODEL_OBJECT: TableType.Regular,
    MetadataTypesConstant.CALCULATED_INSIGHT: TableType.View,
}


class Data360Source(DatabaseServiceSource):
    """
    Extracts metadata from Salesforce Data 360 (formerly DataCloud):
    dataspaces → databases, DLO/DMO/CIO schemas → schemas, objects → tables.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config

        self.dataspace_map: dict = {}
        self.table_map: dict = {}
        self.client = get_connection(self.service_connection)
        self.table_constraints = None
        self.database_source_state: set = set()
        self.test_connection()

    @classmethod
    def create(
        cls, config_dict: Any, metadata: OpenMetadata, pipeline_name: str | None = None
    ) -> "Data360Source":
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: Data360Connection = config.serviceConnection.root.config
        if not isinstance(connection, Data360Connection):
            raise InvalidSourceException(
                f"Expected Data360Connection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        """Yields dataspace names as database names."""
        dataspaces = get_dataspaces(
            self.client,
            limit=self.service_connection.paginationLimit,
            log_warning=self.log_warning,
        )
        for dataspace in dataspaces:
            dataspace_name = dataspace.get(ResponseConstant.NAME)
            if filter_by_database(
                self.source_config.databaseFilterPattern, dataspace_name
            ):
                self.status.filter(dataspace_name, "Database Filtered Out")
                continue
            self.dataspace_map[dataspace_name] = dataspace
            yield dataspace_name

    def yield_database_tag(
        self, database_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Yields classification tags derived from the dataspace status."""
        try:
            dataspace = self.dataspace_map.get(database_name)
            status = dataspace.get(ResponseConstant.STATUS)
            tags = [status] if status else []
            yield from get_ometa_tag_and_classification(
                tag_fqn=fqn.build(
                    self.metadata,
                    Database,
                    service_name=self.context.get().database_service,
                    database_name=database_name,
                ),
                tags=tags,
                classification_name=Constant.TAG_CLASSIFICATION_NAME,
                tag_description=ResponseConstant.STATUS,
                classification_description=Constant.TAG_CLASSIFICATION_DESCRIPTION,
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{database_name} Database Tag",
                    error=f"Unexpected error while yielding tags for dataspace {database_name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        """Yields a CreateDatabaseRequest for each dataspace."""
        try:
            dataspace = self.dataspace_map.get(database_name)
            status = dataspace.get(ResponseConstant.STATUS)
            yield Either(
                right=CreateDatabaseRequest(
                    name=database_name,
                    displayName=dataspace.get(ResponseConstant.LABEL),
                    description=dataspace.get(ResponseConstant.DESCRIPTION),
                    tags=get_tag_labels(
                        self.metadata,
                        [status] if status else [],
                        Constant.TAG_CLASSIFICATION_NAME,
                        self.source_config.includeTags,
                    ),
                    service=FullyQualifiedEntityName(
                        self.context.get().database_service
                    ),
                )
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{database_name} Database",
                    error=f"Unexpected error while yielding dataspace {database_name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_database_schema_names(self) -> Iterable[str]:
        """Yields the three fixed schema names for DLO, DMO, and CIO."""
        yield from [
            Constant.DATA_LAKE_OBJECTS,
            Constant.DATA_MODEL_OBJECTS,
            Constant.CALCULATED_INSIGHTS,
        ]

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """Yields a CreateDatabaseSchemaRequest for each DataCloud object category."""
        try:
            yield Either(
                right=CreateDatabaseSchemaRequest(
                    name=EntityName(schema_name),
                    database=FullyQualifiedEntityName(
                        fqn.build(
                            metadata=self.metadata,
                            entity_type=Database,
                            service_name=self.context.get().database_service,
                            database_name=self.context.get().database,
                        )
                    ),
                )
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{schema_name} Database Schema",
                    error=f"Unexpected error while yielding schema {schema_name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_tables_name_and_type(
        self,
    ) -> Iterable[tuple[str, str]] | None:
        """Fetches DataCloud objects and yields (name, metadata_type) tuples."""
        dataspace_name = self.context.get().database
        schema_name = self.context.get().database_schema
        metadata_type = get_metadata_type(schema_name)
        metadata_res = get_metadata_by_type(
            client=self.client,
            entity_type=metadata_type,
            dataspace_name=dataspace_name,
            log_warning=self.log_warning,
        )
        if not metadata_res:
            return

        for datacloud_object in metadata_res.get(ResponseConstant.METADATA, []):
            table_name = datacloud_object.get(ResponseConstant.NAME)
            table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=self.context.get().database_service,
                database_name=dataspace_name,
                schema_name=schema_name,
                table_name=table_name,
            )
            filter_value = (
                table_fqn
                if self.config.sourceConfig.config.useFqnForFiltering
                else table_name
            )
            if filter_by_table(
                self.config.sourceConfig.config.tableFilterPattern, filter_value
            ):
                self.status.filter(table_fqn, "Table Filtered Out")
                continue
            self.table_map[table_fqn] = datacloud_object
            yield table_name, metadata_type

    def yield_table(
        self, table_name_and_type: tuple[str, str]
    ) -> Iterable[Either[CreateTableRequest]]:
        """Yields a CreateTableRequest for each DataCloud object."""
        try:
            table_name, table_type = table_name_and_type
            table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=self.context.get().database_service,
                database_name=self.context.get().database,
                schema_name=self.context.get().database_schema,
                table_name=table_name,
            )
            table = self.table_map.get(table_fqn)
            ci_expression = None
            description = None

            if table_type == MetadataTypesConstant.CALCULATED_INSIGHT:
                combine_ci_fields(table)
                if ResponseConstant.PARTITION_BY in table:
                    table[Constant.TABLE_PARTITION] = get_table_partition(
                        partition_by=table.get(ResponseConstant.PARTITION_BY)
                    )
                ci_details = get_calculated_insight_by_name(
                    self.client, table_name, self.log_warning
                )
                if ci_details:
                    ci_expression = SqlQuery(
                        root=ci_details.get(ResponseConstant.EXPRESSION)
                    )
                    description = ci_details.get(ResponseConstant.DESCRIPTION)
            else:
                table[Constant.TABLE_CONSTRAINTS] = get_table_constraints(
                    table.get(ResponseConstant.PRIMARY_KEYS, [])
                )
                category = table.get(ResponseConstant.CATEGORY)
                table[Constant.TAGS] = get_tag_labels(
                    self.metadata,
                    [category] if category else [],
                    Constant.TAG_CLASSIFICATION_NAME,
                    self.source_config.includeTags,
                )

            table_request = CreateTableRequest(
                name=table_name,
                tableType=DATA360_TABLE_TYPE_MAP.get(table_type, TableType.Regular),
                columns=self.get_columns(table.get(ResponseConstant.FIELDS, [])),
                displayName=table.get(ResponseConstant.DISPLAY_NAME),
                description=description,
                tablePartition=table.get(Constant.TABLE_PARTITION),
                tableConstraints=table.get(Constant.TABLE_CONSTRAINTS),
                tags=table.get(Constant.TAGS, []),
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                    )
                ),
                schemaDefinition=ci_expression,
            )
            yield Either(right=table_request)
            self.register_record(table_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{table_name_and_type[0]} Table",
                    error=f"Unexpected error while yielding table {table_name_and_type}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_columns(self, fields: list) -> list:
        """Builds Column objects from DataCloud field definitions."""
        columns = []
        for ordinal, column in enumerate(fields, start=1):
            columns.append(
                Column(
                    name=column[ResponseConstant.NAME],
                    displayName=column[ResponseConstant.DISPLAY_NAME],
                    dataType=ColumnTypeParser.get_column_type(
                        column[ResponseConstant.TYPE]
                    ),
                    tags=get_tag_labels(
                        self.metadata,
                        [column.get(Constant.FIELD_TYPE)]
                        if column.get(Constant.FIELD_TYPE)
                        else [],
                        Constant.TAG_CLASSIFICATION_NAME,
                        self.source_config.includeTags,
                    ),
                    dataTypeDisplay=column[ResponseConstant.BUSINESS_TYPE],
                    ordinalPosition=ordinal,
                )
            )
        return columns

    def yield_table_tags(
        self, table_name_and_type: tuple[str, str]
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Yields classification tags for non-CIO table types."""
        try:
            table_name, table_type = table_name_and_type
            if table_type == MetadataTypesConstant.CALCULATED_INSIGHT:
                return
            table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=self.context.get().database_service,
                database_name=self.context.get().database,
                schema_name=self.context.get().database_schema,
                table_name=table_name,
            )
            table = self.table_map.get(table_fqn)
            category = table.get(ResponseConstant.CATEGORY)
            tags = [t for t in [category, Constant.MEASURE, Constant.DIMENSION] if t]
            yield from get_ometa_tag_and_classification(
                tag_fqn=fqn.build(
                    self.metadata,
                    Database,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                ),
                tags=tags,
                classification_name=Constant.TAG_CLASSIFICATION_NAME,
                tag_description=ResponseConstant.CATEGORY,
                classification_description=Constant.TAG_CLASSIFICATION_DESCRIPTION,
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{table_name_and_type[0]} table tags",
                    error=f"Unexpected error while yielding tags for table {table_name_and_type[0]}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def log_warning(self, msg: str) -> None:
        logger.warning(msg)
        self.status.warning(msg, reason=msg)

    def get_stored_procedures(self):
        """Not implemented for Data Cloud."""

    def yield_procedure_lineage_and_queries(self):
        """Not implemented for Data Cloud."""

    def yield_stored_procedure(self, stored_procedure):
        """Not implemented for Data Cloud."""

    def yield_tag(self, schema_name):
        """Not implemented for Data Cloud."""

    def yield_view_lineage(self):
        """Not implemented for Data Cloud."""

    def close(self):
        """Nothing to close."""

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.metadata, self.client, self.service_connection)
