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
Generic source to build SQL connectors.
"""
import copy
import traceback
from abc import ABC
from copy import deepcopy
from typing import Any, Dict, Iterable, List, Optional, Tuple, cast

from pydantic import BaseModel
from sqlalchemy.engine import Connection
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect

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
    TablePartition,
    TableType,
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
    Markdown,
    SourceUrl,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.connections.session import create_and_bind_thread_safe_session
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.patch_request import PatchedEntity, PatchRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.connections_utils import kill_active_connections
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.sql_column_handler import SqlColumnHandlerMixin
from metadata.ingestion.source.database.sqlalchemy_source import SqlAlchemySource
from metadata.ingestion.source.database.stored_procedures_mixin import QueryByProcedure
from metadata.utils import fqn
from metadata.utils.constraints import get_relationship_type
from metadata.utils.execution_time_tracker import (
    calculate_execution_time,
    calculate_execution_time_generator,
)
from metadata.utils.filters import filter_by_table
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager, check_ssl_and_init

logger = ingestion_logger()


class ColumnAndReferredColumn(BaseModel):
    table_name: str
    schema_name: str
    db_name: Optional[str]
    column: Dict


class TableNameAndType(BaseModel):
    """
    Helper model for passing down
    names and types of tables
    """

    name: str
    type_: TableType = TableType.Regular


# pylint: disable=too-many-public-methods
class CommonDbSourceService(
    DatabaseServiceSource, SqlColumnHandlerMixin, SqlAlchemySource, ABC
):
    """
    - fetch_column_tags implemented at SqlColumnHandler. Sources should override this when needed
    """

    @retry_with_docker_host()
    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )

        self.metadata = metadata

        # It will be one of the Unions. We don't know the specific type here.
        self.service_connection = self.config.serviceConnection.root.config

        self.ssl_manager = None
        self.ssl_manager: SSLManager = check_ssl_and_init(self.service_connection)
        if self.ssl_manager:
            self.service_connection = self.ssl_manager.setup_ssl(
                self.service_connection
            )

        self.engine: Engine = get_connection(self.service_connection)
        self.session = create_and_bind_thread_safe_session(self.engine)

        # Flag the connection for the test connection
        self.connection_obj = self.engine
        self.test_connection()

        self._connection_map = {}  # Lazy init as well
        self._inspector_map = {}
        self.table_constraints = None
        self.database_source_state = set()
        self.context.get_global().table_constrains = []
        self.context.get_global().foreign_tables = []
        self.context.set_threads(self.source_config.threads)
        super().__init__()

    def set_inspector(self, database_name: str) -> None:
        """
        When sources override `get_database_names`, they will need
        to setup multiple inspectors. They can use this function.
        :param database_name: new database to set
        """

        kill_active_connections(self.engine)
        logger.info(f"Ingesting from database: {database_name}")

        new_service_connection = deepcopy(self.service_connection)
        new_service_connection.database = database_name
        self.engine = get_connection(new_service_connection)

        self._connection_map = {}  # Lazy init as well
        self._inspector_map = {}

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.
        """
        custom_database_name = self.service_connection.__dict__.get("databaseName")

        database_name = self.service_connection.__dict__.get(
            "database", custom_database_name or "default"
        )

        yield database_name

    def get_database_description(self, database_name: str) -> Optional[str]:
        """
        Method to fetch the database description
        by default there will be no database description
        """

    def get_schema_description(self, schema_name: str) -> Optional[str]:
        """
        Method to fetch the schema description
        by default there will be no schema description
        """

    def get_stored_procedure_description(self, stored_procedure: str) -> Optional[str]:
        """
        Method to fetch the stored procedure description
        by default there will be no stored procedure description
        """

    @calculate_execution_time_generator()
    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """

        description = (
            Markdown(db_description)
            if (db_description := self.get_database_description(database_name))
            else None
        )
        source_url = (
            SourceUrl(source_url)
            if (source_url := self.get_source_url(database_name=database_name))
            else None
        )

        yield Either(
            right=CreateDatabaseRequest(
                name=EntityName(database_name),
                service=FullyQualifiedEntityName(self.context.get().database_service),
                description=description,
                sourceUrl=source_url,
                tags=self.get_database_tag_labels(database_name=database_name),
            )
        )

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema
        else:
            for schema_name in self.inspector.get_schema_names():
                yield schema_name

    def get_database_schema_names(self) -> Iterable[str]:
        """
        return schema names
        """
        yield from self._get_filtered_schema_names()

    @calculate_execution_time_generator()
    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """

        description = (
            Markdown(db_description)
            if (db_description := self.get_schema_description(schema_name))
            else None
        )
        source_url = (
            SourceUrl(source_url)
            if (
                source_url := self.get_source_url(
                    database_name=self.context.get().database, schema_name=schema_name
                )
            )
            else None
        )

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
                description=description,
                sourceUrl=source_url,
                tags=self.get_schema_tag_labels(schema_name=schema_name),
            )
        )

    @staticmethod
    @calculate_execution_time()
    def get_table_description(
        schema_name: str, table_name: str, inspector: Inspector
    ) -> str:
        description = None
        try:
            table_info: dict = inspector.get_table_comment(table_name, schema_name)
        # Catch any exception without breaking the ingestion
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Table description error for table [{schema_name}.{table_name}]: {exc}"
            )
        else:
            description = table_info.get("text")
        return description

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Connect to the source database to get the table
        name and type. By default, use the inspector method
        to get the names and pass the Regular type.

        This is useful for sources where we need fine-grained
        logic on how to handle table types, e.g., external, foreign,...
        """

        return [
            TableNameAndType(name=table_name)
            for table_name in self.inspector.get_table_names(schema_name) or []
        ]

    def query_view_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Connect to the source database to get the view
        name and type. By default, use the inspector method
        to get the names and pass the View type.

        This is useful for sources where we need fine-grained
        logic on how to handle table types, e.g., material views,...
        """

        return [
            TableNameAndType(name=table_name, type_=TableType.View)
            for table_name in self.inspector.get_view_names(schema_name) or []
        ]

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.get().database_schema
        try:
            if self.source_config.includeTables:
                for table_and_type in self.query_table_names_and_types(schema_name):
                    table_name = self.standardize_table_name(
                        schema_name, table_and_type.name
                    )
                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                        table_name=table_name,
                        skip_es_search=True,
                    )
                    if filter_by_table(
                        self.source_config.tableFilterPattern,
                        (
                            table_fqn
                            if self.source_config.useFqnForFiltering
                            else table_name
                        ),
                    ):
                        self.status.filter(
                            table_fqn,
                            "Table Filtered Out",
                        )
                        continue
                    yield table_name, table_and_type.type_

            if self.source_config.includeViews:
                for view_and_type in self.query_view_names_and_types(schema_name):
                    view_name = self.standardize_table_name(
                        schema_name, view_and_type.name
                    )
                    view_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                        table_name=view_name,
                    )

                    if filter_by_table(
                        self.source_config.tableFilterPattern,
                        (
                            view_fqn
                            if self.source_config.useFqnForFiltering
                            else view_name
                        ),
                    ):
                        self.status.filter(
                            view_fqn,
                            "Table Filtered Out",
                        )
                        continue
                    yield view_name, view_and_type.type_
        except Exception as err:
            logger.warning(
                f"Fetching tables names failed for schema {schema_name} due to - {err}"
            )
            logger.debug(traceback.format_exc())

    @calculate_execution_time()
    def get_schema_definition(
        self,
        table_type: TableType,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> Optional[str]:
        """
        Get the DDL statement or View Definition for a table
        """
        try:
            schema_definition = None
            # Lineage qualified table types to be considered for view definition
            if table_type in (
                TableType.View,
                TableType.MaterializedView,
                TableType.SecureView,
                TableType.Dynamic,
                TableType.Stream,
            ):
                schema_definition = inspector.get_view_definition(
                    table_name, schema_name
                )
            elif hasattr(inspector, "get_table_ddl") and self.source_config.includeDDL:
                schema_definition = inspector.get_table_ddl(
                    self.connection, table_name, schema_name
                )
            schema_definition = (
                str(schema_definition).strip()
                if schema_definition is not None
                else None
            )
            return schema_definition

        except NotImplementedError:
            logger.debug("Schema definition not implemented")

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(f"Failed to fetch schema definition for {table_name}: {exc}")
        return None

    def is_partition(  # pylint: disable=unused-argument
        self,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> bool:
        return False

    def get_table_partition_details(  # pylint: disable=unused-argument
        self,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> Tuple[bool, Optional[TablePartition]]:
        """
        check if the table is partitioned table and return the partition details
        """
        return False, None  # By default the table will be a Regular Table

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        We don't have a generic source implementation for handling tags.

        Each source should implement its own when needed
        """

    def get_stored_procedures(self) -> Iterable[Any]:
        """Not implemented"""

    def yield_stored_procedure(
        self, stored_procedure: Any
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Not implemented"""

    def get_stored_procedure_queries(self) -> Iterable[QueryByProcedure]:
        """Not Implemented"""

    def get_location_path(self, table_name: str, schema_name: str) -> Optional[str]:
        """
        Method to fetch the location path of the table
        by default there will be no location path
        """

    @calculate_execution_time_generator()
    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        schema_name = self.context.get().database_schema
        try:
            (
                columns,
                table_constraints,
                foreign_columns,
            ) = self.get_columns_and_constraints(
                schema_name=schema_name,
                table_type=table_type,
                table_name=table_name,
                db_name=self.context.get().database,
                inspector=self.inspector,
            )

            schema_definition = self.get_schema_definition(
                table_type=table_type,
                table_name=table_name,
                schema_name=schema_name,
                inspector=self.inspector,
            )

            table_constraints = self.update_table_constraints(
                schema_name=schema_name,
                table_name=table_name,
                db_name=self.context.get().database,
                table_constraints=table_constraints,
                foreign_columns=foreign_columns,
                columns=columns,
            )

            description = (
                Markdown(db_description)
                if (
                    db_description := self.get_table_description(
                        schema_name=schema_name,
                        table_name=table_name,
                        inspector=self.inspector,
                    )
                )
                else None
            )

            table_request = CreateTableRequest(
                name=EntityName(table_name),
                tableType=table_type,
                description=description,
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
                tags=self.get_tag_labels(
                    table_name=table_name
                ),  # Pick tags from context info, if any
                sourceUrl=self.get_source_url(
                    table_name=table_name,
                    schema_name=schema_name,
                    database_name=self.context.get().database,
                    table_type=table_type,
                ),
                owners=self.get_owner_ref(table_name=table_name),
                locationPath=self.get_location_path(
                    table_name=table_name, schema_name=schema_name
                ),
            )

            is_partitioned, partition_details = self.get_table_partition_details(
                table_name=table_name, schema_name=schema_name, inspector=self.inspector
            )
            if is_partitioned:
                table_request.tableType = TableType.Partitioned.value
                table_request.tablePartition = partition_details

            yield Either(right=table_request)

            # Register the request that we'll handle during the deletion checks
            self.register_record(table_request=table_request)

        except Exception as exc:
            error = (
                f"Unexpected exception to yield table "
                f"(database=[{self.context.get().database}], schema=[{schema_name}], table=[{table_name}]): {exc}"
            )
            yield Either(
                left=StackTraceError(
                    name=table_name, error=error, stackTrace=traceback.format_exc()
                )
            )

    def _prepare_foreign_constraints(  # pylint: disable=too-many-arguments, too-many-locals
        self,
        supports_database: bool,
        column: Dict,
        table_name: str,
        schema_name: str,
        db_name: str,
        columns: List[Column],
        add_to_global: bool = True,
    ):
        """
        Method to prepare the foreign constraints
        """
        referred_column_fqns = []
        if supports_database:
            database_name = column.get("referred_database")
        else:
            database_name = self.context.get().database
        referred_table_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Table,
            table_name=column.get("referred_table"),
            schema_name=column.get("referred_schema"),
            database_name=database_name,
            service_name=self.context.get().database_service,
        )
        referred_table = self.metadata.get_by_name(entity=Table, fqn=referred_table_fqn)
        if referred_table:
            for referred_column in column.get("referred_columns"):
                col_fqn = fqn._build(  # pylint: disable=protected-access
                    referred_table_fqn, referred_column, quote=False
                )
                if col_fqn:
                    referred_column_fqns.append(FullyQualifiedEntityName(col_fqn))
        else:
            if add_to_global:
                column_and_referred_columns = ColumnAndReferredColumn(
                    table_name=table_name,
                    schema_name=schema_name,
                    db_name=db_name,
                    column=column,
                )
                self.context.get_global().foreign_tables.append(
                    column_and_referred_columns
                )
            return None
        relationship_type = None
        if referred_table:
            relationship_type = get_relationship_type(
                column,  # sqlalchemy foreign column
                referred_table.columns,  # referred table columns
                columns,  # current table om columns
            )
        return TableConstraint(
            constraintType=ConstraintType.FOREIGN_KEY,
            columns=column.get("constrained_columns"),
            referredColumns=referred_column_fqns,
            relationshipType=relationship_type,
        )

    def _get_foreign_constraints(
        self,
        table_name,
        schema_name,
        db_name,
        foreign_columns: List[Dict],
        columns: List[Column],
    ) -> List[TableConstraint]:
        """
        Search the referred table for foreign constraints
        and get referred column fqn
        """
        supports_database = hasattr(self.service_connection, "supportsDatabase")

        foreign_constraints = []
        for column in foreign_columns:
            foreign_constraint = self._prepare_foreign_constraints(
                supports_database, column, table_name, schema_name, db_name, columns
            )
            if foreign_constraint and foreign_constraint not in foreign_constraints:
                foreign_constraints.append(foreign_constraint)

        return foreign_constraints

    @calculate_execution_time()
    def update_table_constraints(
        self,
        table_name,
        schema_name,
        db_name,
        table_constraints,
        foreign_columns,
        columns,
    ) -> List[TableConstraint]:
        """
        From topology.
        process the table constraints of all tables
        """
        foreign_table_constraints = self._get_foreign_constraints(
            table_name, schema_name, db_name, foreign_columns, columns
        )
        if foreign_table_constraints:
            if table_constraints:
                table_constraints.extend(
                    constraint
                    for constraint in foreign_table_constraints
                    if constraint and constraint not in table_constraints
                )
            else:
                table_constraints = foreign_table_constraints
        return table_constraints

    @property
    def connection(self) -> Connection:
        """
        Return the SQLAlchemy connection
        """
        thread_id = self.context.get_current_thread_id()

        if not self._connection_map.get(thread_id):
            self._connection_map[thread_id] = self.engine.connect()

        return self._connection_map[thread_id]

    @property
    def inspector(self) -> Inspector:
        thread_id = self.context.get_current_thread_id()

        if not self._inspector_map.get(thread_id):
            self._inspector_map[thread_id] = inspect(self.connection)

        return self._inspector_map[thread_id]

    def close(self):
        if self.connection is not None:
            self.connection.close()
        for connection in self._connection_map.values():
            connection.close()
        if hasattr(self, "ssl_manager") and self.ssl_manager:
            self.ssl_manager = cast(SSLManager, self.ssl_manager)
            self.ssl_manager.cleanup_temp_files()
        self.engine.dispose()

    def fetch_table_tags(
        self,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> None:
        """
        Method to fetch tags associated with table
        """

    def standardize_table_name(self, schema_name: str, table: str) -> str:
        """
        This method is interesting to be maintained in case
        some connector, such as BigQuery, needs to perform
        some added logic here.

        Returning `table` is just the default implementation.
        """
        return table

    def get_source_url(
        self,
        database_name: Optional[str] = None,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
        table_type: Optional[TableType] = None,
    ) -> Optional[str]:
        """
        By default the source url is not supported for
        """

    def yield_table_constraints(self) -> Iterable[Either[PatchedEntity]]:
        """
        Process remaining table constraints by patching the table
        """
        supports_database = hasattr(self.service_connection, "supportsDatabase")

        for foreign_table in self.context.get_global().foreign_tables or []:
            try:
                foreign_constraints = []
                table_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=foreign_table.db_name,
                    schema_name=foreign_table.schema_name,
                    table_name=foreign_table.table_name,
                )
                table = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
                if table:
                    foreign_constraint = self._prepare_foreign_constraints(
                        supports_database,
                        foreign_table.column,
                        foreign_table.table_name,
                        foreign_table.schema_name,
                        foreign_table.db_name,
                        table.columns,
                        False,
                    )
                    if foreign_constraint:
                        foreign_constraints.append(foreign_constraint)

                # send the patch request
                if foreign_constraints:
                    new_entity = copy.deepcopy(table)
                    new_entity.tableConstraints = (
                        new_entity.tableConstraints or []
                    ) + foreign_constraints
                    patch_request = PatchRequest(
                        original_entity=table,
                        new_entity=new_entity,
                        override_metadata=True,
                    )
                    yield Either(right=patch_request)
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=str(foreign_table.table_name),
                        error=f"Error to yield tableConstraints for {str(foreign_table.table_name)}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )
