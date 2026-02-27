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
Test Airbyte Client - Public API Detection and AirbyteCloudClient
"""

from unittest.mock import MagicMock, patch

import pytest
import requests

from metadata.generated.schema.entity.services.connections.pipeline.airbyte.basicAuth import (
    BasicAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
    Oauth20ClientCredentialsAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
    AirbyteConnection,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.source.pipeline.airbyte.client import (
    AirbyteClient,
    AirbyteCloudClient,
)

MOCK_REST = "metadata.ingestion.source.pipeline.airbyte.client.REST"
MOCK_REQUESTS_POST = "metadata.ingestion.source.pipeline.airbyte.client.requests.post"
MOCK_GENERATE_TOKEN = (
    "metadata.ingestion.source.pipeline.airbyte.client.generate_http_basic_token"
)
MOCK_TIME = "metadata.ingestion.source.pipeline.airbyte.client.time.time"


class TestAirbyteClientPublicApiDetection:
    """Test cases for Airbyte Client public API detection"""

    @patch(MOCK_REST)
    def test_internal_api_detection(self, mock_rest):
        mock_rest.return_value = MagicMock()
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/v1"
        )
        client = AirbyteClient(config)
        assert client._use_public_api is False

    @patch(MOCK_REST)
    def test_public_api_detection(self, mock_rest):
        mock_rest.return_value = MagicMock()
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)
        assert client._use_public_api is True

    @patch(MOCK_REST)
    def test_public_api_detection_case_insensitive(self, mock_rest):
        mock_rest.return_value = MagicMock()
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/PUBLIC/v1"
        )
        client = AirbyteClient(config)
        assert client._use_public_api is True

    @patch(MOCK_REST)
    def test_none_api_version_defaults_to_internal(self, mock_rest):
        mock_rest.return_value = MagicMock()
        config = AirbyteConnection(hostPort="http://localhost:8001", apiVersion=None)
        client = AirbyteClient(config)
        assert client._use_public_api is False

    @patch(MOCK_GENERATE_TOKEN)
    @patch(MOCK_REST)
    def test_basic_auth_configuration(self, mock_rest, mock_generate_token):
        mock_rest.return_value = MagicMock()
        mock_generate_token.return_value = "basic-token"
        config = AirbyteConnection(
            hostPort="http://localhost:8001",
            apiVersion="api/v1",
            auth=BasicAuthentication(username="user", password="pass"),
        )
        client = AirbyteClient(config)
        assert client.client is not None


class TestAirbyteClientInternalApi:
    """Test cases for AirbyteClient with internal API (api/v1)"""

    @patch(MOCK_REST)
    def test_list_workspaces(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "workspaces": [{"workspaceId": "test-workspace-id"}]
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/v1"
        )
        client = AirbyteClient(config)

        result = client.list_workspaces()

        mock_rest_instance.post.assert_called_once_with("/workspaces/list")
        assert result == [{"workspaceId": "test-workspace-id"}]

    @patch(MOCK_REST)
    def test_list_connections(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "connections": [{"connectionId": "test-connection-id"}]
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/v1"
        )
        client = AirbyteClient(config)

        result = client.list_connections("workspace-id")

        call_args = mock_rest_instance.post.call_args
        assert call_args[0][0] == "/connections/list"
        assert result == [{"connectionId": "test-connection-id"}]

    @patch(MOCK_REST)
    def test_list_jobs(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {"jobs": [{"jobId": "test-job-id"}]}
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/v1"
        )
        client = AirbyteClient(config)

        result = client.list_jobs("connection-id")

        call_args = mock_rest_instance.post.call_args
        assert call_args[0][0] == "/jobs/list"
        assert result == [{"jobId": "test-job-id"}]

    @patch(MOCK_REST)
    def test_get_source(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {"sourceId": "test-source-id"}
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/v1"
        )
        client = AirbyteClient(config)

        result = client.get_source("source-id")

        call_args = mock_rest_instance.post.call_args
        assert call_args[0][0] == "/sources/get"
        assert result == {"sourceId": "test-source-id"}

    @patch(MOCK_REST)
    def test_get_destination(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {"destinationId": "test-destination-id"}
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/v1"
        )
        client = AirbyteClient(config)

        result = client.get_destination("destination-id")

        call_args = mock_rest_instance.post.call_args
        assert call_args[0][0] == "/destinations/get"
        assert result == {"destinationId": "test-destination-id"}

    @patch(MOCK_REST)
    def test_list_workspaces_exception(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "exceptionStack": "error",
            "message": "Internal error",
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/v1"
        )
        client = AirbyteClient(config)

        with pytest.raises(APIError):
            client.list_workspaces()

    @patch(MOCK_REST)
    def test_list_connections_exception(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "exceptionStack": "error",
            "message": "Internal error",
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/v1"
        )
        client = AirbyteClient(config)

        with pytest.raises(APIError):
            client.list_connections("workspace-id")

    @patch(MOCK_REST)
    def test_list_jobs_exception(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "exceptionStack": "error",
            "message": "Internal error",
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/v1"
        )
        client = AirbyteClient(config)

        with pytest.raises(APIError):
            client.list_jobs("connection-id")

    @patch(MOCK_REST)
    def test_get_source_exception(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "exceptionStack": "error",
            "message": "Internal error",
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/v1"
        )
        client = AirbyteClient(config)

        with pytest.raises(APIError):
            client.get_source("source-id")

    @patch(MOCK_REST)
    def test_get_destination_exception(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.post.return_value = {
            "exceptionStack": "error",
            "message": "Internal error",
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/v1"
        )
        client = AirbyteClient(config)

        with pytest.raises(APIError):
            client.get_destination("destination-id")


class TestAirbyteClientPublicApi:
    """Test cases for AirbyteClient with public API (api/public/v1)"""

    @patch(MOCK_REST)
    def test_list_workspaces(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "data": [{"workspaceId": "test-workspace-id"}]
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        result = client.list_workspaces()

        mock_rest_instance.get.assert_called_once_with("/workspaces")
        assert result == [{"workspaceId": "test-workspace-id"}]

    @patch(MOCK_REST)
    def test_list_connections(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "data": [{"connectionId": "test-connection-id"}]
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        result = client.list_connections("workspace-id")

        mock_rest_instance.get.assert_called_once_with(
            "/connections?workspaceIds=workspace-id"
        )
        assert result == [{"connectionId": "test-connection-id"}]

    @patch(MOCK_REST)
    def test_list_jobs(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"data": [{"jobId": "test-job-id"}]}
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        result = client.list_jobs("connection-id")

        mock_rest_instance.get.assert_called_once_with(
            "/jobs?connectionId=connection-id"
        )
        assert result == [{"jobId": "test-job-id"}]

    @patch(MOCK_REST)
    def test_get_source(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"sourceId": "source-id"}
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        result = client.get_source("source-id")

        mock_rest_instance.get.assert_called_once_with("/sources/source-id")
        assert result == {"sourceId": "source-id"}

    @patch(MOCK_REST)
    def test_get_destination(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"destinationId": "destination-id"}
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        result = client.get_destination("destination-id")

        mock_rest_instance.get.assert_called_once_with("/destinations/destination-id")
        assert result == {"destinationId": "destination-id"}

    @patch(MOCK_REST)
    def test_list_workspaces_exception(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Public API error",
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        with pytest.raises(APIError):
            client.list_workspaces()

    @patch(MOCK_REST)
    def test_list_connections_exception(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Public API error",
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        with pytest.raises(APIError):
            client.list_connections("workspace-id")

    @patch(MOCK_REST)
    def test_list_jobs_exception(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Public API error",
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        with pytest.raises(APIError):
            client.list_jobs("connection-id")

    @patch(MOCK_REST)
    def test_get_source_exception(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Public API error",
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        with pytest.raises(APIError):
            client.get_source("source-id")

    @patch(MOCK_REST)
    def test_get_destination_exception(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Public API error",
        }
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        with pytest.raises(APIError):
            client.get_destination("destination-id")


class TestAirbyteClientUrlEncoding:
    """Test URL encoding of parameters in public API"""

    @patch(MOCK_REST)
    def test_list_connections_url_encoding(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"data": []}
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        client.list_connections("workspace/id&special=chars")

        mock_rest_instance.get.assert_called_once_with(
            "/connections?workspaceIds=workspace%2Fid%26special%3Dchars"
        )

    @patch(MOCK_REST)
    def test_list_jobs_url_encoding(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"data": []}
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        client.list_jobs("connection/id&special=chars")

        mock_rest_instance.get.assert_called_once_with(
            "/jobs?connectionId=connection%2Fid%26special%3Dchars"
        )

    @patch(MOCK_REST)
    def test_get_source_url_encoding(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"sourceId": "src/id"}
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        client.get_source("src/id")

        mock_rest_instance.get.assert_called_once_with("/sources/src%2Fid")

    @patch(MOCK_REST)
    def test_get_destination_url_encoding(self, mock_rest):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"destinationId": "dst/id"}
        mock_rest.return_value = mock_rest_instance
        config = AirbyteConnection(
            hostPort="http://localhost:8001", apiVersion="api/public/v1"
        )
        client = AirbyteClient(config)

        client.get_destination("dst/id")

        mock_rest_instance.get.assert_called_once_with("/destinations/dst%2Fid")


class TestAirbyteCloudClient:
    """Test cases for AirbyteCloudClient"""

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_requires_oauth(self, mock_rest, mock_requests_post):
        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=BasicAuthentication(username="user", password="pass"),
        )

        with pytest.raises(ValueError, match="OAuth 2.0"):
            AirbyteCloudClient(config)

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_oauth_initialization(self, mock_rest, mock_requests_post):
        mock_rest.return_value = MagicMock()
        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)

        assert client.client is not None
        assert client._oauth_token is None
        assert client._oauth_token_expiry == 0
        assert client._use_public_api is True

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_fetch_oauth_token_success(self, mock_rest, mock_requests_post):
        mock_rest.return_value = MagicMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": "test-token",
            "expires_in": 3600,
        }
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)
        token, expires_in = client._fetch_oauth_token()

        assert token == "test-token"
        assert expires_in == 3600

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_fetch_oauth_token_no_token(self, mock_rest, mock_requests_post):
        mock_rest.return_value = MagicMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)

        with pytest.raises(APIError, match="No access_token"):
            client._fetch_oauth_token()

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_fetch_oauth_token_request_error(self, mock_rest, mock_requests_post):
        mock_rest.return_value = MagicMock()
        mock_requests_post.side_effect = requests.exceptions.RequestException(
            "Connection error"
        )

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)

        with pytest.raises(APIError, match="OAuth token fetch failed"):
            client._fetch_oauth_token()

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_fetch_oauth_token_default_expiry(self, mock_rest, mock_requests_post):
        mock_rest.return_value = MagicMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "test-token"}
        mock_requests_post.return_value = mock_response

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)
        token, expires_in = client._fetch_oauth_token()

        assert token == "test-token"
        assert expires_in == 180

    @patch(MOCK_TIME)
    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_get_oauth_token_refresh(self, mock_rest, mock_requests_post, mock_time):
        mock_rest.return_value = MagicMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": "new-token",
            "expires_in": 3600,
        }
        mock_requests_post.return_value = mock_response
        mock_time.return_value = 1000.0

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)
        token, _ = client._get_oauth_token()

        assert token == "new-token"
        assert client._oauth_token == "new-token"
        assert client._oauth_token_expiry == 1000.0 + 3600

    @patch(MOCK_TIME)
    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_get_oauth_token_uses_cached(
        self, mock_rest, mock_requests_post, mock_time
    ):
        mock_rest.return_value = MagicMock()
        mock_time.return_value = 1000.0

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)
        client._oauth_token = "cached-token"
        client._oauth_token_expiry = 2000.0

        token, _ = client._get_oauth_token()

        assert token == "cached-token"
        assert mock_requests_post.call_count == 0

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_cloud_client_inherits_public_api_methods(
        self, mock_rest, mock_requests_post
    ):
        """AirbyteCloudClient inherits public API methods from AirbyteClient"""
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "data": [{"workspaceId": "cloud-workspace"}]
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)
        result = client.list_workspaces()

        mock_rest_instance.get.assert_called_with("/workspaces")
        assert result == [{"workspaceId": "cloud-workspace"}]

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_cloud_client_list_connections(self, mock_rest, mock_requests_post):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "data": [{"connectionId": "cloud-connection"}]
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)
        result = client.list_connections("workspace-id")

        mock_rest_instance.get.assert_called_with(
            "/connections?workspaceIds=workspace-id"
        )
        assert result == [{"connectionId": "cloud-connection"}]

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_cloud_client_list_jobs(self, mock_rest, mock_requests_post):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"data": [{"jobId": "cloud-job"}]}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)
        result = client.list_jobs("connection-id")

        mock_rest_instance.get.assert_called_with("/jobs?connectionId=connection-id")
        assert result == [{"jobId": "cloud-job"}]

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_cloud_client_get_source(self, mock_rest, mock_requests_post):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"sourceId": "cloud-source"}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)
        result = client.get_source("source-id")

        mock_rest_instance.get.assert_called_with("/sources/source-id")
        assert result == {"sourceId": "cloud-source"}

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_cloud_client_get_destination(self, mock_rest, mock_requests_post):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"destinationId": "cloud-destination"}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)
        result = client.get_destination("destination-id")

        mock_rest_instance.get.assert_called_with("/destinations/destination-id")
        assert result == {"destinationId": "cloud-destination"}

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_cloud_client_exception_handling(self, mock_rest, mock_requests_post):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {
            "exceptionStack": "error",
            "message": "Cloud error",
        }
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)

        with pytest.raises(APIError):
            client.list_workspaces()

    @patch(MOCK_REQUESTS_POST)
    @patch(MOCK_REST)
    def test_cloud_client_url_encoding(self, mock_rest, mock_requests_post):
        mock_rest_instance = MagicMock()
        mock_rest_instance.get.return_value = {"data": []}
        mock_rest.return_value = mock_rest_instance

        config = AirbyteConnection(
            hostPort="https://api.airbyte.com",
            apiVersion="v1",
            auth=Oauth20ClientCredentialsAuthentication(
                clientId="client-id", clientSecret="client-secret"
            ),
        )

        client = AirbyteCloudClient(config)
        client.list_connections("workspace/id&special=chars")

        mock_rest_instance.get.assert_called_with(
            "/connections?workspaceIds=workspace%2Fid%26special%3Dchars"
        )
