#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Shared OpenMetadata server configuration for ingestion tests.

One ServerConfig per pytest session: sink destination + server URL + JWT.
Every rendered workflow YAML shares this config; only the source block varies
per connector.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .env import Env

# Default dev JWT for the local Docker stack. Matches the token baked into
# docker-compose.yml so local runs work without env var plumbing. Tests
# against other environments set OM_JWT_TOKEN explicitly.
_DEFAULT_DEV_JWT = (
    "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9."
    "eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbi1tZXRhZGF0YS5vcmcifQ."
    "tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
)


@dataclass(frozen=True)
class ServerConfig:
    """Shared sinkConfig + workflowConfig.openMetadataServerConfig applied to every test."""

    server_url: str
    jwt_token: str

    @classmethod
    def from_env(cls) -> "ServerConfig":
        return cls(
            server_url=Env.optional("OM_SERVER_URL", default="http://localhost:8585/api"),
            jwt_token=Env.optional("OM_JWT_TOKEN", default=_DEFAULT_DEV_JWT),
        )

    def to_workflow_config_dict(self) -> dict[str, Any]:
        """Builds the workflowConfig block for a rendered config YAML."""
        return {
            "openMetadataServerConfig": {
                "hostPort": self.server_url,
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": self.jwt_token},
            }
        }

    def to_sink_config_dict(self) -> dict[str, Any]:
        """Builds the sink block for a rendered config YAML."""
        return {"type": "metadata-rest", "config": {}}
