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
Source connection handler
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

import looker_sdk
from looker_sdk.rtl.api_settings import ApiSettings, SettingsConfig
from looker_sdk.sdk.api40.methods import Looker40SDK

from metadata.core.connections.test_connection import (
    Diagnosis,
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.dashboard import DashboardStep
from metadata.core.connections.test_connection.checks.rest import (
    call_endpoint,
    fetch_list,
    http_status,
    verify_access,
)
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection as LookerConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.utils.constants import THREE_MIN

if TYPE_CHECKING:
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher

SDK_API_VERSION = "4.0"

API_SDK_DOC = "https://cloud.google.com/looker/docs/api-sdk"

# Looker encodes the HTTP status of a failed call in the documentation URL it
# returns with the error body, e.g.
# https://cloud.google.com/looker/docs/r/err/4.0/404/post/api/4.0/login
_ERROR_DOC_URL = re.compile(r"/r/err/[^/]+/(?P<status>\d{3})/(?P<path>\S*)", re.IGNORECASE)

# A 404 from a server that is not Looker. Word-bounded so a port or byte count
# containing 404 does not match.
_FOREIGN_404 = re.compile(r"\b404\b|not found", re.IGNORECASE)


class UnsupportedApiVersionError(Exception):
    """The Looker instance does not list the API version the SDK speaks."""


def _error_doc(error: BaseException) -> re.Match[str] | None:
    """Parse the status and endpoint from the documentation URL the error carries.

    Searches the message and the attribute: an API call deserializes the URL onto
    ``documentation_url``, a failed login raises the raw body as the message, and
    only newer ``looker-sdk`` renders the attribute in ``__str__``.
    """
    doc_url = getattr(error, "documentation_url", "") or ""
    return _ERROR_DOC_URL.search(f"{error} {doc_url}")


def _http_status(*codes: int) -> Matcher:
    """Match a Looker REST error by the HTTP status of the call that failed.

    The SDK flattens every error into text, so the status is only recoverable from
    the error-document URL it embeds - hence a bespoke extractor, not the shared
    ``requests`` default.
    """
    wanted = frozenset(str(code) for code in codes)

    def status_of(error: BaseException) -> int | None:
        match = _error_doc(error)
        return int(match["status"]) if match is not None and match["status"] in wanted else None

    return http_status(*codes, extract=status_of)


def _login_rejected(error: BaseException) -> bool:
    """Match Looker rejecting the credentials: a 404 on ``/login``, so the endpoint -
    not the status - is what separates it from a wrong host."""
    return any(
        (match := _error_doc(current)) is not None and match["status"] == "404" and "login" in match["path"].lower()
        for current in exception_chain(error)
    )


def _has_error_doc(error: BaseException) -> bool:
    """Whether any error in the chain carries a Looker error document.

    A real transport failure is flattened into a message with no such document, so
    its presence marks a structured Looker answer that must keep its raw errorLog
    rather than be diagnosed from incidental text.
    """
    return any(_error_doc(current) is not None for current in exception_chain(error))


def _foreign_404(error: BaseException) -> bool:
    """Match a 404 from a server that is not Looker: a 404 token, but no Looker
    error document (a Looker 404 carries one and is matched above)."""
    return not _has_error_doc(error) and any(_FOREIGN_404.search(str(current)) for current in exception_chain(error))


def _transport_text(*tokens: str) -> Matcher:
    """Match a flattened transport error by text: the SDK re-raises every
    ``IOError`` as an ``SDKError`` whose message is the stringified original, so
    DNS, refused, TLS and timeout errors lose their type.

    Guarded by the absence of a Looker error document, so a structured Looker
    error whose message happens to contain a transport token (e.g. a 400 reading
    "timeout") keeps its raw errorLog instead of being blamed on the network.
    """
    lowered = tuple(token.lower() for token in tokens)

    def match(error: BaseException) -> bool:
        if _has_error_doc(error):
            return False
        chain = " ".join(str(current) for current in exception_chain(error)).lower()
        return any(token in chain for token in lowered)

    return match


# The API spec documents 400, 404 and 429 for the endpoints these checks call - no
# 401 anywhere, no 403 on any of them. An unmatched status keeps its raw errorLog.
LOOKER_ERRORS = ErrorPack(
    # Before the generic 404: a rejected login is itself a 404, on /login.
    when(_login_rejected).diagnose(
        "Authentication failed",
        fix="Looker rejected the credentials. Check the Client ID and Client Secret.",
        doc=API_SDK_DOC,
    ),
    when(Matchers.contains("Required auth credentials not found")).diagnose(
        "Missing credentials",
        fix="Provide both the Client ID and the Client Secret.",
        doc=API_SDK_DOC,
    ),
    when(_http_status(404)).diagnose(
        "Resource not found",
        fix="Looker could not find the requested resource. Check that Host Port is the instance URL.",
    ),
    when(_http_status(429)).diagnose(
        "Rate limited by Looker",
        fix="Looker is throttling the requests. Retry once the instance is under less load.",
    ),
    when(Matchers.exception(UnsupportedApiVersionError)).diagnose(
        f"API {SDK_API_VERSION} is not supported by this instance",
        fix=f"This connector uses API {SDK_API_VERSION}, which the instance does not list as supported.",
        doc=API_SDK_DOC,
    ),
    # Matched on text: the transport flattens these into an SDKError message. Guarded
    # so a structured Looker error is not read as a transport failure; the type-based
    # NETWORK_ERRORS below only fires outside the transport.
    when(
        _transport_text("failed to resolve", "name or service not known", "nodename nor servname", "getaddrinfo failed")
    ).diagnose(
        "Host could not be resolved",
        fix="Check Host Port and that DNS resolves it from where ingestion runs.",
    ),
    when(_transport_text("connection refused")).diagnose(
        "Connection refused",
        fix="Nothing is listening on that port. Check the host and port in Host Port.",
    ),
    when(_transport_text("timed out", "timeout")).diagnose(
        "Connection timed out",
        fix="The host did not answer in time. Check that the network allows access to this host and port.",
    ),
    when(_transport_text("certificate verify failed", "sslerror", "ssl: ")).diagnose(
        "TLS verification failed",
        fix="The instance's certificate could not be verified from where ingestion runs.",
    ),
    when(_transport_text("max retries exceeded", "connection aborted", "connection error")).diagnose(
        "Cannot reach the host",
        fix="Check Host Port and that the instance is reachable from where ingestion runs.",
    ),
    # Looker serves this page, with no error document, both for a rejected sign-in
    # and for a host that is not a live instance; the two cannot be told apart.
    when(_transport_text("looker is unavailable", "looker not found")).diagnose(
        "Authentication failed",
        fix="Looker returns this same page for wrong credentials and for a host that is not a live "
        "instance. Check the Client ID and Client Secret, then Host Port.",
        doc=API_SDK_DOC,
    ),
    # Last: a 404 from something that is not Looker - any Looker error carries an
    # error document, whether or not this pack diagnoses its status.
    when(_foreign_404).diagnose(
        "The host is not serving the Looker API",
        fix="A server answered but did not return a Looker error. Check that Host Port points at the Looker instance.",
    ),
).including(NETWORK_ERRORS)


class LookerChecks:
    """Test-connection checks for Looker.

    ``CheckAccess`` is the gate: reading the borrowed client logs in on its first
    call, so bad credentials and an unreachable host fail there.
    """

    errors = LOOKER_ERRORS

    def __init__(self, looker: Borrowed[Looker40SDK]) -> None:
        self._looker = looker

    def _client(self) -> Looker40SDK:
        return self._looker.client

    @check(DashboardStep.CheckAccess)
    def check_access(self) -> Evidence:
        return verify_access(
            lambda: self._client().me(),
            command="log in and read the authenticated user",
        )

    @check(DashboardStep.ValidateVersion)
    def validate_version(self) -> Evidence:
        command = "list the API versions the instance supports"
        versions = call_endpoint(lambda: self._client().versions(), command=command)
        supported = [version.version for version in versions.supported_versions or []]
        if SDK_API_VERSION not in supported:
            raise CheckError(
                UnsupportedApiVersionError(
                    f"API {SDK_API_VERSION} is not listed among the supported versions: "
                    f"{', '.join(version for version in supported if version) or 'none'}"
                ),
                Evidence(command=command),
            )
        return Evidence(summary=f"API {SDK_API_VERSION} is supported", command=command)

    @check(DashboardStep.ListDashboards)
    def list_dashboards(self) -> Evidence:
        return fetch_list(
            lambda: self._client().all_dashboards(fields="id,title"),
            noun="dashboard",
            command="list dashboards",
            empty_caveat=Diagnosis(
                title="No dashboards visible",
                remediation="The connection works but returned no dashboards. Confirm the user can see "
                "the dashboards to ingest.",
            ),
        )

    @check(DashboardStep.ListLookMLModels)
    def list_lookml_models(self) -> Evidence:
        return fetch_list(
            lambda: self._client().all_lookml_models(limit=1),
            noun="LookML model",
            command="list LookML models",
            empty_caveat=Diagnosis(
                title="No LookML models visible",
                remediation="The connection works but returned no LookML model. Grant the user access "
                "to the models to ingest; without them, lineage will not be present.",
            ),
        )


class LookerSettings(ApiSettings):
    """Configure the SDK from this service's connection.

    Without it the SDK reads host and credentials from the process environment,
    which a long-lived worker populates once: later connections in that process
    would reuse the first one's.
    """

    def __init__(self, connection: LookerConnectionConfig) -> None:
        self._config: SettingsConfig = {
            "base_url": str(connection.hostPort),
            "client_id": connection.clientId,
            "client_secret": connection.clientSecret.get_secret_value(),
        }
        super().__init__()

    def read_config(self) -> SettingsConfig:
        return self._config


class LookerConnection(BaseConnection[LookerConnectionConfig, Looker40SDK]):
    # Listing dashboards and LookML models can be slow on large instances; keep the
    # legacy 3-minute budget the imperative handler used, now applied per step.
    step_timeout_seconds = THREE_MIN

    def _get_client(self) -> Looker40SDK:
        return looker_sdk.init40(config_settings=LookerSettings(self.service_connection))

    def checks(self) -> ChecksProvider:
        return LookerChecks(looker=self.borrow())
