#  Copyright 2024 Collate
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
Test REST/OpenAPI.
"""

from copy import deepcopy
from unittest import TestCase
from unittest.mock import patch

from pydantic import AnyUrl
from pydantic_core import Url

from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.entity.services.apiService import (
    ApiConnection,
    ApiService,
    ApiServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.schema import DataTypeTopic
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.api.rest.metadata import RestSource
from metadata.ingestion.source.api.rest.models import RESTCollection, RESTEndpoint

mock_rest_config = {
    "source": {
        "type": "rest",
        "serviceName": "openapi_rest",
        "serviceConnection": {
            "config": {
                "type": "Rest",
                "openAPISchemaURL": "https://petstore3.swagger.io/api/v3/openapi.json",
                "docURL": "https://petstore3.swagger.io/",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "ApiMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}
MOCK_COLLECTIONS = [
    RESTCollection(
        name=EntityName(root="pet"),
        display_name=None,
        description=Markdown(root="Everything about your Pets"),
        url=None,
    ),
    RESTCollection(
        name=EntityName(root="store"),
        display_name=None,
        description=Markdown(root="Access to Petstore orders"),
        url=None,
    ),
    RESTCollection(
        name=EntityName(root="user"),
        display_name=None,
        description=Markdown(root="Operations about user"),
        url=None,
    ),
]
MOCK_SINGLE_COLLECTION = RESTCollection(
    name=EntityName(root="store"),
    display_name=None,
    description=Markdown(root="Access to Petstore orders"),
    url=Url("https://petstore3.swagger.io/#/store"),
)
MOCK_SINGLE_ENDPOINT = RESTEndpoint(
    name="/store/order/post",
    display_name="/store/order",
    description=Markdown(root="Place a new order in the store."),
    url=None,
    operationId="placeOrder",
)

MOCK_API_SERVICE = ApiService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="openapi_rest",
    fullyQualifiedName=FullyQualifiedEntityName("openapi_rest"),
    connection=ApiConnection(),
    serviceType=ApiServiceType.Rest,
)
EXPECTED_COLLECTION_REQUEST = [
    Either(
        right=CreateAPICollectionRequest(
            name=EntityName(root="pet"),
            description=Markdown(root="Everything about your Pets"),
            endpointURL=Url("https://petstore3.swagger.io/#/pet"),
            service=FullyQualifiedEntityName(root="openapi_rest"),
        )
    )
]
MOCK_STORE_URL = AnyUrl("https://petstore3.swagger.io/#/store")
MOCK_STORE_ORDER_URL = AnyUrl("https://petstore3.swagger.io/#/store/placeOrder")
MOCK_JSON_RESPONSE = {
    "paths": {
        "/user/login": {
            "get": {
                "tags": ["user"],
                "summary": "Logs user into the system",
                "operationId": "loginUser",
            }
        }
    },
    "tags": [
        {
            "name": "pet",
            "description": "Everything about your Pets",
        },
        {"name": "store", "description": "Access to Petstore orders"},
    ],
}

# Mock data for testing process_schema_fields
MOCK_SCHEMA_RESPONSE_SIMPLE = {
    "components": {
        "schemas": {
            "User": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "name": {"type": "string"},
                    "email": {"type": "string"},
                },
            }
        }
    }
}

MOCK_SCHEMA_RESPONSE_WITH_ARRAY = {
    "components": {
        "schemas": {
            "User": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "name": {"type": "string"},
                    "tags": {
                        "type": "array",
                        "items": {"$ref": "#/components/schemas/Tag"},
                    },
                },
            },
            "Tag": {
                "type": "object",
                "properties": {"id": {"type": "integer"}, "name": {"type": "string"}},
            },
        }
    }
}

MOCK_SCHEMA_RESPONSE_WITH_OBJECT_REF = {
    "components": {
        "schemas": {
            "User": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "name": {"type": "string"},
                    "address": {"$ref": "#/components/schemas/Address"},
                },
            },
            "Address": {
                "type": "object",
                "properties": {
                    "street": {"type": "string"},
                    "city": {"type": "string"},
                },
            },
        }
    }
}

MOCK_SCHEMA_RESPONSE_WITH_ARRAY_CIRCULAR = {
    "components": {
        "schemas": {
            "User": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "name": {"type": "string"},
                    "friends": {
                        "type": "array",
                        "items": {"$ref": "#/components/schemas/User"},
                    },
                },
            }
        }
    }
}

MOCK_SCHEMA_RESPONSE_WITH_OBJECT_REF_CIRCULAR = {
    "components": {
        "schemas": {
            "User": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "name": {"type": "string"},
                    "profile": {"$ref": "#/components/schemas/Profile"},
                },
            },
            "Profile": {
                "type": "object",
                "properties": {
                    "bio": {"type": "string"},
                    "user": {"$ref": "#/components/schemas/User"},
                },
            },
        }
    }
}


class RESTTest(TestCase):
    @patch("metadata.ingestion.source.api.api_service.ApiServiceSource.test_connection")
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_rest_config)
        self.rest_source = RestSource.create(
            mock_rest_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.rest_source.context.get().__dict__[
            "api_service"
        ] = MOCK_API_SERVICE.fullyQualifiedName.root

    def test_get_api_collections(self):
        """test get api collections"""
        collections = list(self.rest_source.get_api_collections())
        assert collections == MOCK_COLLECTIONS

    def test_yield_api_collection(self):
        """test yield api collections"""
        collection_request = list(
            self.rest_source.yield_api_collection(MOCK_COLLECTIONS[0])
        )
        assert collection_request == EXPECTED_COLLECTION_REQUEST

    def test_all_collections(self):
        with patch.object(
            self.rest_source.connection, "json", return_value=MOCK_JSON_RESPONSE
        ):
            collections = list(self.rest_source.get_api_collections())
        MOCK_COLLECTIONS_COPY = deepcopy(MOCK_COLLECTIONS)
        MOCK_COLLECTIONS_COPY[2].description = None
        assert collections == MOCK_COLLECTIONS_COPY

    def test_generate_collection_url(self):
        """test generate collection url"""
        collection_url = self.rest_source._generate_collection_url("store")
        assert collection_url == MOCK_STORE_URL

    def test_generate_endpoint_url(self):
        """test generate endpoint url"""
        endpoint_url = self.rest_source._generate_endpoint_url(
            MOCK_SINGLE_COLLECTION, MOCK_SINGLE_ENDPOINT
        )
        assert endpoint_url == MOCK_STORE_ORDER_URL

    @patch("metadata.ingestion.source.api.api_service.ApiServiceSource.test_connection")
    def test_collection_filter_pattern(self, test_connection):
        """test collection filter pattern"""
        test_connection.return_value = False
        # Test with include pattern
        include_config = deepcopy(mock_rest_config)
        include_config["source"]["sourceConfig"]["config"][
            "apiCollectionFilterPattern"
        ] = {"includes": ["pet.*"]}
        rest_source_include = RestSource.create(
            include_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        collections_include = list(rest_source_include.get_api_collections())
        assert len(collections_include) == 1
        assert collections_include[0].name.root == "pet"

        # Test with exclude pattern
        exclude_config = deepcopy(mock_rest_config)
        exclude_config["source"]["sourceConfig"]["config"][
            "apiCollectionFilterPattern"
        ] = {"excludes": ["store.*"]}
        rest_source_exclude = RestSource.create(
            exclude_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        collections_exclude = list(rest_source_exclude.get_api_collections())
        assert len(collections_exclude) == 2
        assert all(col.name.root != "store" for col in collections_exclude)

        # Test with both include and exclude patterns
        both_config = deepcopy(mock_rest_config)
        both_config["source"]["sourceConfig"]["config"][
            "apiCollectionFilterPattern"
        ] = {"includes": ["pet.*", "user.*"], "excludes": ["user.*"]}
        rest_source_both = RestSource.create(
            both_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        collections_both = list(rest_source_both.get_api_collections())
        assert len(collections_both) == 1
        assert collections_both[0].name.root == "pet"

        # Test with invalid pattern
        invalid_config = deepcopy(mock_rest_config)
        invalid_config["source"]["sourceConfig"]["config"][
            "apiCollectionFilterPattern"
        ] = {"includes": ["invalid.*"]}
        rest_source_invalid = RestSource.create(
            invalid_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        collections_invalid = list(rest_source_invalid.get_api_collections())
        assert len(collections_invalid) == 0

    def test_process_schema_fields_simple(self):
        """Test processing simple schema fields without references"""
        self.rest_source.json_response = MOCK_SCHEMA_RESPONSE_SIMPLE

        result = self.rest_source.process_schema_fields("#/components/schemas/User")

        assert result is not None
        assert len(result) == 3
        # Check field names and types
        field_names = {field.name.root for field in result}
        assert field_names == {"id", "name", "email"}

        # Check specific field types
        id_field = next(field for field in result if field.name.root == "id")
        assert id_field.dataType == DataTypeTopic.INT
        assert id_field.children is None

    def test_process_schema_fields_with_array(self):
        """Test processing schema fields with array references"""
        self.rest_source.json_response = MOCK_SCHEMA_RESPONSE_WITH_ARRAY

        result = self.rest_source.process_schema_fields("#/components/schemas/User")

        assert result is not None
        assert len(result) == 3

        # Find the tags field (array type)
        tags_field = next(field for field in result if field.name.root == "tags")
        assert tags_field.dataType == DataTypeTopic.ARRAY
        assert tags_field.children is not None
        assert len(tags_field.children) == 2

        # Check array children fields
        child_names = {child.name.root for child in tags_field.children}
        assert child_names == {"id", "name"}

    def test_process_schema_fields_with_object_reference(self):
        """Test processing schema fields with object references"""
        self.rest_source.json_response = MOCK_SCHEMA_RESPONSE_WITH_OBJECT_REF

        result = self.rest_source.process_schema_fields("#/components/schemas/User")

        assert result is not None
        assert len(result) == 3

        # Find the address field (object reference)
        address_field = next(field for field in result if field.name.root == "address")
        assert address_field.dataType == DataTypeTopic.UNKNOWN
        assert address_field.children is not None
        assert len(address_field.children) == 2

        # Check object children fields
        child_names = {child.name.root for child in address_field.children}
        assert child_names == {"street", "city"}

    def test_process_schema_fields_circular_reference_array(self):
        """Test processing schema fields with circular references in arrays"""
        self.rest_source.json_response = MOCK_SCHEMA_RESPONSE_WITH_ARRAY_CIRCULAR

        result = self.rest_source.process_schema_fields("#/components/schemas/User")

        assert result is not None
        assert len(result) == 3

        # Find the friends field (array with circular reference)
        friends_field = next(field for field in result if field.name.root == "friends")
        assert friends_field.dataType == DataTypeTopic.ARRAY
        # Should be None due to circular reference prevention
        assert friends_field.children is None

    def test_process_schema_fields_circular_reference_object(self):
        """Test processing schema fields with circular references in objects"""
        self.rest_source.json_response = MOCK_SCHEMA_RESPONSE_WITH_OBJECT_REF_CIRCULAR

        result = self.rest_source.process_schema_fields("#/components/schemas/User")

        assert result is not None
        assert len(result) == 3

        # Find the profile field
        profile_field = next(field for field in result if field.name.root == "profile")
        assert profile_field.dataType == DataTypeTopic.UNKNOWN
        assert profile_field.children is not None
        assert len(profile_field.children) == 2

        # Check that the circular reference is prevented
        user_field_in_profile = next(
            child for child in profile_field.children if child.name.root == "user"
        )
        # Should be None due to circular reference prevention
        assert user_field_in_profile.children is None
