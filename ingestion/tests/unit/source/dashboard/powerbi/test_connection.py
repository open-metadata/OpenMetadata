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
"""Unit tests for Power BI test-connection checks."""

import json
import socket
from unittest.mock import MagicMock, patch

import pytest
import requests
from requests.exceptions import HTTPError

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.dashboard import DashboardStep
from metadata.core.connections.test_connection.constants import STEP_TIMEOUT_SECONDS
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection as PowerBIConnectionConfig,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.dashboard.powerbi.client import PowerBiApiClient, PowerBiApiError
from metadata.ingestion.source.dashboard.powerbi.connection import (
    POWERBI_ERRORS,
    PowerBIChecks,
    PowerBIConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.dashboard.powerbi.connection"


def _api_error(status_code: int, message: str = "boom") -> PowerBiApiError:
    """The error the test-connection path really raises on a non-success status.

    Previously this built an ometa APIError from {"code": ..., "message": ...} - a
    TOP-LEVEL code, which is the OM server's own error contract, not Power BI's wire
    format. Power BI nests code under "error", so ometa never builds an APIError for
    it; the shape was unreachable. PowerBiApiError is what _test_get raises, and it
    carries the status on .status_code where the http_status matcher reads it.
    """
    return PowerBiApiError(status_code, "/myorg/admin/dashboards", message)


def _raw_http_error(status_code: int) -> HTTPError:
    """A bare requests.HTTPError as the client re-raises when the body has no
    'code' field - status lives on .response.status_code, not .status_code."""
    response = MagicMock()
    response.status_code = status_code
    return HTTPError("server said no", response=response)


def _checks() -> tuple[PowerBIChecks, MagicMock]:
    """A provider over a borrowed client - the one its connection owns."""
    api_client = MagicMock()
    powerbi_client = MagicMock(api_client=api_client)
    return PowerBIChecks(powerbi=Borrowed.of(powerbi_client)), api_client


def test_powerbi_connection_is_base_connection():
    assert issubclass(PowerBIConnection, BaseConnection)


def test_checks_does_not_touch_the_network():
    with patch(f"{CONNECTION_MODULE}.PowerBiApiClient") as mock_client:
        conn = PowerBIConnection(MagicMock())
        provider = conn.checks()

    assert isinstance(provider, PowerBIChecks)
    mock_client.assert_not_called()


def test_checks_reuse_the_connections_client_and_never_authenticate_twice():
    # The provider borrows the client its connection owns, so the checks and the
    # ingestion share one authenticated session instead of acquiring a second token.
    with patch(f"{CONNECTION_MODULE}.PowerBiApiClient") as mock_client:
        # PowerBiClient validates its api_client field, so the fake must carry the spec.
        mock_client.return_value = MagicMock(spec=PowerBiApiClient)
        conn = PowerBIConnection(MagicMock(pbitFilesSource=None))
        provider = conn.checks()

        provider.check_access()
        provider.get_dashboards()

    assert mock_client.call_count == 1


def test_collect_checks_maps_every_step():
    provider, _ = _checks()
    collected = collect_checks(provider)

    assert set(collected) == {DashboardStep.CheckAccess, DashboardStep.GetDashboards}


def test_check_access_authenticates():
    provider, client = _checks()
    client.get_auth_token.return_value = ("token", "3600")

    evidence = provider.check_access()

    client.get_auth_token.assert_called_once_with()
    assert evidence.summary == "authenticated"
    assert evidence.command == "acquire OAuth token"


def test_check_access_wraps_failure_as_check_error():
    provider, client = _checks()
    client.get_auth_token.side_effect = InvalidSourceException("no token")

    with pytest.raises(CheckError) as exc_info:
        provider.check_access()

    assert isinstance(exc_info.value.cause, InvalidSourceException)
    assert exc_info.value.evidence.command == "acquire OAuth token"


def test_get_dashboards_counts_results():
    provider, client = _checks()
    client.test_fetch_dashboards.return_value = [object(), object(), object()]

    evidence = provider.get_dashboards()

    assert evidence.summary == "3 dashboards enumerated"
    assert evidence.command == "fetch dashboards"


def test_get_dashboards_caps_the_count():
    provider, client = _checks()
    client.test_fetch_dashboards.return_value = [object()] * 250

    evidence = provider.get_dashboards()

    assert evidence.summary == "100+ dashboards enumerated"
    assert evidence.caveat is None


def test_get_dashboards_at_cap_shows_plus():
    provider, client = _checks()
    client.test_fetch_dashboards.return_value = [object()] * 100

    evidence = provider.get_dashboards()

    assert evidence.summary == "100+ dashboards enumerated"


def test_get_dashboards_empty_passes_with_caveat():
    provider, client = _checks()
    client.test_fetch_dashboards.return_value = None

    evidence = provider.get_dashboards()

    assert evidence.summary == "no dashboards enumerated"
    assert evidence.caveat is not None
    assert evidence.caveat.title == "No dashboards visible"


def test_get_dashboards_wraps_failure_as_check_error():
    provider, client = _checks()
    client.test_fetch_dashboards.side_effect = _api_error(403)

    with pytest.raises(CheckError) as exc_info:
        provider.get_dashboards()

    assert exc_info.value.evidence.command == "fetch dashboards"


def test_get_dashboards_wraps_client_build_failure():
    # Reading the borrow is what builds the client (MSAL discovery), and that read
    # happens inside fetch_list's try, so a build failure still reports the step's
    # command rather than escaping raw.
    provider = PowerBIChecks(powerbi=Borrowed(MagicMock(side_effect=ValueError("authority discovery failed"))))

    with pytest.raises(CheckError) as exc_info:
        provider.get_dashboards()

    assert exc_info.value.evidence.command == "fetch dashboards"
    assert isinstance(exc_info.value.cause, ValueError)


@pytest.mark.parametrize(
    ("error", "title"),
    [
        (_api_error(401), "Power BI did not authorize the service principal"),
        (InvalidSourceException("bad creds"), "Authentication failed"),
        (_api_error(403), "Insufficient permissions"),
        (_api_error(404), "Resource not found"),
        (_raw_http_error(401), "Power BI did not authorize the service principal"),
        (_raw_http_error(403), "Insufficient permissions"),
        (_raw_http_error(404), "Resource not found"),
        # A status-coded 401 whose message echoes the authority URL must classify
        # by its status, not be shadowed by the broad 'authority' matcher.
        (
            _api_error(401, "AADSTS700016 https://login.microsoftonline.com/<tenant> authority"),
            "Power BI did not authorize the service principal",
        ),
        (ValueError("Unable to get authority configuration for https://login..."), "Invalid tenant or authority"),
        (ValueError("invalid_instance: The authority you provided is not known"), "Invalid tenant or authority"),
        (
            ValueError("Your given address (https://login...) should consist of an https url"),
            "Invalid tenant or authority",
        ),
        (socket.gaierror("name resolution failed"), "Host could not be resolved"),
    ],
)
def test_error_pack_classifies(error, title):
    diagnosis = POWERBI_ERRORS.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == title


def test_error_pack_ignores_unknown_error():
    assert POWERBI_ERRORS.classify(ValueError("something else")) is None


# ── Driving the real PowerBiApiClient against Power BI's real error envelope ──
#
# Everything above mocks the api_client, so it proves only that the provider calls
# it. These drive the real client and the real ometa REST plumbing, stubbing only
# requests.Session.request, against the envelope Microsoft documents.


@pytest.fixture
def real_api_client():
    """A real PowerBiApiClient over the real ometa REST plumbing.

    Only the two things that would really dial out are stubbed: MSAL (whose
    ConfidentialClientApplication does authority discovery at construction) and the
    token acquisition. The subject under test is what the client does with Power
    BI's *reply*, so everything from the request down is real. get_auth_token is
    patched on the class because ClientConfig captures the bound method at
    construction, before an instance attribute could take effect.
    """
    config = PowerBIConnectionConfig(clientId="cid", clientSecret="secret", tenantId="tid")
    with (
        patch("metadata.ingestion.source.dashboard.powerbi.client.msal.ConfidentialClientApplication"),
        patch.object(PowerBiApiClient, "get_auth_token", return_value=("token", 3600)),
    ):
        yield PowerBiApiClient(config)


def _powerbi_error_response(status_code: int, code: str, message: str) -> requests.Response:
    """A real Power BI error reply.

    The envelope is the one Microsoft documents for the Power BI REST API:
        {"error":{"code":"TokenExpired","message":"Access token has expired, ..."}}
    quoted verbatim against a 403 in
    https://learn.microsoft.com/en-us/power-bi/developer/embedded/troubleshoot-rest-api

    This shape is exactly what defeats ometa's REST._request: it tests for a
    TOP-LEVEL "code" key, but Power BI nests code under "error", so neither branch
    raises and the request decays to None.
    """
    response = requests.Response()
    response.status_code = status_code
    response._content = json.dumps({"error": {"code": code, "message": message}}).encode()
    response.headers["content-type"] = "application/json"
    response.url = "https://api.powerbi.com/v1.0/myorg/admin/dashboards"
    return response


@pytest.mark.parametrize(
    ("status_code", "code", "title"),
    [
        (401, "PowerBINotAuthorizedException", "Power BI did not authorize the service principal"),
        (403, "TokenExpired", "Insufficient permissions"),
        (404, "ItemNotFound", "Resource not found"),
    ],
)
def test_a_real_powerbi_error_envelope_reaches_the_status_rules(real_api_client, status_code, code, title):
    """Regression: ometa's REST._request looks for a TOP-LEVEL "code"; Power BI nests
    it under "error", so the request decayed to None and the step died with a bare
    TypeError carrying no status. The status must reach the classifier."""
    provider = PowerBIChecks(powerbi=Borrowed.of(MagicMock(api_client=real_api_client)))

    with (
        patch.object(requests.Session, "request", return_value=_powerbi_error_response(status_code, code, "denied")),
        pytest.raises(CheckError) as failure,
    ):
        provider.get_dashboards()

    diagnosis = POWERBI_ERRORS.classify(failure.value.cause)
    assert diagnosis is not None, f"a {status_code} produced no diagnosis: {failure.value.cause!r}"
    assert diagnosis.title == title


# Real MSAL client-credentials error payloads. MSAL returns the token endpoint's
# error document as a dict rather than raising, and PowerBiApiClient interpolates
# that dict into the InvalidSourceException message - which is what makes the
# AADSTS code matchable text. Code meanings verified against
# https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes
_MSAL_BAD_SECRET = {
    "error": "invalid_client",
    "error_description": (
        "AADSTS7000215: Invalid client secret provided. Ensure the secret being sent in the request "
        "is the client secret value, not the client secret ID, for a secret added to app "
        "'11111111-1111-1111-1111-111111111111'."
    ),
    "error_codes": [7000215],
}
_MSAL_APP_NOT_IN_TENANT = {
    "error": "unauthorized_client",
    "error_description": (
        "AADSTS700016: Application with identifier '11111111-1111-1111-1111-111111111111' was not "
        "found in the directory 'contoso'. This can happen if the application has not been installed "
        "by the administrator of the tenant or consented to by any user in the tenant."
    ),
    "error_codes": [700016],
}
_MSAL_TENANT_NOT_FOUND = {
    "error": "invalid_request",
    "error_description": "AADSTS90002: Tenant 'nope' not found. Check to make sure you have the correct tenant ID.",
    "error_codes": [90002],
}


@pytest.mark.parametrize(
    ("msal_response", "title"),
    [
        (_MSAL_BAD_SECRET, "Invalid client secret"),
        (_MSAL_APP_NOT_IN_TENANT, "Application not found in this tenant"),
        (_MSAL_TENANT_NOT_FOUND, "Tenant not found"),
    ],
)
def test_a_token_failure_is_diagnosed_by_its_aadsts_code(msal_response, title):
    """Drive the real get_auth_token so the AADSTS code reaches the pack the way it
    really does: MSAL hands back an error dict, the client interpolates it into the
    InvalidSourceException message."""
    config = PowerBIConnectionConfig(clientId="cid", clientSecret="secret", tenantId="tid")
    with patch("metadata.ingestion.source.dashboard.powerbi.client.msal.ConfidentialClientApplication") as msal_app:
        msal_app.return_value.acquire_token_silent.return_value = None
        msal_app.return_value.acquire_token_for_client.return_value = msal_response
        client = PowerBiApiClient(config)
        provider = PowerBIChecks(powerbi=Borrowed.of(MagicMock(api_client=client)))

        with pytest.raises(CheckError) as failure:
            provider.check_access()

    diagnosis = POWERBI_ERRORS.classify(failure.value.cause)
    assert diagnosis is not None
    assert diagnosis.title == title
    assert diagnosis.remediation


def test_the_non_admin_path_resolves_a_group_then_lists_its_dashboards():
    """useAdminApis=False takes the /myorg/groups -> /myorg/groups/<id>/dashboards
    route; both hops must go through the strict accessor."""
    config = PowerBIConnectionConfig(clientId="cid", clientSecret="secret", tenantId="tid", useAdminApis=False)
    groups = requests.Response()
    groups.status_code = 200
    groups._content = json.dumps(
        {
            "@odata.context": "http://api.powerbi.com/v1.0/myorg/$metadata#groups",
            "@odata.count": 1,
            "value": [{"id": "g1", "name": "Workspace 1"}],
        }
    ).encode()
    dashboards = requests.Response()
    dashboards.status_code = 200
    dashboards._content = json.dumps(
        {
            "@odata.context": "http://api.powerbi.com/v1.0/myorg/$metadata#dashboards",
            "value": [{"id": "d1"}, {"id": "d2"}],
        }
    ).encode()

    with (
        patch("metadata.ingestion.source.dashboard.powerbi.client.msal.ConfidentialClientApplication"),
        patch.object(PowerBiApiClient, "get_auth_token", return_value=("token", 3600)),
    ):
        client = PowerBiApiClient(config)
        provider = PowerBIChecks(powerbi=Borrowed.of(MagicMock(api_client=client)))
        with patch.object(requests.Session, "request", side_effect=[groups, dashboards]):
            evidence = provider.get_dashboards()

    assert evidence.summary == "2 dashboards enumerated"


def test_the_non_admin_path_surfaces_a_group_listing_failure():
    """A 403 on the first hop must fail the step, not decay into "no dashboards"."""
    config = PowerBIConnectionConfig(clientId="cid", clientSecret="secret", tenantId="tid", useAdminApis=False)

    with (
        patch("metadata.ingestion.source.dashboard.powerbi.client.msal.ConfidentialClientApplication"),
        patch.object(PowerBiApiClient, "get_auth_token", return_value=("token", 3600)),
    ):
        client = PowerBiApiClient(config)
        provider = PowerBIChecks(powerbi=Borrowed.of(MagicMock(api_client=client)))
        with (
            patch.object(
                requests.Session,
                "request",
                return_value=_powerbi_error_response(403, "TokenExpired", "denied"),
            ),
            pytest.raises(CheckError) as failure,
        ):
            provider.get_dashboards()

    assert POWERBI_ERRORS.classify(failure.value.cause).title == "Insufficient permissions"


def test_an_unrecognised_token_failure_keeps_the_generic_auth_diagnosis():
    """The AADSTS rules are additive: a token failure with no code we know must
    still be diagnosed, not fall through to nothing."""
    error = InvalidSourceException("Failed to generate the PowerBi access token. Please check provided config {}")
    assert POWERBI_ERRORS.classify(error).title == "Authentication failed"


def test_an_aadsts_code_in_a_rest_error_does_not_shadow_its_status():
    """The AADSTS rules are gated on InvalidSourceException, so a status-coded REST
    failure whose body echoes a code still classifies by status."""
    error = _api_error(403, "AADSTS700016 mentioned in a proxy error body")
    assert POWERBI_ERRORS.classify(error).title == "Insufficient permissions"


def test_a_rate_limited_call_is_bounded_in_time(real_api_client):
    """Regression: an exhausted 429 slept ~42h (~2.8h with only retry_wait capped) -
    the sleep grows per attempt, so the retry count dominates."""
    provider = PowerBIChecks(powerbi=Borrowed.of(MagicMock(api_client=real_api_client)))
    slept: list[float] = []

    with (
        patch.object(requests.Session, "request", return_value=_powerbi_error_response(429, "TooManyRequests", "slow")),
        patch("metadata.ingestion.ometa.client.time.sleep", side_effect=slept.append),
        pytest.raises(CheckError),
    ):
        provider.get_dashboards()

    assert sum(slept) <= STEP_TIMEOUT_SECONDS, f"a rate-limited step slept {sum(slept)}s"


def test_a_rate_limited_call_reports_a_diagnosis_and_a_readable_error(real_api_client):
    """An exhausted 429 arrives as LimitsException, raised with no message - so
    str() is empty and the step's errorLog would be blank. It must still name the
    status and say something."""
    provider = PowerBIChecks(powerbi=Borrowed.of(MagicMock(api_client=real_api_client)))

    with (
        patch.object(requests.Session, "request", return_value=_powerbi_error_response(429, "TooManyRequests", "slow")),
        patch("metadata.ingestion.ometa.client.time.sleep"),
        pytest.raises(CheckError) as failure,
    ):
        provider.get_dashboards()

    cause = failure.value.cause
    assert POWERBI_ERRORS.classify(cause).title == "Rate limited by Power BI"
    assert str(cause), "the step's errorLog would be empty"
    assert "429" in str(cause)


def test_a_two_hundred_carrying_only_a_message_is_diagnosed(real_api_client):
    """Power BI can answer 200 with a bare {"message": ...}. response.ok is True, so
    without a guard the model raises an unclassifiable ValidationError."""
    provider = PowerBIChecks(powerbi=Borrowed.of(MagicMock(api_client=real_api_client)))
    response = requests.Response()
    response.status_code = 200
    response._content = json.dumps({"message": "API is not accessible for application"}).encode()
    response.headers["content-type"] = "application/json"

    with (
        patch.object(requests.Session, "request", return_value=response),
        pytest.raises(CheckError) as failure,
    ):
        provider.get_dashboards()

    assert isinstance(failure.value.cause, PowerBiApiError)
    assert "API is not accessible" in str(failure.value.cause)


def test_a_successful_dashboard_listing_is_counted(real_api_client):
    """The counterpart: a real 200 payload still passes and is counted."""
    provider = PowerBIChecks(powerbi=Borrowed.of(MagicMock(api_client=real_api_client)))
    response = requests.Response()
    response.status_code = 200
    # The shape Power BI returns for GET /admin/dashboards: an OData envelope.
    response._content = json.dumps(
        {
            "@odata.context": "http://api.powerbi.com/v1.0/myorg/$metadata#dashboards",
            "value": [{"id": "d1", "displayName": "D1"}],
        }
    ).encode()
    response.headers["content-type"] = "application/json"

    with patch.object(requests.Session, "request", return_value=response):
        evidence = provider.get_dashboards()

    assert evidence.summary == "1 dashboard enumerated"
