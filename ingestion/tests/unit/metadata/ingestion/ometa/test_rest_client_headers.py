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
"""Unit tests for REST client headers parameter"""

from unittest.mock import Mock, patch

import pytest

from metadata.ingestion.ometa.client import REST, ClientConfig


class TestRESTClientHeaders:
    """Test class for REST client headers parameter functionality"""

    @pytest.fixture
    def rest_client(self):
        """Create a REST client for testing"""
        config = ClientConfig(
            base_url="https://test.example.com",
            api_version="v1",
            auth_token=lambda: ("test_token", 0),
            auth_header="Authorization",
        )
        return REST(config)

    @patch("metadata.ingestion.ometa.client.requests.Session.request")
    def test_get_with_custom_headers(self, mock_request, rest_client):
        """Test GET method with custom headers"""
        mock_response = Mock()
        mock_response.text = '{"status": "success"}'
        mock_response.json.return_value = {"status": "success"}
        mock_response.status_code = 200
        mock_request.return_value = mock_response

        custom_headers = {"Accept": "application/custom+json"}
        result = rest_client.get("/test", headers=custom_headers)

        # Verify request was made
        assert mock_request.called
        # Get the actual call arguments
        call_args = mock_request.call_args
        # Verify custom headers were passed
        assert "Accept" in call_args.kwargs["headers"]
        assert call_args.kwargs["headers"]["Accept"] == "application/custom+json"
        # Verify result
        assert result == {"status": "success"}

    @patch("metadata.ingestion.ometa.client.requests.Session.request")
    def test_post_with_custom_headers(self, mock_request, rest_client):
        """Test POST method with custom headers"""
        mock_response = Mock()
        mock_response.text = '{"id": "123"}'
        mock_response.json.return_value = {"id": "123"}
        mock_response.status_code = 200
        mock_request.return_value = mock_response

        custom_headers = {"Content-Type": "application/xml"}
        result = rest_client.post("/test", data="<xml/>", headers=custom_headers)

        # Verify request was made
        assert mock_request.called
        # Get the actual call arguments
        call_args = mock_request.call_args
        # Verify custom headers were passed
        assert "Content-Type" in call_args.kwargs["headers"]
        assert call_args.kwargs["headers"]["Content-Type"] == "application/xml"
        # Verify result
        assert result == {"id": "123"}

    @patch("metadata.ingestion.ometa.client.requests.Session.request")
    def test_put_with_custom_headers(self, mock_request, rest_client):
        """Test PUT method with custom headers"""
        mock_response = Mock()
        mock_response.text = '{"updated": true}'
        mock_response.json.return_value = {"updated": True}
        mock_response.status_code = 200
        mock_request.return_value = mock_response

        custom_headers = {"X-Custom-Header": "custom-value"}
        result = rest_client.put("/test", json={"key": "value"}, headers=custom_headers)

        # Verify request was made
        assert mock_request.called
        # Get the actual call arguments
        call_args = mock_request.call_args
        # Verify custom headers were passed
        assert "X-Custom-Header" in call_args.kwargs["headers"]
        assert call_args.kwargs["headers"]["X-Custom-Header"] == "custom-value"
        # Verify result
        assert result == {"updated": True}

    @patch("metadata.ingestion.ometa.client.requests.Session.request")
    def test_delete_with_custom_headers(self, mock_request, rest_client):
        """Test DELETE method with custom headers"""
        mock_response = Mock()
        mock_response.text = '{"deleted": true}'
        mock_response.json.return_value = {"deleted": True}
        mock_response.status_code = 200
        mock_request.return_value = mock_response

        custom_headers = {"Accept": "text/plain"}
        result = rest_client.delete("/test", headers=custom_headers)

        # Verify request was made
        assert mock_request.called
        # Get the actual call arguments
        call_args = mock_request.call_args
        # Verify custom headers were passed
        assert "Accept" in call_args.kwargs["headers"]
        assert call_args.kwargs["headers"]["Accept"] == "text/plain"
        # Verify result
        assert result == {"deleted": True}

    @patch("metadata.ingestion.ometa.client.requests.Session.request")
    def test_get_without_custom_headers(self, mock_request, rest_client):
        """Test GET method without custom headers uses default"""
        mock_response = Mock()
        mock_response.text = '{"status": "success"}'
        mock_response.json.return_value = {"status": "success"}
        mock_response.status_code = 200
        mock_request.return_value = mock_response

        result = rest_client.get("/test")

        # Verify request was made
        assert mock_request.called
        # Get the actual call arguments
        call_args = mock_request.call_args
        # Verify default headers are present
        assert "Content-type" in call_args.kwargs["headers"]
        assert call_args.kwargs["headers"]["Content-type"] == "application/json"
        # Verify result
        assert result == {"status": "success"}

    @patch("metadata.ingestion.ometa.client.requests.Session.request")
    def test_headers_override_default(self, mock_request, rest_client):
        """Test that custom headers override default Content-type"""
        mock_response = Mock()
        mock_response.text = '{"status": "success"}'
        mock_response.json.return_value = {"status": "success"}
        mock_response.status_code = 200
        mock_request.return_value = mock_response

        # Provide custom Content-type that should override default
        custom_headers = {"Content-type": "text/html"}
        result = rest_client.get("/test", headers=custom_headers)

        # Verify request was made
        assert mock_request.called
        # Get the actual call arguments
        call_args = mock_request.call_args
        # Verify custom header overrides default
        assert call_args.kwargs["headers"]["Content-type"] == "text/html"
        # Verify result
        assert result == {"status": "success"}
