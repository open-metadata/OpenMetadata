#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Shared OpenMetadata server configuration for ingestion tests.

Instance fields hold resolved values for the session HTTP client (which
authenticates directly, no YAML indirection). Rendered YAML emits ${OM_*}
references so cfg_*.yaml artifacts never embed raw JWTs — safe to share.

Token resolution: if OM_JWT_TOKEN is exported, use it. Otherwise mint a
long-lived ingestion-bot token from the running server (admin login →
GET /bots/name/ingestion-bot → GET /users/auth-mechanism/{userId}). The
minted token is signed by THIS server's keystore, so it works against
any OM instance regardless of how it was bootstrapped — no shared dev
keypair assumption.
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
    """Mint a server-signed, long-lived ingestion-bot JWT.

    Three hops against the live OM server:
      1. POST /v1/users/login → short-lived admin access token.
      2. GET  /v1/bots/name/ingestion-bot → bot's linked user id.
      3. GET  /v1/users/auth-mechanism/{user_id} → bot's permanent JWT.

    The returned token is signed by THIS server's RSA keypair, so it
    validates regardless of which keystore the OM instance was
    bootstrapped with. Bot tokens have `JWTTokenExpiry: Unlimited` per
    OM's default bot bootstrap, so they survive long test sessions.

    Admin password is base64-encoded in the login payload to match OM's
    expectation (the server decodes before bcrypt-comparing).
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
    """Shared sinkConfig + workflowConfig.openMetadataServerConfig applied to every test.

    `token_source` records how `jwt_token` was obtained — "env" when
    OM_JWT_TOKEN was already exported at session start, "minted" when
    from_env() had to mint via the bot-token flow. Exposed for the
    session posture log so a developer can see at a glance which auth
    path was taken without having to instrument the fixture.
    """

    server_url: str
    jwt_token: str
    token_source: TokenSource

    @classmethod
    def from_env(cls) -> "ServerConfig":
        """Resolve server URL + JWT for the session — PURE: no side effects.

        OM_JWT_TOKEN, if exported, wins (escape hatch for hermetic CI or
        deliberately scoped tokens). Otherwise mint via the bot-token
        flow against OM_SERVER_URL using OM_ADMIN_EMAIL / OM_ADMIN_PASSWORD
        (defaults: admin@open-metadata.org / admin — the docker-compose
        bootstrap creds).

        This method DOES NOT write OM_JWT_TOKEN back into os.environ. The
        `om_server_config` fixture in the top-level conftest is the single
        named place that does that install step — keeping the factory
        pure and the ambient-env mutation explicit.
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
        """Builds the sink block for a rendered config YAML.

        `bulk_sink_batch_size: 1` forces the OM sink to flush each entity
        synchronously instead of buffering up to 100. Required for the FK
        post-process path: `yield_table_constraints` runs BEFORE the final
        sink flush, so deferred FK lookups (`metadata.get_by_name(...)` on
        the referred table) otherwise miss entities still sitting in the
        buffer. Production runs usually cross the buffer threshold and
        hide this; small E2E fixtures (<100 entities) don't.
        """
        return {"type": "metadata-rest", "config": {"bulk_sink_batch_size": 1}}
