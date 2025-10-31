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
import uuid
from copy import deepcopy
from unittest import TestCase

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.api.data.createAPIEndpoint import (
    CreateAPIEndpointRequest,
)
from metadata.generated.schema.api.services.createApiService import (
    CreateApiServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
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
from metadata.generated.schema.entity.services.connections.api.restConnection import (
    RestConnection,
    RestType,
)
from metadata.generated.schema.type.basic import EntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList


class OMetaRestApiTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    metadata = int_admin_ometa()

    user = metadata.create_or_update(
        data=CreateUserRequest(name="random-user", email="random@user.com"),
    )
    owners = EntityReferenceList(
        root=[
            EntityReference(
                id=user.id, type="user", fullyQualifiedName=user.fullyQualifiedName.root
            )
        ]
    )

    service = CreateApiServiceRequest(
        name="test-api-service",
        serviceType=ApiServiceType.Rest,
        connection=ApiConnection(
            config=RestConnection(
                openAPISchemaURL="https://petstore.swagger.io/v2/swagger.json",
                type=RestType.Rest,
            )
        ),
    )
    service_type = "apiService"

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        cls.api_collection_entity = APICollection(
            id=uuid.uuid4(),
            name="test-collection",
            service=EntityReference(id=cls.service_entity.id, type="apiService"),
            fullyQualifiedName="test-api-service.test-collection",
            endpointURL="https://petstore.swagger.io/v2/pet",
        )

        cls.create_collection = CreateAPICollectionRequest(
            name="test-collection",
            service=cls.service_entity.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet",
        )

        cls.api_endpoint_entity = APIEndpoint(
            id=uuid.uuid4(),
            name="test-endpoint",
            service=EntityReference(id=cls.service_entity.id, type="apiService"),
            apiCollection=EntityReference(
                id=cls.api_collection_entity.id, type="apiCollection"
            ),
            fullyQualifiedName="test-api-service.test-collection.test-endpoint",
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
            requestMethod=ApiRequestMethod.GET,
        )

        cls.create_endpoint = CreateAPIEndpointRequest(
            name="test-endpoint",
            apiCollection=cls.api_collection_entity.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
            requestMethod=ApiRequestMethod.GET,
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(entity=ApiService, fqn="test-api-service").id.root
        )

        cls.metadata.delete(
            entity=ApiService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_create_api_service(self):
        """
        We can create an ApiService and we receive it back as Entity
        """

        res = self.metadata.create_or_update(data=self.service)

        self.assertEqual(res.name, self.service.name)
        self.assertEqual(res.serviceType, self.service.serviceType)
        self.assertTrue(
            res.owners is None or res.owners == EntityReferenceList(root=[])
        )

    def test_update_api_service(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.service)

        updated = self.service.model_dump(exclude_unset=True)
        updated["owners"] = self.owners
        updated_entity = CreateApiServiceRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated owner
        self.assertEqual(res.name, updated_entity.name)
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owners.root[0].id, self.user.id)

    def test_get_api_service_name(self):
        """
        We can fetch an ApiService by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.service)

        res = self.metadata.get_by_name(entity=ApiService, fqn=self.service.name)
        self.assertEqual(res.name, self.service.name)

        # Now check that we get a None if the service does not exist
        nullable_res = self.metadata.get_by_name(
            entity=ApiService, fqn="something.made.up"
        )
        self.assertIsNone(nullable_res)

    def test_get_api_service_id(self):
        """
        We can fetch an ApiService by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.service)

        # First pick up by name
        res_name = self.metadata.get_by_name(entity=ApiService, fqn=self.service.name)
        # Then fetch by ID
        res = self.metadata.get_by_id(
            entity=ApiService, entity_id=str(res_name.id.root)
        )

        self.assertEqual(res_name.id, res.id)

    def test_list_api_services(self):
        """
        We can list all our ApiServices
        """

        self.metadata.create_or_update(data=self.service)

        res = self.metadata.list_entities(entity=ApiService)

        # Fetch our test ApiService. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.service.name), None
        )
        assert data

    def test_delete_api_service(self):
        """
        We can delete an ApiService by ID
        """
        # Create a separate service for deletion test
        delete_service = CreateApiServiceRequest(
            name="test-api-service-delete",
            serviceType=ApiServiceType.Rest,
            connection=ApiConnection(
                config=RestConnection(
                    openAPISchemaURL="https://petstore.swagger.io/v2/swagger.json",
                    type=RestType.Rest,
                )
            ),
        )

        self.metadata.create_or_update(data=delete_service)

        # Find by name
        res_name = self.metadata.get_by_name(entity=ApiService, fqn=delete_service.name)
        # Then fetch by ID
        res_id = self.metadata.get_by_id(entity=ApiService, entity_id=res_name.id)

        # Delete
        self.metadata.delete(entity=ApiService, entity_id=str(res_id.id.root))

        # Then we should not find it
        res = self.metadata.list_entities(entity=ApiService)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == delete_service.name.root
            ),
            None,
        )

    def test_create_api_collection(self):
        """
        We can create an APICollection and we receive it back as Entity
        """

        res = self.metadata.create_or_update(data=self.create_collection)

        self.assertEqual(res.name, self.api_collection_entity.name)
        self.assertEqual(res.service.id, self.service_entity.id)
        self.assertTrue(
            res.owners is None or res.owners == EntityReferenceList(root=[])
        )

    def test_update_api_collection(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.create_collection)

        updated = self.create_collection.model_dump(exclude_unset=True)
        updated["owners"] = self.owners
        updated_entity = CreateAPICollectionRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated owner
        self.assertEqual(res.name, updated_entity.name)
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owners.root[0].id, self.user.id)

    def test_get_api_collection_name(self):
        """
        We can fetch an APICollection by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create_collection)

        res = self.metadata.get_by_name(
            entity=APICollection, fqn=self.api_collection_entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.api_collection_entity.name)

        # Now check that we get a None if the collection does not exist
        nullable_res = self.metadata.get_by_name(
            entity=APICollection, fqn="something.made.up"
        )
        self.assertIsNone(nullable_res)

    def test_get_api_collection_id(self):
        """
        We can fetch an APICollection by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create_collection)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=APICollection, fqn=self.api_collection_entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(
            entity=APICollection, entity_id=str(res_name.id.root)
        )

        self.assertEqual(res_name.id, res.id)

    def test_list_api_collections(self):
        """
        We can list all our APICollections
        """

        self.metadata.create_or_update(data=self.create_collection)

        res = self.metadata.list_entities(
            entity=APICollection, params={"service": "test-api-service"}
        )

        # Fetch our test APICollection. We have already inserted it, so we should find it
        data = next(
            iter(
                ent
                for ent in res.entities
                if ent.name == self.api_collection_entity.name
            ),
            None,
        )
        assert data

    def test_delete_api_collection(self):
        """
        We can delete an APICollection by ID
        """
        # Create a separate collection for deletion test
        delete_collection = CreateAPICollectionRequest(
            name="test-collection-delete",
            service=self.service_entity.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/user",
        )

        self.metadata.create_or_update(data=delete_collection)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=APICollection, fqn=f"test-api-service.test-collection-delete"
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(entity=APICollection, entity_id=res_name.id)

        # Delete
        self.metadata.delete(entity=APICollection, entity_id=str(res_id.id.root))

        # Then we should not find it
        res = self.metadata.list_entities(entity=APICollection)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == f"test-api-service.test-collection-delete"
            ),
            None,
        )

    def test_create_api_endpoint(self):
        """
        We can create an APIEndpoint and we receive it back as Entity
        """
        # First ensure the collection exists
        collection_res = self.metadata.create_or_update(data=self.create_collection)

        # Update the endpoint creation request with the actual collection FQN
        endpoint_request = CreateAPIEndpointRequest(
            name="test-endpoint",
            apiCollection=collection_res.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
            requestMethod=ApiRequestMethod.GET,
        )

        res = self.metadata.create_or_update(data=endpoint_request)

        self.assertEqual(res.name, self.api_endpoint_entity.name)
        self.assertEqual(res.apiCollection.id, collection_res.id)
        self.assertEqual(res.requestMethod, ApiRequestMethod.GET)
        self.assertTrue(
            res.owners is None or res.owners == EntityReferenceList(root=[])
        )

    def test_update_api_endpoint(self):
        """
        Updating it properly changes its properties
        """
        # First ensure the collection exists
        collection_res = self.metadata.create_or_update(data=self.create_collection)

        # Create the endpoint
        endpoint_request = CreateAPIEndpointRequest(
            name="test-endpoint",
            apiCollection=collection_res.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
            requestMethod=ApiRequestMethod.GET,
        )

        res_create = self.metadata.create_or_update(data=endpoint_request)

        updated = endpoint_request.model_dump(exclude_unset=True)
        updated["owners"] = self.owners
        updated_entity = CreateAPIEndpointRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated owner
        self.assertEqual(res.name, updated_entity.name)
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owners.root[0].id, self.user.id)

    def test_get_api_endpoint_name(self):
        """
        We can fetch an APIEndpoint by name and get it back as Entity
        """
        # First ensure the collection exists
        collection_res = self.metadata.create_or_update(data=self.create_collection)

        # Create the endpoint
        endpoint_request = CreateAPIEndpointRequest(
            name="test-endpoint-get-name",
            apiCollection=collection_res.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
            requestMethod=ApiRequestMethod.GET,
        )

        endpoint_res = self.metadata.create_or_update(data=endpoint_request)

        res = self.metadata.get_by_name(
            entity=APIEndpoint, fqn=endpoint_res.fullyQualifiedName
        )
        self.assertEqual(res.name, endpoint_res.name)

        # Now check that we get a None if the endpoint does not exist
        nullable_res = self.metadata.get_by_name(
            entity=APIEndpoint, fqn="something.made.up"
        )
        self.assertIsNone(nullable_res)

    def test_get_api_endpoint_id(self):
        """
        We can fetch an APIEndpoint by ID and get it back as Entity
        """
        # First ensure the collection exists
        collection_res = self.metadata.create_or_update(data=self.create_collection)

        # Create the endpoint
        endpoint_request = CreateAPIEndpointRequest(
            name="test-endpoint-get-id",
            apiCollection=collection_res.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
            requestMethod=ApiRequestMethod.GET,
        )

        endpoint_res = self.metadata.create_or_update(data=endpoint_request)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=APIEndpoint, fqn=endpoint_res.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(
            entity=APIEndpoint, entity_id=str(res_name.id.root)
        )

        self.assertEqual(res_name.id, res.id)

    def test_list_api_endpoints(self):
        """
        We can list all our APIEndpoints
        """
        # First ensure the collection exists
        collection_res = self.metadata.create_or_update(data=self.create_collection)

        # Create the endpoint
        endpoint_request = CreateAPIEndpointRequest(
            name="test-endpoint",
            apiCollection=collection_res.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
            requestMethod=ApiRequestMethod.GET,
        )

        self.metadata.create_or_update(data=endpoint_request)

        res = self.metadata.list_entities(
            entity=APIEndpoint,
            params={"apiCollection": collection_res.fullyQualifiedName.root},
        )

        # Fetch our test APIEndpoint. We have already inserted it, so we should find it
        data = next(
            iter(
                ent for ent in res.entities if ent.name == self.api_endpoint_entity.name
            ),
            None,
        )
        assert data

    def test_delete_api_endpoint(self):
        """
        We can delete an APIEndpoint by ID
        """
        # First ensure the collection exists
        collection_res = self.metadata.create_or_update(data=self.create_collection)

        # Create a separate endpoint for deletion test
        delete_endpoint = CreateAPIEndpointRequest(
            name="test-endpoint-delete",
            apiCollection=collection_res.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}/delete",
            requestMethod=ApiRequestMethod.DELETE,
        )

        # Find by name
        endpoint_res = self.metadata.create_or_update(data=delete_endpoint)
        res_name = self.metadata.get_by_name(
            entity=APIEndpoint, fqn=endpoint_res.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(entity=APIEndpoint, entity_id=res_name.id)

        # Delete
        self.metadata.delete(entity=APIEndpoint, entity_id=str(res_id.id.root))

        # Then we should not find it
        res = self.metadata.list_entities(entity=APIEndpoint)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == endpoint_res.fullyQualifiedName
            ),
            None,
        )

    def test_list_all_and_paginate_collections(self):
        """
        Validate generator utility to fetch all APICollections
        """
        fake_create = deepcopy(self.create_collection)
        for i in range(0, 5):
            fake_create.name = EntityName(self.create_collection.name.root + str(i))
            self.metadata.create_or_update(data=fake_create)

        all_entities = self.metadata.list_all_entities(
            entity=APICollection, limit=2  # paginate in batches of pairs
        )
        assert (
            len(list(all_entities)) >= 5
        )  # In case the default testing entity is not present

        entity_list = self.metadata.list_entities(entity=APICollection, limit=2)
        assert len(entity_list.entities) == 2
        if entity_list.after:
            after_entity_list = self.metadata.list_entities(
                entity=APICollection, limit=2, after=entity_list.after
            )
            assert len(after_entity_list.entities) == 2

    def test_get_entity_ref_api_service(self):
        """
        test get EntityReference for ApiService
        """
        res = self.metadata.create_or_update(data=self.service)
        entity_ref = self.metadata.get_entity_reference(
            entity=ApiService, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id

    def test_get_entity_ref_api_collection(self):
        """
        test get EntityReference for APICollection
        """
        res = self.metadata.create_or_update(data=self.create_collection)
        entity_ref = self.metadata.get_entity_reference(
            entity=APICollection, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id

    def test_get_entity_ref_api_endpoint(self):
        """
        test get EntityReference for APIEndpoint
        """
        # First ensure the collection exists
        collection_res = self.metadata.create_or_update(data=self.create_collection)

        # Create the endpoint
        endpoint_request = CreateAPIEndpointRequest(
            name="test-endpoint",
            apiCollection=collection_res.fullyQualifiedName,
            endpointURL="https://petstore.swagger.io/v2/pet/{petId}",
            requestMethod=ApiRequestMethod.GET,
        )

        res = self.metadata.create_or_update(data=endpoint_request)
        entity_ref = self.metadata.get_entity_reference(
            entity=APIEndpoint, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id
