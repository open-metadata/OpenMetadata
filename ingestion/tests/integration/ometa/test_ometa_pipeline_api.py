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
OpenMetadata high-level API Pipeline test
"""
import uuid
from datetime import datetime
from unittest import TestCase

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.backendConnection import (
    BackendConnection,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.helpers import datetime_to_ts


class OMetaPipelineTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    user = metadata.create_or_update(
        data=CreateUserRequest(name="random-user", email="random@user.com"),
    )
    owner = EntityReference(id=user.id, type="user")

    service = CreatePipelineServiceRequest(
        name="test-service-pipeline",
        serviceType=PipelineServiceType.Airflow,
        connection=PipelineConnection(
            config=AirflowConnection(
                hostPort="http://localhost:8080",
                connection=BackendConnection(),
            ),
        ),
    )
    service_type = "pipelineService"

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """
        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        cls.entity = Pipeline(
            id=uuid.uuid4(),
            name="test",
            service=cls.service_entity.fullyQualifiedName,
            fullyQualifiedName="test-service-pipeline.test",
        )

        cls.create = CreatePipelineRequest(
            name="test",
            service=cls.service_entity.fullyQualifiedName,
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=PipelineService, fqn="test-service-pipeline"
            ).id.__root__
        )

        cls.metadata.delete(
            entity=PipelineService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_create(self):
        """
        We can create a Pipeline and we receive it back as Entity
        """

        res = self.metadata.create_or_update(data=self.create)

        self.assertEqual(res.name, self.entity.name)
        self.assertEqual(res.service.id, self.entity.service.id)
        self.assertEqual(res.owner, None)

    def test_update(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.create)

        updated = self.create.dict(exclude_unset=True)
        updated["owner"] = self.owner
        updated_entity = CreatePipelineRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated algorithm
        self.assertEqual(res.service.id, updated_entity.service.id)
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owner.id, self.user.id)

    def test_get_name(self):
        """
        We can fetch a Pipeline by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.get_by_name(
            entity=Pipeline, fqn=self.entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.entity.name)

    def test_get_id(self):
        """
        We can fetch a Pipeline by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=Pipeline, fqn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=Pipeline, entity_id=res_name.id)

        self.assertEqual(res_name.id, res.id)

    def test_list(self):
        """
        We can list all our Pipelines
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.list_entities(entity=Pipeline, limit=100)

        # Fetch our test Database. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
        assert data

    def test_delete(self):
        """
        We can delete a Pipeline by ID
        """

        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Pipeline, fqn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(
            entity=Pipeline, entity_id=str(res_name.id.__root__)
        )

        # Delete
        self.metadata.delete(entity=Pipeline, entity_id=str(res_id.id.__root__))

        # Then we should not find it
        res = self.metadata.list_entities(entity=Pipeline)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == self.entity.fullyQualifiedName
            ),
            None,
        )

    def test_add_status(self):
        """
        We can add status data
        """

        create_pipeline = CreatePipelineRequest(
            name="pipeline-test",
            service=self.service_entity.fullyQualifiedName,
            tasks=[
                Task(name="task1"),
                Task(name="task2"),
            ],
        )

        pipeline: Pipeline = self.metadata.create_or_update(data=create_pipeline)
        execution_ts = datetime_to_ts(datetime.strptime("2021-03-07", "%Y-%m-%d"))

        updated = self.metadata.add_pipeline_status(
            fqn=pipeline.fullyQualifiedName.__root__,
            status=PipelineStatus(
                timestamp=execution_ts,
                executionStatus=StatusType.Successful,
                taskStatus=[
                    TaskStatus(name="task1", executionStatus=StatusType.Successful),
                ],
            ),
        )

        # We get a list of status
        assert updated.pipelineStatus.timestamp.__root__ == execution_ts
        assert len(updated.pipelineStatus.taskStatus) == 1

        # Disabled as throwing an error regarding service key not present
        # should be fixed in https://github.com/open-metadata/OpenMetadata/issues/5661
        # # Check that we can update a given status properly
        # updated = self.metadata.add_pipeline_status(
        #     pipeline=pipeline,
        #     status=PipelineStatus(
        #         timestamp=execution_ts,
        #         executionStatus=StatusType.Successful,
        #         taskStatus=[
        #             TaskStatus(name="task1", executionStatus=StatusType.Successful),
        #             TaskStatus(name="task2", executionStatus=StatusType.Successful),
        #         ],
        #     ),
        # )

        # assert updated.pipelineStatus[0].executionDate.__root__ == execution_ts
        # assert len(updated.pipelineStatus[0].taskStatus) == 2

        # # Cleanup
        # self.metadata.delete(entity=Pipeline, entity_id=pipeline.id)

    def test_add_tasks(self):
        """
        Check the add task logic
        """

        create_pipeline = CreatePipelineRequest(
            name="pipeline-test",
            service=self.service_entity.fullyQualifiedName,
            tasks=[
                Task(name="task1"),
                Task(name="task2"),
            ],
        )

        pipeline = self.metadata.create_or_update(data=create_pipeline)

        # Add new tasks
        updated_pipeline = self.metadata.add_task_to_pipeline(
            pipeline,
            Task(name="task3"),
        )

        assert len(updated_pipeline.tasks) == 3

        # Update a task already added
        updated_pipeline = self.metadata.add_task_to_pipeline(
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
        updated_pipeline = self.metadata.add_task_to_pipeline(pipeline, *new_tasks)

        assert len(updated_pipeline.tasks) == 4

        # Cleanup
        self.metadata.delete(entity=Pipeline, entity_id=pipeline.id)

    def test_add_tasks_to_empty_pipeline(self):
        """
        We can add tasks to a pipeline without tasks
        """

        pipeline = self.metadata.create_or_update(data=self.create)

        updated_pipeline = self.metadata.add_task_to_pipeline(
            pipeline,
            Task(name="task", displayName="TaskDisplay"),
        )

        assert len(updated_pipeline.tasks) == 1

    def test_clean_tasks(self):
        """
        Check that we can remove Pipeline tasks
        if they are not part of the list arg
        """

        create_pipeline = CreatePipelineRequest(
            name="pipeline-test",
            service=self.service_entity.fullyQualifiedName,
            tasks=[
                Task(name="task1"),
                Task(name="task2"),
                Task(name="task3"),
                Task(name="task4"),
            ],
        )

        pipeline = self.metadata.create_or_update(data=create_pipeline)

        self.metadata.clean_pipeline_tasks(
            pipeline=pipeline, task_ids=["task3", "task4"]
        )

        updated_pipeline = self.metadata.get_by_name(
            entity=Pipeline,
            fqn="test-service-pipeline.pipeline-test",
            fields=["tasks"],
        )

        assert len(updated_pipeline.tasks) == 2
        assert {task.name for task in updated_pipeline.tasks} == {"task3", "task4"}

        # Cleanup
        self.metadata.delete(entity=Pipeline, entity_id=pipeline.id)

    def test_list_versions(self):
        """
        test list pipeline entity versions
        """
        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Pipeline, fqn=self.entity.fullyQualifiedName
        )

        res = self.metadata.get_list_entity_versions(
            entity=Pipeline, entity_id=res_name.id.__root__
        )
        assert res

    def test_get_entity_version(self):
        """
        test get pipeline entity version
        """
        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Pipeline, fqn=self.entity.fullyQualifiedName
        )
        res = self.metadata.get_entity_version(
            entity=Pipeline, entity_id=res_name.id.__root__, version=0.1
        )

        # check we get the correct version requested and the correct entity ID
        assert res.version.__root__ == 0.1
        assert res.id == res_name.id

    def test_get_entity_ref(self):
        """
        test get EntityReference
        """
        res = self.metadata.create_or_update(data=self.create)
        entity_ref = self.metadata.get_entity_reference(
            entity=Pipeline, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id
