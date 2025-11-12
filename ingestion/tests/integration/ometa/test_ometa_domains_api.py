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
from copy import deepcopy
from unittest import TestCase
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from _openmetadata_testutils.ometa import int_admin_ometa
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
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.type.basic import EntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.client import REST

BAD_DOMAIN_RESPONSE = {
    "data": [
        {
            "id": "cb149dd4-f4c2-485e-acd3-74b7dca1015e",
            "name": "valid-domain",
            "domainType": "Consumer-aligned",
            "description": "Valid domain",
        },
        {
            "id": "5d76676c-8e94-4e7e-97b8-294f4c16d0aa",
            "name": "another-valid-domain",
            "domainType": "Consumer-aligned",
            "description": "Another valid domain",
        },
        {
            "id": "f063ff4e-99a3-4d42-8678-c484c2556e8d",
            "name": "invalid-domain",
            "domainType": "Consumer-aligned",
            "description": "Invalid domain with bad tags",
            "tags": [
                {
                    "tagFQN": 123,  # Invalid type - should be string
                    "source": "Classification",
                    "labelType": "Manual",
                    "state": "Confirmed",
                }
            ],
        },
    ],
    "paging": {
        "total": 3,
    },
}


class OMetaDomainTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    metadata = int_admin_ometa()

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

        if domain:
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
        self.assertEqual(
            res.domains.root[0].name, self.create_data_product.domains[0].root
        )

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
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain.id, type="domain")]
        )
        self.metadata.patch_domain(
            entity=Dashboard, source=self.dashboard, domains=domains_ref
        )

        updated_dashboard: Dashboard = self.metadata.get_by_name(
            entity=Dashboard, fqn=self.dashboard.fullyQualifiedName, fields=["domains"]
        )

        self.assertEqual(updated_dashboard.domains.root[0].name, domain.name.root)

    def test_add_remove_assets_to_data_product(self):
        """We can add assets to a data product"""
        domain: Domain = self.metadata.create_or_update(data=self.create_domain)
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain.id, type="domain")]
        )
        # Make sure the dashboard belongs to the data product domain!
        self.metadata.patch_domain(
            entity=Dashboard, source=self.dashboard, domains=domains_ref
        )
        data_product: DataProduct = self.metadata.create_or_update(
            data=self.create_data_product
        )
        asset_ref = EntityReference(id=self.dashboard.id, type="dashboard")
        self.metadata.add_assets_to_data_product(data_product.name.root, [asset_ref])

        # Use the new assets API to get assets
        assets_response = self.metadata.get_data_product_assets(
            data_product.name.root, limit=100
        )
        self.assertEqual(len(assets_response["data"]), 1)
        self.assertEqual(assets_response["data"][0]["id"], str(self.dashboard.id.root))
        self.assertEqual(assets_response["data"][0]["type"], "dashboard")

        self.metadata.remove_assets_from_data_product(
            data_product.name.root, [asset_ref]
        )

        # Use the new assets API to verify removal
        assets_response = self.metadata.get_data_product_assets(
            data_product.name.root, limit=100
        )
        self.assertEqual(len(assets_response["data"]), 0)

        # Check what happens if we remove an asset that's not there on a Data Product
        # We still get a success in the status
        status = self.metadata.remove_assets_from_data_product(
            data_product.name.root, [asset_ref]
        )
        self.assertEqual(status["status"], "success")

    def test_get_domain_assets(self):
        """We can get assets for a domain"""
        domain: Domain = self.metadata.create_or_update(data=self.create_domain)
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain.id, type="domain")]
        )
        self.metadata.patch_domain(
            entity=Dashboard, source=self.dashboard, domains=domains_ref
        )

        # Get domain assets
        assets_response = self.metadata.get_domain_assets(domain.name.root, limit=100)
        self.assertGreaterEqual(len(assets_response["data"]), 1)

        # Check that our dashboard is in the assets list
        dashboard_ids = [asset["id"] for asset in assets_response["data"]]
        self.assertIn(str(self.dashboard.id.root), dashboard_ids)

        # Verify the asset has correct type
        dashboard_asset = next(
            (
                asset
                for asset in assets_response["data"]
                if asset["id"] == str(self.dashboard.id.root)
            ),
            None,
        )
        self.assertIsNotNone(dashboard_asset)
        self.assertEqual(dashboard_asset["type"], "dashboard")

    def test_list(self):
        """
        We can list all our Domains
        """
        self.metadata.create_or_update(data=self.create_domain)

        res = self.metadata.list_entities(entity=Domain)

        # Fetch our test Domain. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.create_domain.name),
            None,
        )
        assert data

    def test_list_data_products(self):
        """
        We can list all our Data Products
        """
        self.metadata.create_or_update(data=self.create_domain)
        self.metadata.create_or_update(data=self.create_data_product)

        res = self.metadata.list_entities(entity=DataProduct)

        # Fetch our test Data Product. We have already inserted it, so we should find it
        data = next(
            iter(
                ent for ent in res.entities if ent.name == self.create_data_product.name
            ),
            None,
        )
        assert data

    def test_list_all_and_paginate(self):
        """
        Validate generator utility to fetch all domains
        """
        fake_create = deepcopy(self.create_domain)
        for i in range(0, 10):
            fake_create.name = EntityName(self.create_domain.name.root + str(i))
            self.metadata.create_or_update(data=fake_create)

        all_entities = self.metadata.list_all_entities(
            entity=Domain, limit=2  # paginate in batches of pairs
        )
        assert (
            len(list(all_entities)) >= 10
        )  # In case the default testing entity is not present

        entity_list = self.metadata.list_entities(entity=Domain, limit=2)
        assert len(entity_list.entities) == 2
        after_entity_list = self.metadata.list_entities(
            entity=Domain, limit=2, after=entity_list.after
        )
        assert len(after_entity_list.entities) == 2
        before_entity_list = self.metadata.list_entities(
            entity=Domain, limit=2, before=after_entity_list.before
        )
        assert before_entity_list.entities == entity_list.entities

    def test_delete(self):
        """
        We can delete a Domain by ID
        """
        domain = self.metadata.create_or_update(data=self.create_domain)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Domain, fqn=domain.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(entity=Domain, entity_id=res_name.id)

        # Delete
        self.metadata.delete(entity=Domain, entity_id=str(res_id.id.root))

        # Then we should not find it
        res = self.metadata.list_entities(entity=Domain)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == domain.fullyQualifiedName
            ),
            None,
        )

    def test_delete_data_product(self):
        """
        We can delete a Data Product by ID
        """
        self.metadata.create_or_update(data=self.create_domain)
        data_product = self.metadata.create_or_update(data=self.create_data_product)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=DataProduct, fqn=data_product.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(entity=DataProduct, entity_id=res_name.id)

        # Delete
        self.metadata.delete(entity=DataProduct, entity_id=str(res_id.id.root))

        # Then we should not find it
        res = self.metadata.list_entities(entity=DataProduct)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == data_product.fullyQualifiedName
            ),
            None,
        )

    def test_update_domain(self):
        """
        Updating it properly changes its properties
        """
        res_create = self.metadata.create_or_update(data=self.create_domain)

        updated = self.create_domain.model_dump(exclude_unset=True)
        updated["owners"] = self.owners
        updated["description"] = "Updated description"
        updated_entity = CreateDomainRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated properties
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owners.root[0].id, self.user.id)
        self.assertEqual(res.description.root, "Updated description")

    def test_update_data_product(self):
        """
        Updating it properly changes its properties
        """
        self.metadata.create_or_update(data=self.create_domain)
        res_create = self.metadata.create_or_update(data=self.create_data_product)

        updated = self.create_data_product.model_dump(exclude_unset=True)
        updated["owners"] = self.owners
        updated["description"] = "Updated data product description"
        updated_entity = CreateDataProductRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated properties
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owners.root[0].id, self.user.id)
        self.assertEqual(res.description.root, "Updated data product description")

    def test_list_versions(self):
        """
        test list domain entity versions
        """
        domain = self.metadata.create_or_update(data=self.create_domain)

        res = self.metadata.get_list_entity_versions(
            entity=Domain, entity_id=domain.id.root
        )
        assert res

    def test_list_data_product_versions(self):
        """
        test list data product entity versions
        """
        self.metadata.create_or_update(data=self.create_domain)
        data_product = self.metadata.create_or_update(data=self.create_data_product)

        res = self.metadata.get_list_entity_versions(
            entity=DataProduct, entity_id=data_product.id.root
        )
        assert res

    def test_get_entity_version(self):
        """
        test get domain entity version
        """
        domain = self.metadata.create_or_update(data=self.create_domain)

        res = self.metadata.get_entity_version(
            entity=Domain, entity_id=domain.id.root, version=0.1
        )

        # check we get the correct version requested and the correct entity ID
        assert res.version.root == 0.1
        assert res.id == domain.id

    def test_get_data_product_entity_version(self):
        """
        test get data product entity version
        """
        self.metadata.create_or_update(data=self.create_domain)
        data_product = self.metadata.create_or_update(data=self.create_data_product)

        res = self.metadata.get_entity_version(
            entity=DataProduct, entity_id=data_product.id.root, version=0.1
        )

        # check we get the correct version requested and the correct entity ID
        assert res.version.root == 0.1
        assert res.id == data_product.id

    def test_get_entity_ref(self):
        """
        test get Domain EntityReference
        """
        domain = self.metadata.create_or_update(data=self.create_domain)
        entity_ref = self.metadata.get_entity_reference(
            entity=Domain, fqn=domain.fullyQualifiedName
        )

        assert domain.id == entity_ref.id

    def test_get_data_product_entity_ref(self):
        """
        test get Data Product EntityReference
        """
        self.metadata.create_or_update(data=self.create_domain)
        data_product = self.metadata.create_or_update(data=self.create_data_product)
        entity_ref = self.metadata.get_entity_reference(
            entity=DataProduct, fqn=data_product.fullyQualifiedName
        )

        assert data_product.id == entity_ref.id

    def test_list_w_skip_on_failure(self):
        """
        We can list all our Domains even when some of them are broken
        """
        # first validate that exception is raised when skip_on_failure is False
        with patch.object(REST, "get", return_value=BAD_DOMAIN_RESPONSE):
            with pytest.raises(ValidationError):
                self.metadata.list_entities(entity=Domain)

        with patch.object(REST, "get", return_value=BAD_DOMAIN_RESPONSE):
            res = self.metadata.list_entities(entity=Domain, skip_on_failure=True)

        # We should have 2 domains, the 3rd one is broken and should be skipped
        assert len(res.entities) == 2

    def test_list_all_w_skip_on_failure(self):
        """
        Validate generator utility to fetch all domains even when some of them are broken
        """
        # first validate that exception is raised when skip_on_failure is False
        with patch.object(REST, "get", return_value=BAD_DOMAIN_RESPONSE):
            with pytest.raises(ValidationError):
                res = self.metadata.list_all_entities(
                    entity=Domain,
                    limit=1,  # paginate in batches of pairs
                )
                list(res)

        with patch.object(REST, "get", return_value=BAD_DOMAIN_RESPONSE):
            res = self.metadata.list_all_entities(
                entity=Domain,
                limit=1,
                skip_on_failure=True,  # paginate in batches of pairs
            )

            # We should have 2 domains, the 3rd one is broken and should be skipped
            assert len(list(res)) == 2

    def test_domain_with_slash_in_name(self):
        """E.g., `domain.name/with-slash`"""
        name = EntityName("domain.name/with-slash")
        create_request = CreateDomainRequest(
            name=name,
            domainType=DomainType.Consumer_aligned,
            description="Domain with slash in name",
        )
        new_domain: Domain = self.metadata.create_or_update(data=create_request)

        res: Domain = self.metadata.get_by_name(
            entity=Domain, fqn=new_domain.fullyQualifiedName
        )

        assert res.name == name

    def test_data_product_with_slash_in_name(self):
        """E.g., `data.product/with-slash`"""
        self.metadata.create_or_update(data=self.create_domain)
        name = EntityName("data.product/with-slash")
        create_request = CreateDataProductRequest(
            name=name,
            description="Data product with slash in name",
            domains=["TestDomain"],
        )
        new_data_product: DataProduct = self.metadata.create_or_update(
            data=create_request
        )

        res: DataProduct = self.metadata.get_by_name(
            entity=DataProduct, fqn=new_data_product.fullyQualifiedName
        )

        assert res.name == name

    def test_get_domain_assets_pagination(self):
        """
        Test domain assets API with pagination
        """
        domain: Domain = self.metadata.create_or_update(data=self.create_domain)
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain.id, type="domain")]
        )

        # Create multiple dashboards and add them to domain
        for i in range(5):
            dashboard = self.metadata.create_or_update(
                CreateDashboardRequest(
                    name=f"test-dashboard-{i}",
                    service=self.service_entity.fullyQualifiedName,
                )
            )
            self.metadata.patch_domain(
                entity=Dashboard, source=dashboard, domains=domains_ref
            )

        # Test pagination
        assets_page1 = self.metadata.get_domain_assets(
            domain.name.root, limit=2, offset=0
        )
        assets_page2 = self.metadata.get_domain_assets(
            domain.name.root, limit=2, offset=2
        )

        # We should have at least 2 assets on first page
        self.assertGreaterEqual(len(assets_page1["data"]), 2)
        # And potentially more on second page
        self.assertGreaterEqual(len(assets_page2["data"]), 0)

    def test_get_data_product_assets_pagination(self):
        """
        Test data product assets API with pagination
        """
        domain: Domain = self.metadata.create_or_update(data=self.create_domain)
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain.id, type="domain")]
        )
        data_product: DataProduct = self.metadata.create_or_update(
            data=self.create_data_product
        )

        # Create multiple dashboards and add them to the data product
        dashboards = []
        for i in range(3):
            dashboard = self.metadata.create_or_update(
                CreateDashboardRequest(
                    name=f"test-dp-dashboard-{i}",
                    service=self.service_entity.fullyQualifiedName,
                )
            )
            # First assign to domain
            self.metadata.patch_domain(
                entity=Dashboard, source=dashboard, domains=domains_ref
            )
            dashboards.append(dashboard)

        # Add all dashboards to data product
        asset_refs = [EntityReference(id=d.id, type="dashboard") for d in dashboards]
        self.metadata.add_assets_to_data_product(data_product.name.root, asset_refs)

        # Test pagination
        assets_page1 = self.metadata.get_data_product_assets(
            data_product.name.root, limit=2, offset=0
        )
        assets_page2 = self.metadata.get_data_product_assets(
            data_product.name.root, limit=2, offset=2
        )

        # We should have 2 assets on first page
        self.assertEqual(len(assets_page1["data"]), 2)
        # And 1 asset on second page
        self.assertEqual(len(assets_page2["data"]), 1)

        # Clean up
        self.metadata.remove_assets_from_data_product(
            data_product.name.root, asset_refs
        )
