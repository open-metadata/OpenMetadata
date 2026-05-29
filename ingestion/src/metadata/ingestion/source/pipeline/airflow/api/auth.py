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
import functools
import json
import os
import re
import traceback
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Optional, Tuple  # noqa: UP035

import requests

from metadata.utils.credentials import (
    get_gcp_impersonate_credentials,
    set_google_credentials,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

TokenCallback = Callable[[], Tuple[str, object]]  # noqa: UP006

_JWT_REFRESH_INTERVAL_SECONDS = 25 * 60  # re-fetch every 25 min, well within Airflow's ~30-60 min TTL
_BASIC_AUTH_TTL_SECONDS = 7 * 24 * 3600  # basic auth doesn't expire; skip retry for 7 days

# Composer Airflow web UI URLs end with this DNS suffix. Match the full suffix
# so an attacker-controlled lookalike like "composer.googleusercontent.com.evil.tld"
# is not classified as Composer.
_COMPOSER_HOST_SUFFIXES = (".composer.googleusercontent.com",)

# IAP audience lookup is per-host and effectively never invalidates within a
# process. Cap the cache at 128 distinct hosts to satisfy the bounded-cache
# guideline; in practice a single OpenMetadata instance never services that
# many Composer pipelines simultaneously.
_AUDIENCE_CACHE_MAX = 128


def try_exchange_jwt(host: str, username: str, password: str, verify: bool) -> Optional[str]:  # noqa: UP045
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
        logger.debug("JWT token exchange failed (likely Airflow 2.x): %s", traceback.format_exc())
        return None


def build_access_token_callback(token: str) -> TokenCallback:
    """Returns a static token callback with no expiry."""
    return lambda: (token, 0)


def build_basic_auth_callback(host: str, username: str, password: str, verify: bool) -> Tuple[TokenCallback, None]:  # noqa: UP006
    """
    Returns (callback, None). auth_token_mode=None means client.py uses the
    token value as-is; the callback embeds 'Bearer' or 'Basic' prefix itself.

    On every refresh cycle the callback re-calls try_exchange_jwt so the JWT
    is always freshly issued — no stale-token 401s for long-running ingestions.
    Falls back to Basic auth for Airflow 2.x servers.
    """

    def _callback() -> Tuple[str, object]:  # noqa: UP006
        jwt = try_exchange_jwt(host, username, password, verify)
        if jwt:
            return f"Bearer {jwt}", _JWT_REFRESH_INTERVAL_SECONDS
        b64 = base64.b64encode(f"{username}:{password}".encode()).decode()
        return f"Basic {b64}", _BASIC_AUTH_TTL_SECONDS

    return _callback, None


def is_composer_host(host: Optional[str]) -> bool:  # noqa: UP045
    """Return True if the host's DNS name looks like a Cloud Composer Airflow web URL."""
    result = False
    if host:
        try:
            netloc = urllib.parse.urlparse(host).hostname or ""
            result = any(netloc.endswith(suffix) for suffix in _COMPOSER_HOST_SUFFIXES)
        except ValueError:
            result = False
    return result


@functools.lru_cache(maxsize=_AUDIENCE_CACHE_MAX)
def resolve_iap_audience(host: str, verify: bool = True) -> Optional[str]:  # noqa: UP045
    """
    Probe the host without credentials and extract the IAP OAuth client ID from
    the Google login redirect. Cached per (host, verify) so we only do one probe
    per process for any given pair. Cache is bounded at _AUDIENCE_CACHE_MAX.

    Returns None when the host is not behind IAP, the redirect cannot be parsed,
    or the probe itself failed (network error, custom domain that hides client_id).
    """
    audience = None
    try:
        resp = requests.get(host, allow_redirects=False, timeout=10, verify=verify)
        if 300 <= resp.status_code < 400:
            location = resp.headers.get("Location", "")
            match = re.search(r"[?&]client_id=([^&]+)", location)
            if match:
                audience = urllib.parse.unquote(match.group(1))
    except Exception:
        logger.debug("IAP audience auto-detect failed for %s: %s", host, traceback.format_exc())
    return audience


def _decode_jwt_expiry(token: str) -> datetime:
    """Decode the `exp` claim from a JWT without verifying the signature. Falls back to +55 min."""
    expiry = datetime.now(timezone.utc) + timedelta(minutes=55)
    try:
        payload_segment = token.split(".")[1]
        padded = payload_segment + "=" * (-len(payload_segment) % 4)
        claims = json.loads(base64.urlsafe_b64decode(padded.encode()))
        exp = claims.get("exp")
        if isinstance(exp, (int, float)):
            expiry = datetime.fromtimestamp(int(exp), tz=timezone.utc)
    except Exception:
        logger.debug("Could not decode JWT expiry; using +55 min fallback: %s", traceback.format_exc())
    return expiry


def _resolve_effective_audience(
    explicit_audience: Optional[str],  # noqa: UP045
    host: Optional[str],  # noqa: UP045
    verify: bool,
) -> Optional[str]:  # noqa: UP045
    """
    Pick the audience for ID-token minting in priority order:
      1. explicit_audience passed by caller (from the GcpServiceAccount.iapAudience field)
      2. auto-detection against a Composer host

    Returns None when no IAP audience applies — caller falls back to the
    access-token path for non-IAP GCP-protected Airflow servers.
    """
    audience = explicit_audience
    if not audience and host and is_composer_host(host):
        audience = resolve_iap_audience(host, verify=verify)
        if audience:
            logger.info("Auto-detected IAP audience for Composer host %s: %s", host, audience)
    return audience


def _mint_id_token(gcp_credentials, audience: str) -> Tuple[str, datetime]:  # noqa: UP006
    """
    Mint a Google-signed OIDC ID token whose `aud` matches the IAP backend.

    Handles all four GcpCredentials variants by routing through set_google_credentials
    (which writes SA-values to a tmp file + sets GOOGLE_APPLICATION_CREDENTIALS):

      - SA values / SA path: mint via service_account.IDTokenCredentials from the file.
      - External Account / ADC: defer to google.oauth2.id_token.fetch_id_token,
        which resolves the ambient identity (metadata server, federated SA, etc.).

    Service-account impersonation is applied on top when configured.
    """
    from google.auth.transport.requests import Request as AuthRequest  # noqa: PLC0415
    from google.oauth2 import id_token, service_account  # noqa: PLC0415

    impersonate = getattr(gcp_credentials, "gcpImpersonateServiceAccount", None)
    if impersonate and impersonate.impersonateServiceAccount:
        return _mint_impersonated_id_token(impersonate, audience)

    sa_file_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if sa_file_path and Path(sa_file_path).is_file():
        creds = service_account.IDTokenCredentials.from_service_account_file(sa_file_path, target_audience=audience)
        creds.refresh(AuthRequest())
        expiry = _normalize_expiry(getattr(creds, "expiry", None))
        return creds.token, expiry or _decode_jwt_expiry(creds.token)

    token = id_token.fetch_id_token(AuthRequest(), audience)
    if not token:
        raise RuntimeError(
            "google.oauth2.id_token.fetch_id_token returned no token. "
            "The ambient identity cannot mint ID tokens for the given audience — "
            "configure a service account credentials file or run under GCE/GKE workload identity."
        )
    return token, _decode_jwt_expiry(token)


def _mint_impersonated_id_token(impersonate, audience: str) -> Tuple[str, datetime]:  # noqa: UP006
    """Mint an ID token via service-account impersonation chain."""
    import google.auth  # noqa: PLC0415
    from google.auth import impersonated_credentials  # noqa: PLC0415
    from google.auth.transport.requests import Request as AuthRequest  # noqa: PLC0415

    source_credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    target_credentials = impersonated_credentials.Credentials(
        source_credentials=source_credentials,
        target_principal=impersonate.impersonateServiceAccount,
        target_scopes=["https://www.googleapis.com/auth/cloud-platform"],
        lifetime=impersonate.lifetime,
    )
    creds = impersonated_credentials.IDTokenCredentials(
        target_credentials=target_credentials,
        target_audience=audience,
        include_email=True,
    )
    creds.refresh(AuthRequest())
    expiry = _normalize_expiry(getattr(creds, "expiry", None))
    return creds.token, expiry or _decode_jwt_expiry(creds.token)


def _normalize_expiry(expiry: Optional[datetime]) -> Optional[datetime]:  # noqa: UP045
    """google-auth returns naive UTC datetimes — make them tz-aware so downstream comparisons don't break."""
    result = expiry
    if expiry is not None and expiry.tzinfo is None:
        result = expiry.replace(tzinfo=timezone.utc)
    return result


def _mint_access_token(gcp_credentials) -> Tuple[str, datetime]:  # noqa: UP006
    """
    Mint an OAuth2 access token (legacy path, retained for non-IAP GCP-protected Airflow).

    Identical to the original build_gcp_token_callback behavior — kept so any
    existing customer running Airflow behind GCP IAM (but not Composer/IAP) keeps
    working without configuration changes.
    """
    import google.auth  # noqa: PLC0415
    from google.auth.transport.requests import Request as AuthRequest  # noqa: PLC0415

    impersonate = getattr(gcp_credentials, "gcpImpersonateServiceAccount", None)
    if impersonate and impersonate.impersonateServiceAccount:
        credentials = get_gcp_impersonate_credentials(
            impersonate_service_account=impersonate.impersonateServiceAccount,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
            lifetime=impersonate.lifetime,
        )
    else:
        credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    credentials.refresh(AuthRequest())  # type: ignore
    expiry = _normalize_expiry(getattr(credentials, "expiry", None)) or (
        datetime.now(timezone.utc) + timedelta(minutes=55)
    )
    return credentials.token, expiry  # type: ignore


def build_gcp_token_callback(
    gcp_credentials,
    *,
    iap_audience: Optional[str] = None,  # noqa: UP045
    host: Optional[str] = None,  # noqa: UP045
    verify: bool = True,
) -> TokenCallback:
    """
    Returns a token callback that fetches and auto-refreshes GCP credentials for
    Airflow REST API auth.

    Decision matrix (per refresh cycle):
      - IAP audience available (explicit or auto-detected from a Composer host)
        -> mint an OIDC ID token whose `aud` matches the IAP backend.
      - No IAP audience and host does not look like Composer
        -> fall back to OAuth2 access tokens (legacy path).

    Auto-detection only fires for Composer hosts; failures there are logged at
    DEBUG and the callback falls back to the access-token path, preserving the
    previous behavior for non-IAP GCP-protected Airflow.

    Supports all 4 GCP credential types via set_google_credentials and impersonation.
    """
    set_google_credentials(gcp_credentials)
    audience = _resolve_effective_audience(iap_audience, host, verify)

    def _callback() -> Tuple[str, datetime]:  # noqa: UP006
        if audience:
            return _mint_id_token(gcp_credentials, audience)
        return _mint_access_token(gcp_credentials)

    return _callback
