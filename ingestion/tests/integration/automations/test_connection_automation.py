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
import sys

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
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    StatusType,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.ingestion.source.connections import get_test_connection_fn

if sys.version_info < (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


def test_connection_workflow(metadata, mysql_container):
    """
    Test all the steps related to the test connection automation workflow
    """

    service_connection = MysqlConnection(
        username=mysql_container.username,
        authType=BasicAuth(password=mysql_container.password),
        hostPort=f"localhost:{mysql_container.get_exposed_port(3306)}",
    )

    new_workflow_request = CreateWorkflowRequest(
        name="test-connection-mysql",
        description="description",
        workflowType=WorkflowType.TEST_CONNECTION,
        request=TestServiceConnectionRequest(
            serviceType=ServiceType.Database,
            connectionType=MySQLType.Mysql.value,
            connection=DatabaseConnection(
                config=service_connection,
            ),
        ),
    )

    automation_workflow: Workflow = metadata.create_or_update(data=new_workflow_request)

    test_connection_fn = get_test_connection_fn(service_connection)
    test_connection_fn(metadata, automation_workflow=automation_workflow)

    final_workflow: Workflow = metadata.get_by_name(
        entity=Workflow, fqn="test-connection-mysql"
    )

    assert final_workflow.status == WorkflowStatus.Successful
    assert len(final_workflow.response.steps) == 5
    # Get queries is not passing since we're not enabling the logs in the container
    assert final_workflow.response.status.value == StatusType.Failed.value
    steps = [
        step for step in final_workflow.response.steps if step.name != "GetQueries"
    ]
    assert all(step.passed for step in steps)

    metadata.delete(
        entity=Workflow,
        entity_id=str(automation_workflow.id.root),
        hard_delete=True,
    )


def test_connection_workflow_ko(metadata):
    """Test connection that will fail"""
    wrong_service_connection = MysqlConnection(
        username="openmetadata_user",
        authType=BasicAuth(password="openmetadata_password"),
        hostPort="localhost:8585",  # There's something running there, but it's not MySQL
        databaseSchema="openmetadata_db",
    )

    wrong_workflow_request = CreateWorkflowRequest(
        name="test-connection-mysql-bad",
        description="description",
        workflowType=WorkflowType.TEST_CONNECTION,
        request=TestServiceConnectionRequest(
            serviceType=ServiceType.Database,
            connectionType=MySQLType.Mysql.value,
            connection=DatabaseConnection(
                config=wrong_service_connection,
            ),
        ),
    )

    automation_workflow: Workflow = metadata.create_or_update(
        data=wrong_workflow_request
    )

    test_connection_fn = get_test_connection_fn(wrong_service_connection)
    test_connection_fn(metadata, automation_workflow=automation_workflow)

    final_workflow: Workflow = metadata.get_by_name(
        entity=Workflow, fqn="test-connection-mysql-bad"
    )

    assert final_workflow.response.status == StatusType.Failed

    metadata.delete(
        entity=Workflow,
        entity_id=str(automation_workflow.id.root),
        hard_delete=True,
    )
