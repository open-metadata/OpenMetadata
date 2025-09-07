"""
OpenMetadata SDK Client - Main client class
"""
from typing import ClassVar, Optional

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk.config import OpenMetadataConfig


class OpenMetadata:
    """Main SDK client for OpenMetadata"""

    _instance: ClassVar[Optional["OpenMetadata"]] = None
    _default_client: ClassVar[Optional[OMeta]] = None

    def __init__(self, config: OpenMetadataConfig):
        """Initialize OpenMetadata client"""
        self.config = config
        
        # Convert boolean verify_ssl to enum
        if not config.verify_ssl:
            verify_ssl = VerifySSL.no_ssl
        elif config.ca_bundle:
            verify_ssl = VerifySSL.validate
        else:
            verify_ssl = VerifySSL.ignore
        
        # Create OpenMetadataConnection from config
        om_connection = OpenMetadataConnection(
            hostPort=config.server_url,
            authProvider="openmetadata",
            securityConfig=config.to_ometa_config(),
            verifySSL=verify_ssl,
            sslConfig={"caCertificate": config.ca_bundle} if config.ca_bundle else None,
        )
        
        self._ometa = OMeta(config=om_connection)

    @classmethod
    def initialize(cls, config: OpenMetadataConfig) -> "OpenMetadata":
        """Initialize the default client instance"""
        cls._instance = cls(config)
        cls._default_client = cls._instance._ometa
        return cls._instance

    @classmethod
    def get_instance(cls) -> "OpenMetadata":
        """Get the default client instance"""
        if cls._instance is None:
            raise RuntimeError("OpenMetadata client not initialized. Call initialize() first")
        return cls._instance

    @classmethod
    def get_default_client(cls) -> OMeta:
        """Get the default OMeta client for internal use"""
        if cls._default_client is None:
            raise RuntimeError("OpenMetadata client not initialized. Call initialize() first")
        return cls._default_client

    @property
    def ometa(self) -> OMeta:
        """Get the underlying OMeta client"""
        return self._ometa

    def close(self):
        """Close the client connection"""
        if hasattr(self._ometa, "close"):
            self._ometa.close()