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
Test status callback
"""
from datetime import datetime, timezone
from unittest import TestCase

from pydantic import BaseModel

from _openmetadata_testutils.ometa import int_admin_ometa
from airflow_provider_openmetadata.lineage.status import add_status, get_dag_status
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    StatusType,
    TaskStatus,
)
from metadata.generated.schema.entity.services.pipelineService import PipelineService

from ..integration_base import (
    generate_name,
    get_create_entity,
    get_create_service,
    get_test_dag,
)


class MockDagRun(BaseModel):
    execution_date: datetime


class MockTaskInstance(BaseModel):
    task_id: str
    state: str
    start_date: datetime
    end_date: datetime
    log_url: str


class TestStatusCallback(TestCase):
    """
    Test Status Callback
    """

    metadata = int_admin_ometa()
    service_name = generate_name()
    pipeline_name = generate_name()

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients: Pipeline Entity
        """
        create_service = get_create_service(
            entity=PipelineService, name=cls.service_name
        )
        cls.metadata.create_or_update(create_service)

        create_pipeline = get_create_entity(
            entity=Pipeline, name=cls.pipeline_name, reference=cls.service_name.root
        )
        cls.pipeline: Pipeline = cls.metadata.create_or_update(create_pipeline)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=PipelineService, fqn=cls.service_name.root
            ).id.root
        )

        cls.metadata.delete(
            entity=PipelineService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_get_dag_status(self):
        """Check the logic when passing DAG status"""

        # If we need more task status, the DAG is marked as pending
        all_tasks = ["task1", "task2"]
        task_status = [TaskStatus(name="task1", executionStatus=StatusType.Successful)]
        self.assertEqual(StatusType.Pending, get_dag_status(all_tasks, task_status))

        # If a task is failed, DAG is flagged as failed
        all_tasks = ["task1", "task2"]
        task_status = [
            TaskStatus(name="task1", executionStatus=StatusType.Successful),
            TaskStatus(name="task2", executionStatus=StatusType.Failed),
        ]
        self.assertEqual(StatusType.Failed, get_dag_status(all_tasks, task_status))

        # If all tasks are successful, DAG is marked as successful
        all_tasks = ["task1", "task2"]
        task_status = [
            TaskStatus(name="task1", executionStatus=StatusType.Successful),
            TaskStatus(name="task2", executionStatus=StatusType.Successful),
        ]
        self.assertEqual(StatusType.Successful, get_dag_status(all_tasks, task_status))

    def test_add_status(self):
        """Status gets properly added to the Pipeline Entity"""

        now = datetime.now(timezone.utc)

        dag = get_test_dag(self.pipeline_name.root)

        # Use the first tasks as operator we are processing in the callback
        operator = dag.tasks[0]

        # Patching a DagRun since we only pick up the execution_date
        dag_run = MockDagRun(execution_date=now)

        # Patching a TaskInstance
        task_instance = MockTaskInstance(
            task_id=operator.task_id,
            state="success",
            start_date=now,
            end_date=now,
            log_url="https://example.com",
        )

        context = {"dag": dag, "dag_run": dag_run, "task_instance": task_instance}

        add_status(
            operator=operator,
            pipeline=self.pipeline,
            metadata=self.metadata,
            context=context,
        )

        updated_pipeline: Pipeline = self.metadata.get_by_name(
            entity=Pipeline,
            fqn=self.pipeline.fullyQualifiedName,
            fields=["pipelineStatus"],
        )

        # DAG status is Pending since we only have the status of a single task
        self.assertEqual(
            StatusType.Pending, updated_pipeline.pipelineStatus.executionStatus
        )
        self.assertEqual(
            StatusType.Successful,
            updated_pipeline.pipelineStatus.taskStatus[0].executionStatus,
        )
