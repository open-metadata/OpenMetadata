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
"""Unit tests for the Unity Catalog BaseConnection wiring and test-connection checks."""

import socket
from unittest.mock import MagicMock, patch

import pytest
from databricks.sdk.errors import PermissionDenied, ResourceDoesNotExist, Unauthenticated

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.network import NetworkUnreachableError
from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection as UnityCatalogConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.unitycatalog.connection import (
    LINEAGE_PROBE_COMMAND,
    UNITY_CATALOG_ERRORS,
    UnityCatalogChecks,
    UnityCatalogConnection,
    get_connection,
    get_connection_url,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.unitycatalog.connection"

EXPECTED_STEPS = [
    DatabaseStep.CheckAccess,
    DatabaseStep.GetDatabases,
    DatabaseStep.GetSchemas,
    DatabaseStep.GetTables,
    DatabaseStep.GetViews,
    DatabaseStep.GetQueries,
    DatabaseStep.GetTags,
]


def _config(**overrides) -> UnityCatalogConnectionConfig:
    defaults = {
        "hostPort": "my-workspace.cloud.databricks.com:443",
        "authType": PersonalAccessToken(token="dapi-secret"),
    }
    defaults.update(overrides)
    return UnityCatalogConnectionConfig(**defaults)


def _named(name: str, **attributes) -> MagicMock:
    mock = MagicMock(**attributes)
    mock.name = name
    return mock


WAREHOUSE = {"httpPath": "/sql/1.0/warehouses/abc123"}


def _checks(client: MagicMock, sql: MagicMock | None = None, **config_overrides) -> UnityCatalogChecks:
    """A provider over two borrowed clients: the workspace client and the
    SQL-warehouse engine, each owned by its own connection."""
    return UnityCatalogChecks(
        workspace=Borrowed.of(client),
        sql=Borrowed.of(sql if sql is not None else MagicMock()),
        service_connection=_config(**config_overrides),
    )


def test_unitycatalog_connection_is_base_connection():
    assert issubclass(UnityCatalogConnection, BaseConnection)


def test_get_client_delegates_to_the_workspace_client_builder():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get_connection:
        client = UnityCatalogConnection(_config()).client

    mock_get_connection.assert_called_once()
    assert client is mock_get_connection.return_value


def test_checks_exposes_the_provider_without_touching_the_network():
    with (
        patch(f"{CONNECTION_MODULE}.get_connection") as mock_get_connection,
        patch(f"{CONNECTION_MODULE}.get_sqlalchemy_connection") as mock_engine,
    ):
        provider = UnityCatalogConnection(_config()).checks()

    assert isinstance(provider, UnityCatalogChecks)
    # Neither client is built while the provider is assembled: both are borrowed.
    mock_get_connection.assert_not_called()
    mock_engine.assert_not_called()


def test_checks_borrow_the_clients_their_connections_own():
    with (
        patch(f"{CONNECTION_MODULE}.get_connection") as mock_get_connection,
        patch(f"{CONNECTION_MODULE}.get_sqlalchemy_connection") as mock_engine,
    ):
        connection = UnityCatalogConnection(_config())
        provider = connection.checks()

        assert provider._workspace.client is connection.client
        assert provider._sql.client is connection.sql.client

    # One workspace client, one engine - each built once, by its owner.
    assert mock_get_connection.call_count == 1
    assert mock_engine.call_count == 1


def test_sql_engine_is_never_built_when_no_warehouse_step_runs():
    # The lineage and tag steps need a SQL warehouse; a workspace configured
    # without an httpPath must never pay for an engine it does not use.
    with (
        patch(f"{CONNECTION_MODULE}.get_connection"),
        patch("metadata.core.connections.test_connection.network.tcp_probe"),
        patch(f"{CONNECTION_MODULE}.get_sqlalchemy_connection") as mock_engine,
    ):
        provider = UnityCatalogConnection(_config()).checks()
        provider.check_access()

    mock_engine.assert_not_called()


def test_closing_the_connection_disposes_the_sql_engine():
    engine = MagicMock()
    with (
        patch(f"{CONNECTION_MODULE}.get_connection"),
        patch(f"{CONNECTION_MODULE}.get_sqlalchemy_connection", return_value=engine),
    ):
        connection = UnityCatalogConnection(_config())
        _ = connection.sql.client
        connection.close()

    engine.dispose.assert_called_once_with()


def test_connection_timeout_drives_the_per_step_budget():
    with patch(f"{CONNECTION_MODULE}.get_connection"):
        connection = UnityCatalogConnection(_config(connectionTimeout=300))

    assert connection.step_timeout_seconds == 300


def test_every_definition_step_resolves_to_a_check():
    resolved = collect_checks(_checks(MagicMock()))

    assert sorted(resolved) == sorted(EXPECTED_STEPS)


class TestHostNormalization:
    # The probe, the WorkspaceClient, and the SQLAlchemy URL must all derive the same
    # host, so a pasted workspace URL resolves consistently instead of one path seeing
    # a mangled value.
    @pytest.mark.parametrize(
        "host_port",
        [
            "https://my-workspace.cloud.databricks.com",
            "https://my-workspace.cloud.databricks.com/sql/1.0/warehouses/abc",
            "my-workspace.cloud.databricks.com",
        ],
    )
    def test_workspace_client_host_is_normalized(self, host_port):
        with patch(f"{CONNECTION_MODULE}.WorkspaceClient") as mock_client:
            get_connection(_config(hostPort=host_port))

        assert mock_client.call_args.kwargs["host"] == "my-workspace.cloud.databricks.com"

    def test_connection_url_normalizes_the_host(self):
        url = get_connection_url(_config(hostPort="https://my-workspace.cloud.databricks.com/sql/x"))

        assert "://my-workspace.cloud.databricks.com" in url
        assert "https://" not in url.split("://", 1)[1]


class TestCheckAccess:
    def test_probes_the_host_before_listing_catalogs(self):
        client = MagicMock()
        with patch("metadata.core.connections.test_connection.network.tcp_probe") as mock_probe:
            evidence = _checks(client).check_access()

        mock_probe.assert_called_once_with("my-workspace.cloud.databricks.com", 443)
        assert evidence.summary == "connection established"
        assert evidence.command == "catalogs.list()"

    def test_defaults_to_port_443_when_host_port_omits_the_port(self):
        with patch("metadata.core.connections.test_connection.network.tcp_probe") as mock_probe:
            _checks(MagicMock(), hostPort="my-workspace.cloud.databricks.com").check_access()

        mock_probe.assert_called_once_with("my-workspace.cloud.databricks.com", 443)

    @pytest.mark.parametrize(
        "host_port",
        [
            "https://my-workspace.cloud.databricks.com",
            "https://my-workspace.cloud.databricks.com/sql/1.0/warehouses/abc",
            "my-workspace.cloud.databricks.com",
        ],
    )
    def test_normalizes_a_pasted_workspace_url_before_probing(self, host_port):
        with patch("metadata.core.connections.test_connection.network.tcp_probe") as mock_probe:
            _checks(MagicMock(), hostPort=host_port).check_access()

        mock_probe.assert_called_once_with("my-workspace.cloud.databricks.com", 443)

    def test_unreachable_host_fails_before_the_client_is_used(self):
        client = MagicMock()
        with (
            patch(
                "metadata.core.connections.test_connection.network.tcp_probe",
                side_effect=NetworkUnreachableError("down"),
            ),
            pytest.raises(CheckError) as failure,
        ):
            _checks(client).check_access()

        assert failure.value.evidence.command == "TCP connect my-workspace.cloud.databricks.com:443"
        client.catalogs.list.assert_not_called()

    def test_rejected_credentials_surface_as_a_check_error_with_the_command(self):
        client = MagicMock()
        client.catalogs.list.side_effect = Unauthenticated("invalid access token")
        with patch("metadata.core.connections.test_connection.network.tcp_probe"), pytest.raises(CheckError) as failure:
            _checks(client).check_access()

        assert failure.value.evidence.command == "catalogs.list()"
        assert isinstance(failure.value.cause, Unauthenticated)


class TestMetadataSteps:
    def test_get_databases_resolves_the_first_non_internal_catalog(self):
        client = MagicMock()
        client.catalogs.list.return_value = iter([_named("__databricks_internal"), _named("main")])
        checks = _checks(client)

        evidence = checks.check_databases()

        assert checks.table_obj.catalog_name == "main"
        assert evidence.command == "catalogs.list()"
        assert evidence.summary == "catalog 'main' resolved"

    def test_get_databases_validates_the_configured_catalog(self):
        client = MagicMock()
        client.catalogs.get.return_value = _named("my_catalog")
        checks = _checks(client, catalog="my_catalog")

        evidence = checks.check_databases()

        client.catalogs.get.assert_called_once_with("my_catalog")
        client.catalogs.list.assert_not_called()
        assert evidence.command == "catalogs.get('my_catalog')"

    def test_get_schemas_validates_the_configured_schema(self):
        client = MagicMock()
        client.schemas.get.return_value = _named("my_schema")
        checks = _checks(client, databaseSchema="my_schema")
        checks.table_obj.catalog_name = "my_catalog"

        evidence = checks.check_schemas()

        client.schemas.get.assert_called_once_with("my_catalog.my_schema")
        assert evidence.command == "schemas.get('my_schema')"
        assert evidence.summary == "schema 'my_schema' resolved"

    def test_get_tables_reports_the_resolved_scope(self):
        client = MagicMock()
        client.tables.list.return_value = iter([_named("orders")])
        checks = _checks(client)
        checks.table_obj.catalog_name = "my_catalog"
        checks.table_obj.schema_name = "my_schema"

        evidence = checks.check_tables()

        assert evidence.summary == "tables enumerated in 'my_catalog.my_schema'"
        assert evidence.command == "tables.list()"

    def test_get_views_carries_the_command_when_the_scope_is_unresolved(self):
        client = MagicMock()

        with pytest.raises(CheckError) as failure:
            _checks(client).check_views()

        assert failure.value.evidence.command == "tables.list(omit_columns=True)"
        client.tables.list.assert_not_called()


class TestWarehouseSteps:
    def test_get_queries_reads_the_borrowed_engine(self):
        engine = MagicMock()
        with patch(f"{CONNECTION_MODULE}.read_lineage_tables") as mock_lineage:
            checks = _checks(MagicMock(), sql=engine, **WAREHOUSE)
            evidence = checks.check_queries()

        mock_lineage.assert_called_once_with(engine)
        # The engine belongs to UnityCatalogSqlConnection: the check never disposes it.
        engine.dispose.assert_not_called()
        assert evidence.summary == "lineage tables accessible"

    def test_get_queries_wraps_a_probe_failure_as_check_error(self):
        engine = MagicMock()
        with (
            patch(f"{CONNECTION_MODULE}.read_lineage_tables", side_effect=PermissionDenied("PERMISSION_DENIED")),
            pytest.raises(CheckError),
        ):
            _checks(MagicMock(), sql=engine, **WAREHOUSE).check_queries()

        engine.dispose.assert_not_called()

    def test_get_tags_probes_the_information_schema_tag_tables(self):
        engine = MagicMock()
        with patch(f"{CONNECTION_MODULE}.read_tag_tables") as mock_tags:
            checks = _checks(MagicMock(), sql=engine, **WAREHOUSE)
            evidence = checks.check_tags()

        mock_tags.assert_called_once_with(engine, checks.table_obj)
        assert evidence.summary == "tag tables accessible"


class TestErrorPack:
    @pytest.mark.parametrize(
        ("error", "expected_title"),
        [
            (Unauthenticated("workspace rejected the request"), "Authentication failed"),
            (RuntimeError("Invalid access token."), "Authentication failed"),
            (RuntimeError("the token is expired"), "Access token expired"),
            (PermissionDenied("no grants"), "Insufficient privileges"),
            (RuntimeError("PERMISSION_DENIED: user lacks USE CATALOG"), "Insufficient privileges"),
            (RuntimeError("INSUFFICIENT_PERMISSIONS"), "Insufficient privileges"),
            (ResourceDoesNotExist("catalog my_catalog"), "Object not found"),
            (RuntimeError("NO_SUCH_CATALOG: my_catalog"), "Catalog not found"),
            (RuntimeError("NO_SUCH_SCHEMA: my_schema"), "Schema not found"),
            (RuntimeError("TABLE_OR_VIEW_NOT_FOUND: my_table"), "Table or view not found"),
            (RuntimeError("MALFORMED_REQUEST: bad http path"), "Invalid HTTP path"),
            (RuntimeError("No valid connection settings."), "SQL warehouse not configured"),
            (
                RuntimeError("[FAILED_JDBC.CONNECTION] ... Failed to connect to the database. SQLSTATE: HV000"),
                "SQL warehouse not reachable",
            ),
            (RuntimeError("Table system.access.table_lineage does not exist"), "Object not found"),
        ],
    )
    def test_maps_unity_catalog_errors_to_a_diagnosis(self, error, expected_title):
        diagnosis = UNITY_CATALOG_ERRORS.classify(error)

        assert diagnosis is not None
        assert diagnosis.title == expected_title
        assert diagnosis.remediation

    def test_folds_in_the_shared_network_pack(self):
        diagnosis = UNITY_CATALOG_ERRORS.classify(NetworkUnreachableError("host:443 is not reachable"))

        assert diagnosis is not None
        assert diagnosis.title == "Cannot reach the host"

    def test_unresolvable_host_is_a_dns_diagnosis(self):
        diagnosis = UNITY_CATALOG_ERRORS.classify(socket.gaierror("nodename nor servname provided"))

        assert diagnosis is not None
        assert diagnosis.title == "Host could not be resolved"

    def test_an_unmatched_error_is_left_unclassified(self):
        assert UNITY_CATALOG_ERRORS.classify(RuntimeError("something else entirely")) is None


def test_closing_disposes_the_sql_engine_on_every_reuse_cycle():
    # close() resets the teardown registry, so a sub-owner registered once in
    # __init__ would leak its engine on the second cycle.
    engines = [MagicMock(), MagicMock()]
    with (
        patch(f"{CONNECTION_MODULE}.get_connection"),
        patch(f"{CONNECTION_MODULE}.get_sqlalchemy_connection", side_effect=engines),
    ):
        connection = UnityCatalogConnection(_config())
        _ = connection.sql.client
        connection.close()
        _ = connection.sql.client
        connection.close()

    for engine in engines:
        engine.dispose.assert_called_once_with()


class TestNoWarehouseConfigured:
    def test_get_queries_fails_without_building_an_engine(self):
        with patch(f"{CONNECTION_MODULE}.get_sqlalchemy_connection") as mock_engine:
            checks = _checks(MagicMock(), httpPath=None)

            with pytest.raises(CheckError) as exc_info:
                checks.check_queries()

        mock_engine.assert_not_called()
        assert exc_info.value.evidence.command == LINEAGE_PROBE_COMMAND

    def test_get_tags_fails_without_building_an_engine(self):
        with patch(f"{CONNECTION_MODULE}.get_sqlalchemy_connection") as mock_engine:
            checks = _checks(MagicMock(), httpPath=None)

            with pytest.raises(CheckError):
                checks.check_tags()

        mock_engine.assert_not_called()

    def test_the_missing_warehouse_is_still_diagnosed(self):
        checks = _checks(MagicMock(), httpPath=None)

        with pytest.raises(CheckError) as exc_info:
            checks.check_queries()

        diagnosis = UNITY_CATALOG_ERRORS.classify(exc_info.value.cause)
        assert diagnosis is not None
        assert diagnosis.title == "SQL warehouse not configured"
