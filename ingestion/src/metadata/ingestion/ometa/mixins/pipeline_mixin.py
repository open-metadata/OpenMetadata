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
Mixin class containing Pipeline specific methods

To be used by OpenMetadata class
"""
from typing import List

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    Task,
)
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import ometa_logger

logger = ometa_logger()


class OMetaPipelineMixin:
    """
    OpenMetadata API methods related to the Pipeline Entity

    To be inherited by OpenMetadata
    """

    client: REST

    def add_pipeline_status(self, fqn: str, status: PipelineStatus) -> Pipeline:
        """
        Given a pipeline and a PipelineStatus, send it
        to the Pipeline Entity
        """
        resp = self.client.put(
            f"{self.get_suffix(Pipeline)}/{fqn}/status",
            data=status.json(),
        )

        return Pipeline(**resp)

    def add_task_to_pipeline(self, pipeline: Pipeline, *tasks: Task) -> Pipeline:
        """
        The background logic for this method is that during
        Airflow backend lineage, we compute one task at
        a time.

        Let's generalise a bit the approach by preparing
        a method capable of updating a tuple of tasks
        from the client.

        Latest changes leave all the task management
        to the client. Therefore, a Pipeline will only contain
        the tasks sent in each PUT from the client.
        """

        # Get the names of all incoming tasks
        updated_tasks_names = {task.name for task in tasks}

        # Check which tasks are currently in the pipeline but not being updated
        not_updated_tasks = []
        if pipeline.tasks:
            not_updated_tasks = [
                task for task in pipeline.tasks if task.name not in updated_tasks_names
            ]

        # All tasks are the union of the incoming tasks & the not updated tasks
        all_tasks = [*tasks, *not_updated_tasks]

        updated_pipeline = CreatePipelineRequest(
            name=pipeline.name,
            displayName=pipeline.displayName,
            description=pipeline.description,
            pipelineUrl=pipeline.pipelineUrl,
            concurrency=pipeline.concurrency,
            pipelineLocation=pipeline.pipelineLocation,
            startDate=pipeline.startDate,
            service=pipeline.service,
            tasks=all_tasks,
            owner=pipeline.owner,
            tags=pipeline.tags,
        )

        return self.create_or_update(updated_pipeline)

    def clean_pipeline_tasks(self, pipeline: Pipeline, task_ids: List[str]) -> Pipeline:
        """
        Given a list of tasks, remove from the
        Pipeline Entity those that are not received
        as an input.

        e.g., if a Pipeline has tasks A, B, C,
        but we only receive A & C, we will
        remove the task B from the entity
        """

        updated_pipeline = CreatePipelineRequest(
            name=pipeline.name,
            displayName=pipeline.displayName,
            description=pipeline.description,
            pipelineUrl=pipeline.pipelineUrl,
            concurrency=pipeline.concurrency,
            pipelineLocation=pipeline.pipelineLocation,
            startDate=pipeline.startDate,
            service=pipeline.service,
            tasks=[task for task in pipeline.tasks if task.name in task_ids],
            owner=pipeline.owner,
            tags=pipeline.tags,
        )

        return self.create_or_update(updated_pipeline)
