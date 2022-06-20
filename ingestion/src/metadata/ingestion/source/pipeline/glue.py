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
from typing import Iterable

from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.glueConnection import (
    GlueConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.glueConnection import (
    GlueConnection as GluePipelineConnection,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

GRAPH = "Graph"
NODES = "Nodes"
NAME = "Name"


class GlueSource(Source[Entity]):
    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.status = SQLSourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)

        self.service_connection = self.config.serviceConnection.__root__.config
        self.pipeline_service = self.metadata.get_service_or_create(
            entity=PipelineService,
            config=WorkflowSource(
                type="glue",
                serviceName=self.config.serviceName,
                serviceConnection=PipelineConnection(
                    config=GluePipelineConnection(
                        awsConfig=self.service_connection.awsConfig
                    ),
                ),
                sourceConfig={},
            ),
        )
        self.connection = get_connection(self.service_connection)
        self.glue = self.connection.client

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

        yield from self.ingest_pipelines()

    def get_tasks(self, tasks):
        task_list = []
        for task in tasks[GRAPH][NODES]:
            task_list.append(
                Task(
                    name=task[NAME],
                    displayName=task[NAME],
                    taskType=task["Type"],
                    downstreamTasks=self.get_downstream_tasks(
                        task["UniqueId"], tasks[GRAPH]
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
                    name=jobs[NAME],
                    displayName=jobs[NAME],
                    description="",
                    tasks=tasks,
                    service=EntityReference(
                        id=self.pipeline_service.id, type="pipelineService"
                    ),
                )
                yield pipeline_ev
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> None:
        test_connection(self.connection)
