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

import logging
import traceback
import uuid
from typing import Iterable

from metadata.config.common import FQDN_SEPARATOR
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.location import Location, LocationType
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.sql_source_common import SQLSourceStatus
from metadata.utils.aws_client import AWSClient
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.filters import filter_by_schema, filter_by_table
from metadata.utils.helpers import (
    get_database_service_or_create,
    get_pipeline_service_or_create,
    get_storage_service_or_create,
)

logger: logging.Logger = logging.getLogger(__name__)


class GlueSource(Source[Entity]):
    def __init__(self, config: GlueConnection, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.status = SQLSourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service = get_database_service_or_create(
            config=config,
            metadata_config=metadata_config,
            service_name=self.config.serviceName,
        )
        config_obj = self.config.serviceConnection.__root__.config
        self.storage_service = get_storage_service_or_create(
            {
                "name": config_obj.storageServiceName,
                "serviceType": "S3",
            },
            metadata_config,
        )
        self.task_id_mapping = {}
        self.pipeline_service = get_pipeline_service_or_create(
            {
                "name": config_obj.pipelineServiceName,
                "serviceType": "Glue",
                "pipelineUrl": config_obj.endPointURL
                if config_obj.endPointURL is not None
                else f"https://glue.{config_obj.awsRegion}.amazonaws.com",
            },
            metadata_config,
        )
        self.glue = AWSClient(config_obj).get_client("glue")
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

    def assign_next_token_db(self, glue_db_resp):
        if "NextToken" in glue_db_resp:
            self.next_db_token = glue_db_resp["NextToken"]
        else:
            self.next_db_token = "break"

    def next_record(self) -> Iterable[Entity]:
        while True:
            if self.next_db_token == "break":
                break
            elif self.next_db_token:
                glue_db_resp = self.glue.get_databases(
                    NextToken=self.next_db_token, ResourceShareType="ALL"
                )
                self.assign_next_token_db(glue_db_resp)
            else:
                glue_db_resp = self.glue.get_databases(ResourceShareType="ALL")
                self.assign_next_token_db(glue_db_resp)
            for db in glue_db_resp["DatabaseList"]:

                if filter_by_schema(
                    schema_filter_pattern=self.config.sourceConfig.config.schemaFilterPattern,
                    schema_name=db["Name"],
                ):
                    self.source_status.filter(db["Name"], "Schema pattern not allowed")
                    continue

                self.database_name = db["Name"]
                yield from self.ingest_tables()
        yield from self.ingest_pipelines()

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
            yield Column(**parsed_string)

    def ingest_tables(self, next_tables_token=None) -> Iterable[OMetaDatabaseAndTable]:
        try:
            if next_tables_token is not None:
                glue_resp = self.glue.get_tables(
                    DatabaseName=self.database_name, NextToken=next_tables_token
                )
            else:
                glue_resp = self.glue.get_tables(DatabaseName=self.database_name)
            for table in glue_resp["TableList"]:

                if filter_by_table(
                    self.config.sourceConfig.config.tableFilterPattern,
                    table.get("name"),
                ):
                    self.status.filter(
                        "{}".format(table["name"]),
                        "Table pattern not allowed",
                    )
                    continue
                database_entity = Database(
                    id=uuid.uuid4(),
                    name="default",
                    service=EntityReference(id=self.service.id, type="databaseService"),
                )

                schema_entity = DatabaseSchema(
                    id=uuid.uuid4(),
                    name=table["DatabaseName"],
                    database=EntityReference(id=database_entity.id, type="database"),
                    service=EntityReference(id=self.service.id, type="databaseService"),
                )
                table_name = table["Name"][:255]
                fqn = f"{self.config.serviceName}{FQDN_SEPARATOR}{self.database_name}{FQDN_SEPARATOR}{table_name}"
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

                self.dataset_name = fqn
                table_columns = self.get_columns(table["StorageDescriptor"])
                location_entity = Location(
                    name=table["StorageDescriptor"]["Location"],
                    locationType=location_type,
                    service=EntityReference(
                        id=self.storage_service.id, type="storageService"
                    ),
                )

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
                    description=table["Description"]
                    if hasattr(table, "Description")
                    else "",
                    fullyQualifiedName=fqn[:128],
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
            if "NextToken" in glue_resp:
                yield from self.ingest_tables(glue_resp["NextToken"])
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.debug(traceback.print_exc())
            logger.error(err)

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

    def ingest_pipelines(self) -> Iterable[OMetaDatabaseAndTable]:
        try:
            for workflow in self.glue.list_workflows()["Workflows"]:
                jobs = self.glue.get_workflow(Name=workflow, IncludeGraph=True)[
                    "Workflow"
                ]
                tasks = self.get_tasks(jobs)
                pipeline_ev = Pipeline(
                    id=uuid.uuid4(),
                    name=jobs["Name"],
                    displayName=jobs["Name"],
                    description="",
                    tasks=tasks,
                    service=EntityReference(
                        id=self.pipeline_service.id, type="pipelineService"
                    ),
                )
                yield pipeline_ev
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.debug(traceback.print_exc())
            logger.error(err)

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> None:
        pass
