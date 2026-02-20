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
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.domains.createDataProduct import (
    CreateDataProductRequest,
)
from metadata.generated.schema.api.domains.createDomain import CreateDomainRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.domains.dataProduct import DataProduct
from metadata.generated.schema.entity.domains.domain import Domain, DomainType
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.basic import EntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.client import REST

from ..integration_base import generate_name

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


@pytest.fixture(scope="module")
def domain_entity(metadata):
    """Module-scoped Domain for domain tests."""
    name = generate_name()
    domain = metadata.create_or_update(
        data=CreateDomainRequest(
            domainType=DomainType.Consumer_aligned,
            name=name,
            description="random",
        )
    )

    yield domain

    metadata.delete(
        entity=Domain, entity_id=domain.id, recursive=True, hard_delete=True
    )


@pytest.fixture(scope="module")
def data_product_entity(metadata, domain_entity):
    """Module-scoped DataProduct for data product tests."""
    name = generate_name()
    data_product = metadata.create_or_update(
        data=CreateDataProductRequest(
            name=name,
            description="random",
            domains=[domain_entity.name.root],
        )
    )

    yield data_product

    metadata.delete(entity=DataProduct, entity_id=data_product.id, hard_delete=True)


@pytest.fixture(scope="module")
def domain_user(metadata):
    """Module-scoped user for ownership tests."""
    user_name = generate_name()
    user = metadata.create_or_update(
        data=CreateUserRequest(name=user_name, email=f"{user_name.root}@user.com"),
    )

    yield user

    metadata.delete(entity=User, entity_id=user.id, hard_delete=True)


@pytest.fixture(scope="module")
def domain_owners(domain_user):
    """Owner reference list for domain tests."""
    return EntityReferenceList(root=[EntityReference(id=domain_user.id, type="user")])


@pytest.fixture(scope="module")
def domain_dashboard(metadata, dashboard_service):
    """Module-scoped Dashboard for domain asset tests.

    Cleanup handled by dashboard_service's recursive delete.
    """
    dashboard_name = generate_name()
    dashboard = metadata.create_or_update(
        CreateDashboardRequest(
            name=dashboard_name,
            service=dashboard_service.fullyQualifiedName,
        )
    )

    return dashboard


class TestOMetaDomainsAPI:
    """
    Domains & Data Products API integration tests.
    Tests CRUD operations, assets management, and pagination.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - dashboard_service: DashboardService (module scope)
    """

    def test_add_remove_assets_to_data_product(
        self, metadata, domain_entity, data_product_entity, domain_dashboard
    ):
        """We can add assets to a data product"""
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain_entity.id, type="domain")]
        )
        fresh_dashboard = metadata.get_by_name(
            entity=Dashboard, fqn=domain_dashboard.fullyQualifiedName.root
        )
        metadata.patch_domain(
            entity=Dashboard, source=fresh_dashboard, domains=domains_ref
        )
        asset_ref = EntityReference(id=domain_dashboard.id, type="dashboard")
        metadata.add_assets_to_data_product(data_product_entity.name.root, [asset_ref])

        assets_response = metadata.get_data_product_assets(
            data_product_entity.name.root, limit=100
        )
        assert len(assets_response["data"]) == 1
        assert assets_response["data"][0]["id"] == str(domain_dashboard.id.root)
        assert assets_response["data"][0]["type"] == "dashboard"

        metadata.remove_assets_from_data_product(
            data_product_entity.name.root, [asset_ref]
        )

        assets_response = metadata.get_data_product_assets(
            data_product_entity.name.root, limit=100
        )
        assert len(assets_response["data"]) == 0

        status = metadata.remove_assets_from_data_product(
            data_product_entity.name.root, [asset_ref]
        )
        assert status["status"] == "success"

    def test_add_remove_assets_to_data_product_with_special_chars(
        self, metadata, domain_entity, domain_dashboard
    ):
        """
        Test adding/removing assets to a data product with special characters
        (slash, hash) in its name. This validates URL encoding works correctly.
        """
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain_entity.id, type="domain")]
        )

        dp_name = EntityName("data-product/with/slashes")
        create_dp_request = CreateDataProductRequest(
            name=dp_name,
            description="Data product with special chars",
            domains=[domain_entity.name.root],
        )
        data_product = metadata.create_or_update(data=create_dp_request)

        try:
            fresh_dashboard = metadata.get_by_name(
                entity=Dashboard, fqn=domain_dashboard.fullyQualifiedName.root
            )
            metadata.patch_domain(
                entity=Dashboard, source=fresh_dashboard, domains=domains_ref
            )

            asset_ref = EntityReference(id=domain_dashboard.id, type="dashboard")
            metadata.add_assets_to_data_product(data_product.name.root, [asset_ref])

            assets_response = metadata.get_data_product_assets(
                data_product.name.root, limit=100
            )
            assert len(assets_response["data"]) == 1
            assert assets_response["data"][0]["id"] == str(domain_dashboard.id.root)

            metadata.remove_assets_from_data_product(
                data_product.name.root, [asset_ref]
            )

            assets_response = metadata.get_data_product_assets(
                data_product.name.root, limit=100
            )
            assert len(assets_response["data"]) == 0
        finally:
            metadata.delete(
                entity=DataProduct, entity_id=data_product.id, hard_delete=True
            )

    def test_create(self, domain_entity, data_product_entity):
        """
        We can create a Domain and we receive it back as Entity
        """
        assert domain_entity.name is not None
        assert domain_entity.description.root == "random"

        assert data_product_entity.name is not None
        assert data_product_entity.description.root == "random"
        assert data_product_entity.domains.root[0].name == domain_entity.name.root

    def test_data_product_with_slash_in_name(self, metadata, domain_entity):
        """E.g., `data.product/with-slash`"""
        name = EntityName("data.product/with-slash")
        create_request = CreateDataProductRequest(
            name=name,
            description="Data product with slash in name",
            domains=[domain_entity.name.root],
        )
        new_data_product = metadata.create_or_update(data=create_request)

        try:
            res = metadata.get_by_name(
                entity=DataProduct, fqn=new_data_product.fullyQualifiedName
            )
            assert res.name == name
        finally:
            metadata.delete(
                entity=DataProduct, entity_id=new_data_product.id, hard_delete=True
            )

    def test_delete(self, metadata):
        """
        We can delete a Domain by ID
        """
        domain_name = generate_name()
        domain = metadata.create_or_update(
            data=CreateDomainRequest(
                domainType=DomainType.Consumer_aligned,
                name=domain_name,
                description="domain for delete test",
            )
        )

        res_name = metadata.get_by_name(entity=Domain, fqn=domain.fullyQualifiedName)
        res_id = metadata.get_by_id(entity=Domain, entity_id=res_name.id)

        metadata.delete(entity=Domain, entity_id=str(res_id.id.root))

        res = metadata.list_entities(entity=Domain)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == domain.fullyQualifiedName
            ),
            None,
        )

    def test_delete_data_product(self, metadata, domain_entity):
        """
        We can delete a Data Product by ID
        """
        dp_name = generate_name()
        data_product = metadata.create_or_update(
            data=CreateDataProductRequest(
                name=dp_name,
                description="data product for delete test",
                domains=[domain_entity.name.root],
            )
        )

        res_name = metadata.get_by_name(
            entity=DataProduct, fqn=data_product.fullyQualifiedName
        )
        res_id = metadata.get_by_id(entity=DataProduct, entity_id=res_name.id)

        metadata.delete(entity=DataProduct, entity_id=str(res_id.id.root))

        res = metadata.list_entities(entity=DataProduct)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == data_product.fullyQualifiedName
            ),
            None,
        )

    def test_domain_with_slash_in_name(self, metadata):
        """E.g., `domain.name/with-slash`"""
        name = EntityName("domain.name/with-slash")
        create_request = CreateDomainRequest(
            name=name,
            domainType=DomainType.Consumer_aligned,
            description="Domain with slash in name",
        )
        new_domain = metadata.create_or_update(data=create_request)

        try:
            res = metadata.get_by_name(entity=Domain, fqn=new_domain.fullyQualifiedName)
            assert res.name == name
        finally:
            metadata.delete(
                entity=Domain,
                entity_id=new_domain.id,
                recursive=True,
                hard_delete=True,
            )

    def test_get_data_product_assets_pagination(
        self, metadata, domain_entity, data_product_entity, dashboard_service
    ):
        """
        Test data product assets API with pagination
        """
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain_entity.id, type="domain")]
        )

        dashboards = []
        for _ in range(3):
            dashboard = metadata.create_or_update(
                CreateDashboardRequest(
                    name=generate_name(),
                    service=dashboard_service.fullyQualifiedName,
                )
            )
            metadata.patch_domain(
                entity=Dashboard, source=dashboard, domains=domains_ref
            )
            dashboards.append(dashboard)

        asset_refs = [EntityReference(id=d.id, type="dashboard") for d in dashboards]
        metadata.add_assets_to_data_product(data_product_entity.name.root, asset_refs)

        try:
            assets_page1 = metadata.get_data_product_assets(
                data_product_entity.name.root, limit=2, offset=0
            )
            assets_page2 = metadata.get_data_product_assets(
                data_product_entity.name.root, limit=2, offset=2
            )

            assert len(assets_page1["data"]) == 2
            assert len(assets_page2["data"]) == 1
        finally:
            metadata.remove_assets_from_data_product(
                data_product_entity.name.root, asset_refs
            )

    def test_get_data_product_entity_ref(self, metadata, data_product_entity):
        """
        test get Data Product EntityReference
        """
        entity_ref = metadata.get_entity_reference(
            entity=DataProduct, fqn=data_product_entity.fullyQualifiedName
        )

        assert data_product_entity.id == entity_ref.id

    def test_get_data_product_entity_version(self, metadata, data_product_entity):
        """
        test get data product entity version
        """
        res = metadata.get_entity_version(
            entity=DataProduct,
            entity_id=data_product_entity.id.root,
            version=0.1,
        )

        assert res.version.root == 0.1
        assert res.id == data_product_entity.id

    def test_get_domain_assets(self, metadata, domain_entity, domain_dashboard):
        """We can get assets for a domain"""
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain_entity.id, type="domain")]
        )
        fresh_dashboard = metadata.get_by_name(
            entity=Dashboard, fqn=domain_dashboard.fullyQualifiedName.root
        )
        metadata.patch_domain(
            entity=Dashboard, source=fresh_dashboard, domains=domains_ref
        )

        assets_response = metadata.get_domain_assets(domain_entity.name.root, limit=100)
        assert len(assets_response["data"]) >= 1

        dashboard_ids = [asset["id"] for asset in assets_response["data"]]
        assert str(domain_dashboard.id.root) in dashboard_ids

        dashboard_asset = next(
            (
                asset
                for asset in assets_response["data"]
                if asset["id"] == str(domain_dashboard.id.root)
            ),
            None,
        )
        assert dashboard_asset is not None
        assert dashboard_asset["type"] == "dashboard"

    def test_get_domain_assets_pagination(
        self, metadata, domain_entity, dashboard_service
    ):
        """
        Test domain assets API with pagination
        """
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain_entity.id, type="domain")]
        )

        for _ in range(5):
            dashboard = metadata.create_or_update(
                CreateDashboardRequest(
                    name=generate_name(),
                    service=dashboard_service.fullyQualifiedName,
                )
            )
            metadata.patch_domain(
                entity=Dashboard, source=dashboard, domains=domains_ref
            )

        assets_page1 = metadata.get_domain_assets(
            domain_entity.name.root, limit=2, offset=0
        )
        assets_page2 = metadata.get_domain_assets(
            domain_entity.name.root, limit=2, offset=2
        )

        assert len(assets_page1["data"]) >= 2
        assert len(assets_page2["data"]) >= 0

    def test_get_domain_assets_with_special_chars_in_name(
        self, metadata, domain_dashboard
    ):
        """
        Test getting assets for a domain with special characters (slash) in its name.
        This validates URL encoding works correctly in get_domain_assets.
        """
        domain_name = EntityName("domain/with/slashes")
        create_domain_request = CreateDomainRequest(
            name=domain_name,
            domainType=DomainType.Consumer_aligned,
            description="Domain with special chars",
        )
        domain = metadata.create_or_update(data=create_domain_request)
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain.id, type="domain")]
        )

        try:
            fresh_dashboard = metadata.get_by_name(
                entity=Dashboard, fqn=domain_dashboard.fullyQualifiedName.root
            )
            metadata.patch_domain(
                entity=Dashboard, source=fresh_dashboard, domains=domains_ref
            )

            assets_response = metadata.get_domain_assets(domain.name.root, limit=100)
            assert len(assets_response["data"]) >= 1

            dashboard_ids = [asset["id"] for asset in assets_response["data"]]
            assert str(domain_dashboard.id.root) in dashboard_ids
        finally:
            metadata.delete(
                entity=Domain,
                entity_id=domain.id,
                recursive=True,
                hard_delete=True,
            )

    def test_get_entity_ref(self, metadata, domain_entity):
        """
        test get Domain EntityReference
        """
        entity_ref = metadata.get_entity_reference(
            entity=Domain, fqn=domain_entity.fullyQualifiedName
        )

        assert domain_entity.id == entity_ref.id

    def test_get_entity_version(self, metadata, domain_entity):
        """
        test get domain entity version
        """
        res = metadata.get_entity_version(
            entity=Domain, entity_id=domain_entity.id.root, version=0.1
        )

        assert res.version.root == 0.1
        assert res.id == domain_entity.id

    def test_get_id(self, metadata, domain_entity, data_product_entity):
        """We can fetch Domains & Data Products by ID"""
        res_name = metadata.get_by_name(
            entity=Domain, fqn=domain_entity.fullyQualifiedName.root
        )
        res = metadata.get_by_id(entity=Domain, entity_id=res_name.id)
        assert res.name == domain_entity.name

        res_name = metadata.get_by_name(
            entity=DataProduct, fqn=data_product_entity.fullyQualifiedName.root
        )
        res = metadata.get_by_id(entity=DataProduct, entity_id=res_name.id)
        assert res.name == data_product_entity.name

    def test_get_name(self, metadata, domain_entity, data_product_entity):
        """We can fetch Domains & Data Products by name"""
        res = metadata.get_by_name(
            entity=Domain, fqn=domain_entity.fullyQualifiedName.root
        )
        assert res.name == domain_entity.name

        res = metadata.get_by_name(
            entity=DataProduct, fqn=data_product_entity.fullyQualifiedName.root
        )
        assert res.name == data_product_entity.name

    def test_list(self, metadata, domain_entity):
        """
        We can list all our Domains
        """
        res = metadata.list_entities(entity=Domain)

        data = next(
            iter(ent for ent in res.entities if ent.name == domain_entity.name),
            None,
        )
        assert data

    def test_list_all_and_paginate(self, metadata, domain_entity):
        """
        Validate generator utility to fetch all domains
        """
        created_domains = []
        try:
            for i in range(10):
                fake_name = EntityName(domain_entity.name.root + str(i))
                domain = metadata.create_or_update(
                    data=CreateDomainRequest(
                        domainType=DomainType.Consumer_aligned,
                        name=fake_name,
                        description="paginate test",
                    )
                )
                created_domains.append(domain)

            all_entities = metadata.list_all_entities(entity=Domain, limit=2)
            assert len(list(all_entities)) >= 10

            entity_list = metadata.list_entities(entity=Domain, limit=2)
            assert len(entity_list.entities) == 2
            after_entity_list = metadata.list_entities(
                entity=Domain, limit=2, after=entity_list.after
            )
            assert len(after_entity_list.entities) == 2
            before_entity_list = metadata.list_entities(
                entity=Domain, limit=2, before=after_entity_list.before
            )
            assert before_entity_list.entities == entity_list.entities
        finally:
            for domain in created_domains:
                try:
                    metadata.delete(
                        entity=Domain,
                        entity_id=domain.id,
                        recursive=True,
                        hard_delete=True,
                    )
                except Exception:
                    pass

    def test_list_all_w_skip_on_failure(self, metadata):
        """
        Validate generator utility to fetch all domains even when some are broken
        """
        with patch.object(REST, "get", return_value=BAD_DOMAIN_RESPONSE):
            with pytest.raises(ValidationError):
                res = metadata.list_all_entities(
                    entity=Domain,
                    limit=1,
                )
                list(res)

        with patch.object(REST, "get", return_value=BAD_DOMAIN_RESPONSE):
            res = metadata.list_all_entities(
                entity=Domain,
                limit=1,
                skip_on_failure=True,
            )

            assert len(list(res)) == 2

    def test_list_data_product_versions(self, metadata, data_product_entity):
        """
        test list data product entity versions
        """
        res = metadata.get_list_entity_versions(
            entity=DataProduct, entity_id=data_product_entity.id.root
        )
        assert res

    def test_list_data_products(self, metadata, data_product_entity):
        """
        We can list all our Data Products
        """
        res = metadata.list_entities(entity=DataProduct)

        data = next(
            iter(ent for ent in res.entities if ent.name == data_product_entity.name),
            None,
        )
        assert data

    def test_list_versions(self, metadata, domain_entity):
        """
        test list domain entity versions
        """
        res = metadata.get_list_entity_versions(
            entity=Domain, entity_id=domain_entity.id.root
        )
        assert res

    def test_list_w_skip_on_failure(self, metadata):
        """
        We can list all our Domains even when some of them are broken
        """
        with patch.object(REST, "get", return_value=BAD_DOMAIN_RESPONSE):
            with pytest.raises(ValidationError):
                metadata.list_entities(entity=Domain)

        with patch.object(REST, "get", return_value=BAD_DOMAIN_RESPONSE):
            res = metadata.list_entities(entity=Domain, skip_on_failure=True)

        assert len(res.entities) == 2

    def test_patch_domain(self, metadata, domain_entity, domain_dashboard):
        """We can add domain to an asset"""
        domains_ref = EntityReferenceList(
            root=[EntityReference(id=domain_entity.id, type="domain")]
        )
        fresh_dashboard = metadata.get_by_name(
            entity=Dashboard, fqn=domain_dashboard.fullyQualifiedName.root
        )
        metadata.patch_domain(
            entity=Dashboard, source=fresh_dashboard, domains=domains_ref
        )

        updated_dashboard = metadata.get_by_name(
            entity=Dashboard,
            fqn=domain_dashboard.fullyQualifiedName.root,
            fields=["domains"],
        )

        assert updated_dashboard.domains.root[0].name == domain_entity.name.root

    def test_update_data_product(
        self, metadata, domain_entity, data_product_entity, domain_user, domain_owners
    ):
        """
        Updating it properly changes its properties
        """
        updated_entity = CreateDataProductRequest(
            name=data_product_entity.name,
            description="Updated data product description",
            domains=[domain_entity.name.root],
            owners=domain_owners,
        )

        res = metadata.create_or_update(data=updated_entity)

        assert res.id == data_product_entity.id
        assert res.owners.root[0].id == domain_user.id
        assert res.description.root == "Updated data product description"

    def test_update_domain(self, metadata, domain_entity, domain_user, domain_owners):
        """
        Updating it properly changes its properties
        """
        updated_entity = CreateDomainRequest(
            domainType=DomainType.Consumer_aligned,
            name=domain_entity.name,
            description="Updated description",
            owners=domain_owners,
        )

        res = metadata.create_or_update(data=updated_entity)

        assert res.id == domain_entity.id
        assert res.owners.root[0].id == domain_user.id
        assert res.description.root == "Updated description"
