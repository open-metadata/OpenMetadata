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
OpenMetadata high-level API REST API test
Tests for ApiService, APICollection, and APIEndpoint entities
"""
from copy import deepcopy

import pytest

from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.api.data.createAPIEndpoint import (
    CreateAPIEndpointRequest,
)
from metadata.generated.schema.api.services.createApiService import (
    CreateApiServiceRequest,
)
from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.apiEndpoint import (
    APIEndpoint,
    ApiRequestMethod,
)
from metadata.generated.schema.entity.services.apiService import (
    ApiConnection,
    ApiService,
    ApiServiceType,
)
from metadata.generated.schema.entity.services.connections.api.openAPISchemaURL import (
    OpenAPISchemaURL,
)
from metadata.generated.schema.entity.services.connections.api.restConnection import (
    RestConnection,
    RestType,
)
from metadata.generated.schema.type.basic import EntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList

from ..conftest import _safe_delete
from ..integration_base import generate_name


@pytest.fixture(scope="module")
def api_service(metadata):
    """Module-scoped ApiService for REST API tests."""
    service_name = generate_name()
    service_request = CreateApiServiceRequest(
        name=service_name,
        serviceType=ApiServiceType.Rest,
        connection=ApiConnection(
            config=RestConnection(
                openAPISchemaConnection=OpenAPISchemaURL(
                    openAPISchemaURL="https://petstore.swagger.io/v2/swagger.json"
                ),
                type=RestType.Rest,
            )
        ),
    )
    service_entity = metadata.create_or_update(data=service_request)

    yield service_entity

    _safe_delete(
        metadata,
        entity=ApiService,
        entity_id=service_entity.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def rest_user(metadata):
    """User for REST API ownership tests."""
    from metadata.generated.schema.api.teams.createUser import CreateUserRequest
    from metadata.generated.schema.entity.teams.user import User

    user_name = generate_name()
    user = metadata.create_or_update(
        data=CreateUserRequest(name=user_name, email=f"{user_name.root}@user.com"),
    )

    yield user

    metadata.delete(entity=User, entity_id=user.id, hard_delete=True)


@pytest.fixture(scope="module")
def rest_owners(rest_user):
    """Owner reference list for REST API tests."""
    return EntityReferenceList(
        root=[
            EntityReference(
                id=rest_user.id,
                type="user",
                fullyQualifiedName=rest_user.fullyQualifiedName.root,
            )
        ]
    )


@pytest.fixture(scope="module")
def service_request(api_service):
    """Recreatable service request matching the existing service."""
    return CreateApiServiceRequest(
        name=api_service.name,
        serviceType=ApiServiceType.Rest,
        connection=ApiConnection(
            config=RestConnection(
                openAPISchemaConnection=OpenAPISchemaURL(
                    openAPISchemaURL="https://petstore.swagger.io/v2/swagger.json"
                ),
                type=RestType.Rest,
            )
        ),
    )


@pytest.fixture(scope="module")
def collection_request(api_service):
    """CreateAPICollectionRequest for the module's service."""
    return CreateAPICollectionRequest(
        name="test-collection",
        service=api_service.fullyQualifiedName,
        endpointURL="https://petstore.swagger.io/v2/pet",
    )


@pytest.fixture(scope="module")
def api_collection(metadata, collection_request):
    """Module-scoped APICollection entity."""
    return metadata.create_or_update(data=collection_request)


@pytest.fixture(scope="module")
def endpoint_request(api_collection):
    """CreateAPIEndpointRequest for the module's collection."""
    return CreateAPIEndpointRequest(
        name="test-endpoint",
        apiCollection=api_collection.fullyQualifiedName,
        endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
        requestMethod=ApiRequestMethod.GET,
    )


class TestOMetaRestAPI:
    """
    REST API integration tests.
    Tests CRUD operations for ApiService, APICollection, and APIEndpoint.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    @pytest.mark.order(1)
    def test_create_api_collection(
        self, metadata, api_service, api_collection, collection_request
    ):
        """
        We can create an APICollection and we receive it back as Entity
        """
        res = metadata.create_or_update(data=collection_request)

        assert res.name == collection_request.name
        assert res.service.id == api_service.id
        assert res.owners is None or res.owners == EntityReferenceList(root=[])

    @pytest.mark.order(2)
    def test_create_api_endpoint(
        self, metadata, api_service, api_collection, endpoint_request
    ):
        """
        We can create an APIEndpoint and we receive it back as Entity
        """
        res = metadata.create_or_update(data=endpoint_request)

        assert res.name == endpoint_request.name
        assert res.apiCollection.id == api_collection.id
        assert res.requestMethod == ApiRequestMethod.GET
        assert res.owners is None or res.owners == EntityReferenceList(root=[])

    @pytest.mark.order(3)
    def test_create_api_service(self, metadata, api_service, service_request):
        """
        We can create an ApiService and we receive it back as Entity
        """
        res = metadata.create_or_update(data=service_request)

        assert res.name == service_request.name
        assert res.serviceType == service_request.serviceType
        assert res.owners is None or res.owners == EntityReferenceList(root=[])

    @pytest.mark.order(4)
    def test_delete_api_collection(self, metadata, api_service):
        """
        We can delete an APICollection by ID
        """
        delete_collection = CreateAPICollectionRequest(
            name=generate_name(),
            service=api_service.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/user",
        )

        created = metadata.create_or_update(data=delete_collection)

        res_name = metadata.get_by_name(
            entity=APICollection, fqn=created.fullyQualifiedName
        )
        res_id = metadata.get_by_id(entity=APICollection, entity_id=res_name.id)

        metadata.delete(entity=APICollection, entity_id=str(res_id.id.root))

        res = metadata.list_entities(entity=APICollection)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == created.fullyQualifiedName
            ),
            None,
        )

    @pytest.mark.order(5)
    def test_delete_api_endpoint(self, metadata, api_collection):
        """
        We can delete an APIEndpoint by ID
        """
        delete_endpoint = CreateAPIEndpointRequest(
            name=generate_name(),
            apiCollection=api_collection.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}/delete",
            requestMethod=ApiRequestMethod.DELETE,
        )

        endpoint_res = metadata.create_or_update(data=delete_endpoint)
        res_name = metadata.get_by_name(
            entity=APIEndpoint, fqn=endpoint_res.fullyQualifiedName
        )
        res_id = metadata.get_by_id(entity=APIEndpoint, entity_id=res_name.id)

        metadata.delete(entity=APIEndpoint, entity_id=str(res_id.id.root))

        res = metadata.list_entities(entity=APIEndpoint)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == endpoint_res.fullyQualifiedName
            ),
            None,
        )

    @pytest.mark.order(6)
    def test_delete_api_service(self, metadata):
        """
        We can delete an ApiService by ID
        """
        delete_service = CreateApiServiceRequest(
            name=generate_name(),
            serviceType=ApiServiceType.Rest,
            connection=ApiConnection(
                config=RestConnection(
                    openAPISchemaConnection=OpenAPISchemaURL(
                        openAPISchemaURL="https://petstore.swagger.io/v2/swagger.json"
                    ),
                    type=RestType.Rest,
                )
            ),
        )

        created = metadata.create_or_update(data=delete_service)

        res_name = metadata.get_by_name(entity=ApiService, fqn=delete_service.name)
        res_id = metadata.get_by_id(entity=ApiService, entity_id=res_name.id)

        metadata.delete(entity=ApiService, entity_id=str(res_id.id.root))

        res = metadata.list_entities(entity=ApiService)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == created.fullyQualifiedName
            ),
            None,
        )

    @pytest.mark.order(7)
    def test_get_api_collection_id(self, metadata, api_collection, collection_request):
        """
        We can fetch an APICollection by ID and get it back as Entity
        """
        metadata.create_or_update(data=collection_request)

        res_name = metadata.get_by_name(
            entity=APICollection, fqn=api_collection.fullyQualifiedName
        )
        res = metadata.get_by_id(entity=APICollection, entity_id=str(res_name.id.root))

        assert res_name.id == res.id

    @pytest.mark.order(8)
    def test_get_api_collection_name(
        self, metadata, api_collection, collection_request
    ):
        """
        We can fetch an APICollection by name and get it back as Entity
        """
        metadata.create_or_update(data=collection_request)

        res = metadata.get_by_name(
            entity=APICollection, fqn=api_collection.fullyQualifiedName
        )
        assert res.name == api_collection.name

        nullable_res = metadata.get_by_name(
            entity=APICollection, fqn="something.made.up"
        )
        assert nullable_res is None

    @pytest.mark.order(9)
    def test_get_api_endpoint_id(self, metadata, api_collection):
        """
        We can fetch an APIEndpoint by ID and get it back as Entity
        """
        endpoint_request = CreateAPIEndpointRequest(
            name="test-endpoint-get-id",
            apiCollection=api_collection.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
            requestMethod=ApiRequestMethod.GET,
        )

        endpoint_res = metadata.create_or_update(data=endpoint_request)

        res_name = metadata.get_by_name(
            entity=APIEndpoint, fqn=endpoint_res.fullyQualifiedName
        )
        res = metadata.get_by_id(entity=APIEndpoint, entity_id=str(res_name.id.root))

        assert res_name.id == res.id

    @pytest.mark.order(10)
    def test_get_api_endpoint_name(self, metadata, api_collection):
        """
        We can fetch an APIEndpoint by name and get it back as Entity
        """
        endpoint_request = CreateAPIEndpointRequest(
            name="test-endpoint-get-name",
            apiCollection=api_collection.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
            requestMethod=ApiRequestMethod.GET,
        )

        endpoint_res = metadata.create_or_update(data=endpoint_request)

        res = metadata.get_by_name(
            entity=APIEndpoint, fqn=endpoint_res.fullyQualifiedName
        )
        assert res.name == endpoint_res.name

        nullable_res = metadata.get_by_name(entity=APIEndpoint, fqn="something.made.up")
        assert nullable_res is None

    @pytest.mark.order(11)
    def test_get_entity_ref_api_collection(
        self, metadata, api_collection, collection_request
    ):
        """
        test get EntityReference for APICollection
        """
        res = metadata.create_or_update(data=collection_request)
        entity_ref = metadata.get_entity_reference(
            entity=APICollection, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id

    @pytest.mark.order(12)
    def test_get_entity_ref_api_endpoint(
        self, metadata, api_collection, endpoint_request
    ):
        """
        test get EntityReference for APIEndpoint
        """
        res = metadata.create_or_update(data=endpoint_request)
        entity_ref = metadata.get_entity_reference(
            entity=APIEndpoint, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id

    @pytest.mark.order(13)
    def test_get_entity_ref_api_service(self, metadata, api_service, service_request):
        """
        test get EntityReference for ApiService
        """
        res = metadata.create_or_update(data=service_request)
        entity_ref = metadata.get_entity_reference(
            entity=ApiService, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id

    @pytest.mark.order(14)
    def test_list_all_and_paginate_collections(
        self, metadata, api_service, collection_request
    ):
        """
        Validate generator utility to fetch all APICollections
        """
        fake_create = deepcopy(collection_request)
        for i in range(0, 5):
            fake_create.name = EntityName(collection_request.name.root + str(i))
            metadata.create_or_update(data=fake_create)

        all_entities = metadata.list_all_entities(entity=APICollection, limit=2)
        assert len(list(all_entities)) >= 5

        entity_list = metadata.list_entities(entity=APICollection, limit=2)
        assert len(entity_list.entities) == 2
        if entity_list.after:
            after_entity_list = metadata.list_entities(
                entity=APICollection, limit=2, after=entity_list.after
            )
            assert len(after_entity_list.entities) == 2

    @pytest.mark.order(15)
    def test_list_api_collections(
        self, metadata, api_service, api_collection, collection_request
    ):
        """
        We can list all our APICollections
        """
        metadata.create_or_update(data=collection_request)

        res = metadata.list_entities(
            entity=APICollection,
            params={"service": api_service.name.root},
        )

        data = next(
            iter(ent for ent in res.entities if ent.name == api_collection.name),
            None,
        )
        assert data

    @pytest.mark.order(16)
    def test_list_api_endpoints(self, metadata, api_collection, endpoint_request):
        """
        We can list all our APIEndpoints
        """
        metadata.create_or_update(data=endpoint_request)

        res = metadata.list_entities(
            entity=APIEndpoint,
            params={"apiCollection": api_collection.fullyQualifiedName.root},
        )

        data = next(
            iter(ent for ent in res.entities if ent.name == endpoint_request.name),
            None,
        )
        assert data

    @pytest.mark.order(17)
    def test_list_api_services(self, metadata, api_service, service_request):
        """
        We can list all our ApiServices
        """
        metadata.create_or_update(data=service_request)

        res = metadata.list_entities(entity=ApiService)

        data = next(
            iter(ent for ent in res.entities if ent.name == service_request.name),
            None,
        )
        assert data

    @pytest.mark.order(18)
    def test_update_api_collection(
        self, metadata, api_collection, collection_request, rest_user, rest_owners
    ):
        """
        Updating it properly changes its properties
        """
        res_create = metadata.create_or_update(data=collection_request)

        updated = collection_request.model_dump(exclude_unset=True)
        updated["owners"] = rest_owners
        updated_entity = CreateAPICollectionRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        assert res.name == updated_entity.name
        assert res_create.id == res.id
        assert res.owners.root[0].id == rest_user.id

    @pytest.mark.order(19)
    def test_update_api_endpoint(
        self, metadata, api_collection, endpoint_request, rest_user, rest_owners
    ):
        """
        Updating it properly changes its properties
        """
        res_create = metadata.create_or_update(data=endpoint_request)

        updated = endpoint_request.model_dump(exclude_unset=True)
        updated["owners"] = rest_owners
        updated_entity = CreateAPIEndpointRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        assert res.name == updated_entity.name
        assert res_create.id == res.id
        assert res.owners.root[0].id == rest_user.id

    @pytest.mark.order(20)
    def test_update_api_service(
        self, metadata, api_service, service_request, rest_user, rest_owners
    ):
        """
        Updating it properly changes its properties
        """
        res_create = metadata.create_or_update(data=service_request)

        updated = service_request.model_dump(exclude_unset=True)
        updated["owners"] = rest_owners
        updated_entity = CreateApiServiceRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        assert res.name == updated_entity.name
        assert res_create.id == res.id
        assert res.owners.root[0].id == rest_user.id
