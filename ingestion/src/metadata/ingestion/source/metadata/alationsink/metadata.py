#  Copyright 2024 Collate
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
AlationSink source to extract metadata
"""

import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    ConstraintType,
    Table,
    TableConstraint,
)
from metadata.generated.schema.entity.services.connections.metadata.alationSinkConnection import (
    AlationSinkConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either, Entity
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.connections import get_connection, test_connection_common
from metadata.ingestion.source.metadata.alationsink.client import AlationSinkClient
from metadata.ingestion.source.metadata.alationsink.constants import (
    SERVICE_TYPE_MAPPER,
    TABLE_TYPE_MAPPER,
)
from metadata.ingestion.source.metadata.alationsink.models import (
    ColumnIndex,
    CreateColumnRequest,
    CreateColumnRequestList,
    CreateDatasourceRequest,
    CreateSchemaRequest,
    CreateSchemaRequestList,
    CreateTableRequest,
    CreateTableRequestList,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

DEFAULT_URL = "http://localhost:8080"


class AlationsinkSource(Source):
    """
    Alation Sink source class
    """

    config: WorkflowSource
    alation_sink_client: AlationSinkClient

    @retry_with_docker_host()
    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.source_config = self.config.sourceConfig.config

        self.alation_sink_client = get_connection(self.service_connection)
        self.connectors = {}
        self.test_connection()

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: AlationSinkConnection = config.serviceConnection.root.config
        if not isinstance(connection, AlationSinkConnection):
            raise InvalidSourceException(
                f"Expected AlationSinkConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """Not required to implement"""

    def create_datasource_request(
        self, om_database: Database
    ) -> Optional[CreateDatasourceRequest]:
        """
        Method to form the CreateDatasourceRequest object
        """
        try:
            return CreateDatasourceRequest(
                # We need to send a default fallback url because it is compulsory in the API
                uri=model_str(om_database.sourceUrl) or DEFAULT_URL,
                connector_id=self.connectors.get(
                    SERVICE_TYPE_MAPPER.get(
                        om_database.serviceType, "MySQL OCF Connector"
                    ),
                ),
                db_username="Test",
                title=(
                    om_database.displayName
                    if om_database.displayName
                    else model_str(om_database.name)
                ),
                description=model_str(om_database.description),
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to create datasource request for {model_str(om_database.name)}: {exc}"
            )
        return None

    def create_schema_request(
        self, alation_datasource_id: int, om_schema: DatabaseSchema
    ) -> Optional[CreateSchemaRequest]:
        """
        Method to form the CreateSchemaRequest object
        """
        try:
            return CreateSchemaRequest(
                key=fqn._build(  # pylint: disable=protected-access
                    str(alation_datasource_id), model_str(om_schema.name)
                ),
                title=(
                    om_schema.displayName
                    if om_schema.displayName
                    else model_str(om_schema.name)
                ),
                description=model_str(om_schema.description),
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to create schema request for {model_str(om_schema.name)}: {exc}"
            )
        return None

    def create_table_request(
        self, alation_datasource_id: int, schema_name: str, om_table: Table
    ) -> Optional[CreateTableRequest]:
        """
        Method to form the CreateTableRequest object
        """
        try:
            return CreateTableRequest(
                key=fqn._build(  # pylint: disable=protected-access
                    str(alation_datasource_id), schema_name, model_str(om_table.name)
                ),
                title=(
                    om_table.displayName
                    if om_table.displayName
                    else model_str(om_table.name)
                ),
                description=model_str(om_table.description),
                table_type=TABLE_TYPE_MAPPER.get(om_table.tableType, "TABLE"),
                sql=om_table.schemaDefinition,
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to create table request for {model_str(om_table.name)}: {exc}"
            )
        return None

    def _update_foreign_key(
        self,
        alation_datasource_id: int,
        om_column: Column,
        table_constraints: Optional[List[TableConstraint]],
        column_index: ColumnIndex,
    ):
        """
        Method to update the foreign key metadata in columns index
        """
        try:
            for table_constraint in table_constraints or []:
                if table_constraint.constraintType == ConstraintType.FOREIGN_KEY:
                    for i, constraint_column in enumerate(
                        table_constraint.columns or []
                    ):
                        if constraint_column == model_str(om_column.name):
                            column_index.isForeignKey = True
                            # update the service name of OM with the alation datasource id in the column FQN
                            splitted_col_fqn = fqn.split(
                                model_str(table_constraint.referredColumns[i])
                            )
                            splitted_col_fqn[0] = str(alation_datasource_id)
                            column_index.referencedColumnId = (
                                fqn._build(  # pylint: disable=protected-access
                                    *splitted_col_fqn
                                )
                            )
                            break
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to update foreign key for {model_str(om_column.name)}: {exc}"
            )

    def _get_column_index(
        self,
        alation_datasource_id: int,
        om_column: Column,
        table_constraints: Optional[List[TableConstraint]],
    ) -> Optional[ColumnIndex]:
        """
        Method to get the alation column index
        """
        column_index = ColumnIndex()
        try:
            # Attach the primary key
            if om_column.constraint == Constraint.PRIMARY_KEY:
                column_index.isPrimaryKey = True

            # Attach the foreign key
            self._update_foreign_key(
                alation_datasource_id, om_column, table_constraints, column_index
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to get column index for {model_str(om_column.name)}: {exc}"
            )
        return column_index or None

    def _check_nullable_column(self, om_column: Column) -> Optional[bool]:
        """
        Method to check if the column is null
        """
        try:
            if om_column.constraint == Constraint.NOT_NULL:
                return False
            if om_column.constraint == Constraint.NULL:
                return True
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to check null type for {model_str(om_column.name)}: {exc}"
            )
        return None

    def create_column_request(
        self,
        alation_datasource_id: int,
        schema_name: str,
        table_name: str,
        om_column: Column,
        table_constraints: Optional[List[TableConstraint]],
    ) -> Optional[CreateColumnRequest]:
        """
        Method to form the CreateColumnRequest object
        """
        try:
            return CreateColumnRequest(
                key=fqn._build(  # pylint: disable=protected-access
                    str(alation_datasource_id),
                    schema_name,
                    table_name,
                    model_str(om_column.name),
                ),
                column_type=(
                    om_column.dataTypeDisplay.lower()
                    if om_column.dataTypeDisplay
                    else om_column.dataType.value.lower()
                ),
                title=(
                    om_column.displayName
                    if om_column.displayName
                    else model_str(om_column.name)
                ),
                description=model_str(om_column.description),
                position=(
                    str(om_column.ordinalPosition)
                    if om_column.ordinalPosition
                    else None
                ),
                index=self._get_column_index(
                    alation_datasource_id, om_column, table_constraints
                ),
                nullable=self._check_nullable_column(om_column),
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to create column request for {model_str(om_column.name)}: {exc}"
            )
        return None

    def ingest_columns(
        self, alation_datasource_id: int, schema_name: str, om_table: Table
    ):
        """
        Method to ingest the columns
        """
        try:
            create_requests = CreateColumnRequestList(root=[])
            for om_column in om_table.columns or []:
                create_column_request = self.create_column_request(
                    alation_datasource_id=alation_datasource_id,
                    schema_name=schema_name,
                    table_name=model_str(om_table.name),
                    om_column=om_column,
                    table_constraints=om_table.tableConstraints,
                )
                if create_column_request:
                    create_requests.root.append(create_column_request)
            if create_requests.root:
                # Make the API call to write the columns to Alation
                self.alation_sink_client.write_entities(
                    alation_datasource_id, create_requests
                )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unable to ingest columns for table [{model_str(om_table.name)}]: {exc}"
            )

    def ingest_tables(self, alation_datasource_id: int, om_schema: DatabaseSchema):
        """
        Method to ingest the tables
        """
        try:
            # Iterate over all the tables in OpenMetadata
            om_tables = list(
                self.metadata.list_all_entities(
                    entity=Table,
                    skip_on_failure=True,
                    params={"database": model_str(om_schema.fullyQualifiedName)},
                    fields=["tableConstraints, columns"],
                )
            )
            create_requests = CreateTableRequestList(root=[])
            for om_table in om_tables:
                if filter_by_table(
                    self.source_config.tableFilterPattern, model_str(om_table.name)
                ):
                    self.status.filter(model_str(om_table.name), "Table Filtered Out")
                    continue
                create_table_request = self.create_table_request(
                    alation_datasource_id=alation_datasource_id,
                    schema_name=model_str(om_schema.name),
                    om_table=om_table,
                )
                if create_table_request:
                    create_requests.root.append(create_table_request)
            if create_requests.root:
                # Make the API call to write the tables to Alation
                alation_tables = self.alation_sink_client.write_entities(
                    alation_datasource_id, create_requests
                )
                if alation_tables:
                    for om_table in om_tables:
                        if filter_by_table(
                            self.source_config.tableFilterPattern,
                            model_str(om_table.name),
                        ):
                            self.status.filter(
                                model_str(om_table.name), "Table Filtered Out"
                            )
                            continue
                        self.ingest_columns(
                            alation_datasource_id=alation_datasource_id,
                            schema_name=model_str(om_schema.name),
                            om_table=om_table,
                        )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unable to ingest tables for schema [{model_str(om_schema.name)}]: {exc}"
            )

    def ingest_schemas(self, alation_datasource_id: int, om_database: Database):
        """
        Method to ingests the schemas
        """
        try:
            # Iterate over all the schemas in OpenMetadata
            om_schemas = list(
                self.metadata.list_all_entities(
                    entity=DatabaseSchema,
                    skip_on_failure=True,
                    params={"database": model_str(om_database.fullyQualifiedName)},
                )
            )
            create_requests = CreateSchemaRequestList(root=[])
            for om_schema in om_schemas or []:
                if filter_by_schema(
                    self.source_config.schemaFilterPattern, model_str(om_schema.name)
                ):
                    self.status.filter(model_str(om_schema.name), "Schema Filtered Out")
                    continue
                create_schema_request = self.create_schema_request(
                    alation_datasource_id, om_schema
                )
                if create_schema_request:
                    create_requests.root.append(create_schema_request)
            if create_requests.root:
                # Make the API call to write the schemas to Alation
                alation_schemas = self.alation_sink_client.write_entities(
                    alation_datasource_id, create_requests
                )
                if alation_schemas:
                    for om_schema in om_schemas or []:
                        self.ingest_tables(alation_datasource_id, om_schema)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unable to ingest schemas for database [{model_str(om_database.name)}]: {exc}"
            )

    def _iter(self, *_, **__) -> Iterable[Either[Entity]]:

        # If we have the mapping provided by user we'll only iterate over those
        if self.service_connection.datasourceLinks:
            for (
                alation_datasource_id,
                om_database_fqn,
            ) in self.service_connection.datasourceLinks.root.items():
                om_database = self.metadata.get_by_name(
                    entity=Database, fqn=om_database_fqn
                )
                if om_database:
                    self.ingest_schemas(
                        alation_datasource_id=int(alation_datasource_id),
                        om_database=om_database,
                    )
        else:
            # If the mapping is not provided, we'll iterate over all the databases
            self.connectors = self.alation_sink_client.list_connectors()
            # Iterate over all the databases in OpenMetadata
            om_databases = self.metadata.list_all_entities(
                entity=Database,
                skip_on_failure=True,
            )
            for om_database in om_databases or []:
                if filter_by_database(
                    self.source_config.databaseFilterPattern,
                    model_str(om_database.name),
                ):
                    self.status.filter(
                        model_str(om_database.name), "Database Filtered Out"
                    )
                    continue
                # write the datasource entity to alation
                alation_datasource = self.alation_sink_client.write_entity(
                    self.create_datasource_request(om_database)
                )
                if alation_datasource:
                    self.ingest_schemas(alation_datasource.id, om_database)

    def close(self):
        """Not required to implement"""

    def test_connection(self) -> None:
        test_connection_common(
            self.metadata, self.alation_sink_client, self.service_connection
        )
