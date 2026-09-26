"""Unit tests for OpenMetadata SDK client verify_ssl mapping."""

import unittest
from unittest.mock import MagicMock, patch

from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.sdk.client import OpenMetadata
from metadata.sdk.config import OpenMetadataConfig


def _config(**kwargs) -> OpenMetadataConfig:
    """Return a minimal config, merging any overrides."""
    return OpenMetadataConfig(
        server_url="https://example.com/api",
        jwt_token="tok",
        **kwargs,
    )


class TestOpenMetadataClientVerifySSL(unittest.TestCase):
    """Ensure verify_ssl boolean maps to the correct VerifySSL enum value."""

    def _make_client(self, config: OpenMetadataConfig) -> VerifySSL:
        """Instantiate the client and return the VerifySSL value passed to OMeta."""
        with patch("metadata.sdk.client.OMeta") as mock_ometa_cls:
            mock_ometa_cls.return_value = MagicMock()
            OpenMetadata(config)
            call_kwargs = mock_ometa_cls.call_args[1]
            return call_kwargs["config"].verifySSL

    def test_verify_ssl_false_maps_to_ignore(self):
        """verify_ssl=False → VerifySSL.ignore so requests.verify=False (cert checks off)."""
        result = self._make_client(_config(verify_ssl=False))
        self.assertEqual(result, VerifySSL.ignore)

    def test_verify_ssl_true_no_bundle_maps_to_no_ssl(self):
        """verify_ssl=True, no ca_bundle → VerifySSL.no_ssl so requests uses its default (system CAs)."""
        result = self._make_client(_config(verify_ssl=True))
        self.assertEqual(result, VerifySSL.no_ssl)

    def test_verify_ssl_true_with_bundle_maps_to_validate(self):
        """verify_ssl=True + ca_bundle → VerifySSL.validate so requests verifies against the bundle."""
        with patch("metadata.sdk.client.OMeta") as mock_ometa_cls:
            mock_ometa_cls.return_value = MagicMock()
            OpenMetadata(_config(verify_ssl=True, ca_bundle="/path/to/ca.pem"))
            call_kwargs = mock_ometa_cls.call_args[1]
            ssl_enum = call_kwargs["config"].verifySSL
        self.assertEqual(ssl_enum, VerifySSL.validate)

    def test_verify_ssl_false_does_not_map_to_no_ssl(self):
        """Regression: verify_ssl=False must not use no_ssl (which passes None → system-CA verify)."""
        result = self._make_client(_config(verify_ssl=False))
        self.assertNotEqual(result, VerifySSL.no_ssl)

    def test_verify_ssl_true_no_bundle_does_not_map_to_ignore(self):
        """Regression: verify_ssl=True must not use ignore (which passes False → cert checks off)."""
        result = self._make_client(_config(verify_ssl=True))
        self.assertNotEqual(result, VerifySSL.ignore)


if __name__ == "__main__":
    unittest.main()
