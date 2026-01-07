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
Test the OpenMetadata client retry mechanism for HTTP 503 responses
"""

from unittest import TestCase
from unittest.mock import Mock, patch

from requests.exceptions import HTTPError

from metadata.ingestion.ometa.client import REST, ClientConfig


class TestClientRetry(TestCase):
    """Test the OpenMetadata REST client retry mechanism"""

    def setUp(self):
        """Set up test fixtures"""
        self.config = ClientConfig(
            base_url="http://localhost:8585/api",
            retry=3,
            retry_wait=1,
            retry_codes=[503, 504],  # Include 503 for testing
        )
        self.client = REST(self.config)

    @patch("metadata.ingestion.ometa.client.requests.Session.request")
    def test_retry_on_503_http_error(self, mock_request):
        """Test that the client retries on HTTP 503 responses"""
        # Create a mock response with 503 status
        mock_response = Mock()
        mock_response.status_code = 503
        mock_response.text = "Service Unavailable"

        # Create HTTPError with the mock response
        http_error = HTTPError()
        http_error.response = mock_response
        mock_response.raise_for_status.side_effect = http_error

        # Mock the request to always return the 503 response
        mock_request.return_value = mock_response

        with patch("time.sleep") as mock_sleep:
            # The client should retry and eventually raise HTTPError after exhausting retries
            with self.assertRaises(HTTPError):
                self.client.get("/test")

            # Should have been called 4 times (initial + 3 retries)
            self.assertEqual(mock_request.call_count, 4)

            # Should have slept 3 times with increasing wait times
            # First retry: 1 * (3 - 3 + 1) = 1
            # Second retry: 1 * (3 - 2 + 1) = 2
            # Third retry: 1 * (3 - 1 + 1) = 3
            expected_calls = [1, 2, 3]
            actual_calls = [call[0][0] for call in mock_sleep.call_args_list]
            self.assertEqual(actual_calls, expected_calls)

    @patch("metadata.ingestion.ometa.client.requests.Session.request")
    def test_retry_on_503_then_success(self, mock_request):
        """Test that the client retries on 503 and succeeds on subsequent attempt"""
        # Create mock responses: first 503, then success
        error_response = Mock()
        error_response.status_code = 503
        error_response.text = "Service Unavailable"

        # Create HTTPError with the mock response
        http_error = HTTPError()
        http_error.response = error_response
        error_response.raise_for_status.side_effect = http_error

        success_response = Mock()
        success_response.status_code = 200
        success_response.text = '{"success": true}'
        success_response.json.return_value = {"success": True}
        success_response.raise_for_status.return_value = None

        # First call fails with 503, second call succeeds
        mock_request.side_effect = [error_response, success_response]

        result = self.client.get("/test")

        # Should return the successful response
        self.assertEqual(result, {"success": True})

        # Should have been called twice (initial failure + retry success)
        self.assertEqual(mock_request.call_count, 2)

    @patch("metadata.ingestion.ometa.client.requests.Session.request")
    def test_no_retry_on_500_when_not_configured(self, mock_request):
        """Test that the client does not retry on HTTP 500 when not in retry_codes"""
        # Create a mock response with 500 status (not in retry_codes)
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        # Create HTTPError with the mock response
        http_error = HTTPError()
        http_error.response = mock_response
        mock_response.raise_for_status.side_effect = http_error

        mock_request.return_value = mock_response

        # Should raise HTTPError without retrying
        with self.assertRaises(HTTPError):
            self.client.get("/test")

        # Should have been called only once (no retries)
        self.assertEqual(mock_request.call_count, 1)
