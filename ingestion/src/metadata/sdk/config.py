"""
Configuration for OpenMetadata SDK
"""
from typing import Optional

from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)


class OpenMetadataConfig:
    """Configuration for OpenMetadata SDK"""

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
        self.verify_ssl = verify_ssl
        self.ca_bundle = ca_bundle
        self.client_timeout = client_timeout

    @classmethod
    def builder(cls):
        """Create a configuration builder"""
        return OpenMetadataConfigBuilder()

    def to_ometa_config(self):
        """Convert to OMeta client configuration"""
        config = OpenMetadataJWTClientConfig(
            jwtToken=self.jwt_token,
        )
        return config


class OpenMetadataConfigBuilder:
    """Builder for OpenMetadata configuration"""

    def __init__(self):
        self._server_url = None
        self._jwt_token = None
        self._api_key = None
        self._verify_ssl = False
        self._ca_bundle = None
        self._client_timeout = 30

    def server_url(self, url: str):
        """Set server URL"""
        self._server_url = url
        return self

    def jwt_token(self, token: str):
        """Set JWT token"""
        self._jwt_token = token
        return self

    def api_key(self, key: str):
        """Set API key (alias for jwt_token)"""
        self._api_key = key
        return self

    def verify_ssl(self, verify: bool):
        """Set SSL verification"""
        self._verify_ssl = verify
        return self

    def ca_bundle(self, bundle: str):
        """Set CA bundle path"""
        self._ca_bundle = bundle
        return self

    def client_timeout(self, timeout: int):
        """Set client timeout in seconds"""
        self._client_timeout = timeout
        return self

    def build(self) -> OpenMetadataConfig:
        """Build configuration"""
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
