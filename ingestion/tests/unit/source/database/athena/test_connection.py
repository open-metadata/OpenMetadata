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

import socket
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from metadata.core.connections.test_connection.check import collect_checks
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection as AthenaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaScheme,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.athena import connection as athena_connection
from metadata.ingestion.source.database.athena.connection import (
    ATHENA_ERRORS,
    AthenaChecks,
    AthenaConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.athena.connection"


def _config(**kwargs) -> AthenaConnectionConfig:
    base = {
        "awsConfig": AWSCredentials(awsAccessKeyId="key", awsRegion="us-east-2", awsSecretAccessKey="secret_key"),
        "s3StagingDir": "s3://postgres/input/",
        "workgroup": "primary",
        "scheme": AthenaScheme.awsathena_rest,
    }
    base.update(kwargs)
    return AthenaConnectionConfig(**base)


def _checks(**config_kwargs) -> AthenaChecks:
    conn = AthenaConnection(_config(**config_kwargs))
    conn._client = MagicMock()
    return conn.checks()


def _client_error(code: str, message: str = "denied") -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": message}}, "StartQueryExecution")


def test_athena_connection_is_base_connection():
    assert issubclass(AthenaConnection, BaseConnection)


def test_get_client_uses_the_class_url_builder():
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = AthenaConnection(_config()).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_connection_url"


def test_get_client_registers_engine_disposal():
    conn = AthenaConnection(_config())
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        engine = mock_connection.return_value
        _ = conn.client
        conn.close()
    engine.dispose.assert_called_once_with()


def test_checks_returns_provider_over_the_client():
    conn = AthenaConnection(_config())
    conn._client = MagicMock()
    provider = conn.checks()
    assert isinstance(provider, AthenaChecks)
    assert provider.client is conn._client


def test_every_athena_step_resolves_to_a_check():
    provider = AthenaChecks(client=MagicMock())
    resolved = collect_checks(provider)
    assert set(resolved) == {
        DatabaseStep.CheckAccess,
        DatabaseStep.GetSchemas,
        DatabaseStep.GetTables,
        DatabaseStep.GetViews,
    }


def test_error_pack_classifies_access_denied_as_not_authorized():
    diagnosis = ATHENA_ERRORS.classify(_client_error("AccessDeniedException"))
    assert diagnosis is not None
    assert diagnosis.title == "Not authorized"


def test_error_pack_classifies_unrecognized_client_as_auth_failure():
    diagnosis = ATHENA_ERRORS.classify(_client_error("UnrecognizedClientException"))
    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_error_pack_classifies_auth_failure_through_a_wrapping_cause():
    wrapped = RuntimeError("query failed")
    wrapped.__cause__ = _client_error("InvalidSignatureException")
    diagnosis = ATHENA_ERRORS.classify(wrapped)
    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_error_pack_classifies_missing_workgroup():
    error = RuntimeError("WorkGroup primary is not found")
    diagnosis = ATHENA_ERRORS.classify(error)
    assert diagnosis is not None
    assert diagnosis.title == "Workgroup not found"


def test_error_pack_classifies_missing_result_location():
    error = RuntimeError("No output location provided for query")
    diagnosis = ATHENA_ERRORS.classify(error)
    assert diagnosis is not None
    assert diagnosis.title == "Query result location not configured"


def test_error_pack_classifies_unreachable_endpoint():
    error = RuntimeError('Could not connect to the endpoint URL: "https://athena.bad.amazonaws.com/"')
    diagnosis = ATHENA_ERRORS.classify(error)
    assert diagnosis is not None
    assert diagnosis.title == "Cannot reach the AWS Athena endpoint"


def test_error_pack_classifies_not_authorized():
    diagnosis = ATHENA_ERRORS.classify(
        _client_error("SomeOtherException", "User is not authorized to perform: glue:GetTables")
    )
    assert diagnosis is not None
    assert diagnosis.title == "Not authorized"


def test_error_pack_folds_in_the_network_pack():
    diagnosis = ATHENA_ERRORS.classify(socket.gaierror("name resolution failed"))
    assert diagnosis is not None
    assert diagnosis.title == "Host could not be resolved"


def test_error_pack_returns_none_for_unknown_error():
    assert ATHENA_ERRORS.classify(RuntimeError("something unrelated")) is None


def test_athena_url():
    expected = (
        "awsathena+rest://key:secret_key@athena.us-east-2.amazonaws.com:443"
        "?s3_staging_dir=s3%3A%2F%2Fpostgres%2Finput%2F&work_group=primary"
    )
    assert AthenaConnection.get_connection_url(_config()) == expected


def test_athena_url_other_staging_dir():
    expected = (
        "awsathena+rest://key:secret_key@athena.us-east-2.amazonaws.com:443"
        "?s3_staging_dir=s3%3A%2F%2Fpostgres%2Fintput%2F&work_group=primary"
    )
    assert AthenaConnection.get_connection_url(_config(s3StagingDir="s3://postgres/intput/")) == expected


def test_get_tables_raises_when_all_targeted_schemas_empty():
    checks = _checks(catalogId="my_catalog")
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1", "db2"]
    inspector.get_table_names.return_value = []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector), pytest.raises(RuntimeError):
        checks.get_tables()


def test_get_tables_passes_when_a_schema_has_tables():
    checks = _checks()
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1", "db2"]
    inspector.get_table_names.side_effect = lambda schema: ["t1"] if schema == "db2" else []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        evidence = checks.get_tables()
    assert evidence is not None


def test_get_tables_honors_schema_filter_pattern():
    checks = _checks(schemaFilterPattern=FilterPattern(includes=["db2"]))
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1", "db2"]
    inspector.get_table_names.side_effect = lambda schema: ["t1"] if schema == "db2" else []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        checks.get_tables()
    probed = {call.args[0] for call in inspector.get_table_names.call_args_list}
    assert probed == {"db2"}


def test_get_tables_raises_when_filter_matches_nothing():
    checks = _checks(catalogId="my_catalog", schemaFilterPattern=FilterPattern(includes=["nope"]))
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1", "db2"]
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector), pytest.raises(RuntimeError):
        checks.get_tables()
    inspector.get_table_names.assert_not_called()


def test_get_views_does_not_raise_when_empty():
    checks = _checks()
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1"]
    inspector.get_view_names.return_value = []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        evidence = checks.get_views()
    assert evidence is not None


def test_get_tables_error_message_is_actionable():
    checks = _checks(catalogId="my_catalog")
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1"]
    inspector.get_table_names.return_value = []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector), pytest.raises(RuntimeError) as exc_info:
        checks.get_tables()
    raised = str(exc_info.value)
    assert "Lake Formation" in raised
    assert "my_catalog" in raised
    assert any(keyword in raised.lower() for keyword in ("describe", "select", "grant"))


def test_get_tables_caps_probing_at_max_schemas():
    checks = _checks(catalogId="my_catalog")
    inspector = MagicMock()
    inspector.get_schema_names.return_value = [f"db{i}" for i in range(500)]
    inspector.get_table_names.return_value = []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector), pytest.raises(RuntimeError):
        checks.get_tables()
    assert inspector.get_table_names.call_count <= athena_connection.MAX_SCHEMAS_TO_PROBE


def test_targeted_schemas_listed_once_across_table_and_view_steps():
    checks = _checks()
    inspector = MagicMock()
    inspector.get_schema_names.return_value = ["db1"]
    inspector.get_table_names.return_value = ["t1"]
    inspector.get_view_names.return_value = []
    with patch(f"{CONNECTION_MODULE}.inspect", return_value=inspector):
        checks.get_tables()
        checks.get_views()
    assert inspector.get_schema_names.call_count == 1
