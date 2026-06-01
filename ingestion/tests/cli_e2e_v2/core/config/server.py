#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Shared OpenMetadata server configuration for ingestion tests.

- `ServerConfig.from_env()` resolves server URL and JWT for the session.
- Rendered YAML emits `${OM_*}` refs; secrets never appear in tmp_path artifacts.
- If `OM_JWT_TOKEN` is unset, a long-lived bot token is minted from the live server.
"""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from typing import Any, Literal

import requests

from ..runner.errors import E2ESetupError
from .env import Env

TokenSource = Literal["env", "minted"]

_DEFAULT_OM_SERVER_URL = "http://localhost:8585/api"
_DEFAULT_ADMIN_EMAIL = "admin@open-metadata.org"
_DEFAULT_ADMIN_PASSWORD = "admin"
_INGESTION_BOT_NAME = "ingestion-bot"
_HTTP_TIMEOUT_SECONDS = 10


class TokenMintError(E2ESetupError):
    """Raised when the bot-token mint flow fails (login, lookup, or fetch)."""


def _mint_ingestion_bot_token(server_url: str, admin_email: str, admin_password: str) -> str:
    """Return a permanent ingestion-bot JWT minted from the live OM server.

    Raises `TokenMintError` on any HTTP, key-lookup, or parse failure.
    Admin password is base64-encoded as required by the OM login endpoint.
    """
    encoded_password = base64.b64encode(admin_password.encode()).decode()
    try:
        login = requests.post(
            f"{server_url}/v1/users/login",
            json={"email": admin_email, "password": encoded_password},
            timeout=_HTTP_TIMEOUT_SECONDS,
        )
        login.raise_for_status()
        admin_token = login.json()["accessToken"]

        headers = {"Authorization": f"Bearer {admin_token}"}
        bot = requests.get(
            f"{server_url}/v1/bots/name/{_INGESTION_BOT_NAME}",
            headers=headers,
            timeout=_HTTP_TIMEOUT_SECONDS,
        )
        bot.raise_for_status()
        bot_user_id = bot.json()["botUser"]["id"]

        auth = requests.get(
            f"{server_url}/v1/users/auth-mechanism/{bot_user_id}",
            headers=headers,
            timeout=_HTTP_TIMEOUT_SECONDS,
        )
        auth.raise_for_status()
        return auth.json()["config"]["JWTToken"]
    except (requests.RequestException, KeyError, ValueError) as exc:
        raise TokenMintError(
            f"failed to mint ingestion-bot token from {server_url}: {exc}. "
            f"Set OM_JWT_TOKEN to bypass minting, or set OM_ADMIN_EMAIL / "
            f"OM_ADMIN_PASSWORD if the OM instance uses non-default admin creds."
        ) from exc


@dataclass(frozen=True)
class ServerConfig:
    """Shared sinkConfig + workflowConfig applied to every test.

    `token_source` is "env" when `OM_JWT_TOKEN` was already exported,
    "minted" when `from_env()` had to mint via the bot-token flow.
    """

    server_url: str
    jwt_token: str
    token_source: TokenSource

    @classmethod
    def from_env(cls) -> ServerConfig:
        """Resolve server URL and JWT; pure — does not write to `os.environ`.

        Uses `OM_JWT_TOKEN` if set; otherwise mints via the bot-token flow
        with `OM_ADMIN_EMAIL` / `OM_ADMIN_PASSWORD`. The fixture layer is
        responsible for installing the token into the environment.
        """
        server_url = Env("OM_SERVER_URL", default=_DEFAULT_OM_SERVER_URL).get()

        existing = os.environ.get("OM_JWT_TOKEN")
        if existing:
            return cls(
                server_url=server_url,
                jwt_token=existing,
                token_source="env",
            )

        minted = _mint_ingestion_bot_token(
            server_url=server_url,
            admin_email=Env("OM_ADMIN_EMAIL", default=_DEFAULT_ADMIN_EMAIL).get(),
            admin_password=Env("OM_ADMIN_PASSWORD", default=_DEFAULT_ADMIN_PASSWORD).get(),
        )
        return cls(
            server_url=server_url,
            jwt_token=minted,
            token_source="minted",
        )

    def to_workflow_config_dict(self) -> dict[str, Any]:
        """Return the workflowConfig block with `${OM_*}` refs (no raw JWT on disk)."""
        return {
            "openMetadataServerConfig": {
                "hostPort": Env("OM_SERVER_URL").ref(),
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": Env("OM_JWT_TOKEN").ref()},
            }
        }

    def to_sink_config_dict(self) -> dict[str, Any]:
        """Return the sink block with `bulk_sink_batch_size: 1`.

        Batch size 1 forces per-entity flushes so FK post-process lookups
        never miss entities still buffered when `yield_table_constraints` runs.
        """
        return {"type": "metadata-rest", "config": {"bulk_sink_batch_size": 1}}
