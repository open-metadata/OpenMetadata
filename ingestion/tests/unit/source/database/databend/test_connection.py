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
"""Unit tests for Databend connection handling."""

from types import SimpleNamespace
from typing import TYPE_CHECKING, cast
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError
from sqlalchemy.engine import make_url

from metadata.generated.schema.entity.services.connections.database.databendConnection import (
    DatabendConnection as DatabendConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.databend import connection as databend_connection
from metadata.ingestion.source.database.databend.connection import (
    DatabendConnection,
    check_connection_access,
    get_connection_url,
)

if TYPE_CHECKING:
    from metadata.generated.schema.entity.automations.workflow import (
        Workflow as AutomationWorkflow,
    )

BASE_CONFIG = {
    "username": "openmetadata",
    "password": "secret",
    "hostPort": "localhost:8000",
}


def _config(**overrides) -> DatabendConnectionConfig:
    return DatabendConnectionConfig.model_validate({**BASE_CONFIG, **overrides})


def test_databend_connection_is_base_connection():
    assert issubclass(DatabendConnection, BaseConnection)


@pytest.mark.parametrize("removed_field", ["database", "catalog", "databaseName"])
def test_schema_rejects_catalog_and_database_fields(removed_field):
    with pytest.raises(ValidationError, match=removed_field):
        _config(**{removed_field: "analytics"})


def test_url_uses_default_database_and_encodes_credentials():
    connection = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata@user",
            "password": "p@ss/word",
            "hostPort": "localhost:8000",
            "connectionOptions": {"sslmode": "disable"},
        }
    )

    url = get_connection_url(connection)

    assert url == "databend://openmetadata%40user:p%40ss%2Fword@localhost:8000/default?sslmode=disable"
    assert make_url(url).database == "default"


def test_url_defaults_database_without_connection_options():
    url = get_connection_url(_config())

    assert url == "databend://openmetadata:secret@localhost:8000/default"
    assert make_url(url).database == "default"


def test_url_uses_database_schema_as_initial_database():
    connection = _config(
        hostPort="tenant.gw.aws.databend.com:443",
        databaseSchema="analytics",
        connectionOptions={"warehouse": "compute pool", "sslmode": "enable"},
    )

    url = get_connection_url(connection)

    assert url == (
        "databend://openmetadata:secret@tenant.gw.aws.databend.com:443/analytics?warehouse=compute+pool&sslmode=enable"
    )
    assert make_url(url).database == "analytics"


def test_client_is_built_without_catalog_switching_and_disposed_on_close():
    engine = MagicMock()
    connection = DatabendConnection(_config())

    with patch(
        "metadata.ingestion.source.database.databend.connection.create_generic_db_connection",
        return_value=engine,
    ) as create_connection:
        assert connection.client is engine

    assert create_connection.call_args.kwargs["get_connection_url_fn"] is get_connection_url
    engine.execute.assert_not_called()
    connection.close()
    engine.dispose.assert_called_once_with()


def test_connection_arguments_are_forwarded_to_engine_builder():
    config = _config(connectionArguments={"connect_timeout": "30"})
    engine = MagicMock()
    connection = DatabendConnection(config)

    with patch(
        "metadata.ingestion.source.database.databend.connection.create_generic_db_connection",
        return_value=engine,
    ) as create_connection:
        assert connection.client is engine

    connection_args_fn = create_connection.call_args.kwargs["get_connection_args_fn"]
    assert connection_args_fn(config) == {"connect_timeout": "30"}

    connection.close()


def _tls_mismatch_error() -> RuntimeError:
    return RuntimeError(
        "APIError: [request_kind=login retry_times=2]: reqwest::Error: error sending request, "
        "source_chain=client error (Connect) -> received corrupt message of type InvalidContentType [v0.33.7]"
    )


def test_connection_access_explains_http_tls_mismatch(monkeypatch):
    driver_error = _tls_mismatch_error()
    engine = MagicMock()
    monkeypatch.setattr(databend_connection, "test_connection_engine_step", MagicMock(side_effect=driver_error))
    with pytest.raises(RuntimeError, match="sslmode=disable") as exc_info:
        check_connection_access(engine)

    assert "HTTP/TLS mode" in str(exc_info.value)
    assert "sslmode=enable" in str(exc_info.value)
    assert exc_info.value.__cause__ is driver_error


@pytest.mark.parametrize(
    "driver_error",
    [
        RuntimeError("InvalidContentType while parsing query results"),
        RuntimeError("request_kind=login: authentication failed"),
        RuntimeError("error sending request: connection refused"),
    ],
)
def test_connection_access_preserves_unrelated_errors(driver_error, monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(databend_connection, "test_connection_engine_step", MagicMock(side_effect=driver_error))
    with pytest.raises(RuntimeError) as exc_info:
        check_connection_access(engine)

    assert exc_info.value is driver_error


def test_automation_workflow_surfaces_http_tls_mismatch_hint():
    connection = DatabendConnection(_config())
    connection._client = MagicMock()
    metadata = MagicMock()
    metadata.get_by_name.return_value = SimpleNamespace(
        steps=[
            SimpleNamespace(
                name="CheckAccess",
                description="Validate access",
                mandatory=True,
                errorMessage="Failed to connect",
                shortCircuit=True,
            )
        ]
    )

    with patch(
        "metadata.ingestion.source.database.databend.connection.test_connection_engine_step",
        side_effect=_tls_mismatch_error(),
    ):
        result = connection.test_connection(
            metadata,
            automation_workflow=cast("AutomationWorkflow", cast("object", SimpleNamespace())),
            timeout_seconds=None,
        )

    assert len(result.steps) == 1
    assert result.steps[0].name == "CheckAccess"
    assert result.steps[0].passed is False
    assert result.steps[0].errorLog is not None
    assert "sslmode=disable" in result.steps[0].errorLog
    assert "HTTP/TLS mode" in result.steps[0].errorLog
    assert "InvalidContentType" not in result.steps[0].errorLog
    assert metadata.patch_automation_workflow_response.call_count == 1


def test_connection_test_probes_default_catalog_on_base_engine():
    engine = MagicMock()
    connection = DatabendConnection(_config())
    connection._client = engine

    def run_steps(**kwargs):
        kwargs["test_fn"]["GetDatabases"]()
        kwargs["test_fn"]["GetSchemas"]()
        return MagicMock()

    with (
        patch(
            "metadata.ingestion.source.database.databend.connection.test_connection_steps",
            side_effect=run_steps,
        ),
        patch("metadata.ingestion.source.database.databend.connection.test_query") as test_query,
        patch("metadata.ingestion.source.database.databend.connection.execute_inspector_func") as inspect_method,
    ):
        connection.test_connection(MagicMock())

    test_query.assert_called_once_with(engine, "SELECT current_catalog()")
    inspect_method.assert_called_once_with(engine, "get_schema_names")


def _run_entity_probes(connection: DatabendConnection, inspector: MagicMock, *steps: str) -> None:
    def run_steps(**kwargs):
        for step in steps:
            kwargs["test_fn"][step]()
        return MagicMock()

    with (
        patch(
            "metadata.ingestion.source.database.databend.connection.test_connection_steps",
            side_effect=run_steps,
        ),
        patch(
            "metadata.ingestion.source.database.databend.connection.inspect",
            return_value=inspector,
        ),
    ):
        connection.test_connection(MagicMock())


def test_connection_test_applies_schema_filter_before_table_probe():
    connection = DatabendConnection(_config(schemaFilterPattern={"includes": ["^analytics$"]}))
    connection._client = MagicMock()
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["default", "analytics"]

    _run_entity_probes(connection, inspector, "GetTables", "GetViews")

    inspector.get_table_names.assert_called_once_with("analytics")
    inspector.get_view_names.assert_called_once_with("analytics")


def test_connection_test_skips_system_history_before_table_probe():
    connection = DatabendConnection(_config(schemaFilterPattern={"includes": [], "excludes": []}))
    connection._client = MagicMock()
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["system_history", "analytics"]

    _run_entity_probes(connection, inspector, "GetTables")

    inspector.get_table_names.assert_called_once_with("analytics")


def test_connection_test_probes_configured_database_schema():
    connection = DatabendConnection(_config(databaseSchema="sales"))
    connection._client = MagicMock()
    inspector = MagicMock()

    _run_entity_probes(connection, inspector, "GetTables")

    inspector.get_schema_names.assert_not_called()
    inspector.get_table_names.assert_called_once_with("sales")


@pytest.mark.parametrize(
    "schema_names,schema_filter_pattern",
    [
        (["information_schema", "system", "system_history"], None),
        (["analytics"], {"excludes": ["^analytics$"]}),
    ],
)
def test_connection_test_fails_table_probe_when_no_schema_is_available(
    schema_names,
    schema_filter_pattern,
    monkeypatch,
):
    overrides = {"schemaFilterPattern": schema_filter_pattern} if schema_filter_pattern else {}
    connection = DatabendConnection(_config(**overrides))
    connection._client = MagicMock()
    inspector = MagicMock()
    inspector.get_schema_names.return_value = schema_names

    def run_steps(**kwargs):
        kwargs["test_fn"]["GetTables"]()

    metadata = MagicMock()
    monkeypatch.setattr(databend_connection, "test_connection_steps", run_steps)
    monkeypatch.setattr(databend_connection, "inspect", MagicMock(return_value=inspector))
    with pytest.raises(RuntimeError, match="No accessible Databend database"):
        connection.test_connection(metadata)

    inspector.get_table_names.assert_not_called()
