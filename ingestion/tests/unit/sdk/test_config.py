"""
Unit tests for SDK configuration functionality
"""
import os
import unittest
from unittest.mock import patch

from metadata.sdk import configure, reset
from metadata.sdk.config import OpenMetadataConfig


class TestOpenMetadataConfig(unittest.TestCase):
    """Test OpenMetadataConfig class"""

    def test_config_creation(self):
        """Test basic config creation"""
        config = OpenMetadataConfig(
            server_url="http://localhost:8585/api", jwt_token="test-token"
        )
        self.assertEqual(config.server_url, "http://localhost:8585/api")
        self.assertEqual(config.jwt_token, "test-token")
        self.assertFalse(config.verify_ssl)
        self.assertEqual(config.client_timeout, 30)

    def test_config_strips_trailing_slash(self):
        """Test that server URL strips trailing slash"""
        config = OpenMetadataConfig(
            server_url="http://localhost:8585/api/", jwt_token="test-token"
        )
        self.assertEqual(config.server_url, "http://localhost:8585/api")

    def test_config_api_key_alias(self):
        """Test that api_key works as alias for jwt_token"""
        config = OpenMetadataConfig(
            server_url="http://localhost:8585/api", api_key="test-key"
        )
        self.assertEqual(config.jwt_token, "test-key")
        self.assertEqual(config.api_key, "test-key")

    def test_config_from_env(self):
        """Test configuration from environment variables"""
        with patch.dict(
            os.environ,
            {
                "OPENMETADATA_HOST": "http://localhost:8585/api",
                "OPENMETADATA_JWT_TOKEN": "env-token",
            },
        ):
            config = OpenMetadataConfig.from_env()
            self.assertEqual(config.server_url, "http://localhost:8585/api")
            self.assertEqual(config.jwt_token, "env-token")

    def test_config_from_env_server_url_alias(self):
        """Test from_env with OPENMETADATA_SERVER_URL"""
        with patch.dict(
            os.environ,
            {
                "OPENMETADATA_SERVER_URL": "http://example.com/api",
                "OPENMETADATA_API_KEY": "api-key",
            },
        ):
            config = OpenMetadataConfig.from_env()
            self.assertEqual(config.server_url, "http://example.com/api")
            self.assertEqual(config.jwt_token, "api-key")

    def test_config_from_env_missing_host(self):
        """Test from_env raises error when host is missing"""
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError) as context:
                OpenMetadataConfig.from_env()
            self.assertIn("Server URL must be provided", str(context.exception))

    def test_config_from_env_ssl_settings(self):
        """Test from_env with SSL settings"""
        with patch.dict(
            os.environ,
            {
                "OPENMETADATA_HOST": "https://localhost:8585/api",
                "OPENMETADATA_JWT_TOKEN": "token",
                "OPENMETADATA_VERIFY_SSL": "true",
                "OPENMETADATA_CA_BUNDLE": "/path/to/ca.pem",
                "OPENMETADATA_CLIENT_TIMEOUT": "60",
            },
        ):
            config = OpenMetadataConfig.from_env()
            self.assertTrue(config.verify_ssl)
            self.assertEqual(config.ca_bundle, "/path/to/ca.pem")
            self.assertEqual(config.client_timeout, 60)

    def test_config_builder(self):
        """Test config builder pattern"""
        config = (
            OpenMetadataConfig.builder()
            .server_url("http://localhost:8585/api")
            .jwt_token("builder-token")
            .verify_ssl(True)
            .client_timeout(45)
            .build()
        )
        self.assertEqual(config.server_url, "http://localhost:8585/api")
        self.assertEqual(config.jwt_token, "builder-token")
        self.assertTrue(config.verify_ssl)
        self.assertEqual(config.client_timeout, 45)

    def test_config_builder_missing_url(self):
        """Test builder raises error when URL is missing"""
        with self.assertRaises(ValueError) as context:
            OpenMetadataConfig.builder().jwt_token("token").build()
        self.assertIn("Server URL is required", str(context.exception))


class TestConfigureFunction(unittest.TestCase):
    """Test SDK configure() function"""

    def setUp(self):
        """Reset SDK state before each test"""
        reset()

    def tearDown(self):
        """Clean up after each test"""
        reset()

    @patch("metadata.sdk.OpenMetadata.initialize")
    def test_configure_with_host_and_token(self, mock_initialize):
        """Test configure with explicit host and jwt_token"""
        configure(host="http://localhost:8585/api", jwt_token="test-token")
        mock_initialize.assert_called_once()
        config = mock_initialize.call_args[0][0]
        self.assertEqual(config.server_url, "http://localhost:8585/api")
        self.assertEqual(config.jwt_token, "test-token")

    @patch("metadata.sdk.OpenMetadata.initialize")
    def test_configure_with_server_url(self, mock_initialize):
        """Test configure with server_url parameter"""
        configure(server_url="http://example.com/api", jwt_token="token")
        config = mock_initialize.call_args[0][0]
        self.assertEqual(config.server_url, "http://example.com/api")

    @patch("metadata.sdk.OpenMetadata.initialize")
    def test_configure_host_fallback_to_env(self, mock_initialize):
        """Test configure falls back to env vars when host not provided"""
        with patch.dict(
            os.environ,
            {
                "OPENMETADATA_HOST": "http://env-host:8585/api",
                "OPENMETADATA_JWT_TOKEN": "env-token",
            },
        ):
            configure(jwt_token="explicit-token")
            config = mock_initialize.call_args[0][0]
            self.assertEqual(config.server_url, "http://env-host:8585/api")
            self.assertEqual(config.jwt_token, "explicit-token")

    @patch("metadata.sdk.OpenMetadata.initialize")
    def test_configure_token_fallback_to_env(self, mock_initialize):
        """Test configure falls back to env for jwt_token"""
        with patch.dict(os.environ, {"OPENMETADATA_JWT_TOKEN": "env-token"}):
            configure(host="http://localhost:8585/api")
            config = mock_initialize.call_args[0][0]
            self.assertEqual(config.jwt_token, "env-token")

    @patch("metadata.sdk.OpenMetadata.initialize")
    def test_configure_from_env_only(self, mock_initialize):
        """Test configure with no args loads from env"""
        with patch.dict(
            os.environ,
            {
                "OPENMETADATA_HOST": "http://env-only:8585/api",
                "OPENMETADATA_JWT_TOKEN": "env-only-token",
            },
        ):
            configure()
            config = mock_initialize.call_args[0][0]
            self.assertEqual(config.server_url, "http://env-only:8585/api")
            self.assertEqual(config.jwt_token, "env-only-token")

    def test_configure_missing_host_raises_error(self):
        """Test configure raises error when host cannot be resolved"""
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError) as context:
                configure(jwt_token="token")
            self.assertIn("Server URL must be provided", str(context.exception))

    @patch("metadata.sdk.OpenMetadata.initialize")
    def test_configure_with_config_object(self, mock_initialize):
        """Test configure with OpenMetadataConfig object"""
        config = OpenMetadataConfig(
            server_url="http://localhost:8585/api", jwt_token="config-token"
        )
        configure(config)
        mock_initialize.assert_called_once_with(config)

    def test_configure_rejects_mixed_config_and_kwargs(self):
        """Test configure raises error when both config and kwargs provided"""
        config = OpenMetadataConfig(
            server_url="http://localhost:8585/api", jwt_token="token"
        )
        with self.assertRaises(TypeError) as context:
            configure(config, host="http://other:8585/api")
        self.assertIn(
            "Pass either a config object or keyword arguments", str(context.exception)
        )


if __name__ == "__main__":
    unittest.main()
