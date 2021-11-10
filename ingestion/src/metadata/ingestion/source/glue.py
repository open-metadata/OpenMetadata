import logging
import os
import traceback
import uuid
from typing import Iterable

import boto3

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import ConfigModel, IncludeFilterPattern, Record
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sample_data import get_pipeline_service_or_create
from metadata.ingestion.source.sql_source import SQLSourceStatus
from metadata.utils.column_helpers import check_column_complex_type
from metadata.utils.helpers import get_database_service_or_create

logger: logging.Logger = logging.getLogger(__name__)


class GlueSourceConfig(ConfigModel):
    service_type = "Glue"
    aws_access_key_id: str
    aws_secret_access_key: str
    endpoint_url: str
    region_name: str
    database: str
    service_name: str
    host_port: str = ""
    filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()

    def get_service_type(self) -> DatabaseServiceType:
        return DatabaseServiceType[self.service_type]


class GlueSource(Source):
    def __init__(
        self, config: GlueSourceConfig, metadata_config: MetadataServerConfig, ctx
    ):
        super().__init__(ctx)
        self.status = SQLSourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service = get_database_service_or_create(config, metadata_config)
        self.task_id_mapping = {}
        self.pipeline_service = get_pipeline_service_or_create(
            {
                "name": self.config.service_name,
                "serviceType": "Glue",
                "pipelineUrl": self.config.endpoint_url,
            },
            metadata_config,
        )
        os.environ["AWS_ACCESS_KEY_ID"] = self.config.aws_access_key_id
        os.environ["AWS_SECRET_ACCESS_KEY"] = self.config.aws_secret_access_key
        self.glue = boto3.client(
            service_name="glue",
            region_name=self.config.region_name,
            endpoint_url=self.config.endpoint_url,
        )

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = GlueSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Record]:
        yield from self.ingest_tables()
        yield from self.ingest_pipelines()

    def get_columns(self, columnData):
        row_order = 0
        for column in columnData["Columns"]:
            if column["Type"].lower().startswith("union"):
                column["Type"] = column["Type"].replace(" ", "")
            (
                col_type,
                data_type_display,
                arr_data_type,
                children,
            ) = check_column_complex_type(
                self.status, self.dataset_name, column["Type"].lower(), column["Name"]
            )
            yield Column(
                name=column["Name"],
                description="",
                dataType=col_type,
                dataTypeDisplay="{}({})".format(col_type, 1)
                if data_type_display is None
                else f"{data_type_display}",
                ordinalPosition=row_order,
                children=children,
                arrayDataType=arr_data_type,
            )
            row_order += 1

    def ingest_tables(self) -> Iterable[OMetaDatabaseAndTable]:
        try:
            for tables in self.glue.get_tables(DatabaseName=self.config.database)[
                "TableList"
            ]:
                if not self.config.filter_pattern.included(tables["Name"]):
                    self.status.filter(
                        "{}.{}".format(self.config.get_service_name(), tables["Name"]),
                        "Table pattern not allowed",
                    )
                    continue
                database_entity = Database(
                    name=tables["DatabaseName"],
                    service=EntityReference(
                        id=self.service.id, type=self.config.service_type
                    ),
                )
                fqn = f"{self.config.service_name}.{self.config.database}.{tables['Name']}"
                self.dataset_name = fqn
                table_columns = self.get_columns(tables["StorageDescriptor"])
                table_entity = Table(
                    id=uuid.uuid4(),
                    name=tables["Name"],
                    description=tables["Description"]
                    if hasattr(tables, "Description")
                    else "",
                    fullyQualifiedName=fqn,
                    columns=table_columns,
                )
                table_and_db = OMetaDatabaseAndTable(
                    table=table_entity, database=database_entity
                )
                yield table_and_db
        except Exception as err:
            logger.error(traceback.format_exc())
            logger.error(traceback.print_exc())
            logger.error(err)

    def get_downstream_tasks(self, task_unique_id, tasks):
        downstreamTasks = []
        for edges in tasks["Edges"]:
            if edges["SourceId"] == task_unique_id:
                if edges["DestinationId"] in self.task_id_mapping.values():
                    downstreamTasks.append(
                        list(self.task_id_mapping.keys())[
                            list(self.task_id_mapping.values()).index(
                                edges["DestinationId"]
                            )
                        ]
                    )
        return downstreamTasks

    def get_tasks(self, tasks):
        taskList = []
        for task in tasks["Graph"]["Nodes"]:
            self.task_id_mapping[task["Name"]] = task["UniqueId"]
        for task in tasks["Graph"]["Nodes"]:
            taskList.append(
                Task(
                    name=task["Name"],
                    displayName=task["Name"],
                    taskType=task["Type"],
                    downstreamTasks=self.get_downstream_tasks(
                        task["UniqueId"], tasks["Graph"]
                    ),
                )
            )
        return taskList

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
            logger.error(traceback.format_exc())
            logger.error(traceback.print_exc())
            logger.error(err)

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status
