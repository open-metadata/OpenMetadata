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
"""
Databricks Unity Catalog Source source methods.
"""
import traceback
from typing import Iterable, List, Optional, Tuple

from databricks.sdk.service.catalog import ColumnInfo

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.databricks.connection import get_connection
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.db_utils import get_view_lineage
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DatabricksUnityCatalogSource(DatabaseServiceSource):
    """
    Implements the necessary methods to extract
    Database metadata from Databricks Source using
    the unity catalog source
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.context.table_views = []
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection: DatabricksConnection = (
            self.config.serviceConnection.__root__.config
        )
        self.client = get_connection(self.service_connection)
        self.connection_obj = self.client
        self.test_connection()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: DatabricksConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DatabricksConnection):
            raise InvalidSourceException(
                f"Expected DatabricksConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.

        Catalog ID -> Database
        """
        if self.service_connection.catalog:
            yield self.service_connection.catalog
        else:
            for catalog in self.client.catalogs.list():
                try:
                    database_fqn = fqn.build(
                        self.metadata,
                        entity_type=Database,
                        service_name=self.context.database_service.name.__root__,
                        database_name=catalog.name,
                    )
                    if filter_by_database(
                        self.config.sourceConfig.config.databaseFilterPattern,
                        database_fqn
                        if self.config.sourceConfig.config.useFqnForFiltering
                        else catalog.name,
                    ):
                        self.status.filter(
                            database_fqn,
                            "Database (Catalog ID) Filtered Out",
                        )
                        continue
                    yield catalog.name
                except Exception as exc:
                    error = f"Unexpected exception to get database name [{catalog.name}]: {exc}"
                    logger.debug(traceback.format_exc())
                    logger.warning(error)
                    self.status.failed(catalog.name, error, traceback.format_exc())

    def yield_database(self, database_name: str) -> Iterable[CreateDatabaseRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """
        yield CreateDatabaseRequest(
            name=database_name,
            service=self.context.database_service.fullyQualifiedName,
        )

    def get_database_schema_names(self) -> Iterable[str]:
        """
        return schema names
        """
        catalog_name = self.context.database.name.__root__
        for schema in self.client.schemas.list(catalog_name=catalog_name):
            try:
                schema_fqn = fqn.build(
                    self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.database_service.name.__root__,
                    database_name=self.context.database.name.__root__,
                    schema_name=schema.name,
                )
                if filter_by_schema(
                    self.config.sourceConfig.config.schemaFilterPattern,
                    schema_fqn
                    if self.config.sourceConfig.config.useFqnForFiltering
                    else schema.name,
                ):
                    self.status.filter(schema_fqn, "Schema Filtered Out")
                    continue
                yield schema.name
            except Exception as exc:
                error = f"Unexpected exception to get database schema [{schema.name}]: {exc}"
                logger.debug(traceback.format_exc())
                logger.warning(error)
                self.status.failed(schema.name, error, traceback.format_exc())

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[CreateDatabaseSchemaRequest]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """
        yield CreateDatabaseSchemaRequest(
            name=schema_name,
            database=self.context.database.fullyQualifiedName,
        )

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.database_schema.name.__root__
        catalog_name = self.context.database.name.__root__
        for table in self.client.tables.list(
            catalog_name=catalog_name,
            schema_name=schema_name,
        ):
            try:
                table_name = table.name
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.context.database_service.name.__root__,
                    database_name=self.context.database.name.__root__,
                    schema_name=self.context.database_schema.name.__root__,
                    table_name=table_name,
                )
                if filter_by_table(
                    self.config.sourceConfig.config.tableFilterPattern,
                    table_fqn
                    if self.config.sourceConfig.config.useFqnForFiltering
                    else table_name,
                ):
                    self.status.filter(
                        table_fqn,
                        "Table Filtered Out",
                    )
                    continue
                table_type: TableType = TableType.Regular
                if table.table_type.value.lower() == TableType.View.value.lower():
                    table_type: TableType = TableType.View
                if table.table_type.value.lower() == TableType.External.value.lower():
                    table_type: TableType = TableType.External
                self.context.table_data = table
                yield table_name, table_type
            except Exception as exc:
                error = f"Unexpected exception to get table [{table.Name}]: {exc}"
                logger.debug(traceback.format_exc())
                logger.warning(error)
                self.status.failed(table.Name, error, traceback.format_exc())

    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Optional[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        table = self.context.table_data
        schema_name = self.context.database_schema.name.__root__
        db_name = self.context.database.name.__root__
        table_constraints = None
        try:
            columns = self.get_columns(table.columns)

            table_request = CreateTableRequest(
                name=table_name,
                tableType=table_type,
                description=table.comment,
                columns=columns,
                tableConstraints=table_constraints,
                databaseSchema=self.context.database_schema.fullyQualifiedName,
            )
            yield table_request

            if table_type == TableType.View or table.view_definition:
                self.context.table_views.append(
                    TableView(
                        table_name=table_name,
                        schema_name=schema_name,
                        db_name=db_name,
                        view_definition=(
                            f'CREATE VIEW "{db_name}"."{schema_name}"'
                            f'."{table_name}" AS {table.view_definition}'
                        ),
                    )
                )

            self.register_record(table_request=table_request)
        except Exception as exc:
            error = f"Unexpected exception to yield table [{table_name}]: {exc}"
            logger.debug(traceback.format_exc())
            logger.warning(error)
            self.status.failed(table_name, error, traceback.format_exc())

    def prepare(self):
        pass

    def get_columns(self, column_data: List[ColumnInfo]) -> Optional[Iterable[Column]]:
        # process table regular columns info

        for column in column_data:
            if column.type_text.lower().startswith("union"):
                column.type_text = column.Type.replace(" ", "")
            parsed_string = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                column.type_text.lower()
            )
            parsed_string["name"] = column.name[:64]
            parsed_string["dataLength"] = parsed_string.get("dataLength", 1)
            parsed_string["description"] = column.comment
            yield Column(**parsed_string)

    def yield_view_lineage(self) -> Optional[Iterable[AddLineageRequest]]:
        logger.info("Processing Lineage for Views")
        for view in [
            v for v in self.context.table_views if v.view_definition is not None
        ]:
            yield from get_view_lineage(
                view=view,
                metadata=self.metadata,
                service_name=self.context.database_service.name.__root__,
                connection_type=self.service_connection.type.value,
            )

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndClassification]:
        pass

    def close(self):
        pass
