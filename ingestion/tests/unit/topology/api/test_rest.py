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
                "openAPISchemaConnection": {
                    "openAPISchemaURL": "https://petstore3.swagger.io/api/v3/openapi.json"
                },
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

# Mock data for testing process_schema_fields with descriptions
MOCK_SCHEMA_RESPONSE_WITH_DESCRIPTIONS = {
    "components": {
        "schemas": {
            "FlightAirportInformation": {
                "type": "object",
                "properties": {
                    "departureAirport": {
                        "title": "Departureairport",
                        "description": "Departure airport information",
                        "$ref": "#/components/schemas/AirportInformation",
                    },
                    "arrivalAirport": {
                        "title": "Arrivalairport",
                        "description": "Arrival airport information",
                        "$ref": "#/components/schemas/AirportInformation",
                    },
                },
                "title": "FlightAirportInformation",
                "description": "Airport information for a flight, including departure and arrival airport details.",
            },
            "AirportInformation": {
                "type": "object",
                "properties": {
                    "gate": {
                        "type": "string",
                        "title": "Gate",
                        "description": "Flight gate",
                    },
                    "parking": {
                        "type": "string",
                        "title": "Parking",
                        "description": "Flight parking",
                    },
                },
                "title": "AirportInformation",
                "description": "Represents airport information for a flight.",
            },
        }
    }
}

# Mock data for testing Swagger 2.0 and query/path parameter support
MOCK_SWAGGER_2_REQUEST_BODY = {
    "parameters": [
        {
            "in": "body",
            "name": "user",
            "description": "User object",
            "schema": {"$ref": "#/components/schemas/User"},
        }
    ],
    "components": {
        "schemas": {
            "User": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "username": {"type": "string"},
                },
            }
        }
    },
}

MOCK_QUERY_PARAMETERS = {
    "parameters": [
        {
            "in": "query",
            "name": "page",
            "type": "integer",
            "description": "Page number",
        },
        {
            "in": "query",
            "name": "limit",
            "type": "integer",
            "description": "Items per page",
        },
        {
            "in": "path",
            "name": "userId",
            "type": "string",
            "description": "User ID",
        },
    ]
}

MOCK_QUERY_PARAMETERS_OPENAPI_3 = {
    "parameters": [
        {
            "in": "query",
            "name": "filter",
            "schema": {"type": "string"},
            "description": "Filter criteria",
        },
        {
            "in": "query",
            "name": "tags",
            "schema": {
                "type": "array",
                "items": {"type": "string"},
            },
            "description": "Tag filters",
        },
    ]
}

MOCK_MIXED_PARAMETERS = {
    "parameters": [
        {
            "in": "header",
            "name": "Authorization",
            "type": "string",
        },
        {
            "in": "query",
            "name": "search",
            "type": "string",
            "description": "Search term",
        },
        {
            "in": "path",
            "name": "id",
            "type": "integer",
        },
    ]
}

# Mock data for testing response schema extraction
MOCK_RESPONSE_DIRECT_REF = {
    "responses": {
        "200": {
            "description": "successful operation",
            "content": {
                "application/json": {"schema": {"$ref": "#/components/schemas/User"}}
            },
        }
    }
}

MOCK_RESPONSE_ARRAY_REF = {
    "responses": {
        "200": {
            "description": "successful operation",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "array",
                        "items": {"$ref": "#/components/schemas/Pet"},
                    }
                }
            },
        }
    }
}

MOCK_RESPONSE_NESTED_DATA_REF = {
    "responses": {
        "200": {
            "description": "successful operation",
            "content": {
                "application/json": {
                    "schema": {
                        "properties": {"data": {"$ref": "#/components/schemas/User"}}
                    }
                }
            },
        }
    }
}

MOCK_RESPONSE_NO_SCHEMA = {
    "responses": {"200": {"description": "successful operation"}}
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
        expected_collections = MOCK_COLLECTIONS + [
            RESTCollection(
                name=EntityName(root="default"),
                display_name=None,
                description=None,
                url=None,
            )
        ]
        assert collections == expected_collections

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
        MOCK_COLLECTIONS_COPY[2].description = Markdown(root="Operations about user")
        MOCK_COLLECTIONS_COPY.append(
            RESTCollection(
                name=EntityName(root="default"),
                display_name=None,
                description=None,
                url=None,
            )
        )
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
        assert len(collections_exclude) == 3
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

    def test_process_schema_fields_with_descriptions(self):
        """Test processing schema fields extracts descriptions from OpenAPI schemas"""
        self.rest_source.json_response = MOCK_SCHEMA_RESPONSE_WITH_DESCRIPTIONS

        result = self.rest_source.process_schema_fields(
            "#/components/schemas/FlightAirportInformation"
        )

        assert result is not None
        assert len(result) == 2

        # Check departure airport field has description
        departure_field = next(
            field for field in result if field.name.root == "departureAirport"
        )
        assert departure_field.description is not None
        assert departure_field.description.root == "Departure airport information"
        assert departure_field.dataType == DataTypeTopic.UNKNOWN
        assert departure_field.children is not None
        assert len(departure_field.children) == 2

        # Check arrival airport field has description
        arrival_field = next(
            field for field in result if field.name.root == "arrivalAirport"
        )
        assert arrival_field.description is not None
        assert arrival_field.description.root == "Arrival airport information"

        # Check nested fields in AirportInformation have descriptions
        gate_field = next(
            child for child in departure_field.children if child.name.root == "gate"
        )
        assert gate_field.description is not None
        assert gate_field.description.root == "Flight gate"
        assert gate_field.dataType == DataTypeTopic.STRING

        parking_field = next(
            child for child in departure_field.children if child.name.root == "parking"
        )
        assert parking_field.description is not None
        assert parking_field.description.root == "Flight parking"
        assert parking_field.dataType == DataTypeTopic.STRING

    def test_convert_parameter_to_field_swagger_2(self):
        """Test converting Swagger 2.0 parameter to FieldModel"""
        param = {
            "in": "query",
            "name": "page",
            "type": "integer",
            "description": "Page number",
        }

        result = self.rest_source._convert_parameter_to_field(param)

        assert result is not None
        assert result.name.root == "page"
        assert result.dataType == DataTypeTopic.INT
        assert result.description.root == "Page number"
        assert result.children is None

    def test_convert_parameter_to_field_openapi_3(self):
        """Test converting OpenAPI 3.0 parameter to FieldModel"""
        param = {
            "in": "query",
            "name": "filter",
            "schema": {"type": "string"},
            "description": "Filter criteria",
        }

        result = self.rest_source._convert_parameter_to_field(param)

        assert result is not None
        assert result.name.root == "filter"
        assert result.dataType == DataTypeTopic.STRING
        assert result.description.root == "Filter criteria"

    def test_convert_parameter_to_field_array_type(self):
        """Test converting array parameter to FieldModel with children"""
        param = {
            "in": "query",
            "name": "tags",
            "schema": {
                "type": "array",
                "items": {"type": "string"},
            },
            "description": "Tag filters",
        }

        result = self.rest_source._convert_parameter_to_field(param)

        assert result is not None
        assert result.name.root == "tags"
        assert result.dataType == DataTypeTopic.ARRAY
        assert result.children is not None
        assert len(result.children) == 1
        assert result.children[0].name.root == "item"
        assert result.children[0].dataType == DataTypeTopic.STRING

    def test_convert_parameter_to_field_no_name(self):
        """Test that parameter without name returns None"""
        param = {"in": "query", "type": "string"}

        result = self.rest_source._convert_parameter_to_field(param)

        assert result is None

    def test_convert_parameter_to_field_no_type(self):
        """Test parameter without type defaults to UNKNOWN"""
        param = {"in": "query", "name": "search"}

        result = self.rest_source._convert_parameter_to_field(param)

        assert result is not None
        assert result.dataType == DataTypeTopic.UNKNOWN

    def test_get_request_schema_swagger_2_body(self):
        """Test extracting request schema from Swagger 2.0 body parameter"""
        self.rest_source.json_response = MOCK_SWAGGER_2_REQUEST_BODY

        result = self.rest_source._get_request_schema(MOCK_SWAGGER_2_REQUEST_BODY)

        assert result is not None
        assert result.schemaFields is not None
        assert len(result.schemaFields) == 2
        field_names = {field.name.root for field in result.schemaFields}
        assert field_names == {"id", "username"}

    def test_get_request_schema_query_parameters(self):
        """Test extracting request schema from query and path parameters"""
        result = self.rest_source._get_request_schema(MOCK_QUERY_PARAMETERS)

        assert result is not None
        assert result.schemaFields is not None
        assert len(result.schemaFields) == 3

        field_names = {field.name.root for field in result.schemaFields}
        assert field_names == {"page", "limit", "userId"}

        # Check that query parameters are extracted correctly
        page_field = next(f for f in result.schemaFields if f.name.root == "page")
        assert page_field.dataType == DataTypeTopic.INT
        assert page_field.description.root == "Page number"

    def test_get_request_schema_openapi_3_query_parameters(self):
        """Test extracting request schema from OpenAPI 3.0 query parameters"""
        result = self.rest_source._get_request_schema(MOCK_QUERY_PARAMETERS_OPENAPI_3)

        assert result is not None
        assert result.schemaFields is not None
        assert len(result.schemaFields) == 2

        # Check array parameter with schema
        tags_field = next(f for f in result.schemaFields if f.name.root == "tags")
        assert tags_field.dataType == DataTypeTopic.ARRAY
        assert tags_field.children is not None
        assert len(tags_field.children) == 1

    def test_get_request_schema_mixed_parameters(self):
        """Test that only query and path parameters are extracted, not headers"""
        result = self.rest_source._get_request_schema(MOCK_MIXED_PARAMETERS)

        assert result is not None
        assert result.schemaFields is not None
        assert len(result.schemaFields) == 2  # Only query and path, not header

        field_names = {field.name.root for field in result.schemaFields}
        assert field_names == {"search", "id"}
        assert "Authorization" not in field_names

    def test_get_request_schema_no_parameters(self):
        """Test that endpoints without request schema return None"""
        result = self.rest_source._get_request_schema({})

        assert result is None

    def test_get_request_schema_openapi_3_requestbody(self):
        """Test that OpenAPI 3.0 requestBody still works (backward compatibility)"""
        mock_openapi_3 = {
            "requestBody": {
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/User"}
                    }
                }
            }
        }
        self.rest_source.json_response = MOCK_SCHEMA_RESPONSE_SIMPLE

        result = self.rest_source._get_request_schema(mock_openapi_3)

        assert result is not None
        assert result.schemaFields is not None
        assert len(result.schemaFields) == 3

    def test_get_response_schema_direct_ref(self):
        """Test extracting response schema with direct $ref"""
        self.rest_source.json_response = MOCK_SCHEMA_RESPONSE_SIMPLE

        result = self.rest_source._get_response_schema(MOCK_RESPONSE_DIRECT_REF)

        assert result is not None
        assert result.schemaFields is not None
        assert len(result.schemaFields) == 3
        field_names = {field.name.root for field in result.schemaFields}
        assert field_names == {"id", "name", "email"}

    def test_get_response_schema_array_ref(self):
        """Test extracting response schema from array response (like GET endpoints)"""
        # Use existing User schema but modify the mock to reference it
        self.rest_source.json_response = MOCK_SCHEMA_RESPONSE_SIMPLE

        # Create a modified version of array response that references User
        mock_array_response = {
            "responses": {
                "200": {
                    "description": "successful operation",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "array",
                                "items": {"$ref": "#/components/schemas/User"},
                            }
                        }
                    },
                }
            }
        }

        result = self.rest_source._get_response_schema(mock_array_response)

        assert result is not None
        assert result.schemaFields is not None
        assert len(result.schemaFields) == 3
        field_names = {field.name.root for field in result.schemaFields}
        assert field_names == {"id", "name", "email"}

    def test_get_response_schema_nested_data_ref(self):
        """Test extracting response schema from nested properties.data structure"""
        self.rest_source.json_response = MOCK_SCHEMA_RESPONSE_SIMPLE

        result = self.rest_source._get_response_schema(MOCK_RESPONSE_NESTED_DATA_REF)

        assert result is not None
        assert result.schemaFields is not None
        assert len(result.schemaFields) == 3

    def test_get_response_schema_no_schema(self):
        """Test that endpoints without response schema return None"""
        result = self.rest_source._get_response_schema(MOCK_RESPONSE_NO_SCHEMA)

        assert result is None

    def test_get_response_schema_no_responses(self):
        """Test that endpoints without responses section return None"""
        result = self.rest_source._get_response_schema({})

        assert result is None

    def test_parse_openapi_type_integer(self):
        """Test _parse_openapi_type converts integer to INT"""
        result = self.rest_source._parse_openapi_type("integer")
        assert result == DataTypeTopic.INT

    def test_parse_openapi_type_string(self):
        """Test _parse_openapi_type handles standard types"""
        result = self.rest_source._parse_openapi_type("string")
        assert result == DataTypeTopic.STRING

    def test_parse_openapi_type_unknown(self):
        """Test _parse_openapi_type returns UNKNOWN for invalid types"""
        result = self.rest_source._parse_openapi_type("invalid_type")
        assert result == DataTypeTopic.UNKNOWN

    def test_parse_openapi_type_none(self):
        """Test _parse_openapi_type returns UNKNOWN for None"""
        result = self.rest_source._parse_openapi_type(None)
        assert result == DataTypeTopic.UNKNOWN

    def test_parse_openapi_type_case_insensitive(self):
        """Test _parse_openapi_type is case insensitive"""
        result = self.rest_source._parse_openapi_type("BOOLEAN")
        assert result == DataTypeTopic.BOOLEAN

    def test_extract_schema_from_response_openapi3(self):
        """Test _extract_schema_from_response extracts OpenAPI 3.0 schema"""
        response = {
            "content": {
                "application/json": {"schema": {"$ref": "#/components/schemas/User"}}
            }
        }
        result = self.rest_source._extract_schema_from_response(response)
        assert result == {"$ref": "#/components/schemas/User"}

    def test_extract_schema_from_response_swagger2(self):
        """Test _extract_schema_from_response extracts Swagger 2.0 schema"""
        response = {"schema": {"$ref": "#/definitions/Pet"}}
        result = self.rest_source._extract_schema_from_response(response)
        assert result == {"$ref": "#/definitions/Pet"}

    def test_extract_schema_from_response_empty(self):
        """Test _extract_schema_from_response returns empty dict for no schema"""
        response = {"description": "Success"}
        result = self.rest_source._extract_schema_from_response(response)
        assert result == {}

    def test_process_inline_schema_simple(self):
        """Test _process_inline_schema processes inline properties"""
        properties = {
            "name": {"type": "string", "description": "User name"},
            "age": {"type": "integer", "description": "User age"},
        }
        result = self.rest_source._process_inline_schema(properties)

        assert result is not None
        assert len(result.schemaFields) == 2
        assert result.schemaFields[0].name.root == "name"
        assert result.schemaFields[0].dataType == DataTypeTopic.STRING
        assert result.schemaFields[1].name.root == "age"
        assert result.schemaFields[1].dataType == DataTypeTopic.INT

    def test_process_inline_schema_with_array(self):
        """Test _process_inline_schema handles array types"""
        properties = {"tags": {"type": "array", "items": {"type": "string"}}}
        result = self.rest_source._process_inline_schema(properties)

        assert result is not None
        assert len(result.schemaFields) == 1
        assert result.schemaFields[0].dataType == DataTypeTopic.ARRAY
        assert result.schemaFields[0].children[0].dataType == DataTypeTopic.STRING

    def test_process_inline_schema_no_type(self):
        """Test _process_inline_schema defaults to UNKNOWN for missing type"""
        properties = {"field": {"description": "A field without type"}}
        result = self.rest_source._process_inline_schema(properties)

        assert result is not None
        assert len(result.schemaFields) == 1
        assert result.schemaFields[0].dataType == DataTypeTopic.UNKNOWN

    def test_get_response_schema_inline_properties(self):
        """Test _get_response_schema handles inline schemas without $ref"""
        self.rest_source.json_response = {}
        info = {
            "responses": {
                "200": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "status": {"type": "string"},
                                    "count": {"type": "integer"},
                                },
                            }
                        }
                    }
                }
            }
        }
        result = self.rest_source._get_response_schema(info)

        assert result is not None
        assert len(result.schemaFields) == 2

    def test_get_response_schema_201_fallback(self):
        """Test _get_response_schema falls back to 201 when 200 not found"""
        self.rest_source.json_response = {
            "components": {
                "schemas": {"User": {"properties": {"id": {"type": "string"}}}}
            }
        }
        info = {
            "responses": {
                "201": {
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/User"}
                        }
                    }
                }
            }
        }
        result = self.rest_source._get_response_schema(info)

        assert result is not None
        assert len(result.schemaFields) == 1

    def test_convert_parameter_array_no_item_type(self):
        """Test _convert_parameter_to_field handles array without item type"""
        param = {
            "in": "query",
            "name": "ids",
            "type": "array",
            "items": {"type": "string"},  # Items with type
        }
        result = self.rest_source._convert_parameter_to_field(param)

        assert result is not None
        assert result.dataType == DataTypeTopic.ARRAY
        assert len(result.children) == 1
        assert result.children[0].dataType == DataTypeTopic.STRING

    def test_convert_parameter_array_missing_item_type(self):
        """Test _convert_parameter_to_field handles array with items but no type specified"""
        param = {
            "in": "query",
            "name": "ids",
            "type": "array",
            "items": {},  # Empty items object - treated as falsy in or expression
        }
        result = self.rest_source._convert_parameter_to_field(param)

        assert result is not None
        assert result.dataType == DataTypeTopic.ARRAY
        # When items dict is empty, it's treated as falsy, so children is None
        assert result.children is None

    def test_convert_parameter_array_no_items(self):
        """Test _convert_parameter_to_field handles array without items"""
        param = {
            "in": "query",
            "name": "ids",
            "type": "array"
            # No items key at all
        }
        result = self.rest_source._convert_parameter_to_field(param)

        assert result is not None
        assert result.dataType == DataTypeTopic.ARRAY
        # When no items key exists, children is None
        assert result.children is None

    @patch("metadata.ingestion.source.api.api_service.ApiServiceSource.test_connection")
    def test_endpoint_filter_pattern(self, test_connection):
        """test endpoint filter pattern"""
        test_connection.return_value = False

        # Setup mock JSON response with paths
        mock_json_with_paths = {
            "paths": {
                "/store/order": {
                    "post": {
                        "tags": ["store"],
                        "summary": "Place an order",
                        "operationId": "placeOrder",
                    }
                },
                "/store/inventory": {
                    "get": {
                        "tags": ["store"],
                        "summary": "Get inventory",
                        "operationId": "getInventory",
                    }
                },
                "/store/order/{orderId}": {
                    "get": {
                        "tags": ["store"],
                        "summary": "Get order by ID",
                        "operationId": "getOrderById",
                    }
                },
            },
            "tags": [{"name": "store", "description": "Access to Petstore orders"}],
        }

        # Test with include pattern - only endpoints matching the pattern
        include_config = deepcopy(mock_rest_config)
        include_config["source"]["sourceConfig"]["config"][
            "apiEndpointFilterPattern"
        ] = {"includes": [".*order.*"]}
        rest_source_include = RestSource.create(
            include_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        rest_source_include.json_response = mock_json_with_paths
        rest_source_include.context.get().__dict__[
            "api_service"
        ] = MOCK_API_SERVICE.fullyQualifiedName.root

        endpoints_include = list(
            rest_source_include.yield_api_endpoint(MOCK_SINGLE_COLLECTION)
        )
        # Should include /store/order and /store/order/{orderId} but not /store/inventory
        assert len(endpoints_include) == 2
        endpoint_names = [e.right.displayName for e in endpoints_include if e.right]
        assert "/store/order" in endpoint_names
        assert "/store/order/{orderId}" in endpoint_names
        assert "/store/inventory" not in endpoint_names

        # Test with exclude pattern
        exclude_config = deepcopy(mock_rest_config)
        exclude_config["source"]["sourceConfig"]["config"][
            "apiEndpointFilterPattern"
        ] = {"excludes": [".*inventory.*"]}
        rest_source_exclude = RestSource.create(
            exclude_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        rest_source_exclude.json_response = mock_json_with_paths
        rest_source_exclude.context.get().__dict__[
            "api_service"
        ] = MOCK_API_SERVICE.fullyQualifiedName.root

        endpoints_exclude = list(
            rest_source_exclude.yield_api_endpoint(MOCK_SINGLE_COLLECTION)
        )
        # Should exclude /store/inventory
        assert len(endpoints_exclude) == 2
        endpoint_names_exclude = [
            e.right.displayName for e in endpoints_exclude if e.right
        ]
        assert "/store/inventory" not in endpoint_names_exclude

    def test_filter_collection_endpoints(self):
        """Test _filter_collection_endpoints filters endpoints correctly for default and tagged collections"""
        self.rest_source.json_response = {
            "paths": {
                "/pet/findByStatus": {
                    "get": {
                        "tags": ["pet"],
                        "summary": "Find pets by status",
                        "operationId": "findPetsByStatus",
                    }
                },
                "/store/order": {
                    "post": {
                        "tags": ["store"],
                        "summary": "Place an order",
                        "operationId": "placeOrder",
                    }
                },
                "/health": {
                    "get": {"summary": "Health check", "operationId": "healthCheck"}
                },
                "/untagged/endpoint": {
                    "get": {"summary": "Untagged endpoint", "operationId": "untagged"}
                },
            }
        }

        pet_collection = RESTCollection(name=EntityName(root="pet"))
        result = self.rest_source._filter_collection_endpoints(pet_collection)
        assert result is not None
        assert len(result) == 1
        assert "/pet/findByStatus" in result

        store_collection = RESTCollection(name=EntityName(root="store"))
        result = self.rest_source._filter_collection_endpoints(store_collection)
        assert result is not None
        assert len(result) == 1
        assert "/store/order" in result

        default_collection = RESTCollection(name=EntityName(root="default"))
        result = self.rest_source._filter_collection_endpoints(default_collection)
        assert result is not None
        assert len(result) == 2
        assert "/health" in result
        assert "/untagged/endpoint" in result
