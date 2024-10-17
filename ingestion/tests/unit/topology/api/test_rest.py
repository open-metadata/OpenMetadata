#  Copyright 2024 Collate
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
Test REST/OpenAPI.
"""

from unittest import TestCase
from unittest.mock import patch

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
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.api.rest.metadata import RestSource
from metadata.ingestion.source.api.rest.models import RESTCollection

mock_rest_config = {
    "source": {
        "type": "rest",
        "serviceName": "openapi_rest",
        "serviceConnection": {
            "config": {
                "type": "Rest",
                "openAPISchemaURL": "https://petstore3.swagger.io/api/v3/openapi.json",
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
            endpointURL=Url("https://petstore3.swagger.io/api/v3/openapi.json#tag/pet"),
            service=FullyQualifiedEntityName(root="openapi_rest"),
        )
    )
]


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

    def test_json_schema(self):
        """test json schema"""
        schema_content_type = self.rest_source.connection.headers.get("content-type")
        assert "application/json" in schema_content_type
