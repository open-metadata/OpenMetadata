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
from typing import TYPE_CHECKING, Any, cast

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.data360Connection import (
    Data360Connection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SqlQuery,
)
from metadata.ingestion.api.delete import delete_entity_from_source
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
    DEFAULT_PAGINATION_LIMIT,
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

if TYPE_CHECKING:
    from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
        DatabaseServiceMetadataPipeline,
    )

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

    service_connection: Data360Connection

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config = cast("DatabaseServiceMetadataPipeline", self.config.sourceConfig.config)
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config  # pyright: ignore[reportOptionalMemberAccess,reportAttributeAccessIssue]

        self.dataspace_map: dict = {}
        self.table_map: dict = {}
        self.client = get_connection(self.service_connection)
        self.table_constraints = None
        self.database_source_state: set = set()
        # Schemas whose table discovery failed this run. Deletion reconciliation
        # must skip these, otherwise a transient API failure (zero tables seen)
        # would be mistaken for "every table in this schema was removed".
        self.failed_schema_fqns: set[str] = set()
        self.test_connection()

    @classmethod
    def create(cls, config_dict: Any, metadata: OpenMetadata, pipeline_name: str | None = None) -> "Data360Source":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config if config.serviceConnection else None
        if not isinstance(connection, Data360Connection):
            raise InvalidSourceException(f"Expected Data360Connection, but got {connection}")
        return cls(config, metadata)

    @property
    def pagination_limit(self) -> int:
        """Page size for every Data 360 listing call."""
        return self.service_connection.paginationLimit or DEFAULT_PAGINATION_LIMIT

    # The topology context holds entity names as attributes created at runtime, so
    # they are read through these accessors instead of ignoring the diagnostic at
    # every one of the ~20 call sites below.
    @property
    def _service_name(self) -> str:
        return self.context.get().database_service  # pyright: ignore[reportAttributeAccessIssue]

    @property
    def _database_name(self) -> str:
        return self.context.get().database  # pyright: ignore[reportAttributeAccessIssue]

    @property
    def _schema_name(self) -> str:
        return self.context.get().database_schema  # pyright: ignore[reportAttributeAccessIssue]

    def _build_fqn(self, entity_type: type, **parts: Any) -> str:
        """`fqn.build` is typed as optional, but every call here supplies all of an
        entity's parts, so an empty FQN is a bug rather than a state to propagate."""
        built = fqn.build(self.metadata, entity_type=entity_type, **parts)
        if not built:
            raise ValueError(f"Could not build {entity_type.__name__} FQN from {parts}")
        return built

    def get_database_names(self) -> Iterable[str]:
        """Yields dataspace names as database names."""
        dataspaces = get_dataspaces(
            self.client,
            limit=self.pagination_limit,
            log_warning=self.log_warning,
        )
        for dataspace in dataspaces:
            dataspace_name = dataspace.get(ResponseConstant.NAME)
            if not dataspace_name:
                self.log_warning(f"Skipping Data 360 dataspace with no name: {dataspace}")
                continue
            if filter_by_database(self.source_config.databaseFilterPattern, dataspace_name):
                self.status.filter(dataspace_name, "Database Filtered Out")
                continue
            self.dataspace_map[dataspace_name] = dataspace
            yield dataspace_name

    def yield_database_tag(self, database_name: str) -> Iterable[Either[OMetaTagAndClassification]]:
        """Yields classification tags derived from the dataspace status."""
        try:
            dataspace = self.dataspace_map.get(database_name, {})
            status = dataspace.get(ResponseConstant.STATUS)
            yield from get_ometa_tag_and_classification(
                tag_fqn=FullyQualifiedEntityName(
                    self._build_fqn(
                        Database,
                        service_name=self._service_name,
                        database_name=database_name,
                    )
                ),
                tags=[status] if status else [],
                classification_name=Constant.TAG_CLASSIFICATION_NAME,
                tag_description=ResponseConstant.STATUS,
                classification_description=Constant.TAG_CLASSIFICATION_DESCRIPTION,
            )
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{database_name} Database Tag",
                    error=f"Unexpected error while yielding tags for dataspace {database_name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_database(self, database_name: str) -> Iterable[Either[CreateDatabaseRequest]]:
        """Yields a CreateDatabaseRequest for each dataspace."""
        try:
            dataspace = self.dataspace_map.get(database_name, {})
            status = dataspace.get(ResponseConstant.STATUS)
            yield Either(  # pyright: ignore[reportCallIssue]
                right=CreateDatabaseRequest(
                    name=EntityName(database_name),
                    displayName=dataspace.get(ResponseConstant.LABEL),
                    description=dataspace.get(ResponseConstant.DESCRIPTION),
                    tags=get_tag_labels(
                        self.metadata,
                        [status] if status else [],
                        Constant.TAG_CLASSIFICATION_NAME,
                        bool(self.source_config.includeTags),
                    ),
                    service=FullyQualifiedEntityName(self._service_name),
                )
            )
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
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

    def yield_database_schema(self, schema_name: str) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """Yields a CreateDatabaseSchemaRequest for each DataCloud object category."""
        try:
            yield Either(  # pyright: ignore[reportCallIssue]
                right=CreateDatabaseSchemaRequest(
                    name=EntityName(schema_name),
                    database=FullyQualifiedEntityName(
                        self._build_fqn(
                            Database,
                            service_name=self._service_name,
                            database_name=self._database_name,
                        )
                    ),
                )
            )
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{schema_name} Database Schema",
                    error=f"Unexpected error while yielding schema {schema_name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_tables_name_and_type(self) -> Iterable[tuple[str, TableType]] | None:
        """Fetches DataCloud objects for the current schema and yields (name, type)."""
        dataspace_name = self._database_name
        schema_name = self._schema_name
        metadata_type = get_metadata_type(schema_name)
        if metadata_type is None:
            self.log_warning(f"No Data 360 object category maps to schema {schema_name}; skipping its tables")
            return
        table_type = DATA360_TABLE_TYPE_MAP.get(metadata_type, TableType.Regular)
        schema_fqn = self._build_fqn(
            DatabaseSchema,
            service_name=self._service_name,
            database_name=dataspace_name,
            schema_name=schema_name,
        )
        try:
            metadata_items = get_metadata_by_type(
                client=self.client,
                entity_type=metadata_type,
                dataspace_name=dataspace_name,
                pagination_limit=self.pagination_limit,
                log_warning=self.log_warning,
            )
        except Exception as exc:
            # Record the failure so `mark_tables_as_deleted` can skip this
            # schema instead of soft-deleting every table it already ingested.
            self.failed_schema_fqns.add(schema_fqn)
            self.status.failed(
                StackTraceError(
                    name=f"{schema_name} Tables",
                    error=f"Unexpected error while fetching tables for {dataspace_name}.{schema_name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
            return

        for datacloud_object in metadata_items:
            table_name = datacloud_object.get(ResponseConstant.NAME)
            if not table_name:
                self.log_warning(f"Skipping Data 360 {metadata_type} with no name in {dataspace_name}.{schema_name}")
                continue
            table_fqn = self._build_fqn(
                Table,
                service_name=self._service_name,
                database_name=dataspace_name,
                schema_name=schema_name,
                table_name=table_name,
            )
            filter_value = table_fqn if self.source_config.useFqnForFiltering else table_name
            if filter_by_table(self.source_config.tableFilterPattern, filter_value):
                self.status.filter(table_fqn, "Table Filtered Out")
                continue
            self.table_map[table_fqn] = datacloud_object
            yield table_name, table_type

    def yield_table(self, table_name_and_type: tuple[str, TableType]) -> Iterable[Either[CreateTableRequest]]:
        """Yields a CreateTableRequest for each DataCloud object."""
        table_name, table_type = table_name_and_type
        try:
            table_fqn = self._build_fqn(
                Table,
                service_name=self._service_name,
                database_name=self._database_name,
                schema_name=self._schema_name,
                table_name=table_name,
            )
            table = self.table_map.get(table_fqn)
            if table is None:
                self.log_warning(f"No Data 360 object was cached for {table_fqn}; skipping table")
                return
            ci_expression = None
            description = None

            if get_metadata_type(self._schema_name) == MetadataTypesConstant.CALCULATED_INSIGHT:
                combine_ci_fields(table)
                if ResponseConstant.PARTITION_BY in table:
                    table[Constant.TABLE_PARTITION] = get_table_partition(
                        partition_by=table.get(ResponseConstant.PARTITION_BY)
                    )
                ci_details = get_calculated_insight_by_name(self.client, table_name, self.log_warning)
                if ci_details:
                    expression = ci_details.get(ResponseConstant.EXPRESSION)
                    ci_expression = SqlQuery(root=expression) if expression else None
                    description = ci_details.get(ResponseConstant.DESCRIPTION)
            else:
                table[Constant.TABLE_CONSTRAINTS] = get_table_constraints(table.get(ResponseConstant.PRIMARY_KEYS, []))
                category = table.get(ResponseConstant.CATEGORY)
                table[Constant.TAGS] = get_tag_labels(
                    self.metadata,
                    [category] if category else [],
                    Constant.TAG_CLASSIFICATION_NAME,
                    bool(self.source_config.includeTags),
                )

            table_request = CreateTableRequest(
                name=EntityName(table_name),
                tableType=table_type,
                columns=self.get_columns(table.get(ResponseConstant.FIELDS, [])),
                displayName=table.get(ResponseConstant.DISPLAY_NAME),
                description=description,
                tablePartition=table.get(Constant.TABLE_PARTITION),
                tableConstraints=table.get(Constant.TABLE_CONSTRAINTS),
                tags=table.get(Constant.TAGS, []),
                databaseSchema=FullyQualifiedEntityName(
                    self._build_fqn(
                        DatabaseSchema,
                        service_name=self._service_name,
                        database_name=self._database_name,
                        schema_name=self._schema_name,
                    )
                ),
                schemaDefinition=ci_expression,
            )
            yield Either(right=table_request)  # pyright: ignore[reportCallIssue]
            self.register_record(table_request)
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{table_name} Table",
                    error=f"Unexpected error while yielding table {table_name_and_type}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_columns(self, fields: list) -> list[Column]:
        """Builds Column objects from DataCloud field definitions."""
        columns = []
        for ordinal, column in enumerate(fields, start=1):
            columns.append(
                Column(
                    name=ColumnName(column[ResponseConstant.NAME]),
                    displayName=column[ResponseConstant.DISPLAY_NAME],
                    dataType=DataType(ColumnTypeParser.get_column_type(column[ResponseConstant.TYPE])),
                    tags=get_tag_labels(
                        self.metadata,
                        [column.get(Constant.FIELD_TYPE)] if column.get(Constant.FIELD_TYPE) else [],
                        Constant.TAG_CLASSIFICATION_NAME,
                        bool(self.source_config.includeTags),
                    ),
                    dataTypeDisplay=column[ResponseConstant.BUSINESS_TYPE],
                    ordinalPosition=ordinal,
                )
            )
        return columns

    def yield_table_tags(
        self, table_name_and_type: tuple[str, TableType]
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Yields classification tags for non-CIO table types."""
        table_name, _ = table_name_and_type
        try:
            if get_metadata_type(self._schema_name) == MetadataTypesConstant.CALCULATED_INSIGHT:
                return
            table_fqn = self._build_fqn(
                Table,
                service_name=self._service_name,
                database_name=self._database_name,
                schema_name=self._schema_name,
                table_name=table_name,
            )
            table = self.table_map.get(table_fqn, {})
            category = table.get(ResponseConstant.CATEGORY)
            tags = [t for t in [category, Constant.MEASURE, Constant.DIMENSION] if t]
            yield from get_ometa_tag_and_classification(
                tag_fqn=FullyQualifiedEntityName(
                    self._build_fqn(
                        Database,
                        service_name=self._service_name,
                        database_name=self._database_name,
                    )
                ),
                tags=tags,
                classification_name=Constant.TAG_CLASSIFICATION_NAME,
                tag_description=ResponseConstant.CATEGORY,
                classification_description=Constant.TAG_CLASSIFICATION_DESCRIPTION,
            )
        except Exception as exc:
            yield Either(  # pyright: ignore[reportCallIssue]
                left=StackTraceError(
                    name=f"{table_name} table tags",
                    error=f"Unexpected error while yielding tags for table {table_name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def log_warning(self, msg: str) -> None:
        logger.warning(msg)
        self.status.warning(msg, reason=msg)

    def mark_tables_as_deleted(self):
        """Marks tables as deleted, skipping any schema whose table discovery failed
        this run. For those schemas "no tables fetched" means the Data 360 API call
        failed, not that every table in the schema was removed, and reconciling
        against an empty listing would soft-delete the whole schema.
        """
        if not self.context.get().__dict__.get("database"):
            raise ValueError("No Database found in the context. We cannot run the table deletion.")

        if not self.source_config.markDeletedTables:
            return

        logger.info(f"Mark Deleted Tables set to True. Processing database [{self._database_name}]")
        for schema_fqn in self._get_filtered_schema_names(return_fqn=True, add_to_status=False):
            if schema_fqn in self.failed_schema_fqns:
                logger.warning(
                    f"Skipping table deletion for schema [{schema_fqn}]: its table discovery failed "
                    "this run, so an empty listing is not evidence that its tables were removed."
                )
                continue
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=Table,
                entity_source_state=self.database_source_state,
                recursive=self.source_config.markDeletedTables,
                params={"databaseSchema": schema_fqn},
            )

    def get_stored_procedures(self) -> Iterable[Any]:
        """Not implemented for Data Cloud."""
        return iter([])

    def yield_procedure_lineage_and_queries(self) -> Iterable[Either[Any]]:
        """Not implemented for Data Cloud."""
        return iter([])

    def yield_stored_procedure(self, stored_procedure: Any) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Not implemented for Data Cloud."""
        return iter([])

    def yield_tag(self, schema_name: str) -> Iterable[Either[OMetaTagAndClassification]]:
        """Not implemented for Data Cloud."""
        return iter([])

    def yield_view_lineage(self) -> Iterable[Either[Any]]:
        """Not implemented for Data Cloud."""
        return iter([])

    def close(self):
        """Nothing to close."""

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.metadata, self.client, self.service_connection)
