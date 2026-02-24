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
OpenMetadata high-level API Pipeline test
"""
from datetime import datetime

import pytest

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.utils.helpers import datetime_to_ts


@pytest.fixture
def pipeline_request(pipeline_service):
    """Create pipeline request using the pipeline service from conftest."""
    return CreatePipelineRequest(
        name="test",
        service=pipeline_service.fullyQualifiedName,
    )


@pytest.fixture
def expected_fqn(pipeline_service):
    """Expected fully qualified name for test pipeline."""
    return f"{pipeline_service.name.root}.test"


class TestOMetaPipelineAPI:
    """
    Pipeline API integration tests.
    Tests CRUD operations, versioning, entity references, and pipeline-specific features.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - pipeline_service: PipelineService (module scope)
    - create_user: User factory (function scope)
    - create_pipeline: Pipeline factory (function scope)
    """

    def test_create(
        self,
        metadata,
        pipeline_service,
        pipeline_request,
        expected_fqn,
        create_pipeline,
    ):
        """
        We can create a Pipeline and we receive it back as Entity
        """
        res = create_pipeline(pipeline_request)

        assert res.name.root == "test"
        assert res.service.id == pipeline_service.id
        assert res.owners is None

        # Verify persistence by fetching from backend
        fetched = metadata.get_by_name(entity=Pipeline, fqn=expected_fqn)
        assert fetched is not None
        assert fetched.id == res.id

    def test_update(
        self,
        metadata,
        pipeline_service,
        pipeline_request,
        create_user,
        create_pipeline,
    ):
        """
        Updating it properly changes its properties
        """
        user = create_user()
        owners = EntityReferenceList(root=[EntityReference(id=user.id, type="user")])

        # Create pipeline
        res_create = create_pipeline(pipeline_request)

        # Update with owners
        updated = pipeline_request.model_dump(exclude_unset=True)
        updated["owners"] = owners
        updated_entity = CreatePipelineRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        # Verify update
        assert (
            res.service.fullyQualifiedName == pipeline_service.fullyQualifiedName.root
        )
        assert res_create.id == res.id
        assert res.owners.root[0].id == user.id

    def test_get_name(self, metadata, pipeline_request, expected_fqn, create_pipeline):
        """
        We can fetch a Pipeline by name and get it back as Entity
        """
        created = create_pipeline(pipeline_request)

        res = metadata.get_by_name(entity=Pipeline, fqn=expected_fqn)
        assert res.name.root == created.name.root

    def test_get_id(self, metadata, pipeline_request, expected_fqn, create_pipeline):
        """
        We can fetch a Pipeline by ID and get it back as Entity
        """
        create_pipeline(pipeline_request)

        # First pick up by name
        res_name = metadata.get_by_name(entity=Pipeline, fqn=expected_fqn)
        # Then fetch by ID
        res = metadata.get_by_id(entity=Pipeline, entity_id=res_name.id)

        assert res_name.id == res.id

    def test_list(self, metadata, pipeline_request, create_pipeline):
        """
        We can list all our Pipelines
        """
        created = create_pipeline(pipeline_request)

        res = metadata.list_entities(entity=Pipeline, limit=100)

        # Fetch our test Pipeline. We have already inserted it, so we should find it
        data = next(iter(ent for ent in res.entities if ent.name == created.name), None)
        assert data is not None

    def test_delete(self, metadata, pipeline_request, expected_fqn, create_pipeline):
        """
        We can delete a Pipeline by ID
        """
        created = create_pipeline(pipeline_request)

        # Delete
        metadata.delete(entity=Pipeline, entity_id=str(created.id.root))

        # Verify deletion - get_by_name should return None
        deleted = metadata.get_by_name(entity=Pipeline, fqn=expected_fqn)
        assert deleted is None

    def test_list_versions(self, metadata, pipeline_request, create_pipeline):
        """
        Test listing pipeline entity versions
        """
        created = create_pipeline(pipeline_request)

        res = metadata.get_list_entity_versions(
            entity=Pipeline, entity_id=created.id.root
        )
        assert res is not None
        assert len(res.versions) >= 1

    def test_get_entity_version(self, metadata, pipeline_request, create_pipeline):
        """
        Test retrieving a specific pipeline entity version
        """
        created = create_pipeline(pipeline_request)

        res = metadata.get_entity_version(
            entity=Pipeline, entity_id=created.id.root, version=0.1
        )

        # Check we get the correct version requested and the correct entity ID
        assert res.version.root == 0.1
        assert res.id == created.id

    def test_get_entity_ref(self, metadata, pipeline_request, create_pipeline):
        """
        Test retrieving EntityReference for a pipeline
        """
        created = create_pipeline(pipeline_request)
        entity_ref = metadata.get_entity_reference(
            entity=Pipeline, fqn=created.fullyQualifiedName
        )

        assert created.id == entity_ref.id

    def test_add_status(self, metadata, pipeline_service, create_pipeline):
        """
        We can add status data
        """
        create_pipeline_req = CreatePipelineRequest(
            name="pipeline-test",
            service=pipeline_service.fullyQualifiedName,
            tasks=[
                Task(name="task1"),
                Task(name="task2"),
            ],
        )

        pipeline = create_pipeline(create_pipeline_req)
        execution_ts = datetime_to_ts(datetime.strptime("2021-03-07", "%Y-%m-%d"))

        updated = metadata.add_pipeline_status(
            fqn=pipeline.fullyQualifiedName.root,
            status=PipelineStatus(
                timestamp=execution_ts,
                executionStatus=StatusType.Successful,
                taskStatus=[
                    TaskStatus(name="task1", executionStatus=StatusType.Successful),
                ],
            ),
        )

        # We get a list of status
        assert updated.pipelineStatus.timestamp.root == execution_ts
        assert len(updated.pipelineStatus.taskStatus) == 1

    def test_add_pipeline_status_with_special_chars(
        self, metadata, pipeline_service, create_pipeline
    ):
        """
        Test adding pipeline status when pipeline name contains special characters
        """
        create_pipeline_req = CreatePipelineRequest(
            name="Pipeline/Name (test)",
            service=pipeline_service.fullyQualifiedName,
            tasks=[
                Task(name="task1"),
            ],
        )

        pipeline = create_pipeline(create_pipeline_req)
        execution_ts = datetime_to_ts(datetime.strptime("2021-03-07", "%Y-%m-%d"))

        # Add status using the pipeline's FQN directly - should not raise 404/500 error
        updated = metadata.add_pipeline_status(
            fqn=pipeline.fullyQualifiedName.root,
            status=PipelineStatus(
                timestamp=execution_ts,
                executionStatus=StatusType.Successful,
                taskStatus=[
                    TaskStatus(name="task1", executionStatus=StatusType.Successful),
                ],
            ),
        )

        assert updated is not None
        assert updated.pipelineStatus is not None
        assert updated.pipelineStatus.executionStatus == StatusType.Successful
        assert updated.pipelineStatus.timestamp.root == execution_ts

    def test_add_tasks(self, metadata, pipeline_service, create_pipeline):
        """
        Check the add task logic
        """
        create_pipeline_req = CreatePipelineRequest(
            name="pipeline-test",
            service=pipeline_service.fullyQualifiedName,
            tasks=[
                Task(name="task1"),
                Task(name="task2"),
            ],
        )

        pipeline = create_pipeline(create_pipeline_req)

        # Add new tasks
        updated_pipeline = metadata.add_task_to_pipeline(
            pipeline,
            Task(name="task3"),
        )

        assert len(updated_pipeline.tasks) == 3

        # Update a task already added
        updated_pipeline = metadata.add_task_to_pipeline(
            pipeline,
            Task(name="task3", displayName="TaskDisplay"),
        )

        assert len(updated_pipeline.tasks) == 3
        assert next(
            iter(
                task
                for task in updated_pipeline.tasks
                if task.displayName == "TaskDisplay"
            )
        )

        # Add more than one task at a time
        new_tasks = [
            Task(name="task3"),
            Task(name="task4"),
        ]
        updated_pipeline = metadata.add_task_to_pipeline(pipeline, *new_tasks)

        assert len(updated_pipeline.tasks) == 4

    def test_add_tasks_to_empty_pipeline(
        self, metadata, pipeline_request, create_pipeline
    ):
        """
        We can add tasks to a pipeline without tasks
        """
        pipeline = create_pipeline(pipeline_request)

        updated_pipeline = metadata.add_task_to_pipeline(
            pipeline,
            Task(name="task", displayName="TaskDisplay"),
        )

        assert len(updated_pipeline.tasks) == 1

    def test_clean_tasks(self, metadata, pipeline_service, create_pipeline):
        """
        Check that we can remove Pipeline tasks
        if they are not part of the list arg
        """
        create_pipeline_req = CreatePipelineRequest(
            name="pipeline-test",
            service=pipeline_service.fullyQualifiedName,
            tasks=[
                Task(name="task1"),
                Task(name="task2"),
                Task(name="task3"),
                Task(name="task4"),
            ],
        )

        pipeline = create_pipeline(create_pipeline_req)

        metadata.clean_pipeline_tasks(pipeline=pipeline, task_ids=["task3", "task4"])

        updated_pipeline = metadata.get_by_name(
            entity=Pipeline,
            fqn=pipeline.fullyQualifiedName.root,
            fields=["tasks"],
        )

        assert len(updated_pipeline.tasks) == 2
        assert {task.name for task in updated_pipeline.tasks} == {"task3", "task4"}
