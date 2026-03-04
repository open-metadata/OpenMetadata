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
OpenMetadata high-level API Workflow test
"""
import pytest

from metadata.generated.schema.api.automations.createWorkflow import (
    CreateWorkflowRequest,
)
from metadata.generated.schema.entity.automations.testServiceConnection import (
    TestServiceConnectionRequest,
)
from metadata.generated.schema.entity.automations.workflow import (
    Workflow,
    WorkflowStatus,
    WorkflowType,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
    MySQLType,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.entity.services.serviceType import ServiceType


@pytest.fixture
def workflow_request():
    """Create workflow request for test connection workflow."""
    return CreateWorkflowRequest(
        name="test",
        description="description",
        workflowType=WorkflowType.TEST_CONNECTION,
        request=TestServiceConnectionRequest(
            serviceType=ServiceType.Database,
            connectionType=MySQLType.Mysql.value,
            connection=DatabaseConnection(
                config=MysqlConnection(
                    username="username",
                    authType=BasicAuth(
                        password="password",
                    ),
                    hostPort="http://localhost:1234",
                )
            ),
        ),
    )


@pytest.fixture
def expected_fqn():
    """Expected fully qualified name for test workflow."""
    return "test"


class TestOMetaWorkflowAPI:
    """
    Workflow API integration tests.
    Tests CRUD operations for test connection workflows.

    Uses fixtures from conftest:
    - metadata_ingestion_bot: OpenMetadata client authenticated as ingestion-bot
      (required to see password fields)
    - create_workflow: Workflow factory (function scope)
    """

    def test_create(
        self, metadata_ingestion_bot, workflow_request, expected_fqn, create_workflow
    ):
        """
        We can create a Workflow and we receive it back as Entity
        """
        res = create_workflow(workflow_request)

        assert res.name.root == "test"
        assert res.description.root == "description"
        assert res.workflowType == WorkflowType.TEST_CONNECTION
        assert res.status == WorkflowStatus.Pending
        assert res.owners is None

        fetched = metadata_ingestion_bot.get_by_name(entity=Workflow, fqn=expected_fqn)
        assert fetched is not None
        assert fetched.id == res.id

    def test_get_name(
        self, metadata_ingestion_bot, workflow_request, expected_fqn, create_workflow
    ):
        """
        We can fetch a Workflow by name and get it back as Entity
        """
        created = create_workflow(workflow_request)

        res = metadata_ingestion_bot.get_by_name(entity=Workflow, fqn=expected_fqn)
        assert res.name.root == created.name.root

        assert (
            res.request.connection.config.authType.password.get_secret_value()
            == "password"
        )

    def test_get_id(
        self, metadata_ingestion_bot, workflow_request, expected_fqn, create_workflow
    ):
        """
        We can fetch a Workflow by ID and get it back as Entity
        """
        create_workflow(workflow_request)

        res_name = metadata_ingestion_bot.get_by_name(entity=Workflow, fqn=expected_fqn)
        res = metadata_ingestion_bot.get_by_id(entity=Workflow, entity_id=res_name.id)

        assert res_name.id == res.id

    def test_list(self, metadata_ingestion_bot, workflow_request, create_workflow):
        """
        We can list all our Workflows
        """
        created = create_workflow(workflow_request)

        res = metadata_ingestion_bot.list_entities(entity=Workflow, limit=100)

        data = next(iter(ent for ent in res.entities if ent.name == created.name), None)
        assert data is not None
