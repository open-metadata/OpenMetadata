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
OpenMetadata high-level API Domains & Data Products test
"""
from unittest import TestCase

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.domains.createDataProduct import (
    CreateDataProductRequest,
)
from metadata.generated.schema.api.domains.createDomain import CreateDomainRequest
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.domains.dataProduct import DataProduct
from metadata.generated.schema.entity.domains.domain import Domain, DomainType
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaDomainTest(TestCase):
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
    owners = EntityReferenceList(root=[EntityReference(id=user.id, type="user")])

    service = CreateDashboardServiceRequest(
        name="test-service-dashboard",
        serviceType=DashboardServiceType.Looker,
        connection=DashboardConnection(
            config=LookerConnection(
                hostPort="http://hostPort", clientId="id", clientSecret="secret"
            )
        ),
    )
    service_type = "dashboardService"

    create_domain = CreateDomainRequest(
        domainType=DomainType.Consumer_aligned, name="TestDomain", description="random"
    )

    create_data_product = CreateDataProductRequest(
        name="TestDataProduct",
        description="random",
        domains=["TestDomain"],
    )

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """
        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        cls.dashboard: Dashboard = cls.metadata.create_or_update(
            CreateDashboardRequest(
                name="test",
                service=cls.service_entity.fullyQualifiedName,
            )
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DashboardService, fqn=cls.service.name.root
            ).id.root
        )

        cls.metadata.delete(
            entity=DashboardService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

        domain: Domain = cls.metadata.get_by_name(
            entity=Domain, fqn=cls.create_domain.name.root
        )

        cls.metadata.delete(
            entity=Domain, entity_id=domain.id, recursive=True, hard_delete=True
        )

    def test_create(self):
        """
        We can create a Domain and we receive it back as Entity
        """

        res: Domain = self.metadata.create_or_update(data=self.create_domain)
        self.assertEqual(res.name, self.create_domain.name)
        self.assertEqual(res.description, self.create_domain.description)

        res: DataProduct = self.metadata.create_or_update(data=self.create_data_product)
        self.assertEqual(res.name, self.create_data_product.name)
        self.assertEqual(res.description, self.create_data_product.description)
        self.assertEqual(res.domains[0].name, self.create_data_product.domains[0])

    def test_get_name(self):
        """We can fetch Domains & Data Products by name"""
        self.metadata.create_or_update(data=self.create_domain)

        res: Domain = self.metadata.get_by_name(
            entity=Domain, fqn=self.create_domain.name.root
        )
        self.assertEqual(res.name, self.create_domain.name)

        self.metadata.create_or_update(data=self.create_data_product)

        res: DataProduct = self.metadata.get_by_name(
            entity=DataProduct, fqn=self.create_data_product.name.root
        )
        self.assertEqual(res.name, self.create_data_product.name)

    def test_get_id(self):
        """We can fetch Domains & Data Products by ID"""
        self.metadata.create_or_update(data=self.create_domain)

        res_name: Domain = self.metadata.get_by_name(
            entity=Domain, fqn=self.create_domain.name.root
        )
        res: Domain = self.metadata.get_by_id(entity=Domain, entity_id=res_name.id)
        self.assertEqual(res.name, self.create_domain.name)

        self.metadata.create_or_update(data=self.create_data_product)

        res_name: DataProduct = self.metadata.get_by_name(
            entity=DataProduct, fqn=self.create_data_product.name.root
        )
        res: DataProduct = self.metadata.get_by_id(
            entity=DataProduct, entity_id=res_name.id
        )
        self.assertEqual(res.name, self.create_data_product.name)

    def test_patch_domain(self):
        """We can add domain to an asset"""
        domain: Domain = self.metadata.create_or_update(data=self.create_domain)
        self.metadata.patch_domain(entity=self.dashboard, domain=domain)

        updated_dashboard: Dashboard = self.metadata.get_by_name(
            entity=Dashboard, fqn=self.dashboard.fullyQualifiedName, fields=["domains"]
        )

        self.assertEqual(updated_dashboard.domains[0].name, domain.name.root)

    def test_add_remove_assets_to_data_product(self):
        """We can add assets to a data product"""
        self.metadata.create_or_update(data=self.create_domain)
        data_product: DataProduct = self.metadata.create_or_update(
            data=self.create_data_product
        )
        asset_ref = EntityReference(id=self.dashboard.id, type="dashboard")
        self.metadata.add_assets_to_data_product(data_product.name.root, [asset_ref])

        res: DataProduct = self.metadata.get_by_name(
            entity=DataProduct,
            fqn=self.create_data_product.name.root,
            fields=["assets"],
        )
        self.assertEqual(len(res.assets.root), 1)
        self.assertEqual(res.assets.root[0].id, self.dashboard.id)
        self.assertEqual(res.assets.root[0].type, "dashboard")

        self.metadata.remove_assets_from_data_product(
            data_product.name.root, [asset_ref]
        )
        res: DataProduct = self.metadata.get_by_name(
            entity=DataProduct,
            fqn=self.create_data_product.name.root,
            fields=["assets"],
        )
        self.assertEqual(len(res.assets.root), 0)

        # Check what happens if we remove an asset that's not there on a Data Product
        # We still get a success in the status
        status = self.metadata.remove_assets_from_data_product(
            data_product.name.root, [asset_ref]
        )
        self.assertEqual(status["status"], "success")
