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
Test ETag support in OpenMetadata ingestion client
"""
import unittest
from unittest.mock import Mock, patch

from metadata.ingestion.ometa.client import ETagMismatchError, REST


class TestETagSupport(unittest.TestCase):
    """Test ETag functionality in the OpenMetadata client."""

    def setUp(self):
        """Set up test client."""
        self.mock_config = Mock()
        self.mock_config.auth_token = "mock_token"
        self.mock_config.auth_header = "Authorization"
        self.mock_config.auth_token_mode = "Bearer"
        self.mock_config.extra_headers = {}
        self.mock_config.allow_redirects = True
        self.mock_config.verify = True
        self.mock_config.cert = None
        self.mock_config.timeout = 30
        self.mock_config.retry = 3
        self.mock_config.retry_wait = 1
        self.mock_config.retry_codes = [429, 502, 503, 504]
        self.mock_config.limit_codes = [400, 401, 403]
        self.mock_config.ttl_cache = 60
        self.mock_config.access_token = "access_token"
        self.mock_config.expires_in = None
        
        self.client = REST(self.mock_config)

    @patch('requests.Session.request')
    def test_get_with_etag_success(self, mock_request):
        """Test successful GET with ETag header."""
        # Mock response with ETag
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {'ETag': '"test-etag-123"'}
        mock_response.json.return_value = {"id": "test-id", "name": "test-entity"}
        mock_response.text = '{"id": "test-id", "name": "test-entity"}'
        mock_response.raise_for_status.return_value = None
        mock_request.return_value = mock_response

        result = self.client.get_with_etag("/api/v1/tables/test-id")

        self.assertIsNotNone(result)
        self.assertEqual(result["data"]["id"], "test-id")
        self.assertEqual(result["etag"], '"test-etag-123"')

    @patch('requests.Session.request')
    def test_patch_with_etag_success(self, mock_request):
        """Test successful PATCH with If-Match header."""
        # Mock response 
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {'ETag': '"new-etag-456"'}
        mock_response.json.return_value = {"id": "test-id", "name": "updated-entity"}
        mock_response.text = '{"id": "test-id", "name": "updated-entity"}'
        mock_response.raise_for_status.return_value = None
        mock_request.return_value = mock_response

        patch_data = '[{"op": "replace", "path": "/description", "value": "new description"}]'
        result = self.client.patch_with_etag("/api/v1/tables/test-id", data=patch_data, etag='"test-etag-123"')

        self.assertIsNotNone(result)
        self.assertEqual(result["data"]["name"], "updated-entity")
        self.assertEqual(result["etag"], '"new-etag-456"')
        
        # Verify If-Match header was sent
        call_args = mock_request.call_args
        headers = call_args[1]["headers"]
        self.assertEqual(headers["If-Match"], '"test-etag-123"')

    @patch('requests.Session.request')
    def test_patch_with_etag_conflict(self, mock_request):
        """Test PATCH with ETag conflict (412 response)."""
        # Mock 412 response
        mock_response = Mock()
        mock_response.status_code = 412
        mock_response.text = "Precondition Failed"
        
        from requests.exceptions import HTTPError
        http_error = HTTPError(response=mock_response)
        mock_request.side_effect = http_error

        patch_data = '[{"op": "replace", "path": "/description", "value": "new description"}]'
        
        with self.assertRaises(ETagMismatchError) as context:
            self.client.patch_with_etag("/api/v1/tables/test-id", data=patch_data, etag='"old-etag"')
        
        self.assertEqual(context.exception.status_code, 412)

    @patch('requests.Session.request')
    def test_patch_without_etag(self, mock_request):
        """Test PATCH without ETag (backward compatibility)."""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {"id": "test-id", "name": "updated-entity"}
        mock_response.text = '{"id": "test-id", "name": "updated-entity"}'
        mock_response.raise_for_status.return_value = None
        mock_request.return_value = mock_response

        patch_data = '[{"op": "replace", "path": "/description", "value": "new description"}]'
        result = self.client.patch_with_etag("/api/v1/tables/test-id", data=patch_data)

        self.assertIsNotNone(result)
        self.assertEqual(result["data"]["name"], "updated-entity")
        self.assertIsNone(result["etag"])
        
        # Verify no If-Match header was sent
        call_args = mock_request.call_args
        headers = call_args[1]["headers"]
        self.assertNotIn("If-Match", headers)


if __name__ == '__main__':
    unittest.main()