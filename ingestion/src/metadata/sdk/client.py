"""OpenMetadata SDK Client - Main client class."""

from __future__ import annotations

from typing import ClassVar, cast

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
    OpenmetadataType,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk.config import OpenMetadataConfig  # noqa: TC001
from metadata.sdk.types import OMetaClient


def verify_ssl_mode(config: OpenMetadataConfig) -> VerifySSL:
    """Map the SDK's boolean ``verify_ssl`` onto the ingestion client's mode.

    ``no_ssl`` hands requests no ``verify`` override, so it checks the certificate
    against the system CAs; ``ignore`` is the only mode that skips the check, and
    so is reserved for an explicit ``verify_ssl=False``.
    """
    if not config.verify_ssl:
        return VerifySSL.ignore
    if config.ca_bundle:
        return VerifySSL.validate
    return VerifySSL.no_ssl


class OpenMetadata:
    """Main SDK client for OpenMetadata."""

    _instance: ClassVar["OpenMetadata" | None] = None  # noqa: UP037
    _default_client: ClassVar[OMetaClient | None] = None

    def __init__(self, config: OpenMetadataConfig):
        """Initialize OpenMetadata client."""
        self.config: OpenMetadataConfig = config

        verify_ssl = verify_ssl_mode(config)

        # Create OpenMetadataConnection from config
        ssl_config = config.to_ssl_config()

        om_connection = OpenMetadataConnection.model_construct(
            hostPort=config.server_url,
            authProvider=AuthProvider.openmetadata,
            securityConfig=config.to_ometa_config(),
            verifySSL=verify_ssl,
            sslConfig=ssl_config,
            type=OpenmetadataType.OpenMetadata,
            clusterName="openmetadata",
        )

        self._ometa: OMetaClient = cast(OMetaClient, OMeta(config=om_connection))  # noqa: TC006

    @classmethod
    def initialize(cls, config: OpenMetadataConfig) -> "OpenMetadata":  # noqa: UP037
        """Initialize the default client instance."""
        cls._instance = cls(config)
        cls._default_client = cls._instance.ometa
        return cls._instance

    @classmethod
    def get_instance(cls) -> "OpenMetadata":  # noqa: UP037
        """Get the default client instance."""
        if cls._instance is None:
            raise RuntimeError("OpenMetadata client not initialized. Call initialize() first")
        return cls._instance

    @classmethod
    def get_default_client(cls) -> OMetaClient:
        """Get the default OMeta client for internal use."""
        if cls._default_client is None:
            raise RuntimeError("OpenMetadata client not initialized. Call initialize() first")
        return cls._default_client

    @property
    def ometa(self) -> OMetaClient:
        """Get the underlying OMeta client."""
        return self._ometa

    def close(self):
        """Close the client connection."""
        if hasattr(self._ometa, "close"):
            self._ometa.close()

    @classmethod
    def reset(cls) -> None:
        """Clear the singleton instance and default client."""
        if cls._instance is not None:
            cls._instance.close()
        cls._instance = None
        cls._default_client = None
