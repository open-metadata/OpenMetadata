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
"""Unit tests for Athena connection handling."""

from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection as AthenaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaScheme,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.source.database.athena import connection as athena_connection

CONNECTION_MODULE = "metadata.ingestion.source.database.athena.connection"


def _config(**kwargs) -> AthenaConnectionConfig:
    base = {
        "awsConfig": AWSCredentials(
            awsAccessKeyId="key",
            awsRegion="us-east-2",
            awsSecretAccessKey="secret_key",
        ),
        "s3StagingDir": "s3://postgres/input/",
        "workgroup": "primary",
        "scheme": AthenaScheme.awsathena_rest,
    }
    base.update(kwargs)
    return AthenaConnectionConfig(**base)


def _run_steps_capturing(service_connection: AthenaConnectionConfig) -> dict:
    """
    Patch the framework so each test_fn callable is invoked directly and any
    raised exception is captured. Returns {step_name: raised_exc_or_None}.
    The executors are nested closures, so they are driven via the public
    test_connection with inspect() mocked.
    """
    captured = {}

    def fake_steps(*, test_fn, **_kwargs):
        for name, fn in test_fn.items():
            try:
                fn()
                captured[name] = None
            except Exception as err:  # pylint: disable=broad-except
                captured[name] = err
        return MagicMock()

    with patch(f"{CONNECTION_MODULE}.test_connection_steps", side_effect=fake_steps):
        athena_connection.test_connection(
            metadata=MagicMock(),
            engine=MagicMock(),
            service_connection=service_connection,
        )
    return captured


def test_get_tables_raises_when_all_targeted_schemas_empty():
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1", "db2"]
    inspector.get_table_names.return_value = []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        captured = _run_steps_capturing(_config(catalogId="my_catalog"))
    assert isinstance(captured["GetTables"], Exception)


def test_get_tables_passes_when_a_schema_has_tables():
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1", "db2"]
    inspector.get_table_names.side_effect = lambda schema: (
        ["t1"] if schema == "db2" else []
    )
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        captured = _run_steps_capturing(_config())
    assert captured["GetTables"] is None


def test_get_tables_honors_schema_filter_pattern():
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1", "db2"]
    inspector.get_table_names.side_effect = lambda schema: (
        ["t1"] if schema == "db2" else []
    )
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        captured = _run_steps_capturing(
            _config(schemaFilterPattern=FilterPattern(includes=["db2"]))
        )
    assert captured["GetTables"] is None
    probed = {call.args[0] for call in inspector.get_table_names.call_args_list}
    assert probed == {"db2"}


def test_get_tables_raises_when_filter_matches_nothing():
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1", "db2"]
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        captured = _run_steps_capturing(
            _config(
                catalogId="my_catalog",
                schemaFilterPattern=FilterPattern(includes=["nope"]),
            )
        )
    assert isinstance(captured["GetTables"], Exception)
    inspector.get_table_names.assert_not_called()


def test_get_views_does_not_raise_when_empty():
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1"]
    inspector.get_table_names.return_value = ["t1"]
    inspector.get_view_names.return_value = []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        captured = _run_steps_capturing(_config())
    assert captured["GetViews"] is None


def test_get_tables_error_message_is_actionable():
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1"]
    inspector.get_table_names.return_value = []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        captured = _run_steps_capturing(_config(catalogId="my_catalog"))
    raised = str(captured["GetTables"])
    assert "Lake Formation" in raised
    assert "my_catalog" in raised
    assert any(keyword in raised.lower() for keyword in ("describe", "select", "grant"))


def test_get_tables_caps_probing_at_max_schemas():
    inspector = MagicMock()
    inspector.get_schema_names.return_value = [f"db{i}" for i in range(500)]
    inspector.get_table_names.return_value = []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        captured = _run_steps_capturing(_config(catalogId="my_catalog"))
    assert isinstance(captured["GetTables"], Exception)
    assert (
        inspector.get_table_names.call_count <= athena_connection.MAX_SCHEMAS_TO_PROBE
    )


def test_targeted_schemas_listed_once_across_table_and_view_steps():
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1"]
    inspector.get_table_names.return_value = ["t1"]
    inspector.get_view_names.return_value = []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        _run_steps_capturing(_config())
    # The memoized table + view executors share a single schema listing on this
    # inspector (1 call), instead of one each (2). GetSchemas uses its own
    # inspector via execute_inspector_func and does not touch this mock.
    assert inspector.get_schema_names.call_count == 1
