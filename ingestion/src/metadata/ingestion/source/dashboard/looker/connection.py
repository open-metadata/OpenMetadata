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
from metadata.core.connections.test_connection.checks.dashboard import (
    DashboardStep,
    call_endpoint,
    fetch_list,
    verify_access,
)
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection as LookerConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection

if TYPE_CHECKING:
    from collections.abc import Callable

    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher

SDK_API_VERSION = "4.0"

API_SDK_DOC = "https://cloud.google.com/looker/docs/api-sdk"

# Looker encodes the HTTP status of a failed call in the documentation URL it
# returns with the error body, e.g.
# https://cloud.google.com/looker/docs/r/err/4.0/404/post/api/4.0/login
_ERROR_DOC_URL = re.compile(r"/r/err/[^/]+/(?P<status>\d{3})/(?P<path>\S*)", re.IGNORECASE)


class UnsupportedApiVersionError(Exception):
    """The Looker instance does not list the API version the SDK speaks."""


def _error_doc(error: BaseException) -> re.Match[str] | None:
    """Parse the status and endpoint out of the Looker documentation URL an error carries.

    ``SDKError`` has no status code of its own; the documentation URL Looker
    returns with the error body encodes both the status and the endpoint that
    produced it. It reaches us two ways: an API call deserializes it onto
    ``documentation_url``, while a failed *login* raises the raw response body as
    the message, leaving that attribute empty. Matching ``str(error)`` - which
    renders both - covers the two shapes with one rule.
    """
    return _ERROR_DOC_URL.search(str(error))


def _http_status(*codes: int) -> Matcher:
    """Match a Looker REST error by the HTTP status of the call that failed."""
    wanted = frozenset(str(code) for code in codes)
    return lambda error: any(
        (match := _error_doc(current)) is not None and match["status"] in wanted for current in exception_chain(error)
    )


def _login_rejected(error: BaseException) -> bool:
    """Match Looker rejecting the API3 credentials.

    The login endpoint answers a wrong client id or secret with ``404 Not found``
    rather than a 401, so the status alone cannot separate bad credentials from a
    wrong host; the endpoint that produced it can.
    """
    return any(
        (match := _error_doc(current)) is not None and match["status"] == "404" and "login" in match["path"].lower()
        for current in exception_chain(error)
    )


def _contains_any(*tokens: str) -> Matcher:
    """Match when any of ``tokens`` appears in the error (or its cause chain).

    The SDK's transport catches every ``IOError`` - DNS failures, refused
    connections, TLS errors, timeouts - and re-raises it as an ``SDKError`` whose
    message is the stringified original, so the underlying exception *type* is
    lost and these conditions can only be matched on text.
    """
    lowered = tuple(token.lower() for token in tokens)

    def match(error: BaseException) -> bool:
        chain = " ".join(str(current) for current in exception_chain(error)).lower()
        return any(token in chain for token in lowered)

    return match


LOOKER_ERRORS = ErrorPack(
    # Ordered before the generic 404: Looker reports rejected API3 credentials as
    # a 404 on /login, so the endpoint is what separates them from a wrong host.
    when(_login_rejected).diagnose(
        "Authentication failed",
        fix="Looker rejected the API3 credentials. Check the Client ID and Client Secret of the "
        "API3 key (Admin > Users > Edit > API Keys) and that the key is still enabled.",
        doc=API_SDK_DOC,
    ),
    when(Matchers.contains("Required auth credentials not found")).diagnose(
        "Missing credentials",
        fix="The SDK found no API3 credentials to log in with. Provide both the Client ID and the "
        "Client Secret in the service configuration.",
        doc=API_SDK_DOC,
    ),
    when(_http_status(401)).diagnose(
        "Authentication failed",
        fix="Looker did not accept the session (401). Check the Client ID and Client Secret of the "
        "API3 key and that it has not been disabled.",
        doc=API_SDK_DOC,
    ),
    when(_http_status(403)).diagnose(
        "Insufficient permissions",
        fix="The API3 user is authenticated but not authorized for this call (403). Grant it a role "
        "with the see_lookml, see_looks, and see_user_dashboards permissions on the models to ingest.",
    ),
    when(_http_status(404)).diagnose(
        "Resource not found",
        fix="Looker could not find the requested resource (404). Check that Host Port is the root URL "
        "of the Looker API, e.g. https://<instance>.cloud.looker.com (port 19999 on a self-hosted "
        "instance).",
    ),
    when(Matchers.exception(UnsupportedApiVersionError)).diagnose(
        f"API {SDK_API_VERSION} is not supported by this instance",
        fix=f"The instance does not list API {SDK_API_VERSION} among its supported versions, which "
        "is the version this connector speaks. Upgrade the Looker instance, or enable the API "
        f"{SDK_API_VERSION} endpoint on it.",
        doc=API_SDK_DOC,
    ),
    # The transport flattens every IOError into an SDKError message, so these
    # network conditions are matched on the text of the original exception. They
    # precede the type-based NETWORK_ERRORS fallback, which only fires for an
    # error raised outside the transport.
    when(
        _contains_any("failed to resolve", "name or service not known", "nodename nor servname", "getaddrinfo failed")
    ).diagnose(
        "Host could not be resolved",
        fix="Check Host Port for typos and that DNS can resolve it from where ingestion runs.",
    ),
    when(_contains_any("connection refused")).diagnose(
        "Connection refused",
        fix="The host answered but nothing is listening on that port; check the port in Host Port "
        "and that the Looker API is served on it.",
    ),
    when(_contains_any("timed out", "timeout")).diagnose(
        "Connection timed out",
        fix="The host did not answer in time; check that a firewall, security group, or network ACL "
        "allows access to this host and port.",
    ),
    when(_contains_any("certificate verify failed", "sslerror", "ssl: ")).diagnose(
        "TLS verification failed",
        fix="The Looker instance's certificate could not be verified. Install a certificate trusted "
        "by the host running ingestion, or use a Host Port whose certificate validates.",
    ),
    when(_contains_any("max retries exceeded", "connection aborted", "connection error")).diagnose(
        "Cannot reach the host",
        fix="Check Host Port, the network route, and that the Looker instance is online and "
        "reachable from where ingestion runs.",
    ),
    # Looker itself serves this page when the hostname does not reach a running
    # instance, so it is a Looker answer even though it carries no error document.
    when(_contains_any("looker is unavailable")).diagnose(
        "The Looker instance is unavailable",
        fix="Looker answered but reported the instance as unavailable. Check that the instance is "
        "running and not in maintenance, and that Host Port matches its URL.",
    ),
    # Last: something answered, but not as Looker - the body carries no Looker error
    # document, so a real Looker 404 (which does, and is matched above) never lands here.
    when(_contains_any("404", "not found")).diagnose(
        "The host is not serving the Looker API",
        fix="A server answered but did not return a Looker error, so Host Port does not reach the "
        "Looker API. Check it points at the Looker instance, e.g. https://<instance>.cloud.looker.com "
        "(port 19999 on a self-hosted instance).",
    ),
).including(NETWORK_ERRORS)


class LookerChecks:
    """Test-connection checks for Looker.

    ``CheckAccess`` is the gate: the SDK logs in lazily on its first call, so bad
    API3 credentials or an unreachable host fail there and the remaining steps are
    skipped rather than each re-dialling the instance.

    ``connect`` is ``BaseConnection.client`` underneath, so every step shares the
    one client the connection owns and closes. It is a thunk rather than the
    client itself so the build - which reads the credentials into the environment
    - still happens inside the first check, never while the provider is assembled.
    """

    errors = LOOKER_ERRORS

    def __init__(self, connect: Callable[[], Looker40SDK]) -> None:
        self._connect = connect

    @check(DashboardStep.CheckAccess)
    def check_access(self) -> Evidence:
        return verify_access(
            lambda: self._connect().me(),
            command="log in and read the authenticated user",
        )

    @check(DashboardStep.ValidateVersion)
    def validate_version(self) -> Evidence:
        command = "list the API versions the instance supports"
        versions = call_endpoint(lambda: self._connect().versions(), command=command)
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
            lambda: self._connect().all_dashboards(fields="id,title"),
            noun="dashboard",
            command="list dashboards",
            empty_caveat=Diagnosis(
                title="No dashboards visible",
                remediation="The connection works but returned no dashboards. Confirm the API3 user "
                "has a role granting see_user_dashboards and access to the folders that hold them - "
                "an empty result can also mean the listing was filtered rather than genuinely empty.",
            ),
        )

    @check(DashboardStep.ListLookMLModels)
    def list_lookml_models(self) -> Evidence:
        return fetch_list(
            lambda: self._connect().all_lookml_models(limit=1),
            noun="LookML model",
            command="list LookML models",
            empty_caveat=Diagnosis(
                title="No LookML models visible",
                remediation="The connection works but returned no LookML model. Grant the API3 user "
                "a role with the see_lookml permission on the models to ingest; without them, "
                "lineage between dashboards and their source tables will not be present.",
            ),
        )


class LookerSettings(ApiSettings):
    """Feed the SDK this service's configuration directly.

    The SDK otherwise reads its host and credentials from the process
    environment, which a long-lived worker only populates once: every later
    Looker connection in that process would silently reuse the first one's host
    and credentials. Overriding ``read_config`` keeps each connection's settings
    to itself - the base class reads it at construction, and the SDK reads it
    again on each login.
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
    def _get_client(self) -> Looker40SDK:
        return looker_sdk.init40(config_settings=LookerSettings(self.service_connection))

    def checks(self) -> ChecksProvider:
        # Pass a thunk, not self.client: the checks then run against the one
        # client this connection owns, and its build still lands inside the gate.
        return LookerChecks(connect=lambda: self.client)
