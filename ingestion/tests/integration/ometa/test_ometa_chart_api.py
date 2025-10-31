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
OpenMetadata high-level API Chart test
"""
import uuid
from unittest import TestCase

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList

from ..integration_base import get_create_entity


class OMetaChartTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    metadata = int_admin_ometa()

    user: User = metadata.create_or_update(data=get_create_entity(User, reference=None))
    owners = EntityReferenceList(
        root=[
            EntityReference(
                id=user.id,
                type="user",
                fullyQualifiedName=user.fullyQualifiedName.root,
            )
        ]
    )

    service = CreateDashboardServiceRequest(
        name="test-service-chart",
        serviceType=DashboardServiceType.Looker,
        connection=DashboardConnection(
            config=LookerConnection(
                hostPort="http://hostPort", clientId="id", clientSecret="secret"
            )
        ),
    )
    service_type = "dashboardService"

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """
        cls.service_entity = cls.metadata.create_or_update(data=cls.service)
        service_fqn = cls.service_entity.fullyQualifiedName.root

        cls.entity = Chart(
            id=uuid.uuid4(),
            name="test",
            service=EntityReference(
                id=cls.service_entity.id,
                type="dashboardService",
                fullyQualifiedName=service_fqn,
            ),
            fullyQualifiedName=f"{service_fqn}.test",
        )

        cls.create = CreateChartRequest(
            name="test",
            service=cls.service_entity.fullyQualifiedName,
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        cls.metadata.delete(
            entity=DashboardService,
            entity_id=str(cls.service_entity.id.root),
            recursive=True,
            hard_delete=True,
        )

    def test_create(self):
        """
        We can create a Chart and we receive it back as Entity
        """

        res = self.metadata.create_or_update(data=self.create)

        self.assertEqual(res.name, self.entity.name)
        self.assertEqual(res.service.id, self.entity.service.id)
        self.assertIsNone(res.owners)

    def test_update(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.create)

        updated = self.create.model_dump(exclude_unset=True)
        updated["owners"] = self.owners
        updated_entity = CreateChartRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated algorithm
        self.assertEqual(res.service.fullyQualifiedName, updated_entity.service.root)
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owners.root[0].id, self.user.id)

    def test_get_name(self):
        """
        We can fetch a Chart by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.get_by_name(
            entity=Chart, fqn=self.entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.entity.name)

    def test_get_id(self):
        """
        We can fetch a Chart by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=Chart, fqn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=Chart, entity_id=res_name.id)

        self.assertEqual(res_name.id, res.id)

    def test_list(self):
        """
        We can list all our Charts
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.list_entities(entity=Chart, limit=100)

        # Fetch our test Database. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
        assert data

    def test_delete(self):
        """
        We can delete a Chart by ID
        """

        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Chart, fqn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(entity=Chart, entity_id=str(res_name.id.root))

        # Delete
        self.metadata.delete(entity=Chart, entity_id=str(res_id.id.root))

        # Then we should not find it
        res = self.metadata.list_entities(entity=Chart)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == self.entity.fullyQualifiedName
            ),
            None,
        )

    def test_list_versions(self):
        """
        test list chart entity versions
        """
        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Chart, fqn=self.entity.fullyQualifiedName
        )

        res = self.metadata.get_list_entity_versions(
            entity=Chart, entity_id=res_name.id.root
        )
        assert res

    def test_get_entity_version(self):
        """
        test get chart entity version
        """
        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Chart, fqn=self.entity.fullyQualifiedName
        )
        res = self.metadata.get_entity_version(
            entity=Chart, entity_id=res_name.id.root, version=0.1
        )

        # check we get the correct version requested and the correct entity ID
        assert res.version.root == 0.1
        assert res.id == res_name.id

    def test_get_entity_ref(self):
        """
        test get EntityReference
        """
        res = self.metadata.create_or_update(data=self.create)
        entity_ref = self.metadata.get_entity_reference(
            entity=Chart, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id
