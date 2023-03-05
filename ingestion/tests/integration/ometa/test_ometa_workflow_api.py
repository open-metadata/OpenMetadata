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
OpenMetadata high-level API Workflow test
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.operations.createWorkflow import (
    CreateWorkflowRequest,
)
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.operations.testServiceConnection import (
    TestServiceConnectionRequest,
)
from metadata.generated.schema.entity.operations.workflow import (
    Workflow,
    WorkflowStatus,
    WorkflowType,
)
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaWorkflowTest(TestCase):
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

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.entity = Workflow(
            id=uuid.uuid4(),
            name="test",
            description="description",
            fullyQualifiedName="test",
            request=TestServiceConnectionRequest(
                serviceType=ServiceType.Database,
                connection=DatabaseConnection(
                    config=MysqlConnection(
                        username="username",
                        password="password",
                        hostPort="http://localhost:1234",
                    )
                ),
            ),
            status=WorkflowStatus.Pending,
            workflowType=WorkflowType.TEST_CONNECTION,
        )

        cls.create = CreateWorkflowRequest(
            name="test",
            description="description",
            workflowType=WorkflowType.TEST_CONNECTION,
            request=TestServiceConnectionRequest(
                serviceType=ServiceType.Database,
                connection=DatabaseConnection(
                    config=MysqlConnection(
                        username="username",
                        password="password",
                        hostPort="http://localhost:1234",
                    )
                ),
            ),
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        id_ = str(cls.metadata.get_by_name(entity=Workflow, fqn="test").id.__root__)

        cls.metadata.delete(
            entity=Workflow,
            entity_id=id_,
            hard_delete=True,
        )

    def test_create(self):
        """
        We can create a Dashboard and we receive it back as Entity
        """

        res: Workflow = self.metadata.create_or_update(data=self.create)

        self.assertEqual(res.name, self.entity.name)
        self.assertEqual(res.description, self.entity.description)
        self.assertEqual(res.workflowType, self.entity.workflowType)
        self.assertEqual(res.status, WorkflowStatus.Pending)
        self.assertEqual(res.owner, None)

    def test_get_name(self):
        """
        We can fetch a Dashboard by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.get_by_name(
            entity=Workflow, fqn=self.entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.entity.name)

    def test_get_id(self):
        """
        We can fetch a Dashboard by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=Workflow, fqn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=Workflow, entity_id=res_name.id)

        self.assertEqual(res_name.id, res.id)

    def test_list(self):
        """
        We can list all our Dashboards
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.list_entities(entity=Workflow, limit=100)

        # Fetch our test Database. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
        assert data
