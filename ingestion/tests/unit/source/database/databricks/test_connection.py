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
"""Unit tests for the Databricks BaseConnection wiring and test-connection checks."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.network import NetworkUnreachableError
from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection as DatabricksConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.databricks.connection import (
    DATABRICKS_ERRORS,
    DatabricksChecks,
    DatabricksConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.databricks.connection"


def _config() -> DatabricksConnectionConfig:
    return DatabricksConnectionConfig(
        hostPort="my-workspace.cloud.databricks.com:443",
        authType=PersonalAccessToken(token="dapi-secret"),
        httpPath="/sql/1.0/warehouses/abc123",
        catalog="my_catalog",
    )


class _SqlAlchemyError(Exception):
    """Mirror ``sqlalchemy.exc.DBAPIError``: wraps the driver error on ``.orig``."""

    def __init__(self, orig: Exception) -> None:
        super().__init__(str(orig))
        self.orig = orig


def test_databricks_connection_is_base_connection():
    assert issubclass(DatabricksConnection, BaseConnection)


def test_get_client_uses_the_databricks_url_builder():
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = DatabricksConnection(_config()).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_connection_url"


def test_close_disposes_the_engine_pool():
    engine = MagicMock()
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection", return_value=engine):
        connection = DatabricksConnection(_config())
        assert connection.client is engine
        connection.close()
    engine.dispose.assert_called_once_with()


def test_connection_timeout_drives_the_per_step_budget():
    from metadata.core.connections.test_connection.constants import STEP_TIMEOUT_SECONDS

    # connectionTimeout (default 120) must win over the 60s framework default,
    # fed through BaseConnection.step_timeout_seconds.
    default_config = _config()
    assert DatabricksConnection(default_config).step_timeout_seconds == default_config.connectionTimeout

    slow_config = _config()
    slow_config.connectionTimeout = 300
    assert DatabricksConnection(slow_config).step_timeout_seconds == 300

    unset_config = _config()
    unset_config.connectionTimeout = None
    assert DatabricksConnection(unset_config).step_timeout_seconds == STEP_TIMEOUT_SECONDS


def test_invalid_token_message_is_classified():
    error = _SqlAlchemyError(Exception("Error during request to server: Invalid access token"))
    assert DATABRICKS_ERRORS.classify(error).title == "Authentication failed"


def test_expired_token_message_is_classified():
    error = _SqlAlchemyError(Exception("the access token is expired, please refresh it"))
    assert DATABRICKS_ERRORS.classify(error).title == "Access token expired"


def test_forbidden_message_is_classified():
    error = _SqlAlchemyError(Exception("HTTP Response code: 403, Forbidden"))
    assert DATABRICKS_ERRORS.classify(error).title == "Access denied"


def test_malformed_http_path_is_classified():
    # A bad httpPath fails CheckAccess with MALFORMED_REQUEST; needs a diagnosis.
    error = _SqlAlchemyError(
        Exception(
            "MALFORMED_REQUEST: Path /sql/1.0/warehouses/39c390db3a5e19e must match pattern "
            "/sql/1.0/endpoints/<endpointId> or /sql/1.0/warehouses/<warehouseId>"
        )
    )
    assert DATABRICKS_ERRORS.classify(error).title == "Invalid HTTP path"


def test_permission_denied_is_classified():
    error = _SqlAlchemyError(Exception("[PERMISSION_DENIED] User does not have SELECT on system.access.table_lineage"))
    assert DATABRICKS_ERRORS.classify(error).title == "Insufficient privileges"


def test_insufficient_permissions_is_classified():
    error = _SqlAlchemyError(Exception("INSUFFICIENT_PERMISSIONS: requires USAGE on catalog"))
    assert DATABRICKS_ERRORS.classify(error).title == "Insufficient privileges"


def test_table_or_view_not_found_is_classified():
    error = _SqlAlchemyError(Exception("[TABLE_OR_VIEW_NOT_FOUND] The table or view cannot be found"))
    assert DATABRICKS_ERRORS.classify(error).title == "Table or view not found"


def test_schema_not_found_is_classified():
    error = _SqlAlchemyError(Exception("[SCHEMA_NOT_FOUND] The schema cannot be found"))
    assert DATABRICKS_ERRORS.classify(error).title == "Schema not found"


def test_catalog_does_not_exist_is_classified():
    error = _SqlAlchemyError(Exception("Catalog 'nope' does not exist"))
    assert DATABRICKS_ERRORS.classify(error).title == "Object not found"


def test_no_such_catalog_exception_is_classified():
    # NO_SUCH_CATALOG_EXCEPTION says "was not found", not "does not exist".
    error = _SqlAlchemyError(Exception("[NO_SUCH_CATALOG_EXCEPTION] Catalog 'batata' was not found. SQLSTATE: 42704"))
    assert DATABRICKS_ERRORS.classify(error).title == "Catalog not found"


def test_no_such_schema_exception_is_classified():
    error = _SqlAlchemyError(Exception("[NO_SUCH_SCHEMA_EXCEPTION] Schema 'nope' was not found"))
    assert DATABRICKS_ERRORS.classify(error).title == "Schema not found"


def test_network_errors_classify_through_including():
    error = NetworkUnreachableError("workspace:443 is not reachable")
    error.__cause__ = ConnectionRefusedError(61, "Connection refused")
    assert DATABRICKS_ERRORS.classify(error).title == "Connection refused"


def test_unknown_error_returns_no_diagnosis():
    error = _SqlAlchemyError(Exception("something entirely unexpected"))
    assert DATABRICKS_ERRORS.classify(error) is None


def test_checks_cover_exactly_the_seeded_steps():
    checks = DatabricksChecks(client=MagicMock(), service_connection=_config())
    collected = collect_checks(checks)
    assert set(collected.keys()) == {
        DatabaseStep.CheckAccess,
        DatabaseStep.GetDatabases,
        DatabaseStep.GetSchemas,
        DatabaseStep.GetTables,
        DatabaseStep.GetViews,
        DatabaseStep.GetQueries,
        DatabaseStep.GetViewDefinitions,
        DatabaseStep.GetCatalogTags,
        DatabaseStep.GetSchemaTags,
        DatabaseStep.GetTableTags,
        DatabaseStep.GetColumnTags,
        DatabaseStep.GetTableLineage,
        DatabaseStep.GetColumnLineage,
    }


def test_construction_does_not_touch_the_network():
    # Building the provider must not connect - that belongs in a gated check.
    engine = MagicMock()
    DatabricksChecks(client=engine, service_connection=_config())
    engine.connect.assert_not_called()


def test_construction_does_not_build_the_inspector():
    # Regression: inspect(engine) connects eagerly, so building it in __init__ would
    # connect before the gate (auth error escapes as a 500). Keep it lazy.
    with patch(f"{CONNECTION_MODULE}.inspect") as mock_inspect:
        checks = DatabricksChecks(client=MagicMock(), service_connection=_config())
        mock_inspect.assert_not_called()
        _ = checks._engine_wrapper.inspector
        mock_inspect.assert_called_once()


def test_check_access_probes_the_host_port_then_pings():
    checks = DatabricksChecks(client=MagicMock(), service_connection=_config())
    with (
        patch(f"{CONNECTION_MODULE}.tcp_probe") as mock_probe,
        patch(f"{CONNECTION_MODULE}.run_sql", return_value=MagicMock()) as mock_run,
    ):
        checks.check_access()
    mock_probe.assert_called_once_with("my-workspace.cloud.databricks.com", 443)
    assert mock_run.call_count == 1


def test_check_access_reports_unreachable_host_as_network_failure():
    checks = DatabricksChecks(client=MagicMock(), service_connection=_config())
    probe_error = NetworkUnreachableError("my-workspace.cloud.databricks.com:443 is not reachable")
    probe_error.__cause__ = ConnectionRefusedError(61, "Connection refused")
    with (
        patch(f"{CONNECTION_MODULE}.tcp_probe", side_effect=probe_error) as mock_probe,
        pytest.raises(CheckError) as exc,
    ):
        checks.check_access()
    mock_probe.assert_called_once_with("my-workspace.cloud.databricks.com", 443)
    assert exc.value.cause is probe_error
    assert DATABRICKS_ERRORS.classify(exc.value.cause).title == "Connection refused"


def test_probe_target_defaults_to_443_when_no_port():
    config = _config()
    config.hostPort = "my-workspace.cloud.databricks.com"
    checks = DatabricksChecks(client=MagicMock(), service_connection=config)
    assert checks._probe_target() == ("my-workspace.cloud.databricks.com", 443)


def test_first_catalog_uses_configured_catalog_without_querying():
    engine = MagicMock()
    checks = DatabricksChecks(client=engine, service_connection=_config())
    assert checks._first_catalog() == "my_catalog"
    engine.connect.assert_not_called()


def test_listing_caps_rows_at_the_sample_size_at_the_source():
    # Bound the fetch (fetchmany), not fetchall-then-slice. Test-connection only;
    # real ingestion goes through the common framework.
    from metadata.core.connections.test_connection.checks.database import (
        DEFAULT_SAMPLE_ROWS,
    )
    from metadata.ingestion.source.database.databricks.connection import (
        DatabricksEngineWrapper,
    )

    result = MagicMock()
    result.fetchmany.return_value = [("t",)]
    conn = MagicMock()
    conn.execute.return_value = result
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = conn

    wrapper = DatabricksEngineWrapper(engine)
    wrapper.first_catalog = "my_catalog"
    wrapper.first_schema = "my_schema"
    wrapper.get_tables()
    result.fetchmany.assert_called_once_with(DEFAULT_SAMPLE_ROWS)
    result.fetchall.assert_not_called()


def test_get_databases_reports_catalog_count():
    checks = DatabricksChecks(client=MagicMock(), service_connection=_config())
    with patch.object(
        checks._engine_wrapper, "get_catalogs", return_value=[("my_catalog",), ("other",)]
    ) as mock_catalogs:
        evidence = checks.get_databases()
    mock_catalogs.assert_called_once_with(catalog_name="my_catalog")
    assert evidence.summary == "2 catalogs enumerated"


def test_get_databases_failure_reports_the_attempted_command_as_evidence():
    config = _config()
    config.catalog = None
    checks = DatabricksChecks(client=MagicMock(), service_connection=config)
    with (
        patch.object(checks._engine_wrapper, "get_catalogs", side_effect=Exception("boom")),
        pytest.raises(CheckError) as exc,
    ):
        checks.get_databases()
    assert exc.value.evidence.command == "SHOW CATALOGS"


def test_get_databases_omits_the_command_when_catalog_is_configured():
    # A configured catalog is trusted without running SHOW CATALOGS.
    checks = DatabricksChecks(client=MagicMock(), service_connection=_config())
    with patch.object(checks._engine_wrapper, "get_catalogs", return_value=[("my_catalog",)]):
        evidence = checks.get_databases()
    assert evidence.command is None


def test_probe_target_strips_a_pasted_url_scheme_and_path():
    # A pasted workspace URL must not reach the socket probe as the host, or the
    # gate fails with a misleading DNS error before the driver.
    config = _config()
    config.hostPort = "https://my-workspace.cloud.databricks.com:443/sql/1.0/warehouses/x"
    checks = DatabricksChecks(client=MagicMock(), service_connection=config)
    assert checks._probe_target() == ("my-workspace.cloud.databricks.com", 443)


def test_connection_url_strips_a_pasted_url_scheme():
    from urllib.parse import urlparse

    from metadata.ingestion.source.database.databricks.connection import get_connection_url

    config = _config()
    config.hostPort = "https://my-workspace.cloud.databricks.com:443"
    parsed = urlparse(get_connection_url(config))
    assert parsed.hostname == "my-workspace.cloud.databricks.com"
    assert parsed.port == 443


def test_auth_host_derivation_strips_a_pasted_scheme():
    # OAuth/Azure-AD derive the workspace host from hostPort too; a pasted scheme
    # must not leak in as the host or auth fails before the driver.
    from metadata.ingestion.source.database.databricks.auth import _host, normalize_host_port

    assert normalize_host_port("https://ws.cloud.databricks.com:443/sql/x") == "ws.cloud.databricks.com:443"
    connection = MagicMock()
    connection.hostPort = "https://ws.cloud.databricks.com:443"
    assert _host(connection) == "ws.cloud.databricks.com"


def test_schema_scoped_get_schemas_skips_use_catalog_when_catalog_unresolved():
    # first_catalog None (GetDatabases failed/skipped) must not emit USE CATALOG `None`.
    from metadata.ingestion.source.database.databricks.connection import (
        DatabricksEngineWrapper,
    )

    engine = MagicMock()
    wrapper = DatabricksEngineWrapper(engine)
    wrapper.first_catalog = None
    assert wrapper.get_schemas(schema_name="my_schema") == ["my_schema"]
    engine.connect.assert_not_called()


def test_get_tables_returns_empty_when_catalog_unresolved():
    from metadata.ingestion.source.database.databricks.connection import (
        DatabricksEngineWrapper,
    )

    engine = MagicMock()
    wrapper = DatabricksEngineWrapper(engine)
    wrapper.first_catalog = None
    wrapper.first_schema = "my_schema"
    assert wrapper.get_tables() == []
    engine.connect.assert_not_called()
