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

  - Google Cloud Composer  (IAP-protected, behind googleusercontent.com)
  - AWS MWAA              (uses invoke_rest_api with AWS IAM credentials)
  - Astronomer Cloud      (workspace API tokens against *.astronomer.run)
  - Self-hosted Airflow   (anything else)

Each probe is best-effort: failures inside the probe never raise; they return
None and the original error is shown to the user unchanged.
"""

import base64
import json
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
            "Composer Airflow is IAP-protected and only accepts Google-issued OIDC ID tokens. "
            "Switch the auth configuration to 'GCP Service Account' and paste your service account JSON."
        )
    else:
        hint = _composer_audience_hint(host, auth_config, verify)
    return hint


def _composer_audience_hint(host: str, auth_config: GcpServiceAccount, verify: bool) -> Optional[str]:  # noqa: UP045
    """
    Produce an actionable hint about the IAP audience. Decision order:

      1. Classic IAP and redirect exposed an audience -> compare with token, name both.
      2. Composer Management API can be reached -> resolve audience from the env's
         config (iapClientId for Composer 2 classic, airflowByoidConfig.audiences
         for Composer 2 BYOID and Composer 3) and tell the user the exact value
         to paste into 'IAP Audience'.
      3. Composer-managed redirect but API probe failed -> recommend
         `gcloud composer environments describe` as a manual fallback.
      4. Any other auto-detect failure -> generic "set IAP Audience manually" hint.
    """
    expected_audience = _probe_iap_audience(host, verify)
    actual_audience = _token_audience(auth_config, host, verify)

    hint = None
    if expected_audience and actual_audience and expected_audience != actual_audience:
        hint = (
            f"IAP audience mismatch. Composer expects aud='{expected_audience}' "
            f"but the token presents aud='{actual_audience}'. "
            "Set 'IAP Audience' to the expected value (also visible in GCP Console -> "
            "Security -> Identity-Aware Proxy -> the Composer backend's OAuth 2.0 Client ID)."
        )
    elif expected_audience and not actual_audience:
        hint = (
            f"Could not mint an OIDC ID token to compare with the IAP audience '{expected_audience}'. "
            "Verify the service account JSON is valid and that the SA has roles/iap.httpsResourceAccessor."
        )
    elif not expected_audience:
        env_info = _probe_composer_management_api(host, auth_config, verify)
        if env_info:
            hint = _hint_from_env_info(env_info)
        elif _detect_composer_iap_model(host, verify) == "composer_managed":
            hint = (
                "This is Composer 2/3 with the managed IAP model (the unauthenticated request "
                "redirects through composer.cloud.google.com/_signin rather than directly to the "
                "Google OAuth endpoint), and the service account does not have access to the "
                "Composer Management API so OpenMetadata could not auto-resolve the audience.\n"
                "\n"
                "Option 1: grant the SA roles/composer.environmentAndStorageObjectViewer on the "
                "project so future test connections can resolve the audience automatically.\n"
                "Option 2: look up the audience manually and paste it into 'IAP Audience':\n"
                "  gcloud composer environments describe <ENV_NAME> --location <REGION> "
                "--format=json | jq '.config | {webServerConfig, airflowByoidConfig}'\n"
                "  - If 'webServerConfig.iapClientId' is set, use that value.\n"
                "  - If 'airflowByoidConfig.audiences' is non-empty, use any value from the list.\n"
                "  - If neither is set (Composer 3 without BYOID), enable BYOID first with "
                "`gcloud composer environments update <ENV_NAME> --location <REGION> "
                "--airflow-byoid-audiences=<your-choice>`."
            )
        else:
            hint = (
                "Could not auto-detect the IAP audience for this Composer environment "
                "(custom domain, blocked egress, or private IAP). Set 'IAP Audience' explicitly "
                "to the OAuth client ID shown in GCP Console -> Security -> Identity-Aware Proxy -> "
                "the Composer backend."
            )
    return hint


def _hint_from_env_info(env_info: dict) -> str:
    """Build a precise audience recommendation from a parsed Composer environment config."""
    name = env_info.get("name") or "<env>"
    version = env_info.get("version") or "unknown"
    iap_client_id = env_info.get("iapClientId")
    byoid_audiences = env_info.get("byoidAudiences") or []
    region = env_info.get("region") or "<region>"

    if iap_client_id:
        result = (
            f"Auto-detected the IAP audience for Composer environment '{name}' (image {version}). "
            f"Set 'IAP Audience' to:\n  {iap_client_id}"
        )
    elif byoid_audiences:
        joined = "\n  ".join(byoid_audiences)
        result = (
            f"Composer environment '{name}' (image {version}) has BYOID configured. "
            f"Set 'IAP Audience' to one of:\n  {joined}"
        )
    else:
        result = (
            f"Composer environment '{name}' (image {version}) has no IAP client ID and no BYOID "
            "audiences configured — Airflow REST API access is not currently enabled.\n"
            "Enable BYOID with the audience of your choice, then paste it into 'IAP Audience':\n"
            f"  gcloud composer environments update {name} --location {region} "
            "--airflow-byoid-audiences=<your-chosen-audience>"
        )
    return result


def _probe_composer_management_api(host: str, auth_config: GcpServiceAccount, verify: bool) -> Optional[dict]:  # noqa: UP045
    """
    Call the Composer Management API to find the env matching this airflowUri
    and extract the fields needed to recommend an audience.

    Returns a dict {name, region, version, iapClientId, byoidAudiences} or None
    when the API can't be reached, the SA lacks permission, the env is missing,
    or any other failure. Diagnostics must never raise.
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
            verify=verify,
        )
        if resp.status_code != 200:
            logger.debug("Composer management API returned %s: %s", resp.status_code, resp.text[:200])
            return None

        normalized_host = (host or "").rstrip("/").lower()
        for env in resp.json().get("environments", []) or []:
            env_config = env.get("config") or {}
            airflow_uri = (env_config.get("airflowUri") or "").rstrip("/").lower()
            if airflow_uri == normalized_host:
                info = _extract_env_audience_info(env, region)
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

    Uses the existing build_gcp_token_callback machinery (with no IAP audience)
    to get the access-token code path. Result is not cached: the diagnostic
    fires only on a failed CheckAccess, so a single extra token mint is cheap.
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


def _extract_env_audience_info(env: dict, region: str) -> dict:
    """Pull the audience-relevant fields out of a Composer environments.get response."""
    config = env.get("config") or {}
    full_name = env.get("name") or ""
    return {
        "name": full_name.split("/")[-1] if full_name else "",
        "region": region,
        "version": (config.get("softwareConfig") or {}).get("imageVersion"),
        "iapClientId": (config.get("webServerConfig") or {}).get("iapClientId"),
        "byoidAudiences": ((config.get("airflowByoidConfig") or {}).get("audiences")) or [],
    }


def _detect_composer_iap_model(host: str, verify: bool) -> Optional[str]:  # noqa: UP045
    """
    Identify which Composer IAP variant we're talking to:
      - "classic": redirect points at accounts.google.com/o/oauth2/auth?client_id=...
      - "composer_managed": redirect points at composer.cloud.google.com/_signin
      - None: probe failed or response wasn't a redirect

    Composer 2/3 with the managed IAP model hides the client_id behind its own
    /_signin shim, so the audience auto-detect cannot succeed and the user must
    supply the audience manually.
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
    elif host and "cloud.astronomer.io" in _hostname(host):
        hint = (
            "hostPort looks like the Astronomer Cloud control plane (cloud.astronomer.io), not a deployment URL. "
            "Copy the deployment's Airflow URL from Deployment -> Details (it ends in .astronomer.run)."
        )
    return hint


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


def _probe_iap_audience(host: str, verify: bool) -> Optional[str]:  # noqa: UP045
    """
    Make an unauthenticated request to the host and pull `client_id=` out of
    the IAP login redirect. Cached at the auth-module level so we only do
    one probe per process per host.
    """
    from metadata.ingestion.source.pipeline.airflow.api.auth import (  # noqa: PLC0415
        resolve_iap_audience,
    )

    return resolve_iap_audience(host, verify=verify)


def _token_audience(auth_config: GcpServiceAccount, host: str, verify: bool) -> Optional[str]:  # noqa: UP045
    """Mint a token via the configured GCP auth and decode its `aud` claim. Returns None on any failure."""
    from metadata.ingestion.source.pipeline.airflow.api.auth import (  # noqa: PLC0415
        build_gcp_token_callback,
    )

    audience = None
    try:
        callback = build_gcp_token_callback(
            auth_config.credentials,
            iap_audience=auth_config.iapAudience,
            host=host,
            verify=verify,
        )
        token, _ = callback()
        audience = _jwt_aud(token)
    except Exception:
        logger.debug("Token audience probe failed: %s", traceback.format_exc())
    return audience


def _jwt_aud(token: str) -> Optional[str]:  # noqa: UP045
    """Decode JWT payload (no signature verification) and return its `aud` claim, or None."""
    result = None
    try:
        payload_segment = token.split(".")[1]
        padded = payload_segment + "=" * (-len(payload_segment) % 4)
        claims = json.loads(base64.urlsafe_b64decode(padded.encode()))
        aud = claims.get("aud")
        if isinstance(aud, str):
            result = aud
        elif isinstance(aud, list) and aud:
            result = aud[0]
    except Exception:
        logger.debug("Could not decode JWT aud claim: %s", traceback.format_exc())
    return result
