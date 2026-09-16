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
from metadata.ingestion.source.database.databend.connection import (
    DatabendConnection,
    check_connection_access,
    get_connection_url,
    set_catalog_on_connect,
)

if TYPE_CHECKING:
    from metadata.generated.schema.entity.automations.workflow import (
        Workflow as AutomationWorkflow,
    )


def test_databend_connection_is_base_connection():
    assert issubclass(DatabendConnection, BaseConnection)


def test_schema_defaults_and_rejects_removed_database_name():
    connection = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
        }
    )

    assert connection.catalog is None
    assert connection.database == "default"

    with pytest.raises(ValidationError, match="databaseName"):
        DatabendConnectionConfig.model_validate(
            {
                "username": "openmetadata",
                "password": "secret",
                "hostPort": "localhost:8000",
                "databaseName": "artificial_container",
            }
        )


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

    assert url == ("databend://openmetadata%40user:p%40ss%2Fword@localhost:8000/default?sslmode=disable")
    assert make_url(url).database == "default"


def test_url_includes_database_and_connection_options():
    connection = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "tenant.gw.aws.databend.com:443",
            "database": "analytics",
            "connectionOptions": {
                "warehouse": "compute pool",
                "sslmode": "enable",
            },
        }
    )

    url = get_connection_url(connection)

    assert url == (
        "databend://openmetadata:secret@tenant.gw.aws.databend.com:443/analytics?warehouse=compute+pool&sslmode=enable"
    )
    assert make_url(url).database == "analytics"


def test_catalog_does_not_change_database_url_path():
    connection = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            "catalog": "lakehouse",
            "database": "bootstrap",
        }
    )

    assert make_url(get_connection_url(connection)).database == "bootstrap"


def test_catalog_is_selected_for_every_new_dbapi_connection():
    engine = MagicMock()
    engine.dialect.identifier_preparer.quote.return_value = "`catalog-name`"
    callbacks = []

    with patch(
        "metadata.ingestion.source.database.databend.connection.event.listens_for",
        side_effect=lambda _engine, _event: callbacks.append,
    ):
        set_catalog_on_connect(engine, "catalog-name")

    assert len(callbacks) == 1
    engine.dialect.identifier_preparer.quote.assert_called_once_with("catalog-name")

    for _ in range(2):
        dbapi_connection = MagicMock()
        cursor = dbapi_connection.cursor.return_value
        callbacks[0](dbapi_connection, MagicMock())
        cursor.execute.assert_called_once_with("USE CATALOG `catalog-name`")
        cursor.close.assert_called_once_with()


def test_connection_registers_catalog_before_engine_is_used():
    config = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            "catalog": "lakehouse",
        }
    )
    engine = MagicMock()
    connection = DatabendConnection(config)

    with (
        patch(
            "metadata.ingestion.source.database.databend.connection.create_generic_db_connection",
            return_value=engine,
        ),
        patch("metadata.ingestion.source.database.databend.connection.set_catalog_on_connect") as set_catalog,
    ):
        assert connection.client is engine

    set_catalog.assert_called_once_with(engine, "lakehouse")
    connection.close()
    engine.dispose.assert_called_once_with()


def test_connection_arguments_are_forwarded_to_engine_builder():
    config = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            "connectionArguments": {"connect_timeout": "30"},
        }
    )
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


def test_connection_access_explains_http_tls_mismatch():
    driver_error = RuntimeError(
        "APIError: [request_kind=login retry_times=2]: reqwest::Error: error sending request, "
        "source_chain=client error (Connect) -> received corrupt message of type InvalidContentType [v0.33.7]"
    )

    with (
        patch(
            "metadata.ingestion.source.database.databend.connection.test_connection_engine_step",
            side_effect=driver_error,
        ),
        pytest.raises(RuntimeError, match="sslmode=disable") as exc_info,
    ):
        check_connection_access(MagicMock())

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
def test_connection_access_preserves_unrelated_errors(driver_error):
    with (
        patch(
            "metadata.ingestion.source.database.databend.connection.test_connection_engine_step",
            side_effect=driver_error,
        ),
        pytest.raises(RuntimeError) as exc_info,
    ):
        check_connection_access(MagicMock())

    assert exc_info.value is driver_error


def test_automation_workflow_surfaces_http_tls_mismatch_hint():
    config = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
        }
    )
    connection = DatabendConnection(config)
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
    driver_error = RuntimeError(
        "APIError: [request_kind=login retry_times=2]: reqwest::Error: error sending request, "
        "source_chain=client error (Connect) -> received corrupt message of type InvalidContentType [v0.33.7]"
    )

    with patch(
        "metadata.ingestion.source.database.databend.connection.test_connection_engine_step",
        side_effect=driver_error,
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


def test_connection_test_uses_configured_catalog_engine():
    config = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            "catalog": "lakehouse",
        }
    )
    engine = MagicMock()
    connection = DatabendConnection(config)
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


def test_connection_test_selects_catalog_before_reflection():
    config = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
        }
    )
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value.execute.return_value.fetchall.return_value = [("lakehouse",)]
    selected_engine = MagicMock()
    selected_connection = MagicMock()
    selected_connection.client = selected_engine
    connection = DatabendConnection(config)
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
        patch(
            "metadata.ingestion.source.database.databend.connection.DatabendConnection",
            return_value=selected_connection,
        ) as connection_class,
        patch("metadata.ingestion.source.database.databend.connection.execute_inspector_func") as inspect_method,
    ):
        connection.test_connection(MagicMock())

    selected_config = connection_class.call_args.args[0]
    assert selected_config.catalog == "lakehouse"
    inspect_method.assert_called_once_with(selected_engine, "get_schema_names")
    selected_connection.close.assert_called_once_with()


def test_connection_test_skips_inaccessible_catalog():
    config = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
        }
    )
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value.execute.return_value.fetchall.return_value = [
        ("inaccessible",),
        ("lakehouse",),
    ]
    inaccessible_connection = MagicMock()
    inaccessible_connection.client = MagicMock()
    selected_connection = MagicMock()
    selected_connection.client = MagicMock()
    connection = DatabendConnection(config)
    connection._client = engine

    def run_steps(**kwargs):
        kwargs["test_fn"]["GetDatabases"]()
        kwargs["test_fn"]["GetSchemas"]()
        return MagicMock()

    inaccessible_inspector = MagicMock()
    inaccessible_inspector.get_schema_names.side_effect = PermissionError("catalog access denied")
    selected_inspector = MagicMock()
    selected_inspector.get_schema_names.return_value = ["analytics"]

    with (
        patch(
            "metadata.ingestion.source.database.databend.connection.test_connection_steps",
            side_effect=run_steps,
        ),
        patch(
            "metadata.ingestion.source.database.databend.connection.DatabendConnection",
            side_effect=[inaccessible_connection, selected_connection],
        ) as connection_class,
        patch(
            "metadata.ingestion.source.database.databend.connection.inspect",
            side_effect=[inaccessible_inspector, selected_inspector],
        ),
        patch("metadata.ingestion.source.database.databend.connection.execute_inspector_func") as inspect_method,
    ):
        connection.test_connection(MagicMock())

    assert [call.args[0].catalog for call in connection_class.call_args_list] == ["inaccessible", "lakehouse"]
    inaccessible_connection.close.assert_called_once_with()
    inspect_method.assert_called_once_with(selected_connection.client, "get_schema_names")
    selected_connection.close.assert_called_once_with()


def test_connection_test_skips_filtered_catalog():
    config = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            "databaseFilterPattern": {"excludes": ["^system$"]},
        }
    )
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value.execute.return_value.fetchall.return_value = [
        ("system",),
        ("lakehouse",),
    ]
    selected_connection = MagicMock()
    selected_connection.client = MagicMock()
    connection = DatabendConnection(config)
    connection._client = engine

    def run_steps(**kwargs):
        kwargs["test_fn"]["GetDatabases"]()
        return MagicMock()

    with (
        patch(
            "metadata.ingestion.source.database.databend.connection.test_connection_steps",
            side_effect=run_steps,
        ),
        patch(
            "metadata.ingestion.source.database.databend.connection.DatabendConnection",
            return_value=selected_connection,
        ) as connection_class,
        patch("metadata.ingestion.source.database.databend.connection.inspect"),
    ):
        connection.test_connection(MagicMock())

    connection_class.assert_called_once()
    assert connection_class.call_args.args[0].catalog == "lakehouse"
    selected_connection.close.assert_called_once_with()


@pytest.mark.parametrize(
    "catalogs,database_filter_pattern",
    [([], None), ([("system",)], {"excludes": ["^system$"]})],
)
def test_connection_test_fails_when_no_catalog_can_be_selected(catalogs, database_filter_pattern):
    config_dict = {
        "username": "openmetadata",
        "password": "secret",
        "hostPort": "localhost:8000",
    }
    if database_filter_pattern:
        config_dict["databaseFilterPattern"] = database_filter_pattern
    config = DatabendConnectionConfig.model_validate(config_dict)
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value.execute.return_value.fetchall.return_value = catalogs
    connection = DatabendConnection(config)
    connection._client = engine

    def run_steps(**kwargs):
        kwargs["test_fn"]["GetDatabases"]()

    with (
        patch(
            "metadata.ingestion.source.database.databend.connection.test_connection_steps",
            side_effect=run_steps,
        ),
        pytest.raises(RuntimeError, match="No accessible Databend catalogs found"),
    ):
        connection.test_connection(MagicMock())


def test_connection_test_applies_schema_filter_before_table_probe():
    config = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            "catalog": "default",
            "schemaFilterPattern": {"includes": ["^analytics$"]},
        }
    )
    engine = MagicMock()
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["default", "analytics"]
    connection = DatabendConnection(config)
    connection._client = engine

    def run_steps(**kwargs):
        kwargs["test_fn"]["GetTables"]()
        kwargs["test_fn"]["GetViews"]()
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

    inspector.get_table_names.assert_called_once_with("analytics")
    inspector.get_view_names.assert_called_once_with("analytics")


def test_connection_test_skips_system_history_before_table_probe():
    config = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            "catalog": "default",
            "schemaFilterPattern": {"includes": [], "excludes": []},
        }
    )
    engine = MagicMock()
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["system_history", "analytics"]
    connection = DatabendConnection(config)
    connection._client = engine

    def run_steps(**kwargs):
        kwargs["test_fn"]["GetTables"]()
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

    inspector.get_table_names.assert_called_once_with("analytics")


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
):
    config_dict = {
        "username": "openmetadata",
        "password": "secret",
        "hostPort": "localhost:8000",
        "catalog": "default",
    }
    if schema_filter_pattern:
        config_dict["schemaFilterPattern"] = schema_filter_pattern
    config = DatabendConnectionConfig.model_validate(config_dict)
    engine = MagicMock()
    inspector = MagicMock()
    inspector.get_schema_names.return_value = schema_names
    connection = DatabendConnection(config)
    connection._client = engine

    def run_steps(**kwargs):
        kwargs["test_fn"]["GetTables"]()

    with (
        patch(
            "metadata.ingestion.source.database.databend.connection.test_connection_steps",
            side_effect=run_steps,
        ),
        patch(
            "metadata.ingestion.source.database.databend.connection.inspect",
            return_value=inspector,
        ),
        pytest.raises(RuntimeError, match="No accessible Databend database"),
    ):
        connection.test_connection(MagicMock())

    inspector.get_table_names.assert_not_called()
