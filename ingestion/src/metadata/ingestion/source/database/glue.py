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
Glue source methods.
"""
import traceback
from typing import Iterable, List, Optional, Tuple

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createLocation import CreateLocationRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.location import Location, LocationType
from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection,
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
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.database_service import (
    DatabaseServiceSource,
    SQLSourceStatus,
    TableLocationLink,
)
from metadata.utils import fqn
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class GlueSource(DatabaseServiceSource):
    """
    Implements the necessary methods to extract
    Database metadata from Glue Source
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config
        self.status = SQLSourceStatus()
        self.connection = get_connection(self.service_connection)
        self.glue = self.connection.client
        self.data_models = {}
        self.dbt_tests = {}
        super().__init__()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: GlueConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, GlueConnection):
            raise InvalidSourceException(
                f"Expected GlueConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def _get_glue_database_and_schemas(self):
        paginator = self.glue.get_paginator("get_databases")
        paginator_response = paginator.paginate()
        for page in paginator_response:
            yield page

    def _get_glue_tables(self):
        schema_name = self.context.database_schema.name.__root__
        paginator = self.glue.get_paginator("get_tables")
        paginator_response = paginator.paginate(DatabaseName=schema_name)
        for page in paginator_response:
            yield page

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.

        Catalog ID -> Database
        """
        database_names = []
        for page in self._get_glue_database_and_schemas() or []:
            for schema in page["DatabaseList"]:
                try:
                    database_fqn = fqn.build(
                        self.metadata,
                        entity_type=Database,
                        service_name=self.context.database_service.name.__root__,
                        database_name=schema["CatalogId"],
                    )
                    if filter_by_database(
                        self.config.sourceConfig.config.databaseFilterPattern,
                        database_fqn
                        if self.config.sourceConfig.config.useFqnForFiltering
                        else schema["CatalogId"],
                    ):
                        self.status.filter(
                            database_fqn,
                            "Database (Catalog ID) Filtered Out",
                        )
                        continue
                    if schema["CatalogId"] in database_names:
                        continue
                    database_names.append(schema["CatalogId"])
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Unexpected exception to get database name [{schema}]: {exc}"
                    )
                    self.status.failures.append(
                        f"{self.config.serviceName}.{schema['CatalogId']}"
                    )
        yield from database_names

    def yield_database(self, database_name: str) -> Iterable[CreateDatabaseRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """
        yield CreateDatabaseRequest(
            name=database_name,
            service=EntityReference(
                id=self.context.database_service.id,
                type="databaseService",
            ),
        )

    def get_database_schema_names(self) -> Iterable[str]:
        """
        return schema names
        """
        for page in self._get_glue_database_and_schemas() or []:
            for schema in page["DatabaseList"]:
                try:
                    schema_fqn = fqn.build(
                        self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.database_service.name.__root__,
                        database_name=self.context.database.name.__root__,
                        schema_name=schema["Name"],
                    )
                    if filter_by_schema(
                        self.config.sourceConfig.config.schemaFilterPattern,
                        schema_fqn
                        if self.config.sourceConfig.config.useFqnForFiltering
                        else schema["Name"],
                    ):
                        self.status.filter(schema_fqn, "Schema Filtered Out")
                        continue
                    yield schema["Name"]
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Unexpected exception to get database schema [{schema}]: {exc}"
                    )
                    self.status.failures.append(
                        f"{self.config.serviceName}.{schema['Name']}"
                    )

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[CreateDatabaseSchemaRequest]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """
        yield CreateDatabaseSchemaRequest(
            name=schema_name,
            database=EntityReference(id=self.context.database.id, type="database"),
        )

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.database_schema.name.__root__
        all_tables: List[dict] = []

        for page in self._get_glue_tables():
            all_tables += page["TableList"]
        for table in all_tables:
            try:
                table_name = table.get("Name")
                table_name = self.standardize_table_name(schema_name, table_name)
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

                parameters = table.get("Parameters")
                location_type = LocationType.Table
                if parameters:
                    # iceberg tables need to pass a key/value pair in the DDL `'table_type'='ICEBERG'`
                    # https://docs.aws.amazon.com/athena/latest/ug/querying-iceberg-creating-tables.html
                    location_type = (
                        location_type
                        if parameters.get("table_type") != "ICEBERG"
                        else LocationType.Iceberg
                    )
                table_type: TableType = TableType.Regular
                if location_type == LocationType.Iceberg:
                    table_type = TableType.Iceberg
                elif table["TableType"] == "EXTERNAL_TABLE":
                    table_type = TableType.External
                elif table["TableType"] == "VIRTUAL_VIEW":
                    table_type = TableType.View

                self.context.table_data = table
                yield table_name, table_type
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Unexpected exception to get table [{table}]: {exc}")
                self.status.failures.append(
                    f"{self.config.serviceName}.{table.get('Name')}"
                )

    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Optional[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        table = self.context.table_data
        table_constraints = None
        try:
            columns = self.get_columns(table["StorageDescriptor"])

            table_request = CreateTableRequest(
                name=table_name,
                tableType=table_type,
                description=table.get("Description", ""),
                columns=columns,
                tableConstraints=table_constraints,
                databaseSchema=EntityReference(
                    id=self.context.database_schema.id,
                    type="databaseSchema",
                ),
            )
            yield table_request
            self.register_record(table_request=table_request)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception to yield table [{table_name}]: {exc}")
            self.status.failures.append(f"{self.config.serviceName}.{table_name}")

    def yield_location(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Optional[CreateLocationRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        table = self.context.table_data
        try:
            location_type: LocationType = LocationType.Table
            if table_type == TableType.Iceberg:
                location_type = LocationType.Iceberg
            location_request = CreateLocationRequest(
                name=table["Name"][:128],
                path=table["StorageDescriptor"]["Location"],
                description=table.get("Description", ""),
                locationType=location_type,
                service=EntityReference(
                    id=self.context.storage_service.id, type="storageService"
                ),
            )
            yield location_request
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected exception to yield location for table [{table_name}]: {exc}"
            )
            self.status.failures.append(f"{self.config.serviceName}.{table_name}")

    def prepare(self):
        pass

    def get_columns(self, column_data):
        for column in column_data["Columns"]:
            if column["Type"].lower().startswith("union"):
                column["Type"] = column["Type"].replace(" ", "")
            parsed_string = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                column["Type"].lower()
            )
            if isinstance(parsed_string, list):
                parsed_string = {}
                parsed_string["dataTypeDisplay"] = str(column["Type"])
                parsed_string["dataType"] = "UNION"
            parsed_string["name"] = column["Name"][:64]
            parsed_string["dataLength"] = parsed_string.get("dataLength", 1)
            parsed_string["description"] = column.get("Comment")
            yield Column(**parsed_string)

    def yield_table_location_link(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[TableLocationLink]:
        """
        Gets the current location being processed, fetches its data model
        and sends it ot the sink
        """

        table_name, _ = table_name_and_type
        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.context.database_service.name.__root__,
            database_name=self.context.database.name.__root__,
            schema_name=self.context.database_schema.name.__root__,
            table_name=table_name,
        )

        location_fqn = fqn.build(
            self.metadata,
            entity_type=Location,
            service_name=self.context.storage_service.name.__root__,
            location_name=self.context.location.name.__root__,
        )
        if table_fqn and location_fqn:
            yield TableLocationLink(table_fqn=table_fqn, location_fqn=location_fqn)

    def standardize_table_name(self, _: str, table: str) -> str:
        return table[:128]

    def yield_view_lineage(self) -> Optional[Iterable[AddLineageRequest]]:
        yield from []

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndCategory]:
        pass

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> None:
        test_connection(self.connection)
