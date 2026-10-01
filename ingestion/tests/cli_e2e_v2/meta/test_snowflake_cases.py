#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Offline Snowflake suite wiring: invocation scoping, credentials by reference, the shim switch and checks."""

import re
from contextlib import ExitStack
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest
import yaml

import metadata.ingestion.source.database.snowflake.queries as snowflake_queries
import metadata.profiler.metrics.system.snowflake.system as snowflake_system
from metadata.generated.schema.entity.data.table import DataType, DmlOperationType, PartitionIntervalTypes, Table
from metadata.generated.schema.entity.data.table import SystemProfile as DmlProfile

from ..features.database.pipelines import MetadataPipeline, ProfilerPipeline
from ..features.database.pipelines import TestPipeline as SuitePipeline
from ..server import ServerConfig
from ..snowflake.baseline import build_snowflake_baseline
from ..snowflake.checks import system_profile_matches, table_is_clustered_by
from ..snowflake.connector import snowflake_invocation, table_diff_invocation
from ..snowflake.expected import snowflake_expected, snowflake_schema
from ..snowflake.source import (
    AccountUsageShim,
    DmlResult,
    SnowflakeInstance,
    SnowflakeSource,
    _shim_statements,
)

_SECRETS = {
    "E2E_SNOWFLAKE_PASSWORD": "synthetic-password",
    "E2E_SNOWFLAKE_CLI_PRIVATE_KEY": "synthetic-private-key",
    "E2E_SNOWFLAKE_PASSPHRASE": "synthetic-passphrase",
}


@pytest.fixture
def instance(monkeypatch):
    for key, value in {
        **_SECRETS,
        "E2E_SNOWFLAKE_ACCOUNT": "synthetic-account",
        "E2E_SNOWFLAKE_USERNAME": "synthetic-user",
        "E2E_SNOWFLAKE_WAREHOUSE": "SYNTHETIC_WH",
        "E2E_SNOWFLAKE_DATABASE": "E2E_DB",
        "OM_SERVER_URL": "http://127.0.0.1:1/api",
        "OM_JWT_TOKEN": "synthetic-token",
    }.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv("E2E_SNOWFLAKE_ROLE", raising=False)
    return SnowflakeInstance("E2E_DB", "SYNTHETIC_WH", "password", admin_engine=None)


@pytest.fixture
def server():
    return ServerConfig("http://127.0.0.1:1/api", "synthetic-token", "env")


def _source(instance, schema):
    return SnowflakeSource(instance, schema, build_snowflake_baseline(instance.database, schema), ExitStack())


def _invoke(instance, server, sources, options=None, filters=None, connection=None, account_usage=None):
    return snowflake_invocation(
        service_name="svc",
        sources=sources,
        instance=instance,
        options=options or MetadataPipeline(),
        filters=filters or {},
        server=server,
        connection=connection,
        account_usage=account_usage,
    )


def test_password_mode_scopes_to_owned_schema_by_reference(instance, server):
    config = _invoke(instance, server, (_source(instance, "E2E_SF_OWNED"),)).config
    connection = config["source"]["serviceConnection"]["config"]
    assert config["source"]["type"] == "snowflake"
    assert connection == {
        "type": "Snowflake",
        "account": "${E2E_SNOWFLAKE_ACCOUNT}",
        "username": "${E2E_SNOWFLAKE_USERNAME}",
        "warehouse": "${E2E_SNOWFLAKE_WAREHOUSE}",
        "database": "${E2E_SNOWFLAKE_DATABASE}",
        "connectionArguments": {"session_parameters": {"GEOGRAPHY_OUTPUT_FORMAT": "GeoJSON"}},
        "password": "${E2E_SNOWFLAKE_PASSWORD}",
    }
    assert config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] == {"includes": ["^E2E_SF_OWNED$"]}


def test_key_pair_mode_references_the_single_line_cli_key(instance, server, monkeypatch):
    monkeypatch.setenv("E2E_SNOWFLAKE_ROLE", "E2E_ROLE")
    key_pair = replace(instance, auth="key_pair")
    connection = _invoke(key_pair, server, (_source(key_pair, "E2E_SF_OWNED"),)).config["source"]["serviceConnection"][
        "config"
    ]
    assert connection["privateKey"] == "${E2E_SNOWFLAKE_CLI_PRIVATE_KEY}"
    assert connection["snowflakePrivatekeyPassphrase"] == "${E2E_SNOWFLAKE_PASSPHRASE}"
    assert connection["role"] == "${E2E_SNOWFLAKE_ROLE}"
    assert "password" not in connection


@pytest.mark.parametrize("auth", ["password", "key_pair"])
def test_rendered_config_references_credentials_instead_of_embedding_them(instance, server, auth):
    mode = replace(instance, auth=auth)
    rendered = yaml.safe_dump(_invoke(mode, server, (_source(mode, "E2E_SF_OWNED"),)).config)
    for value in (*_SECRETS.values(), "synthetic-token", "synthetic-account", "synthetic-user"):
        assert value not in rendered


def test_account_usage_shim_and_connection_options_are_opt_in(instance, server):
    source = _source(instance, "E2E_SF_OWNED")
    plain = _invoke(instance, server, (source,)).config["source"]["serviceConnection"]["config"]
    assert "accountUsageSchema" not in plain
    assert "includeTransientTables" not in plain
    shim = AccountUsageShim("E2E_DB", "E2E_SF_OWNED_AU", engine=None)
    shimmed = _invoke(
        instance, server, (source,), connection={"includeTransientTables": False}, account_usage=shim
    ).config["source"]["serviceConnection"]["config"]
    assert shimmed["accountUsageSchema"] == "E2E_DB.E2E_SF_OWNED_AU"
    assert shimmed["includeTransientTables"] is False


def test_filters_merge_with_owned_schema_scope(instance, server):
    sources = (_source(instance, "E2E_SF_A"), _source(instance, "E2E_SF_B"))
    config = _invoke(
        instance, server, sources, ProfilerPipeline(), {"tableFilterPattern": {"includes": ["^EVENTS$"]}}
    ).config
    source_config = config["source"]["sourceConfig"]["config"]
    assert config["processor"]["type"] == "orm-profiler"
    assert source_config["tableFilterPattern"]["includes"] == ["^EVENTS$"]
    assert source_config["schemaFilterPattern"] == {"includes": ["^E2E_SF_A$", "^E2E_SF_B$"]}


@pytest.mark.parametrize(
    "case, message",
    [
        ("empty", "nonempty tuple"),
        ("closed", "already been closed"),
        ("foreign-account", "session's E2E account"),
        ("duplicate", "distinct schemas"),
        ("unknown-filter", "Unsupported filter fields"),
        ("database-filter", "Unsupported filter fields"),
        ("unscoped-schema-filter", "only the owned schemas"),
        ("broad-schema-filter", "only the owned schemas"),
        ("unowned-schema-filter", "only the owned schemas"),
        ("unknown-connection-option", "Unsupported connection options"),
        ("filters-without-support", "does not accept filters"),
    ],
)
def test_invocation_rejects_unowned_or_unscoped_runs(instance, server, case, message):
    owned = _source(instance, "E2E_SF_OWNED")
    sources, options, filters, connection = (owned,), MetadataPipeline(), {}, None
    if case == "empty":
        sources = ()
    elif case == "closed":
        owned._closed = True
    elif case == "foreign-account":
        sources = (_source(replace(instance), "E2E_SF_OTHER"),)
    elif case == "duplicate":
        sources = (owned, _source(instance, "E2E_SF_OWNED"))
    elif case == "unknown-filter":
        filters = {"storedProcedureFilterPattern": {"includes": [".*"]}}
    elif case == "database-filter":
        filters = {"databaseFilterPattern": {"includes": [".*"]}}
    elif case == "unscoped-schema-filter":
        filters = {"schemaFilterPattern": {"excludes": ["^OTHER$"]}}
    elif case == "broad-schema-filter":
        filters = {"schemaFilterPattern": {"includes": [".*"]}}
    elif case == "unowned-schema-filter":
        filters = {"schemaFilterPattern": {"includes": ["^E2E_SF_OWNED$", "^OTHER$"]}}
    elif case == "unknown-connection-option":
        connection = {"accountUsageSchema": "SNOWFLAKE.ACCOUNT_USAGE"}
    elif case == "filters-without-support":
        options = SuitePipeline(type="TestSuite", entityFullyQualifiedName="svc.E2E_DB.E2E_SF_OWNED.CUSTOMERS")
        filters = {"tableFilterPattern": {"includes": ["CUSTOMERS"]}}
    with pytest.raises(ValueError, match=message):
        _invoke(instance, server, sources, options, filters, connection)


def test_table_diff_moves_connection_into_test_suite_config(instance, server):
    table = "svc.E2E_DB.E2E_SF_OWNED.SAMPLE_ROWS"
    base = _invoke(
        instance,
        server,
        (_source(instance, "E2E_SF_OWNED"),),
        SuitePipeline(type="TestSuite", entityFullyQualifiedName=table),
    )
    connection = base.config["source"]["serviceConnection"]
    case = SimpleNamespace(model_dump=lambda **_: {"name": "diff", "testDefinitionName": "tableDiff"})
    config = table_diff_invocation(base, service_name="svc", test_cases=[case]).config
    assert base.subcommand == "test"
    assert "serviceConnection" not in config["source"]
    source_config = config["source"]["sourceConfig"]["config"]
    assert source_config["entityFullyQualifiedName"] == table
    assert source_config["serviceConnections"] == [{"serviceName": "svc", "serviceConnection": connection}]
    assert config["processor"] == {
        "type": "orm-test-runner",
        "config": {"testCases": [{"name": "diff", "testDefinitionName": "tableDiff"}]},
    }


def test_expected_catalog_folds_names_and_maps_native_types():
    schema = snowflake_schema("E2E_DB", "E2E_SF_OWNED")
    assert schema.name == "E2E_SF_OWNED"
    assert schema.stored_procedures == []
    tables = {table.name: table for table in schema.tables}
    assert set(tables) == {"CUSTOMERS", "TRANSACTIONS", "ALL_TYPES", "CUSTOMER_TXN_SUMMARY"}
    types = {column.name: column.data_type for column in tables["ALL_TYPES"].columns}
    assert types == {
        "ID": DataType.DECIMAL,
        "NUMBER_COL": DataType.DECIMAL,
        "INT_COL": DataType.DECIMAL,
        "FLOAT_COL": DataType.FLOAT,
        "VARCHAR_COL": DataType.VARCHAR,
        "CHAR_COL": DataType.VARCHAR,
        "TEXT_COL": DataType.VARCHAR,
        "BOOL_COL": DataType.BOOLEAN,
        "DATE_COL": DataType.DATE,
        "TIME_COL": DataType.TIME,
        "TS_NTZ_COL": DataType.TIMESTAMP,
        "TS_LTZ_COL": DataType.TIMESTAMP,
        "TS_TZ_COL": DataType.TIMESTAMP,
        "BINARY_COL": DataType.BINARY,
        "VARIANT_COL": DataType.JSON,
        "OBJECT_COL": DataType.JSON,
        "ARRAY_COL": DataType.ARRAY,
        "GEOGRAPHY_COL": DataType.GEOGRAPHY,
    }
    assert {column.name: column.data_type for column in tables["TRANSACTIONS"].columns}["TXN_AT"] == DataType.TIMESTAMP
    narrowed = snowflake_schema("E2E_DB", "E2E_SF_OWNED", tables={"CUSTOMERS"}, procedures=True)
    assert [table.name for table in narrowed.tables] == ["CUSTOMERS"]
    assert [procedure.name for procedure in narrowed.stored_procedures] == [
        "SP_ACTIVE_CUSTOMER_COUNT",
        "FN_CONVERT_AMOUNT",
    ]
    assert [database.name for database in snowflake_expected("svc", "E2E_DB", narrowed).databases] == ["E2E_DB"]


def _account_usage_views(module) -> set[str]:
    source = Path(module.__file__).read_text()
    return {name.upper() for name in re.findall(r"\{account_usage(?:_schema)?\}\.\"?([A-Za-z_]+)", source)}


def test_shim_covers_every_account_usage_view_the_connector_reads():
    """A connector query against a view the shim lacks would fail only in the shim-backed scenarios."""
    read = _account_usage_views(snowflake_queries) | _account_usage_views(snowflake_system)
    shim = AccountUsageShim("E2E_DB", "E2E_SF_OWNED_AU", engine=None)
    statements = _shim_statements(shim, "E2E_SF_OWNED", ["CUSTOMERS"])
    created = {match for statement in statements for match in re.findall(r"VIEW \S+\.([A-Z_]+) AS", statement)}
    assert read, "no ACCOUNT_USAGE views found in the connector queries"
    assert read <= created, f"shim lacks {sorted(read - created)}"


def test_shim_records_only_snowflake_query_ids():
    shim = AccountUsageShim("E2E_DB", "E2E_SF_OWNED_AU", engine=None)
    with pytest.raises(ValueError, match="at least one"):
        shim.record()
    with pytest.raises(ValueError, match="Snowflake query IDs"):
        shim.record(DmlResult("01c76d38'); DROP TABLE x; --", updated=1))
    with pytest.raises(ValueError, match="Snowflake query IDs"):
        shim.wait_for_queries([])


def _profile(operation, rows):
    return DmlProfile(timestamp=0, operation=operation, rowsAffected=rows)


def test_system_profile_check_rejects_sibling_table_dml():
    check = system_profile_matches([(DmlOperationType.INSERT, 4), (DmlOperationType.DELETE, 1)])
    check([_profile(DmlOperationType.DELETE, 1), _profile(DmlOperationType.INSERT, 4)])
    with pytest.raises(AssertionError, match="system profile"):
        check([_profile(DmlOperationType.INSERT, 4), _profile(DmlOperationType.DELETE, 1), _profile("INSERT", 2)])
    with pytest.raises(AssertionError, match="system profile"):
        check([_profile(DmlOperationType.INSERT, 4)])


def test_cluster_key_check_requires_every_key_column_in_order():
    def table(columns):
        return Table(
            id="00000000-0000-0000-0000-000000000001",
            name="CLUSTERED_EVENTS",
            columns=[{"name": "CATEGORY", "dataType": "VARCHAR"}, {"name": "CREATED_DATE", "dataType": "DATE"}],
            tablePartition={"columns": columns} if columns is not None else None,
        )

    def partition(name, interval_type=PartitionIntervalTypes.COLUMN_VALUE):
        return {"columnName": name, "intervalType": interval_type}

    check = table_is_clustered_by("CATEGORY", "CREATED_DATE")
    check(table([partition("CATEGORY"), partition("CREATED_DATE")]))
    for columns in (
        None,
        [partition("CATEGORY")],
        [partition("CREATED_DATE"), partition("CATEGORY")],
        [partition("CATEGORY"), partition("CREATED_DATE", PartitionIntervalTypes.TIME_UNIT)],
    ):
        with pytest.raises(AssertionError, match="partition"):
            check(table(columns))
