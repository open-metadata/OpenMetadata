"""Configuration helpers for the OpenMetadata SDK."""
from __future__ import annotations

from typing import Optional

from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.security.ssl import (
    validateSSLClientConfig,
    verifySSLConfig,
)


class OpenMetadataConfig:
    """Configuration for OpenMetadata SDK."""

    server_url: str
    jwt_token: Optional[str]
    api_key: Optional[str]
    verify_ssl: bool
    ca_bundle: Optional[str]
    client_timeout: int

    def __init__(
        self,
        server_url: str,
        jwt_token: Optional[str] = None,
        api_key: Optional[str] = None,
        verify_ssl: bool = False,
        ca_bundle: Optional[str] = None,
        client_timeout: int = 30,
    ):
        self.server_url = server_url.rstrip("/")
        self.jwt_token = jwt_token or api_key
        self.api_key = api_key
        self.verify_ssl = verify_ssl
        self.ca_bundle = ca_bundle
        self.client_timeout = client_timeout

    @classmethod
    def builder(cls) -> "OpenMetadataConfigBuilder":
        """Create a configuration builder."""
        return OpenMetadataConfigBuilder()

    def to_ometa_config(self) -> OpenMetadataJWTClientConfig:
        """Translate the SDK config into the ingestion client's config model."""
        token = self.jwt_token or self.api_key
        if token is None:
            raise ValueError("JWT token or API key is required to authenticate")

        return OpenMetadataJWTClientConfig.model_validate({"jwtToken": token})

    def to_ssl_config(self) -> verifySSLConfig.SslConfig | None:
        """Build an optional SSL configuration block."""
        if not self.ca_bundle:
            return None
        ssl_payload = validateSSLClientConfig.ValidateSslClientConfig.model_validate(
            {
                "caCertificate": self.ca_bundle,
                "sslCertificate": None,
                "sslKey": None,
            }
        )
        return verifySSLConfig.SslConfig(ssl_payload)


class OpenMetadataConfigBuilder:
    """Builder for :class:`OpenMetadataConfig`."""

    def __init__(self) -> None:
        self._server_url: Optional[str] = None
        self._jwt_token: Optional[str] = None
        self._api_key: Optional[str] = None
        self._verify_ssl: bool = False
        self._ca_bundle: Optional[str] = None
        self._client_timeout: int = 30

    def server_url(self, url: str) -> "OpenMetadataConfigBuilder":
        """Set server URL."""
        self._server_url = url
        return self

    def jwt_token(self, token: str) -> "OpenMetadataConfigBuilder":
        """Set JWT token."""
        self._jwt_token = token
        return self

    def api_key(self, key: str) -> "OpenMetadataConfigBuilder":
        """Set API key (alias for ``jwt_token``)."""
        self._api_key = key
        return self

    def verify_ssl(self, verify: bool) -> "OpenMetadataConfigBuilder":
        """Configure SSL verification."""
        self._verify_ssl = verify
        return self

    def ca_bundle(self, bundle: str) -> "OpenMetadataConfigBuilder":
        """Set CA bundle path."""
        self._ca_bundle = bundle
        return self

    def client_timeout(self, timeout: int) -> "OpenMetadataConfigBuilder":
        """Set client timeout in seconds."""
        self._client_timeout = timeout
        return self

    def build(self) -> OpenMetadataConfig:
        """Build configuration."""
        if not self._server_url:
            raise ValueError("Server URL is required")

        return OpenMetadataConfig(
            server_url=self._server_url,
            jwt_token=self._jwt_token,
            api_key=self._api_key,
            verify_ssl=self._verify_ssl,
            ca_bundle=self._ca_bundle,
            client_timeout=self._client_timeout,
        )
