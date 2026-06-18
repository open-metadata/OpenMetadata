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
Databricks Unity Catalog Source source methods.
"""

import json
import traceback
from threading import RLock
from typing import Any, Iterable, List, Optional, Tuple  # noqa: UP035

from databricks.sdk.service.catalog import ColumnInfo
from databricks.sdk.service.catalog import TableConstraint as DBTableConstraint
from sqlalchemy import text
from sqlalchemy.engine import Connection

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
    ConstraintType,
    Table,
    TableConstraint,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,  # noqa: TC001
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.delete import delete_entity_by_name
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.databricks.client import DatabricksClient
from metadata.ingestion.source.database.databricks.ownership import (
    DatabricksOwnerResolver,
)
from metadata.ingestion.source.database.external_table_lineage_mixin import (
    ExternalTableLineageMixin,
)
from metadata.ingestion.source.database.incremental_metadata_extraction import (
    IncrementalConfig,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.ingestion.source.database.stored_procedures_mixin import QueryByProcedure
from metadata.ingestion.source.database.unitycatalog.connection import (
    get_connection,
    get_sqlalchemy_connection,
)
from metadata.ingestion.source.database.unitycatalog.incremental_table_processor import (
    UnityCatalogIncrementalTableProcessor,
)
from metadata.ingestion.source.database.unitycatalog.models import (
    ColumnJson,
    ElementType,
    ForeignConstrains,
    Type,
)
from metadata.ingestion.source.database.unitycatalog.queries import (
    UNITY_CATALOG_GET_ALL_SCHEMA_TAGS,
    UNITY_CATALOG_GET_ALL_TABLE_COLUMNS_TAGS,
    UNITY_CATALOG_GET_ALL_TABLE_TAGS,
    UNITY_CATALOG_GET_CATALOGS_TAGS,
    UNITY_CATALOG_GET_TABLE_DDL, UNITY_CATALOG_TABLE_CONSTRAINTS,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification

logger = ingestion_logger()

UNITY_CATALOG_TAG = "UNITY CATALOG TAG"
UNITY_CATALOG_TAG_CLASSIFICATION = "UNITY CATALOG TAG CLASSIFICATION"
UNITY_CATALOG_VALUELESS_CLASSIFICATION = "UNITY_CATALOG_TAGS"
UNITY_CATALOG_VALUELESS_CLASSIFICATION_DESCRIPTION = "Unity Catalog tags ingested as key-only (no associated value)."


# pylint: disable=protected-access
class UnitycatalogSource(ExternalTableLineageMixin, DatabaseServiceSource, MultiDBSource):
    """
    Implements the necessary methods to extract
    Database metadata from Databricks Source using
    the unity catalog source
    """

    @retry_with_docker_host()
    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
        incremental_configuration: IncrementalConfig,
    ):
        super().__init__()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = self.config.sourceConfig.config
        self.context.set_threads(self.source_config.threads)
        self.metadata = metadata
        self.service_connection: UnityCatalogConnection = self.config.serviceConnection.root.config
        self._state_lock = RLock()
        self.external_location_map = {}
        self.client = get_connection(self.service_connection)
        self.connection_obj = self.client
        self.table_constraints = []
        self.context.storage_location = None
        # Caches to avoid redundant API calls (N+1 optimization)
        self._catalog_cache: dict[str, Any] = {}
        self._schema_cache: dict[tuple[str, str], Any] = {}
        self.owner_resolver = DatabricksOwnerResolver(
            api_client=DatabricksClient(self.service_connection),
            metadata=self.metadata,
            include_owners=self.source_config.includeOwners,
        )

        self.incremental = incremental_configuration
        self.incremental_table_processor: UnityCatalogIncrementalTableProcessor | None = None
        self.context.get_global().deleted_tables = []  # pyright: ignore[reportAttributeAccessIssue]
        if self.incremental.enabled:
            logger.info(
                "Starting Incremental Metadata Extraction.\n\t Considering Table changes from %s",
                self.incremental.start_datetime_utc,
            )

        self.test_connection()

        self._sql_connection_map = {}
        self.engine = get_sqlalchemy_connection(self.service_connection)

    @property
    def sql_connection(self) -> Connection:
        """
        Return the SQLAlchemy connection
        """
        thread_id = self.context.get_current_thread_id()

        with self._state_lock:
            if not self._sql_connection_map.get(thread_id):
                self._sql_connection_map[thread_id] = self.engine.connect()

            return self._sql_connection_map[thread_id]

    def get_configured_database(self) -> Optional[str]:  # noqa: UP045
        return self.service_connection.catalog

    def get_database_names_raw(self) -> Iterable[str]:
        for catalog in self.client.catalogs.list():
            catalog_name = catalog.name
            if not catalog_name:
                continue
            # Cache the catalog object to avoid re-fetching in yield_database
            with self._state_lock:
                self._catalog_cache[catalog_name] = catalog
            yield catalog_name

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: UnityCatalogConnection = config.serviceConnection.root.config
        if not isinstance(connection, UnityCatalogConnection):
            raise InvalidSourceException(f"Expected UnityCatalogConnection, but got {connection}")
        incremental_config = IncrementalConfig.create(config.sourceConfig.config.incremental, pipeline_name, metadata)  # pyright: ignore[reportArgumentType, reportAttributeAccessIssue, reportOptionalMemberAccess]
        return cls(config, metadata, incremental_config)

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.

        Catalog ID -> Database
        """
        if self.service_connection.catalog:
            configured_catalog = self.service_connection.catalog
            try:
                logger.debug(f"Fetching configured catalog [{configured_catalog}] details to cache for later use")
                catalog = self.client.catalogs.get(configured_catalog)
                with self._state_lock:
                    self._catalog_cache[configured_catalog] = catalog
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Failed to fetch configured catalog [{configured_catalog}]: {exc}")
            self._set_incremental_table_processor(configured_catalog)
            yield configured_catalog
        else:
            for catalog_name in self.get_database_names_raw():
                try:
                    database_fqn = fqn.build(
                        self.metadata,
                        entity_type=Database,
                        service_name=self.context.get().database_service,
                        database_name=catalog_name,
                    )
                    if filter_by_database(
                        self.config.sourceConfig.config.databaseFilterPattern,  # pyright: ignore[reportAttributeAccessIssue]
                        (database_fqn if self.config.sourceConfig.config.useFqnForFiltering else catalog_name),  # pyright: ignore[reportAttributeAccessIssue]
                    ):
                        with self._state_lock:
                            self._catalog_cache.pop(catalog_name, None)
                        self.status.filter(
                            database_fqn,
                            "Database (Catalog ID) Filtered Out",
                        )
                        continue
                    self._set_incremental_table_processor(catalog_name)
                    yield catalog_name
                except Exception as exc:
                    self.status.failed(
                        StackTraceError(
                            name=catalog_name,
                            error=f"Unexpected exception to get database name [{catalog_name}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def _set_incremental_table_processor(self, catalog: str) -> None:
        """Prepare the changed/deleted table maps for incremental extraction of a catalog."""
        if self.incremental.enabled:
            incremental_table_processor = UnityCatalogIncrementalTableProcessor.create(self.sql_connection)
            incremental_table_processor.set_table_map(
                catalog=catalog,
                start_timestamp=self.incremental.start_timestamp,  # pyright: ignore[reportArgumentType]
            )
            with self._state_lock:
                self.incremental_table_processor = incremental_table_processor


    def yield_database(self, database_name: str) -> Iterable[Either[CreateDatabaseRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """
        with self._state_lock:
            catalog = self._catalog_cache.pop(database_name, None)
        database_request = CreateDatabaseRequest(
            name=database_name,
            service=self.context.get().database_service,
            owners=self.get_owner_ref(getattr(catalog, "owner", None)),
            description=getattr(catalog, "comment", None),
            tags=self.get_database_tag_labels(database_name),
        )
        yield Either(right=database_request)
        self.register_record_database_request(database_request=database_request)

    def get_database_schema_names(self) -> Iterable[str]:
        """
        return schema names
        """
        catalog_name = self.context.get().database
        for schema in self.client.schemas.list(catalog_name=catalog_name):
            try:
                schema_name = schema.name
                if not schema_name:
                    continue
                schema_fqn = fqn.build(
                    self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=schema_name,
                )
                if filter_by_schema(
                    self.config.sourceConfig.config.schemaFilterPattern,  # pyright: ignore[reportAttributeAccessIssue]
                    (schema_fqn if self.config.sourceConfig.config.useFqnForFiltering else schema_name),  # pyright: ignore[reportAttributeAccessIssue]
                ):
                    self.status.filter(schema_fqn, "Schema Filtered Out")
                    continue
                schema_cache_key = (catalog_name, schema_name)
                with self._state_lock:
                    self._schema_cache[schema_cache_key] = schema
                yield schema_name
            except Exception as exc:
                self.status.failed(
                    StackTraceError(
                        name=schema.name,
                        error=f"Unexpected exception to get database schema [{schema.name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_database_schema(self, schema_name: str) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """
        database_name = self.context.get().database  # pyright: ignore[reportAttributeAccessIssue]
        schema_cache_key = (database_name, schema_name)
        with self._state_lock:
            schema = self._schema_cache.pop(schema_cache_key, None)
        schema_request = CreateDatabaseSchemaRequest(
            name=EntityName(schema_name),
            database=FullyQualifiedEntityName(
                fqn.build(
                    metadata=self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                )
            ),
            description=getattr(schema, "comment", None),
            owners=self.get_owner_ref(getattr(schema, "owner", None)),
            tags=self.get_schema_tag_labels(schema_name),
        )
        yield Either(right=schema_request)
        self.register_record_schema_request(schema_request=schema_request)

    def _get_tables_with_constraints(self) -> set[tuple[str, str, str]]:
        """
        Build and execute SQL query to fetch table constraints.
        Handles cases where catalog_name and/or schema_name may be None.
        """
        schema_name = self.context.get().database_schema
        catalog_name = self.context.get().database
        tables_with_constraints = set()
        if catalog_name is None or schema_name is None:
            return tables_with_constraints

        sql = UNITY_CATALOG_TABLE_CONSTRAINTS
        params = {}

        if catalog_name is not None:
            sql += " AND table_catalog = :catalog_name"
            params["catalog_name"] = catalog_name
        if schema_name is not None:
            sql += " AND table_schema = :schema_name"
            params["schema_name"] = schema_name

        try:
            cursor = self.sql_connection.execute(text(sql), params)
            for row in cursor:
                table_identifier = (row.table_catalog, row.table_schema, row.table_name)
                tables_with_constraints.add(table_identifier)
                logger.debug(f"Table with constraints: {table_identifier}")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error fetching table constraints for catalog [{catalog_name}], schema [{schema_name}]: {exc}"
            )
        return tables_with_constraints

    def get_tables_name_and_type(self) -> Iterable[Tuple[str, TableType]]:  # noqa: UP006
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        In incremental mode, only the tables changed since the watermark are
        fetched and processed; in full mode every table is listed.

        :return: tables or views, depending on config
        """
        schema_name = self.context.get().database_schema
        catalog_name = self.context.get().database
        if self.incremental.enabled and self.incremental_table_processor:
            yield from self._get_incremental_tables(catalog_name, schema_name)
        else:
            table_with_constraints = self._get_tables_with_constraints()
            for table in self.client.tables.list(
                catalog_name=catalog_name,
                schema_name=schema_name,
            ):
                if (table.catalog_name, table.schema_name, table.name) in table_with_constraints:
                    # Only tables with constraints require full fetch; list() doesn't include constraint details
                    try:
                        table = self.client.tables.get(table.full_name)
                    except Exception as exc:
                        msg = (
                            f"Unexpected exception in fetching constraints "
                            f"Constraints will be ignored."
                            f"table [{table.full_name}]: {exc}."
                        )
                        logger.warning(msg)
                        self.status.warning(table.name, msg)
                yield from self._process_table(table, catalog_name, schema_name)

    def _get_incremental_tables(self, catalog_name: str, schema_name: str) -> Iterable[Tuple[str, TableType]]:  # noqa: UP006
        """Record deleted tables and yield only the tables changed since the watermark."""
        processor = self.incremental_table_processor
        if processor is None:
            return
        changed = processor.get_changed(schema_name)
        # A name in both sets was dropped and recreated within the window.
        # information_schema only lists existing tables, so a changed table
        # exists now and must not be marked deleted.
        deleted_table_fqns = [
            fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                database_name=catalog_name,
                schema_name=schema_name,
                table_name=table_name,
            )
            for table_name in processor.get_deleted(schema_name) - changed
        ]
        with self._state_lock:
            self.context.get_global().deleted_tables.extend(  # pyright: ignore[reportAttributeAccessIssue]
                deleted_table_fqns
            )
        for table_name in changed:
            try:
                table = self.client.tables.get(f"{catalog_name}.{schema_name}.{table_name}")
            except Exception as exc:
                self.status.failed(
                    StackTraceError(
                        name=table_name,
                        error=f"Unexpected exception to get changed table [{table_name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )
                continue
            yield from self._process_table(table, catalog_name, schema_name)

    def _process_table(self, table: Any, catalog_name: str, schema_name: str) -> Iterable[Tuple[str, TableType]]:  # noqa: UP006
        """Apply filtering and table-type detection, then yield the table to the topology."""
        try:
            table_name = table.name
            table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                database_name=catalog_name,
                schema_name=schema_name,
                table_name=table_name,
            )
            if filter_by_table(
                self.config.sourceConfig.config.tableFilterPattern,  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
                (table_fqn if self.config.sourceConfig.config.useFqnForFiltering else table_name),  # pyright: ignore[reportAttributeAccessIssue, reportArgumentType, reportOptionalMemberAccess]
            ):
                self.status.filter(
                    table_fqn,  # pyright: ignore[reportArgumentType]
                    "Table Filtered Out",
                )
                return
            table_type: TableType = TableType.Regular
            if table.table_type:
                if table.table_type.value.lower() == TableType.View.value.lower():
                    table_type = TableType.View
                if table.table_type.value.lower() == "materialized_view":
                    table_type = TableType.MaterializedView
                elif table.table_type.value.lower() == TableType.External.value.lower():
                    table_type = TableType.External
            self.context.get().table_data = table  # pyright: ignore[reportAttributeAccessIssue]
            yield table_name, table_type
        except Exception as exc:
            table_identifier = getattr(table, "name", "<unknown>")
            self.status.failed(
                StackTraceError(
                    name=table_identifier,
                    error=f"Unexpected exception to get table [{table_identifier}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_schema_definition(self, table_name: str, table_type: TableType, table: Any) -> Optional[str]:  # noqa: UP045
        """
        Get the DDL statement or View Definition for a table
        """
        try:
            if table_type in (TableType.View, TableType.MaterializedView):
                if hasattr(table, "view_definition") and table.view_definition:
                    view_type = table_type == TableType.View and "VIEW" or "MATERIALIZED VIEW"  # noqa: RUF021

                    return f"CREATE {view_type} `{table.catalog_name}`.`{table.schema_name}`.`{table_name}` AS {table.view_definition}"
            elif self.source_config.includeDDL and table_type != TableType.Iceberg:
                cursor = self.sql_connection.execute(
                    text(
                        UNITY_CATALOG_GET_TABLE_DDL.format(
                            database=self.context.get().database,
                            schema=self.context.get().database_schema,
                            table=table_name,
                        )
                    )
                )
                result = cursor.fetchone()
                if result:
                    return result[0]
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get schema definition for table [{table_name}]: {exc}")
        return None

    def yield_table(self, table_name_and_type: Tuple[str, TableType]) -> Iterable[Either[CreateTableRequest]]:  # noqa: UP006
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        table = self.context.get().table_data
        schema_name = self.context.get().database_schema
        db_name = self.context.get().database
        if table.storage_location and not table.storage_location.startswith("dbfs"):
            with self._state_lock:
                self.external_location_map[(db_name, schema_name, table_name)] = table.storage_location
        try:
            columns = list(self.get_columns(table_name, table.columns))
            (
                primary_constraints,
                foreign_constraints,
            ) = self.get_table_constraints(table.table_constraints)

            table_constraints = self.update_table_constraints(primary_constraints, foreign_constraints, columns)
            table_constraints = self.normalize_table_constraints(table_constraints, columns)

            schema_definition = self.get_schema_definition(table_name=table_name, table_type=table_type, table=table)

            table_request = CreateTableRequest(
                name=EntityName(table_name),
                tableType=table_type,
                description=table.comment,
                columns=columns,
                tableConstraints=table_constraints,
                schemaDefinition=schema_definition,
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=schema_name,
                    )
                ),
                owners=self.get_owner_ref(table.owner),
                tags=self.get_tag_labels(table_name),
                locationPath=table.storage_location,
            )
            yield Either(right=table_request)

            self.register_record(table_request=table_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=table_name,
                    error=f"Unexpected exception to yield table [{table_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_table_constraints(
        self,
        constraints: List[DBTableConstraint],  # noqa: UP006
    ) -> Tuple[List[TableConstraint], List[ForeignConstrains]]:  # noqa: UP006
        """
        Function to handle table constraint for the current table and add it to context
        """

        primary_constraints = []
        foreign_constraints = []
        for constraint in constraints:
            if constraint.primary_key_constraint:
                primary_constraints.append(
                    TableConstraint(
                        constraintType=ConstraintType.PRIMARY_KEY,
                        columns=constraint.primary_key_constraint.child_columns,
                    )
                )
            if constraint.foreign_key_constraint:
                foreign_constraints.append(
                    ForeignConstrains(
                        child_columns=constraint.foreign_key_constraint.child_columns,
                        parent_columns=constraint.foreign_key_constraint.parent_columns,
                        parent_table=constraint.foreign_key_constraint.parent_table,
                    )
                )
        return primary_constraints, foreign_constraints

    def _get_foreign_constraints(self, foreign_columns) -> List[TableConstraint]:  # noqa: UP006
        """
        Search the referred table for foreign constraints
        and get referred column fqn
        """

        table_constraints = []
        for column in foreign_columns:
            referred_column_fqns = []
            ref_table_fqn = column.parent_table
            table_fqn_list = fqn.split(ref_table_fqn)

            referred_table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                table_name=table_fqn_list[2],
                schema_name=table_fqn_list[1],
                database_name=table_fqn_list[0],
                service_name=self.context.get().database_service,
            )

            # Check if the referred table exists in OpenMetadata before adding constraint
            referred_table = self.metadata.get_by_name(entity=Table, fqn=referred_table_fqn)
            if referred_table:
                for parent_column in column.parent_columns:
                    col_fqn = fqn._build(referred_table_fqn, parent_column, quote=False)
                    if col_fqn:
                        referred_column_fqns.append(FullyQualifiedEntityName(col_fqn))
            else:
                continue

            table_constraints.append(
                TableConstraint(
                    constraintType=ConstraintType.FOREIGN_KEY,
                    columns=column.child_columns,
                    referredColumns=referred_column_fqns,
                )
            )

        return table_constraints

    # pylint: disable=arguments-differ
    def update_table_constraints(self, table_constraints, foreign_columns, columns) -> List[TableConstraint]:  # noqa: UP006
        """
        From topology.
        process the table constraints of all tables
        """
        foreign_table_constraints = self._get_foreign_constraints(foreign_columns)
        if foreign_table_constraints:
            if table_constraints:
                table_constraints.extend(foreign_table_constraints)
            else:
                table_constraints = foreign_table_constraints
        return table_constraints

    def prepare(self):
        """Nothing to prepare"""

    def mark_tables_as_deleted(self):
        """
        Mark tables as deleted.

        In incremental mode only the tables detected as deleted (from the audit
        log) are marked; in full mode the standard stale-entity scan is used.
        """
        if self.incremental.enabled:
            if not self.context.get().__dict__.get("database"):
                raise ValueError("No Database found in the context. We cannot run the table deletion.")
            if self.source_config.markDeletedTables:
                logger.info(f"Mark Deleted Tables set to True. Processing database [{self.context.get().database}]")  # pyright: ignore[reportAttributeAccessIssue]
                yield from delete_entity_by_name(
                    self.metadata,
                    entity_type=Table,
                    entity_names=self.context.get_global().deleted_tables,  # pyright: ignore[reportAttributeAccessIssue]
                    recursive=self.source_config.markDeletedTables,
                )
        else:
            yield from super().mark_tables_as_deleted()

    def add_complex_datatype_descriptions(self, column: Column, column_json: ColumnJson):
        """
        Method to add descriptions to complex datatypes
        """
        try:
            if column.children is None:
                if column_json.metadata and column_json.metadata.comment:
                    column.description = Markdown(column_json.metadata.comment)
            else:
                for i, child in enumerate(column.children):
                    if column_json.metadata and column_json.metadata.comment:
                        column.description = Markdown(column_json.metadata.comment)
                    if column_json.type and isinstance(column_json.type, Type) and column_json.type.fields:
                        self.add_complex_datatype_descriptions(child, column_json.type.fields[i])
                    if (
                        column_json.type
                        and isinstance(column_json.type, Type)
                        and column_json.type.type.lower() == "array"
                        and isinstance(column_json.type.elementType, ElementType)
                    ):
                        self.add_complex_datatype_descriptions(
                            child,
                            column_json.type.elementType.fields[i],
                        )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to add description to complex datatypes for column [{column.name}]: {exc}")

    def get_columns(self, table_name: str, column_data: List[ColumnInfo]) -> Iterable[Column]:  # noqa: UP006
        """
        process table regular columns info
        """
        for column in column_data:
            parsed_string = {}
            if column.type_text:
                if column.type_text.lower().startswith("union"):
                    column.type_text = column.type_text.replace(" ", "")
                if column.type_text.lower() == "struct" or column.type_text.lower() == "array":
                    column.type_text = column.type_text.lower() + "<>"

                parsed_string = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                    column.type_text.lower()
                )
            parsed_string["name"] = column.name[:256]
            parsed_string["dataLength"] = parsed_string.get("dataLength", 1)
            if column.comment:
                parsed_string["description"] = Markdown(column.comment)
            parsed_string["tags"] = self.get_column_tag_labels(table_name=table_name, column={"name": column.name})
            parsed_string["ordinalPosition"] = column.position
            parsed_column = Column(**parsed_string)
            self.add_complex_datatype_descriptions(
                column=parsed_column,
                column_json=ColumnJson.model_validate(json.loads(column.type_json)),
            )
            yield parsed_column

    @staticmethod
    def _ometa_tag_call_args(tag_name: str, tag_value: str | None) -> dict:
        """Map a Unity Catalog (tag_name, tag_value) pair onto OM's
        classification/tag pair, falling back to UNITY_CATALOG_VALUELESS_CLASSIFICATION
        when tag_value is empty or whitespace-only."""
        if tag_value and str(tag_value).strip():
            return {
                "tags": [tag_value],
                "classification_name": tag_name,
                "tag_description": UNITY_CATALOG_TAG,
                "classification_description": UNITY_CATALOG_TAG_CLASSIFICATION,
            }
        return {
            "tags": [tag_name],
            "classification_name": UNITY_CATALOG_VALUELESS_CLASSIFICATION,
            "tag_description": UNITY_CATALOG_VALUELESS_CLASSIFICATION_DESCRIPTION,
            "classification_description": UNITY_CATALOG_VALUELESS_CLASSIFICATION_DESCRIPTION,
        }

    def yield_database_tag(self, database_name: str) -> Iterable[Either[OMetaTagAndClassification]]:
        """Get Unity Catalog database/catalog tags using SQL query"""
        query_tag_fqn_builder_mapping = (
            (
                UNITY_CATALOG_GET_CATALOGS_TAGS.format(database=database_name),
                lambda tag: [self.context.get().database_service, database_name],
            ),
            (
                UNITY_CATALOG_GET_ALL_SCHEMA_TAGS.format(database=database_name),
                lambda tag: [
                    self.context.get().database_service,
                    database_name,
                    tag.schema_name,
                ],
            ),
        )
        try:
            for query, tag_fqn_builder in query_tag_fqn_builder_mapping:
                for tag in self.sql_connection.execute(text(query)):
                    if not tag.tag_name:
                        continue
                    yield from get_ometa_tag_and_classification(
                        tag_fqn=FullyQualifiedEntityName(fqn._build(*tag_fqn_builder(tag))),
                        **self._ometa_tag_call_args(tag.tag_name, tag.tag_value),
                        metadata=self.metadata,
                        system_tags=True,
                    )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error getting tags for catalog/schema {database_name}: {exc}")

    def yield_tag(self, schema_name: str) -> Iterable[Either[OMetaTagAndClassification]]:
        """Get Unity Catalog schema tags using SQL query"""
        database = self.context.get().database
        query_tag_fqn_builder_mapping = (
            (
                UNITY_CATALOG_GET_ALL_TABLE_TAGS.format(database=database, schema=schema_name),
                lambda tag: [
                    self.context.get().database_service,
                    database,
                    schema_name,
                    tag.table_name,
                ],
            ),
            (
                UNITY_CATALOG_GET_ALL_TABLE_COLUMNS_TAGS.format(database=database, schema=schema_name),
                lambda tag: [
                    self.context.get().database_service,
                    database,
                    schema_name,
                    tag.table_name,
                    tag.column_name,
                ],
            ),
        )
        try:
            for query, tag_fqn_builder in query_tag_fqn_builder_mapping:
                for tag in self.sql_connection.execute(text(query)):
                    if not tag.tag_name:
                        continue
                    yield from get_ometa_tag_and_classification(
                        tag_fqn=FullyQualifiedEntityName(fqn._build(*tag_fqn_builder(tag))),
                        **self._ometa_tag_call_args(tag.tag_name, tag.tag_value),
                        metadata=self.metadata,
                        system_tags=True,
                    )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error getting tags for schema {schema_name}: {exc}")

    def get_stored_procedures(self) -> Iterable[Any]:
        """Not implemented"""

    def yield_stored_procedure(self, stored_procedure: Any) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Not implemented"""

    def get_stored_procedure_queries(self) -> Iterable[QueryByProcedure]:
        """Not Implemented"""

    def close(self):
        with self._state_lock:
            sql_connections = list(self._sql_connection_map.values())
        for sql_connection in sql_connections:
            sql_connection.close()
        if self.engine:
            self.engine.dispose()

    # pylint: disable=arguments-renamed
    def get_owner_ref(self, owner: Optional[str]) -> Optional[EntityReferenceList]:  # noqa: UP045
        """
        Method to process the table owners.
        """
        try:
            return self.owner_resolver.get_owner_ref(owner)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error processing owner {owner}: {exc}")
        return None
