#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Shared OpenMetadata server configuration for ingestion tests.

Instance fields hold resolved values for the session HTTP client (which
authenticates directly, no YAML indirection). Rendered YAML emits ${OM_*}
references so cfg_*.yaml artifacts never embed raw JWTs — safe to share.

Local dev convenience: Env's `default` kwarg backfills OM_SERVER_URL and
OM_JWT_TOKEN with local-Docker defaults via os.environ.setdefault, so
rendered YAMLs expand cleanly without requiring the developer to export
anything.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .env import Env

# Default dev JWT for the local Docker stack. Matches the token baked into
# docker-compose.yml so local runs work without env var plumbing.
_DEFAULT_DEV_JWT = (
    "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9."
    "eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbi1tZXRhZGF0YS5vcmcifQ."
    "tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
)

_DEFAULT_OM_SERVER_URL = "http://localhost:8585/api"


@dataclass(frozen=True)
class ServerConfig:
    """Shared sinkConfig + workflowConfig.openMetadataServerConfig applied to every test."""

    server_url: str
    jwt_token: str

    @classmethod
    def from_env(cls) -> "ServerConfig":
        return cls(
            server_url=Env("OM_SERVER_URL", default=_DEFAULT_OM_SERVER_URL).get(),
            jwt_token=Env("OM_JWT_TOKEN", default=_DEFAULT_DEV_JWT).get(),
        )

    def to_workflow_config_dict(self) -> dict[str, Any]:
        """Builds the workflowConfig block for a rendered config YAML.

        Emits ${OM_*} refs. metadata CLI expands them at subprocess load time;
        the rendered YAML on disk never embeds the raw JWT.
        """
        return {
            "openMetadataServerConfig": {
                "hostPort": Env("OM_SERVER_URL").ref(),
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": Env("OM_JWT_TOKEN").ref()},
            }
        }

    def to_sink_config_dict(self) -> dict[str, Any]:
        """Builds the sink block for a rendered config YAML."""
        return {"type": "metadata-rest", "config": {}}
