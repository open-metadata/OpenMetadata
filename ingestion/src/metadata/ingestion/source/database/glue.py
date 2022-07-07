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
from typing import Iterable, List, Optional

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.location import Location, LocationType
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.helpers import get_storage_service_or_create
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class GlueSource(Source[Entity]):
    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.status = SQLSourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service = self.metadata.get_service_or_create(
            entity=DatabaseService, config=config
        )

        self.service_connection = self.config.serviceConnection.__root__.config

        # TODO: add to service_mixin
        self.storage_service = get_storage_service_or_create(
            {
                "name": self.service_connection.storageServiceName,
                "serviceType": "S3",
            },
            metadata_config,
        )

        self.connection = get_connection(self.service_connection)
        self.glue = self.connection.client

        self.database_name = None
        self.next_db_token = None

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: GlueConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, GlueConnection):
            raise InvalidSourceException(
                f"Expected GlueConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Entity]:

        yield from self.ingest_catalog()

    def ingest_catalog(self) -> Iterable[Entity]:
        """
        Ingest db and table data

        Catalog ID -> Database
        Glue db -> Schema
        """
        paginator = self.glue.get_paginator("get_databases")
        paginator_response = paginator.paginate()

        for page in paginator_response:
            for schema in page["DatabaseList"]:

                if filter_by_database(
                    database_filter_pattern=self.config.sourceConfig.config.databaseFilterPattern,
                    database_name=schema["CatalogId"],
                ):
                    self.status.filter(
                        schema["CatalogId"], "Database (Catalog ID) pattern not allowed"
                    )
                    continue

                if filter_by_schema(
                    schema_filter_pattern=self.config.sourceConfig.config.schemaFilterPattern,
                    schema_name=schema["Name"],
                ):
                    self.status.filter(schema["Name"], "Schema pattern not allowed")
                    continue

                yield from self.ingest_tables(
                    catalog_id=schema["CatalogId"], schema_name=schema["Name"]
                )

                if self.config.sourceConfig.config.markDeletedTables:
                    logger.warning(
                        "Glue source does not currently support marking tables as deleted."
                    )

    def get_columns(self, column_data):
        for column in column_data["Columns"]:
            if column["Type"].lower().startswith("union"):
                column["Type"] = column["Type"].replace(" ", "")
            parsed_string = ColumnTypeParser._parse_datatype_string(
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

    def ingest_tables(
        self, catalog_id: str, schema_name: str
    ) -> Iterable[OMetaDatabaseAndTable]:
        try:

            all_tables: List[dict] = []

            paginator = self.glue.get_paginator("get_tables")
            paginator_response = paginator.paginate(DatabaseName=schema_name)

            for page in paginator_response:
                all_tables += page["TableList"]

            for table in all_tables:

                if filter_by_table(
                    self.config.sourceConfig.config.tableFilterPattern,
                    table.get("name"),
                ):
                    self.status.filter(
                        "{}".format(table["Name"]),
                        "Table pattern not allowed",
                    )
                    continue
                database_entity = Database(
                    id=uuid.uuid4(),
                    name=catalog_id,
                    service=EntityReference(id=self.service.id, type="databaseService"),
                )

                schema_entity = DatabaseSchema(
                    id=uuid.uuid4(),
                    name=table["DatabaseName"],
                    database=EntityReference(id=database_entity.id, type="database"),
                    service=EntityReference(id=self.service.id, type="databaseService"),
                )
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

                table_columns = self.get_columns(table["StorageDescriptor"])
                location_entity = self.get_table_location(table, location_type)

                table_type: TableType = TableType.Regular
                if location_type == LocationType.Iceberg:
                    table_type = TableType.Iceberg
                elif table["TableType"] == "EXTERNAL_TABLE":
                    table_type = TableType.External
                elif table["TableType"] == "VIRTUAL_VIEW":
                    table_type = TableType.View
                table_entity = Table(
                    id=uuid.uuid4(),
                    name=table["Name"][:128],
                    description=table.get("Description", ""),
                    columns=table_columns,
                    tableType=table_type,
                )

                table_and_db = OMetaDatabaseAndTable(
                    table=table_entity,
                    database=database_entity,
                    database_schema=schema_entity,
                    location=location_entity,
                )
                yield table_and_db

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def get_table_location(
        self, table: dict, location_type: LocationType
    ) -> Optional[Location]:
        """
        Try to create the location or return None
        :param table: Table dict from boto3
        :param location_type: Table or Iceberg
        :return: Location or None
        """
        try:
            return Location(
                name=table["Name"][:128],  # set location name as table name
                path=table["StorageDescriptor"]["Location"],
                locationType=location_type,
                service=EntityReference(
                    id=self.storage_service.id, type="storageService"
                ),
            )
        except Exception as err:
            logger.error(f"Cannot create location for {table['Name']} due to {err}")
            logger.debug(traceback.format_exc())

        return None

    def get_downstream_tasks(self, task_unique_id, tasks):
        downstream_tasks = []
        for edges in tasks["Edges"]:
            if (
                edges["SourceId"] == task_unique_id
                and edges["DestinationId"] in self.task_id_mapping.values()
            ):
                downstream_tasks.append(
                    list(self.task_id_mapping.keys())[
                        list(self.task_id_mapping.values()).index(
                            edges["DestinationId"]
                        )
                    ][:128]
                )
        return downstream_tasks

    def get_tasks(self, tasks):
        task_list = []
        for task in tasks["Graph"]["Nodes"]:
            task_name = task["Name"][:128]
            self.task_id_mapping[task_name] = task["UniqueId"]
        for task in tasks["Graph"]["Nodes"]:
            task_list.append(
                Task(
                    name=task["Name"],
                    displayName=task["Name"],
                    taskType=task["Type"],
                    downstreamTasks=self.get_downstream_tasks(
                        task["UniqueId"], tasks["Graph"]
                    ),
                )
            )
        return task_list

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> None:
        test_connection(self.connection)
