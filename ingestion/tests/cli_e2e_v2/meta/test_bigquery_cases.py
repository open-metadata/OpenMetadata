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
"""Offline BigQuery suite wiring: invocation scoping, credentials by reference, expectations and checks."""

from dataclasses import replace
from types import SimpleNamespace

import pytest
import yaml

from metadata.generated.schema.entity.data.table import DataType, DmlOperationType, PartitionIntervalTypes, Table
from metadata.generated.schema.entity.data.table import SystemProfile as DmlProfile

from ..bigquery.baseline import build_bigquery_baseline
from ..bigquery.checks import system_profile_matches, table_is_day_partitioned
from ..bigquery.connector import bigquery_invocation, table_diff_invocation
from ..bigquery.expected import bigquery_database, bigquery_expected
from ..bigquery.source import BigQueryInstance, BigQueryProject, BigQuerySource
from ..features.database.pipelines import MetadataPipeline, ProfilerPipeline
from ..features.database.pipelines import TestPipeline as SuitePipeline
from ..server import ServerConfig

_SECRETS = {
    "E2E_BQ_PRIVATE_KEY_ID": "synthetic-key-id",
    "E2E_BQ_CLI_PRIVATE_KEY": "synthetic-private-key",
    "E2E_BQ_CLIENT_EMAIL": "synthetic@example.iam.gserviceaccount.com",
}


@pytest.fixture
def instance(monkeypatch):
    for key, value in {
        **_SECRETS,
        "E2E_BQ_PROJECT_ID": "primary-project",
        "E2E_BQ_PROJECT_ID2": "billing-project",
        "OM_SERVER_URL": "http://127.0.0.1:1/api",
        "OM_JWT_TOKEN": "synthetic-token",
    }.items():
        monkeypatch.setenv(key, value)
    return BigQueryInstance(
        BigQueryProject("primary-project", "E2E_BQ_PROJECT_ID", client=None, admin_engine=None),
        BigQueryProject("billing-project", "E2E_BQ_PROJECT_ID2", client=None, admin_engine=None),
        location="US",
    )


def _source(project, dataset):
    return BigQuerySource(project, dataset, build_bigquery_baseline(project.project_id, dataset))


@pytest.fixture
def server():
    return ServerConfig("http://127.0.0.1:1/api", "synthetic-token", "env")


def _invoke(instance, server, sources, options=None, filters=None):
    return bigquery_invocation(
        service_name="svc",
        sources=sources,
        instance=instance,
        options=options or MetadataPipeline(),
        filters=filters or {},
        server=server,
    )


def test_single_project_scopes_to_owned_dataset_and_bills_second_project(instance, server):
    source = _source(instance.primary, "e2e_bq_owned")
    config = _invoke(instance, server, (source,)).config
    connection = config["source"]["serviceConnection"]["config"]
    assert config["source"]["type"] == "bigquery"
    assert connection["credentials"]["gcpConfig"]["projectId"] == "${E2E_BQ_PROJECT_ID}"
    assert connection["billingProjectId"] == "${E2E_BQ_PROJECT_ID2}"
    assert connection["usageLocation"] == "us"
    assert config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] == {"includes": ["^e2e_bq_owned$"]}


def test_multi_project_lists_projects_without_billing_override(instance, server):
    sources = (_source(instance.primary, "e2e_bq_a"), _source(instance.secondary, "e2e_bq_b"))
    config = _invoke(instance, server, sources).config
    connection = config["source"]["serviceConnection"]["config"]
    assert connection["credentials"]["gcpConfig"]["projectId"] == ["${E2E_BQ_PROJECT_ID}", "${E2E_BQ_PROJECT_ID2}"]
    assert "billingProjectId" not in connection
    assert config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] == {
        "includes": ["^e2e_bq_a$", "^e2e_bq_b$"]
    }


def test_rendered_config_references_credentials_instead_of_embedding_them(instance, server):
    rendered = yaml.safe_dump(_invoke(instance, server, (_source(instance.primary, "e2e_bq_owned"),)).config)
    for value in (*_SECRETS.values(), "synthetic-token"):
        assert value not in rendered
    for key in _SECRETS:
        assert f"${{{key}}}" in rendered


def test_adc_mode_renders_gcp_adc_without_key_references(instance, server):
    adc = replace(instance, auth="adc")
    rendered = _invoke(adc, server, (_source(adc.primary, "e2e_bq_owned"),)).config
    connection = rendered["source"]["serviceConnection"]["config"]
    assert connection["credentials"] == {"gcpConfig": {"type": "gcp_adc", "projectId": "${E2E_BQ_PROJECT_ID}"}}
    assert connection["billingProjectId"] == "${E2E_BQ_PROJECT_ID2}"
    assert not any(key in yaml.safe_dump(rendered) for key in _SECRETS)


def test_filters_merge_with_owned_schema_scope(instance, server):
    source = _source(instance.primary, "e2e_bq_owned")
    config = _invoke(
        instance, server, (source,), ProfilerPipeline(), {"tableFilterPattern": {"includes": ["^events$"]}}
    ).config
    source_config = config["source"]["sourceConfig"]["config"]
    assert config["processor"]["type"] == "orm-profiler"
    assert source_config["tableFilterPattern"]["includes"] == ["^events$"]
    assert source_config["schemaFilterPattern"] == {"includes": ["^e2e_bq_owned$"]}


@pytest.mark.parametrize(
    "case, message",
    [
        ("empty", "nonempty tuple"),
        ("closed", "already been closed"),
        ("foreign-project", "session's E2E projects"),
        ("duplicate", "distinct datasets"),
        ("secondary-only", "primary E2E project"),
        ("unknown-filter", "Unsupported filter fields"),
        ("unscoped-schema-filter", "must include owned datasets"),
        ("filters-without-support", "does not accept filters"),
    ],
)
def test_invocation_rejects_unowned_or_unscoped_runs(instance, server, case, message):
    owned = _source(instance.primary, "e2e_bq_owned")
    sources, options, filters = (owned,), MetadataPipeline(), {}
    if case == "empty":
        sources = ()
    elif case == "closed":
        owned._closed = True
    elif case == "foreign-project":
        foreign = BigQueryProject("primary-project", "E2E_BQ_PROJECT_ID", client=None, admin_engine=None)
        sources = (_source(foreign, "e2e_bq_other"),)
    elif case == "duplicate":
        sources = (owned, _source(instance.primary, "e2e_bq_owned"))
    elif case == "secondary-only":
        sources = (_source(instance.secondary, "e2e_bq_owned"),)
    elif case == "unknown-filter":
        filters = {"storedProcedureFilterPattern": {"includes": [".*"]}}
    elif case == "unscoped-schema-filter":
        filters = {"schemaFilterPattern": {"excludes": ["^other$"]}}
    elif case == "filters-without-support":
        options = SuitePipeline(type="TestSuite", entityFullyQualifiedName="svc.primary-project.e2e_bq_owned.customers")
        filters = {"tableFilterPattern": {"includes": ["customers"]}}
    with pytest.raises(ValueError, match=message):
        _invoke(instance, server, sources, options, filters)


def test_table_diff_moves_connection_into_test_suite_config(instance, server):
    table = "svc.primary-project.e2e_bq_owned.customers"
    base = _invoke(
        instance,
        server,
        (_source(instance.primary, "e2e_bq_owned"),),
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


def test_expected_types_are_strict_for_numeric_and_json():
    database = bigquery_database("primary-project", "e2e_bq_owned")
    assert database.name == "primary-project"
    schema = database.schemas[0]
    assert schema.name == "e2e_bq_owned"
    assert [procedure.name for procedure in schema.stored_procedures] == ["sp_active_customer_count"]
    tables = {table.name: table for table in schema.tables}
    assert set(tables) == {"customers", "transactions", "all_types", "customer_txn_summary"}
    types = {column.name: column.data_type for column in tables["all_types"].columns}
    assert types == {
        "id": DataType.INT,
        "int_col": DataType.INT,
        "float_col": DataType.FLOAT,
        "numeric_col": DataType.NUMERIC,
        "bignumeric_col": DataType.NUMERIC,
        "bool_col": DataType.BOOLEAN,
        "string_col": DataType.STRING,
        "bytes_col": DataType.BINARY,
        "date_col": DataType.DATE,
        "datetime_col": DataType.DATETIME,
        "time_col": DataType.TIME,
        "timestamp_col": DataType.TIMESTAMP,
        "json_col": DataType.JSON,
        "geography_col": DataType.GEOGRAPHY,
        "array_col": DataType.ARRAY,
        "struct_col": DataType.STRUCT,
    }
    amounts = {column.name: column.data_type for column in tables["transactions"].columns}
    assert amounts["amount"] == DataType.NUMERIC
    assert amounts["id"] == DataType.INT
    assert amounts["currency"] == DataType.STRING


def test_filtered_expectation_keeps_procedures_and_multi_project_databases():
    narrowed = bigquery_database("primary-project", "e2e_bq_a", tables={"customers"})
    assert [table.name for table in narrowed.schemas[0].tables] == ["customers"]
    assert narrowed.schemas[0].stored_procedures
    expected = bigquery_expected("svc", narrowed, bigquery_database("billing-project", "e2e_bq_b"))
    assert [database.name for database in expected.databases] == ["primary-project", "billing-project"]


def _profile(operation, rows):
    return DmlProfile(timestamp=0, operation=operation, rowsAffected=rows)


def test_system_profile_check_rejects_sibling_table_dml():
    check = system_profile_matches([(DmlOperationType.INSERT, 4), (DmlOperationType.UPDATE, 1)])
    check([_profile(DmlOperationType.UPDATE, 1), _profile(DmlOperationType.INSERT, 4)])
    with pytest.raises(AssertionError, match="system profile"):
        check([_profile(DmlOperationType.INSERT, 4), _profile(DmlOperationType.UPDATE, 1), _profile("UPDATE", 1)])
    with pytest.raises(AssertionError, match="system profile"):
        check([_profile(DmlOperationType.INSERT, 4)])


def test_partition_check_requires_the_day_partition_column():
    def table(columns):
        return Table(
            id="00000000-0000-0000-0000-000000000001",
            name="events",
            columns=[{"name": "event_date", "dataType": "DATE"}],
            tablePartition={"columns": columns} if columns is not None else None,
        )

    check = table_is_day_partitioned("event_date")
    check(table([{"columnName": "event_date", "intervalType": PartitionIntervalTypes.TIME_UNIT, "interval": "DAY"}]))
    for columns in (
        None,
        [{"columnName": "event_date", "intervalType": PartitionIntervalTypes.INGESTION_TIME, "interval": "DAY"}],
        [{"columnName": "_PARTITIONDATE", "intervalType": PartitionIntervalTypes.TIME_UNIT, "interval": "DAY"}],
    ):
        with pytest.raises(AssertionError, match="partition"):
            check(table(columns))
