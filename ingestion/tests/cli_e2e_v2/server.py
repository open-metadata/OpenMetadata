#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Shared OpenMetadata server configuration for ingestion tests.

- `ServerConfig.from_env()` resolves server URL and JWT for the session.
- Rendered workflow config uses `${OM_*}` references instead of raw credentials.
- If `OM_JWT_TOKEN` is unset, a long-lived bot token is minted from the live server.
"""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass, field
from typing import Any, Generic, Literal, TypeVar, overload

import requests

from .runtime.ci import mask_secrets


class EnvLoadError(RuntimeError):
    """A required environment variable is absent or empty."""


_Req = TypeVar("_Req", Literal[True], Literal[False])


class Env(Generic[_Req]):
    def __init__(self, key: str, default: str | None = None, *, required: bool = True):
        self.key = key
        if default is not None:
            os.environ.setdefault(key, default)
        if required and not os.environ.get(key):
            raise EnvLoadError(f"required env var {key} not set")

    def ref(self) -> str:
        return f"${{{self.key}}}"

    @overload
    def get(self: Env[Literal[True]]) -> str: ...

    @overload
    def get(self: Env[Literal[False]]) -> str | None: ...

    def get(self) -> str | None:
        return os.environ.get(self.key)


TokenSource = Literal["env", "minted"]

_DEFAULT_OM_SERVER_URL = "http://localhost:8585/api"
_DEFAULT_ADMIN_EMAIL = "admin@open-metadata.org"
_DEFAULT_ADMIN_PASSWORD = "admin"
_INGESTION_BOT_NAME = "ingestion-bot"
_HTTP_TIMEOUT_SECONDS = 10


class TokenMintError(RuntimeError):
    """Raised when the bot-token mint flow fails (login, lookup, or fetch)."""


def _mint_ingestion_bot_token(server_url: str, admin_email: str, admin_password: str) -> str:
    """Return a permanent ingestion-bot JWT minted from the live OM server.

    Raises `TokenMintError` on any HTTP, key-lookup, or parse failure.
    Admin password is base64-encoded as required by the OM login endpoint.
    """
    encoded_password = base64.b64encode(admin_password.encode()).decode()
    mask_secrets(admin_password, encoded_password)
    try:
        login = requests.post(
            f"{server_url}/v1/users/login",
            json={"email": admin_email, "password": encoded_password},
            timeout=_HTTP_TIMEOUT_SECONDS,
        )
        login.raise_for_status()
        admin_token = login.json()["accessToken"]
        mask_secrets(admin_token)

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
        bot_token = auth.json()["config"]["JWTToken"]
        mask_secrets(bot_token)
    except (requests.RequestException, KeyError, ValueError) as exc:
        raise TokenMintError(
            f"failed to mint ingestion-bot token from {server_url}: {exc}. "
            f"Set OM_JWT_TOKEN to bypass minting, or set OM_ADMIN_EMAIL / "
            f"OM_ADMIN_PASSWORD if the OM instance uses non-default admin creds."
        ) from exc
    return bot_token


@dataclass(frozen=True)
class ServerConfig:
    """Shared sinkConfig + workflowConfig applied to every test.

    `token_source` is "env" when `OM_JWT_TOKEN` was already exported,
    "minted" when `from_env()` had to mint via the bot-token flow.
    """

    server_url: str
    jwt_token: str = field(repr=False)
    token_source: TokenSource

    @classmethod
    def from_env(cls) -> ServerConfig:
        """Resolve server credentials and register CI masks before further bootstrap work."""
        server_url = Env("OM_SERVER_URL", default=_DEFAULT_OM_SERVER_URL).get()

        existing = os.environ.get("OM_JWT_TOKEN")
        if existing:
            mask_secrets(existing)
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
