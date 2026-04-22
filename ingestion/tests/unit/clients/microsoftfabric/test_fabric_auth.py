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
Test Microsoft Fabric Authentication
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch


class FabricAuthenticatorTest(TestCase):
    """
    Unit tests for Microsoft Fabric MSAL authentication
    """

    @patch("msal.ConfidentialClientApplication")
    def test_get_token_success(self, mock_msal_app):
        """Test successful token acquisition"""
        from metadata.clients.microsoftfabric.fabric_auth import FabricAuthenticator

        # Mock MSAL response
        mock_app_instance = MagicMock()
        mock_app_instance.acquire_token_for_client.return_value = {
            "access_token": "test-access-token-12345",
            "expires_in": 3600,
            "token_type": "Bearer",
        }
        mock_app_instance.acquire_token_silent.return_value = None
        mock_msal_app.return_value = mock_app_instance

        auth = FabricAuthenticator(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        scopes = ["https://api.fabric.microsoft.com/.default"]
        token, expires_in = auth.get_token(scopes)

        self.assertEqual(token, "test-access-token-12345")
        self.assertEqual(expires_in, 3600)

    @patch("msal.ConfidentialClientApplication")
    def test_get_token_from_cache(self, mock_msal_app):
        """Test that tokens are fetched from cache when available"""
        from metadata.clients.microsoftfabric.fabric_auth import FabricAuthenticator

        mock_app_instance = MagicMock()
        mock_app_instance.acquire_token_silent.return_value = {
            "access_token": "cached-token",
            "expires_in": 3600,
            "token_type": "Bearer",
        }
        mock_msal_app.return_value = mock_app_instance

        auth = FabricAuthenticator(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        scopes = ["https://api.fabric.microsoft.com/.default"]
        token, _ = auth.get_token(scopes)

        self.assertEqual(token, "cached-token")
        # Should not call acquire_token_for_client if cache hit
        mock_app_instance.acquire_token_for_client.assert_not_called()

    @patch("msal.ConfidentialClientApplication")
    def test_authentication_failure(self, mock_msal_app):
        """Test handling of authentication failure"""
        from metadata.clients.microsoftfabric.fabric_auth import FabricAuthenticator

        mock_app_instance = MagicMock()
        mock_app_instance.acquire_token_silent.return_value = None
        mock_app_instance.acquire_token_for_client.return_value = {
            "error": "invalid_client",
            "error_description": "Invalid client credentials",
        }
        mock_msal_app.return_value = mock_app_instance

        auth = FabricAuthenticator(
            tenant_id="test-tenant",
            client_id="invalid-client",
            client_secret="invalid-secret",
        )

        scopes = ["https://api.fabric.microsoft.com/.default"]
        with self.assertRaises(ValueError) as context:
            auth.get_token(scopes)

        self.assertIn("Invalid client credentials", str(context.exception))

    @patch("msal.ConfidentialClientApplication")
    def test_custom_authority_uri(self, mock_msal_app):
        """Test using custom authority URI"""
        from metadata.clients.microsoftfabric.fabric_auth import FabricAuthenticator

        mock_app_instance = MagicMock()
        mock_app_instance.acquire_token_silent.return_value = None
        mock_app_instance.acquire_token_for_client.return_value = {
            "access_token": "token",
            "expires_in": 3600,
            "token_type": "Bearer",
        }
        mock_msal_app.return_value = mock_app_instance

        custom_authority = "https://login.microsoftonline.us/"
        auth = FabricAuthenticator(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
            authority_uri=custom_authority,
        )

        # Trigger msal_client property to initialize
        _ = auth.msal_client

        # Verify MSAL was initialized with custom authority
        mock_msal_app.assert_called_once()
        call_kwargs = mock_msal_app.call_args
        self.assertIn("authority", call_kwargs.kwargs)
        self.assertTrue(call_kwargs.kwargs["authority"].startswith(custom_authority))

    def test_fabric_api_scope(self):
        """Test that correct Fabric API scope is defined"""
        from metadata.clients.microsoftfabric.fabric_auth import FABRIC_API_SCOPE

        # Verify the scope is for Microsoft Fabric API
        self.assertEqual(
            FABRIC_API_SCOPE, ["https://api.fabric.microsoft.com/.default"]
        )

    def test_power_bi_scope(self):
        """Test that Power BI scope is defined"""
        from metadata.clients.microsoftfabric.fabric_auth import POWER_BI_SCOPE

        self.assertEqual(
            POWER_BI_SCOPE, ["https://analysis.windows.net/powerbi/api/.default"]
        )

    def test_database_scope(self):
        """Test that database scope is defined"""
        from metadata.clients.microsoftfabric.fabric_auth import DATABASE_SCOPE

        self.assertEqual(DATABASE_SCOPE, ["https://database.windows.net/.default"])

    @patch("msal.ConfidentialClientApplication")
    def test_get_fabric_api_token(self, mock_msal_app):
        """Test get_fabric_api_token helper method"""
        from metadata.clients.microsoftfabric.fabric_auth import FabricAuthenticator

        mock_app_instance = MagicMock()
        mock_app_instance.acquire_token_silent.return_value = None
        mock_app_instance.acquire_token_for_client.return_value = {
            "access_token": "fabric-api-token",
            "expires_in": 3600,
        }
        mock_msal_app.return_value = mock_app_instance

        auth = FabricAuthenticator(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        token, expires_in = auth.get_fabric_api_token()

        self.assertEqual(token, "fabric-api-token")
        self.assertEqual(expires_in, 3600)

    @patch("msal.ConfidentialClientApplication")
    def test_get_power_bi_token(self, mock_msal_app):
        """Test get_power_bi_token helper method"""
        from metadata.clients.microsoftfabric.fabric_auth import FabricAuthenticator

        mock_app_instance = MagicMock()
        mock_app_instance.acquire_token_silent.return_value = None
        mock_app_instance.acquire_token_for_client.return_value = {
            "access_token": "powerbi-token",
            "expires_in": 3600,
        }
        mock_msal_app.return_value = mock_app_instance

        auth = FabricAuthenticator(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        token, expires_in = auth.get_power_bi_token()

        self.assertEqual(token, "powerbi-token")
        self.assertEqual(expires_in, 3600)

    @patch("msal.ConfidentialClientApplication")
    def test_get_token_callback(self, mock_msal_app):
        """Test get_token_callback returns a callable"""
        from metadata.clients.microsoftfabric.fabric_auth import FabricAuthenticator

        mock_app_instance = MagicMock()
        mock_app_instance.acquire_token_silent.return_value = None
        mock_app_instance.acquire_token_for_client.return_value = {
            "access_token": "callback-token",
            "expires_in": 3600,
        }
        mock_msal_app.return_value = mock_app_instance

        auth = FabricAuthenticator(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        scopes = ["https://api.fabric.microsoft.com/.default"]
        callback = auth.get_token_callback(scopes)

        # Callback should be callable
        self.assertTrue(callable(callback))

        # Calling it should return token
        token, expires_in = callback()
        self.assertEqual(token, "callback-token")


class FabricAuthenticatorRetryTest(TestCase):
    """
    Unit tests for authentication retry logic
    """

    @patch("metadata.clients.microsoftfabric.fabric_auth.sleep", return_value=None)
    @patch("msal.ConfidentialClientApplication")
    def test_retry_on_cache_failure(self, mock_msal_app, mock_sleep):
        """Test retry logic when cache fetch fails"""
        from metadata.clients.microsoftfabric.fabric_auth import FabricAuthenticator

        mock_app_instance = MagicMock()
        # Cache fails first time, then succeeds
        mock_app_instance.acquire_token_silent.side_effect = [
            Exception("Cache error"),
            None,
        ]
        mock_app_instance.acquire_token_for_client.return_value = {
            "access_token": "retry-token",
            "expires_in": 3600,
        }
        mock_msal_app.return_value = mock_app_instance

        auth = FabricAuthenticator(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        scopes = ["https://api.fabric.microsoft.com/.default"]
        token, _ = auth.get_token(scopes)

        self.assertEqual(token, "retry-token")

    @patch("metadata.clients.microsoftfabric.fabric_auth.sleep", return_value=None)
    @patch("msal.ConfidentialClientApplication")
    def test_retry_on_token_generation_failure(self, mock_msal_app, mock_sleep):
        """Test retry logic when token generation fails transiently"""
        from metadata.clients.microsoftfabric.fabric_auth import FabricAuthenticator

        mock_app_instance = MagicMock()
        mock_app_instance.acquire_token_silent.return_value = None
        # First calls fail, then succeed
        mock_app_instance.acquire_token_for_client.side_effect = [
            Exception("Network error"),
            Exception("Network error"),
            {
                "access_token": "success-token",
                "expires_in": 3600,
            },
        ]
        mock_msal_app.return_value = mock_app_instance

        auth = FabricAuthenticator(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
        )

        scopes = ["https://api.fabric.microsoft.com/.default"]
        token, _ = auth.get_token(scopes)

        self.assertEqual(token, "success-token")
        # Should have retried
        self.assertEqual(mock_app_instance.acquire_token_for_client.call_count, 3)
