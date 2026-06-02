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
CheckAccess diagnostics for the Airflow REST API client.

When the underlying connection test fails, this module produces a
managed-flavor-specific, actionable hint to surface alongside the raw error:

  - Google Cloud Composer  (IAM-protected, behind googleusercontent.com)
  - AWS MWAA              (uses invoke_rest_api with AWS IAM credentials)
  - Astronomer Cloud      (workspace API tokens against *.astronomer.run)
  - Self-hosted Airflow   (anything else)

Each probe is best-effort: failures inside the probe never raise; they return
None and the original error is shown to the user unchanged.
"""

import re
import traceback
import urllib.parse
from enum import Enum
from typing import Optional

import requests

from metadata.generated.schema.entity.utils.common.accessTokenConfig import AccessToken
from metadata.generated.schema.entity.utils.common.basicAuthConfig import BasicAuth
from metadata.generated.schema.entity.utils.common.gcpCredentialsConfig import (
    GcpServiceAccount,
)
from metadata.generated.schema.entity.utils.common.mwaaAuthConfig import (
    MwaaAuthentication,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class AirflowFlavor(Enum):
    COMPOSER = "composer"
    MWAA = "mwaa"
    ASTRONOMER = "astronomer"
    SELF_HOSTED = "self_hosted"


_COMPOSER_HOST_SUFFIXES = (".composer.googleusercontent.com",)
_COMPOSER_HOST_PATTERN = re.compile(
    r"^[^.]+-dot-(?P<region>[a-z0-9-]+)\.composer\.googleusercontent\.com$",
    re.IGNORECASE,
)
_MWAA_HOST_PATTERN = re.compile(r"\.airflow\.[a-z0-9-]+\.amazonaws\.com$", re.IGNORECASE)
_ASTRONOMER_HOST_SUFFIXES = (".astronomer.run", ".astronomer.io", ".cloud.astronomer.io")
_GCP_CONSOLE_HOST_SUFFIXES = ("console.cloud.google.com", "console.developers.google.com")


def detect_flavor(host: Optional[str], auth_config) -> AirflowFlavor:  # noqa: UP045
    """
    Auth-config wins over URL pattern. Falls back to URL pattern when the auth
    config is generic (Basic / AccessToken), and finally to SELF_HOSTED.
    """
    flavor = AirflowFlavor.SELF_HOSTED
    if isinstance(auth_config, MwaaAuthentication):
        flavor = AirflowFlavor.MWAA
    elif isinstance(auth_config, GcpServiceAccount):
        flavor = AirflowFlavor.COMPOSER
    else:
        netloc = _hostname(host)
        if netloc.endswith(_COMPOSER_HOST_SUFFIXES):
            flavor = AirflowFlavor.COMPOSER
        elif _MWAA_HOST_PATTERN.search(netloc):
            flavor = AirflowFlavor.MWAA
        elif netloc.endswith(_ASTRONOMER_HOST_SUFFIXES):
            flavor = AirflowFlavor.ASTRONOMER
    return flavor


def diagnose(host: Optional[str], auth_config, verify: bool, original_error: Exception) -> Optional[str]:  # noqa: UP045
    """
    Run flavor-specific probes and return an actionable hint string, or None
    when no flavor-specific guidance applies.
    """
    hint = None
    try:
        flavor = detect_flavor(host, auth_config)
        probe = _PROBES.get(flavor)
        if probe:
            hint = probe(host, auth_config, verify, original_error)
    except Exception:
        # Diagnostics must never raise — the user still sees the original error.
        logger.debug("Airflow diagnostics probe failed: %s", traceback.format_exc())
    return hint


# ── Probes ──────────────────────────────────────────────────────────────────


def _probe_composer(host: Optional[str], auth_config, verify: bool, original_error: Exception) -> Optional[str]:  # noqa: UP045
    hint = None
    if not host:
        hint = "Set hostPort to the Airflow web UI URL from your Composer environment page (https://<env>.composer.googleusercontent.com)."
    elif _hostname(host).endswith(_GCP_CONSOLE_HOST_SUFFIXES):
        hint = (
            "hostPort points at the GCP Console (console.cloud.google.com), not at the Composer Airflow web UI. "
            "Open the Composer environment in the Console and copy the 'Airflow web UI' URL "
            "(https://<env-id>-dot-<region>.composer.googleusercontent.com)."
        )
    elif not isinstance(auth_config, GcpServiceAccount):
        hint = (
            "Composer Airflow only accepts Google IAM credentials. "
            "Switch the auth configuration to 'GCP Service Account' and paste your service account JSON."
        )
    else:
        hint = _composer_access_hint(host, auth_config, verify)
    return hint


def _composer_access_hint(host: str, auth_config: GcpServiceAccount, verify: bool) -> Optional[str]:  # noqa: UP045
    """
    A valid GCP Service Account config that still fails CheckAccess is almost
    always an IAM permission problem: Google rejects the request before it
    reaches the Airflow API and returns an HTML login/denied page, which the
    client surfaces as an unhelpful JSON parse error. Decision order:

      1. Classic IAP redirect detected -> the environment requires OIDC ID-token
         auth, which OpenMetadata does not support; recommend IAM-based access.
      2. Composer Management API reachable and env found -> the SA has project
         access but not Airflow access; name the env and the missing role.
      3. Anything else -> generic missing-IAM-permission hint.
    """
    hint = None
    if _detect_composer_iap_model(host, verify) == "classic":
        hint = (
            "This Composer environment is protected by classic IAP, which requires OIDC ID-token "
            "authentication that OpenMetadata does not support. Use a Composer 2/3 environment with "
            "IAM-based web server access control, or expose the Airflow REST API without classic IAP."
        )
    else:
        env_info = _probe_composer_management_api(host, auth_config, verify)
        if env_info:
            hint = _composer_permission_hint(env_info)
        else:
            hint = (
                "The request was rejected before reaching the Airflow API — this usually means the "
                "service account is missing IAM permissions on the Composer environment.\n"
                "Grant the service account the 'Composer User' role (roles/composer.user) on the "
                "project, wait a few minutes for IAM propagation, and re-run the test connection."
            )
    return hint


def _composer_permission_hint(env_info: dict) -> str:
    """Build a permission hint that names the Composer environment the SA can already see."""
    name = env_info.get("name") or "<env>"
    version = env_info.get("version") or "unknown"
    return (
        f"The service account can see Composer environment '{name}' (image {version}) through the "
        "Composer Management API, but the Airflow web server rejected the request.\n"
        "Grant the service account the 'Composer User' role (roles/composer.user) on the project. "
        "If Airflow UI Access Control is enabled for this environment, also assign the service "
        "account an Airflow role (e.g. 'Op') in the Airflow UI."
    )


def _probe_composer_management_api(host: str, auth_config: GcpServiceAccount, verify: bool) -> Optional[dict]:  # noqa: UP045
    """
    Call the Composer Management API to find the env matching this airflowUri,
    proving whether the service account has any project-level access at all.

    Returns a dict {name, region, version} or None when the API can't be
    reached, the SA lacks permission, the env is missing, or any other
    failure. Diagnostics must never raise.

    Note: the `verify` parameter (user-controlled Airflow verifySSL) is
    intentionally NOT forwarded to the Google Management API call. A user who
    disables certificate verification for an internal Airflow endpoint should
    not have that opt-out leak into bearer-token requests against
    composer.googleapis.com, which always presents a Google-signed cert.
    """
    info = None
    try:
        region = _composer_region_from_host(host)
        project_id = _project_from_credentials(auth_config.credentials)
        if not region or not project_id:
            return None

        token = _mint_access_token_for_diagnostic(auth_config)
        if not token:
            return None

        url = f"https://composer.googleapis.com/v1/projects/{project_id}/locations/{region}/environments"
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
            verify=True,
        )
        if resp.status_code != 200:
            logger.debug("Composer management API returned %s: %s", resp.status_code, resp.text[:200])
            return None

        normalized_host = (host or "").rstrip("/").lower()
        for env in resp.json().get("environments", []) or []:
            env_config = env.get("config") or {}
            airflow_uri = (env_config.get("airflowUri") or "").rstrip("/").lower()
            if airflow_uri == normalized_host:
                info = _extract_env_info(env, region)
                break
    except Exception:
        logger.debug("Composer management probe failed: %s", traceback.format_exc())
    return info


def _composer_region_from_host(host: Optional[str]) -> Optional[str]:  # noqa: UP045
    """Extract region from a Composer hostname like 'abc-dot-us-east4.composer.googleusercontent.com'."""
    region = None
    netloc = _hostname(host)
    if netloc:
        match = _COMPOSER_HOST_PATTERN.match(netloc)
        if match:
            region = match.group("region")
    return region


def _project_from_credentials(credentials) -> Optional[str]:  # noqa: UP045
    """
    Resolve the GCP project ID to query for Composer environments. Prefers the
    explicit `projectId` field on GcpCredentialsValues; falls back to whatever
    google.auth.default() reports for ambient credentials (ADC, federation).
    """
    project = None
    gcp_config = getattr(credentials, "gcpConfig", None)
    project_id_field = getattr(gcp_config, "projectId", None)
    if project_id_field is not None:
        candidate = getattr(project_id_field, "root", project_id_field)
        if isinstance(candidate, str) and candidate:
            project = candidate
        elif isinstance(candidate, list) and candidate:
            project = candidate[0]

    if not project:
        try:
            import google.auth  # noqa: PLC0415

            _, ambient_project = google.auth.default()
            if ambient_project:
                project = ambient_project
        except Exception:
            logger.debug("google.auth.default() project lookup failed: %s", traceback.format_exc())
    return project


def _mint_access_token_for_diagnostic(auth_config: GcpServiceAccount) -> Optional[str]:  # noqa: UP045
    """
    Mint an OAuth2 access token (cloud-platform scope) for the Composer
    Management API call. Returns None on any failure.

    Uses the existing build_gcp_token_callback machinery to get the
    access-token code path. Result is not cached: the diagnostic fires only
    on a failed CheckAccess, so a single extra token mint is cheap.
    """
    from metadata.ingestion.source.pipeline.airflow.api.auth import (  # noqa: PLC0415
        build_gcp_token_callback,
    )

    token = None
    try:
        callback = build_gcp_token_callback(auth_config.credentials)
        token_value, _ = callback()
        token = token_value
    except Exception:
        logger.debug("Could not mint access token for Composer management probe: %s", traceback.format_exc())
    return token


def _extract_env_info(env: dict, region: str) -> dict:
    """Pull the identifying fields out of a Composer environments.get response."""
    config = env.get("config") or {}
    full_name = env.get("name") or ""
    return {
        "name": full_name.split("/")[-1] if full_name else "",
        "region": region,
        "version": (config.get("softwareConfig") or {}).get("imageVersion"),
    }


def _detect_composer_iap_model(host: str, verify: bool) -> Optional[str]:  # noqa: UP045
    """
    Identify which Composer access-control variant we're talking to:
      - "classic": redirect points at accounts.google.com/o/oauth2/auth?client_id=...
        (classic IAP — requires OIDC ID tokens, which OpenMetadata does not support)
      - "composer_managed": redirect points at composer.cloud.google.com/_signin
        (Composer 2/3 IAM-based access — works with plain access tokens)
      - None: probe failed or response wasn't a redirect
    """
    model = None
    try:
        resp = requests.get(host, allow_redirects=False, timeout=10, verify=verify)
        if 300 <= resp.status_code < 400:
            location = resp.headers.get("Location", "")
            location_host = _hostname(location)
            if location_host.endswith(".composer.cloud.google.com"):
                model = "composer_managed"
            elif location_host == "accounts.google.com" and "client_id=" in location:
                model = "classic"
    except Exception:
        logger.debug("Composer IAP model probe failed for %s: %s", host, traceback.format_exc())
    return model


def _probe_mwaa(host: Optional[str], auth_config, verify: bool, original_error: Exception) -> Optional[str]:  # noqa: UP045
    hint = None
    if not isinstance(auth_config, MwaaAuthentication):
        hint = (
            "This host looks like an AWS MWAA environment, but the auth configuration is not 'AWS Credentials (MWAA)'. "
            "Switch the auth type and provide your AWS credentials plus the MWAA environment name."
        )
    else:
        message = str(original_error).lower()
        if "expiredtoken" in message or "expired" in message:
            hint = (
                "AWS credentials are expired. Refresh them (re-run aws sso login or rotate the access key) and retry."
            )
        elif "accessdenied" in message or "not authorized" in message:
            hint = (
                "AWS credentials authenticated but the IAM principal cannot call MWAA. "
                "Grant airflow:CreateWebLoginToken and airflow:InvokeRestApi on the environment."
            )
        elif "resourcenotfound" in message or "no such" in message:
            env_name = getattr(getattr(auth_config, "mwaaConfig", None), "mwaaEnvironmentName", None)
            hint = (
                f"MWAA environment '{env_name}' was not found in the configured region. "
                "Verify the environment name (case-sensitive) and that the AWS region matches the environment."
            )
    return hint


def _probe_astronomer(host: Optional[str], auth_config, verify: bool, original_error: Exception) -> Optional[str]:  # noqa: UP045
    hint = None
    if isinstance(auth_config, BasicAuth):
        hint = (
            "Astronomer Cloud does not support Basic auth. Generate a Workspace API token "
            "in the Astronomer Cloud UI (Settings -> API Tokens) and configure 'Access Token' auth here."
        )
    elif not isinstance(auth_config, AccessToken):
        hint = (
            "Astronomer Cloud expects a Workspace API token. Switch the auth configuration to "
            "'Access Token' and paste the token issued in Astronomer Cloud UI -> Settings -> API Tokens."
        )
    elif host and _is_astronomer_control_plane(_hostname(host)):
        hint = (
            "hostPort looks like the Astronomer Cloud control plane (cloud.astronomer.io), not a deployment URL. "
            "Copy the deployment's Airflow URL from Deployment -> Details (it ends in .astronomer.run)."
        )
    return hint


def _is_astronomer_control_plane(netloc: str) -> bool:
    """Match cloud.astronomer.io exactly or as a strict DNS suffix; substring matches are unsafe."""
    return netloc == "cloud.astronomer.io" or netloc.endswith(".cloud.astronomer.io")


def _probe_self_hosted(host: Optional[str], auth_config, verify: bool, original_error: Exception) -> Optional[str]:  # noqa: UP045
    hint = None
    if host:
        try:
            resp = requests.get(host, allow_redirects=False, timeout=10, verify=verify)
            content_type = resp.headers.get("Content-Type", "").lower()
            if "text/html" in content_type and resp.status_code == 200:
                hint = (
                    "The host returned an HTML page at the root URL. The Airflow REST API is most likely "
                    "disabled or sitting behind an SSO proxy. Enable the API auth backend on the Airflow "
                    "webserver (airflow.cfg: [api] auth_backends = airflow.api.auth.backend.basic_auth) "
                    "or terminate SSO before this URL."
                )
        except requests.exceptions.SSLError:
            hint = (
                "TLS certificate validation failed. If you are using a self-signed certificate, "
                "uncheck 'Verify SSL' for this service."
            )
        except requests.exceptions.ConnectionError:
            hint = f"Could not establish a TCP connection to {host}. Check DNS, firewall rules, and that the host is reachable from the OpenMetadata server."
    return hint


_PROBES = {
    AirflowFlavor.COMPOSER: _probe_composer,
    AirflowFlavor.MWAA: _probe_mwaa,
    AirflowFlavor.ASTRONOMER: _probe_astronomer,
    AirflowFlavor.SELF_HOSTED: _probe_self_hosted,
}


# ── Helpers ─────────────────────────────────────────────────────────────────


def _hostname(host: Optional[str]) -> str:  # noqa: UP045
    """Return the lowercased hostname of a URL or '' when unparseable."""
    result = ""
    if host:
        try:
            parsed = urllib.parse.urlparse(host)
            netloc = parsed.hostname or parsed.netloc or host
            result = netloc.lower()
        except ValueError:
            result = ""
    return result
