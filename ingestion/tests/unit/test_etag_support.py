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

from metadata.ingestion.ometa.client import REST, ETagMismatchError


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
        self.mock_config.etag_retry = 3
        self.mock_config.etag_retry_wait = 1

        self.client = REST(self.mock_config)

    @patch("requests.Session.request")
    def test_get_with_etag_success(self, mock_request):
        """Test successful GET with ETag header."""
        # Mock response with ETag
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"ETag": '"test-etag-123"'}
        mock_response.json.return_value = {"id": "test-id", "name": "test-entity"}
        mock_response.text = '{"id": "test-id", "name": "test-entity"}'
        mock_response.raise_for_status.return_value = None
        mock_request.return_value = mock_response

        result = self.client.get_with_etag("/api/v1/tables/test-id")

        self.assertIsNotNone(result)
        self.assertEqual(result["data"]["id"], "test-id")
        self.assertEqual(result["etag"], '"test-etag-123"')

    @patch("requests.Session.request")
    def test_patch_with_etag_success(self, mock_request):
        """Test successful PATCH with If-Match header."""
        # Mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"ETag": '"new-etag-456"'}
        mock_response.json.return_value = {"id": "test-id", "name": "updated-entity"}
        mock_response.text = '{"id": "test-id", "name": "updated-entity"}'
        mock_response.raise_for_status.return_value = None
        mock_request.return_value = mock_response

        patch_data = (
            '[{"op": "replace", "path": "/description", "value": "new description"}]'
        )
        result = self.client.patch_with_etag(
            "/api/v1/tables/test-id", data=patch_data, etag='"test-etag-123"'
        )

        self.assertIsNotNone(result)
        self.assertEqual(result["data"]["name"], "updated-entity")
        self.assertEqual(result["etag"], '"new-etag-456"')

        # Verify If-Match header was sent
        call_args = mock_request.call_args
        headers = call_args[1]["headers"]
        self.assertEqual(headers["If-Match"], '"test-etag-123"')

    @patch("requests.Session.request")
    def test_patch_with_etag_conflict(self, mock_request):
        """Test PATCH with ETag conflict (412 response)."""
        # Mock 412 response
        mock_response = Mock()
        mock_response.status_code = 412
        mock_response.text = "Precondition Failed"

        from requests.exceptions import HTTPError

        http_error = HTTPError(response=mock_response)
        mock_request.side_effect = http_error

        patch_data = (
            '[{"op": "replace", "path": "/description", "value": "new description"}]'
        )

        with self.assertRaises(ETagMismatchError) as context:
            self.client.patch_with_etag(
                "/api/v1/tables/test-id", data=patch_data, etag='"old-etag"'
            )

        self.assertEqual(context.exception.status_code, 412)

    @patch("requests.Session.request")
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

        patch_data = (
            '[{"op": "replace", "path": "/description", "value": "new description"}]'
        )
        result = self.client.patch_with_etag("/api/v1/tables/test-id", data=patch_data)

        self.assertIsNotNone(result)
        self.assertEqual(result["data"]["name"], "updated-entity")
        self.assertIsNone(result["etag"])

        # Verify no If-Match header was sent
        call_args = mock_request.call_args
        headers = call_args[1]["headers"]
        self.assertNotIn("If-Match", headers)

    @patch("time.sleep")
    @patch("requests.Session.request")
    def test_patch_with_etag_retry_success(self, mock_request, mock_sleep):
        """Test successful PATCH with ETag retry after conflict."""
        # First call returns 412, second call succeeds
        mock_response_conflict = Mock()
        mock_response_conflict.status_code = 412
        mock_response_conflict.text = "Precondition Failed"

        mock_response_success = Mock()
        mock_response_success.status_code = 200
        mock_response_success.headers = {"ETag": '"final-etag-789"'}
        mock_response_success.json.return_value = {
            "id": "test-id",
            "name": "finally-updated",
        }
        mock_response_success.text = '{"id": "test-id", "name": "finally-updated"}'
        mock_response_success.raise_for_status.return_value = None

        from requests.exceptions import HTTPError

        http_error = HTTPError(response=mock_response_conflict)

        # First call raises HTTPError (412), second call succeeds
        mock_request.side_effect = [http_error, mock_response_success]

        def mock_callback():
            """Mock callback that returns updated patch data and ETag"""
            return (
                '[{"op": "replace", "path": "/description", "value": "refreshed description"}]',
                '"refreshed-etag-456"',
            )

        patch_data = (
            '[{"op": "replace", "path": "/description", "value": "new description"}]'
        )
        result = self.client.patch_with_etag_retry(
            "/api/v1/tables/test-id",
            data=patch_data,
            etag='"old-etag-123"',
            get_latest_callback=mock_callback,
        )

        self.assertIsNotNone(result)
        self.assertEqual(result["data"]["name"], "finally-updated")
        self.assertEqual(result["etag"], '"final-etag-789"')

        # Verify sleep was called for retry wait
        mock_sleep.assert_called_once_with(1)

        # Verify two requests were made
        self.assertEqual(mock_request.call_count, 2)

    @patch("time.sleep")
    @patch("requests.Session.request")
    def test_patch_with_etag_retry_exhausted(self, mock_request, mock_sleep):
        """Test PATCH with ETag retry when retries are exhausted."""
        # All calls return 412
        mock_response_conflict = Mock()
        mock_response_conflict.status_code = 412
        mock_response_conflict.text = "Precondition Failed"

        from requests.exceptions import HTTPError

        http_error = HTTPError(response=mock_response_conflict)
        mock_request.side_effect = http_error

        def mock_callback():
            """Mock callback that returns updated patch data and ETag"""
            return (
                '[{"op": "replace", "path": "/description", "value": "refreshed description"}]',
                '"refreshed-etag-456"',
            )

        patch_data = (
            '[{"op": "replace", "path": "/description", "value": "new description"}]'
        )

        with self.assertRaises(ETagMismatchError):
            self.client.patch_with_etag_retry(
                "/api/v1/tables/test-id",
                data=patch_data,
                etag='"old-etag-123"',
                get_latest_callback=mock_callback,
            )

        # Verify sleep was called for retries (3 retries = 3 sleeps)
        self.assertEqual(mock_sleep.call_count, 3)

        # Verify 4 requests were made (initial + 3 retries)
        self.assertEqual(mock_request.call_count, 4)

    @patch("requests.Session.request")
    def test_patch_with_etag_retry_no_callback(self, mock_request):
        """Test PATCH with ETag retry when no callback is provided."""
        # Mock 412 response
        mock_response_conflict = Mock()
        mock_response_conflict.status_code = 412
        mock_response_conflict.text = "Precondition Failed"

        from requests.exceptions import HTTPError

        http_error = HTTPError(response=mock_response_conflict)
        mock_request.side_effect = http_error

        patch_data = (
            '[{"op": "replace", "path": "/description", "value": "new description"}]'
        )

        with self.assertRaises(ETagMismatchError):
            self.client.patch_with_etag_retry(
                "/api/v1/tables/test-id",
                data=patch_data,
                etag='"old-etag-123"',
                get_latest_callback=None,
            )

        # Verify only one request was made (no retries without callback)
        self.assertEqual(mock_request.call_count, 1)

    @patch("time.sleep")
    @patch("requests.Session.request")
    def test_patch_with_etag_retry_callback_error(self, mock_request, mock_sleep):
        """Test PATCH with ETag retry when callback raises an error."""
        # First call returns 412
        mock_response_conflict = Mock()
        mock_response_conflict.status_code = 412
        mock_response_conflict.text = "Precondition Failed"

        from requests.exceptions import HTTPError

        http_error = HTTPError(response=mock_response_conflict)
        mock_request.side_effect = http_error

        def failing_callback():
            """Mock callback that raises an error"""
            raise Exception("Callback failed")

        patch_data = (
            '[{"op": "replace", "path": "/description", "value": "new description"}]'
        )

        with self.assertRaises(ETagMismatchError):
            self.client.patch_with_etag_retry(
                "/api/v1/tables/test-id",
                data=patch_data,
                etag='"old-etag-123"',
                get_latest_callback=failing_callback,
            )

        # Verify sleep was called once before callback failed
        mock_sleep.assert_called_once_with(1)

        # Verify only one request was made (failed during first retry)
        self.assertEqual(mock_request.call_count, 1)


if __name__ == "__main__":
    unittest.main()
