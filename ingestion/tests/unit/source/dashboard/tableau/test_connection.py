"""Unit tests for Tableau test-connection checks."""

import socket
from unittest.mock import MagicMock, patch

import pytest
from requests.exceptions import HTTPError, SSLError
from tableauserverclient.server.endpoint.exceptions import ServerResponseError

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.dashboard import DashboardStep
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.dashboard.tableau.client import (
    TableauChartsException,
    TableauDataModelsException,
    TableauOwnersNotFound,
    TableauWorkBookException,
)
from metadata.ingestion.source.dashboard.tableau.connection import (
    TABLEAU_ERRORS,
    TableauChecks,
    TableauConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.dashboard.tableau.connection"


def _server_error(code: str) -> ServerResponseError:
    """A Tableau REST error: its code prefixes the HTTP status, e.g. 401002."""
    return ServerResponseError(code, "summary", "detail")


def _raw_http_error(status_code: int) -> HTTPError:
    response = MagicMock()
    response.status_code = status_code
    return HTTPError("server said no", response=response)


def _checks(get_connection) -> tuple[TableauChecks, MagicMock]:
    """A provider whose lazily-built client is the returned mock."""
    client = MagicMock()
    get_connection.return_value = client
    return TableauChecks(connection=MagicMock()), client


def test_tableau_connection_is_base_connection():
    assert issubclass(TableauConnection, BaseConnection)


def test_get_client_delegates_to_get_connection():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        conn = TableauConnection(MagicMock())
        client = conn.client

    assert client is mock_get.return_value
    mock_get.assert_called_once_with(conn.service_connection)


def test_checks_does_not_touch_the_network():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        conn = TableauConnection(MagicMock())
        provider = conn.checks()

    assert isinstance(provider, TableauChecks)
    mock_get.assert_not_called()


def test_collect_checks_maps_every_step():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, _ = _checks(mock_get)
    collected = collect_checks(provider)

    assert set(collected) == {
        DashboardStep.ServerInfo,
        DashboardStep.ValidateApiVersion,
        DashboardStep.ValidateSiteUrl,
        DashboardStep.GetWorkbooks,
        DashboardStep.GetViews,
        DashboardStep.GetOwners,
        DashboardStep.GetDataModels,
    }


def test_client_is_built_once_and_shared_across_checks():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, _ = _checks(mock_get)
        provider.server_info()
        provider.get_workbooks()

    mock_get.assert_called_once_with(provider._connection)


def test_server_info_signs_in():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)

        evidence = provider.server_info()

    client.server_info.assert_called_once_with()
    assert evidence.summary == "authenticated"
    assert evidence.command == "sign in and read server info"


def test_server_info_wraps_sign_in_failure_as_check_error():
    # Signing in happens inside the gate check, so bad credentials surface as a
    # classified ServerInfo failure instead of escaping while the provider is built.
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider = TableauChecks(connection=MagicMock())
        mock_get.side_effect = _server_error("401001")

        with pytest.raises(CheckError) as exc_info:
            provider.server_info()

    assert isinstance(exc_info.value.cause, ServerResponseError)
    assert exc_info.value.evidence.command == "sign in and read server info"


def test_validate_api_version_reports_the_version():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)
        client.server_api_version.return_value = "3.19"

        evidence = provider.validate_api_version()

    assert evidence.summary == "REST API version 3.19"
    assert evidence.command == "read the server REST API version"


def test_validate_site_url_passes():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)

        evidence = provider.validate_site_url()

    client.test_site_url.assert_called_once_with()
    assert evidence.summary == "site name is well formed"


def test_validate_site_url_wraps_failure_as_check_error():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)
        client.test_site_url.side_effect = ValueError('The site url "https://x" is in incorrect format.')

        with pytest.raises(CheckError) as exc_info:
            provider.validate_site_url()

    assert exc_info.value.evidence.command == "validate the configured site name"


def test_get_workbooks_passes():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)

        evidence = provider.get_workbooks()

    client.test_get_workbooks.assert_called_once_with()
    assert evidence.summary == "workbooks are readable"


def test_get_workbooks_wraps_failure_as_check_error():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)
        client.test_get_workbooks.side_effect = TableauWorkBookException("no workbooks")

        with pytest.raises(CheckError) as exc_info:
            provider.get_workbooks()

    assert exc_info.value.evidence.command == "fetch workbooks"
    assert isinstance(exc_info.value.cause, TableauWorkBookException)


def test_get_views_passes():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)

        evidence = provider.get_views()

    client.test_get_workbook_views.assert_called_once_with()
    assert evidence.summary == "workbook views are readable"


def test_get_owners_passes():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)

        evidence = provider.get_owners()

    client.test_get_owners.assert_called_once_with()
    assert evidence.summary == "workbook owners are resolvable"


def test_get_data_models_passes():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)

        evidence = provider.get_data_models()

    client.test_get_datamodels.assert_called_once_with()
    assert evidence.summary == "data sources are readable"
    assert evidence.command == "query the Metadata API for the data sources of a workbook"


def test_get_data_models_wraps_failure_as_check_error():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)
        client.test_get_datamodels.side_effect = TableauDataModelsException("metadata api off")

        with pytest.raises(CheckError) as exc_info:
            provider.get_data_models()

    assert isinstance(exc_info.value.cause, TableauDataModelsException)


@pytest.mark.parametrize(
    ("error", "title"),
    [
        (_server_error("401001"), "Authentication failed"),
        (_server_error("401002"), "Authentication failed"),
        (_server_error("403004"), "Insufficient permissions"),
        (_server_error("404000"), "Resource not found"),
        (_raw_http_error(401), "Authentication failed"),
        (_raw_http_error(403), "Insufficient permissions"),
        (_raw_http_error(404), "Resource not found"),
        (SSLError("certificate verify failed"), "TLS verification failed"),
        (TableauWorkBookException("nope"), "No workbooks visible"),
        (TableauChartsException("nope"), "No views visible"),
        (TableauOwnersNotFound("nope"), "Owner information not available"),
        (TableauDataModelsException("nope"), "Data sources could not be read"),
        (ValueError('The site url "https://x" is in incorrect format.'), "Invalid Site Name"),
        (socket.gaierror("name resolution failed"), "Host could not be resolved"),
    ],
)
def test_error_pack_classifies(error, title):
    diagnosis = TABLEAU_ERRORS.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == title


def test_error_pack_classifies_a_wrapped_cause():
    # get_connection re-raises a sign-in failure as SourceConnectionException; the
    # Tableau error survives in the cause chain and still classifies.
    wrapper = RuntimeError("Unknown error connecting")
    wrapper.__cause__ = _server_error("401001")

    diagnosis = TABLEAU_ERRORS.classify(wrapper)

    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_error_pack_ignores_unknown_error():
    assert TABLEAU_ERRORS.classify(ValueError("something else")) is None
