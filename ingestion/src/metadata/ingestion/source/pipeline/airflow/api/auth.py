#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Auth helper functions for the Airflow REST API client.
"""
import base64
import traceback
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional, Tuple

import requests

from metadata.utils.credentials import (
    get_gcp_impersonate_credentials,
    set_google_credentials,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

TokenCallback = Callable[[], Tuple[str, object]]

_JWT_REFRESH_INTERVAL_SECONDS = (
    25 * 60
)  # re-fetch every 25 min, well within Airflow's ~30-60 min TTL
_BASIC_AUTH_TTL_SECONDS = (
    7 * 24 * 3600
)  # basic auth doesn't expire; skip retry for 7 days


def try_exchange_jwt(
    host: str, username: str, password: str, verify: bool
) -> Optional[str]:
    """POST {host}/auth/token to get a JWT Bearer token (Airflow 3.x). Returns None on failure."""
    try:
        resp = requests.post(
            f"{host}/auth/token",
            json={"username": username, "password": password},
            timeout=10,
            verify=verify,
        )
        resp.raise_for_status()
        return resp.json().get("access_token")
    except Exception:
        logger.debug(
            "JWT token exchange failed (likely Airflow 2.x): %s", traceback.format_exc()
        )
        return None


def build_access_token_callback(token: str) -> TokenCallback:
    """Returns a static token callback with no expiry."""
    return lambda: (token, 0)


def build_basic_auth_callback(
    host: str, username: str, password: str, verify: bool
) -> Tuple[TokenCallback, None]:
    """
    Returns (callback, None). auth_token_mode=None means client.py uses the
    token value as-is; the callback embeds 'Bearer' or 'Basic' prefix itself.

    On every refresh cycle the callback re-calls try_exchange_jwt so the JWT
    is always freshly issued — no stale-token 401s for long-running ingestions.
    Falls back to Basic auth for Airflow 2.x servers.
    """

    def _callback() -> Tuple[str, object]:
        jwt = try_exchange_jwt(host, username, password, verify)
        if jwt:
            return f"Bearer {jwt}", _JWT_REFRESH_INTERVAL_SECONDS
        b64 = base64.b64encode(f"{username}:{password}".encode()).decode()
        return f"Basic {b64}", _BASIC_AUTH_TTL_SECONDS

    return _callback, None


def build_gcp_token_callback(gcp_credentials) -> TokenCallback:
    """
    Returns a token callback that fetches and auto-refreshes GCP OAuth2 tokens.

    Supports all 4 GCP credential types via set_google_credentials():
    - GcpCredentialsValues: service account JSON values (clientEmail, privateKey, etc.)
    - GcpCredentialsPath: path to a credentials JSON file
    - GcpExternalAccount: workload identity federation
    - GcpADC: application default credentials

    Also handles optional service account impersonation via gcpImpersonateServiceAccount.
    """
    set_google_credentials(gcp_credentials)
    impersonate = gcp_credentials.gcpImpersonateServiceAccount

    def _callback() -> Tuple[str, datetime]:
        import google.auth
        from google.auth.transport.requests import Request as AuthRequest

        if impersonate and impersonate.impersonateServiceAccount:
            credentials = get_gcp_impersonate_credentials(
                impersonate_service_account=impersonate.impersonateServiceAccount,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
                lifetime=impersonate.lifetime,
            )
        else:
            credentials, _ = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )

        credentials.refresh(AuthRequest())
        expiry = getattr(credentials, "expiry", None) or (
            datetime.now(timezone.utc) + timedelta(minutes=55)
        )
        return (credentials.token, expiry)

    return _callback
