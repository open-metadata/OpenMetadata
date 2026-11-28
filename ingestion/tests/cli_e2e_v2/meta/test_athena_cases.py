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
"""Offline Athena ownership gates, cleanup guards and seed rendering."""

from datetime import date, datetime
from decimal import Decimal

import pytest

from ..athena.baseline import (
    AthenaColumn,
    AthenaTable,
    Raw,
    TableFormat,
    build_athena_baseline,
    create_table_ddl,
    insert_sql,
    render_value,
)
from ..athena.connector import OM_DATABASE, athena_invocation
from ..athena.expected import ALL_TABLES, athena_schema
from ..athena.source import (
    AthenaInstance,
    AthenaSource,
    S3Location,
    _delete_database,
    _delete_prefix,
    default_data_root,
)
from ..features.database.pipelines import LineagePipeline, MetadataPipeline, ProfilerPipeline
from ..server import ServerConfig

_DATABASE = "e2e_athena_" + "a" * 32
_OTHER = "e2e_athena_" + "b" * 32


class _Refuse:
    """Stands in for AWS clients: any call fails the test."""

    def __getattr__(self, name):
        raise AssertionError(f"unexpected AWS call {name}")


@pytest.fixture
def instance(monkeypatch):
    monkeypatch.setenv("E2E_ATHENA_REGION", "us-east-2")
    monkeypatch.setenv("E2E_ATHENA_S3STAGINGDIR", "s3://staging-bucket/output/")
    monkeypatch.setenv("E2E_ATHENA_WORKGROUP", "primary")
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:1/api")
    monkeypatch.setenv("OM_JWT_TOKEN", "synthetic-token")
    root = default_data_root("s3://staging-bucket/output/")
    return AthenaInstance("us-east-2", "primary", root, _Refuse(), _Refuse(), _Refuse())


def _source(instance, database=_DATABASE):
    return AthenaSource(instance, database, instance.data_root.child(database), build_athena_baseline())


def _invocation(instance, sources, options=None, filters=None):
    return athena_invocation(
        service_name="fixture_service",
        sources=sources,
        instance=instance,
        options=MetadataPipeline() if options is None else options,
        filters={} if filters is None else filters,
        server=ServerConfig("http://127.0.0.1:1/api", "synthetic-token", "env"),
    )


@pytest.mark.parametrize(
    "options", [MetadataPipeline(), ProfilerPipeline(), LineagePipeline(processQueryLineage=False)]
)
def test_every_invocation_scopes_to_exact_owned_database(instance, options):
    config = _invocation(instance, (_source(instance),), options).config["source"]
    assert config["sourceConfig"]["config"]["schemaFilterPattern"]["includes"] == [f"^{_DATABASE}$"]
    connection = config["serviceConnection"]["config"]
    assert connection == {
        "type": "Athena",
        "awsConfig": {"awsRegion": "${E2E_ATHENA_REGION}"},
        "s3StagingDir": "${E2E_ATHENA_S3STAGINGDIR}",
        "workgroup": "${E2E_ATHENA_WORKGROUP}",
        "databaseName": OM_DATABASE,
    }


def test_schema_filter_anchors_owned_includes_and_excludes(instance):
    sources = (_source(instance), _source(instance, _OTHER))
    pattern = {"includes": [_DATABASE, _OTHER], "excludes": [_OTHER]}
    config = _invocation(instance, sources, filters={"schemaFilterPattern": pattern}).config["source"]
    assert config["sourceConfig"]["config"]["schemaFilterPattern"] == {
        "includes": [f"^{_DATABASE}$", f"^{_OTHER}$"],
        "excludes": [f"^{_OTHER}$"],
    }


@pytest.mark.parametrize(
    "filters",
    [
        {"schemaFilterPattern": {"includes": ["e2e_db"]}},
        {"schemaFilterPattern": {"includes": [".*"]}},
        {"schemaFilterPattern": {"includes": []}},
        {"schemaFilterPattern": {"excludes": ["default"]}},
        {"databaseFilterPattern": {"includes": [".*"]}},
    ],
)
def test_invocation_rejects_unowned_scopes(instance, filters):
    with pytest.raises(ValueError):
        _invocation(instance, (_source(instance),), filters=filters)


def test_invocation_rejects_closed_foreign_and_duplicate_sources(instance):
    with pytest.raises(ValueError, match="nonempty tuple"):
        _invocation(instance, ())
    with pytest.raises(ValueError, match="distinct databases"):
        _invocation(instance, (_source(instance), _source(instance)))
    foreign = AthenaInstance("us-east-2", "primary", instance.data_root, _Refuse(), _Refuse(), _Refuse())
    with pytest.raises(ValueError, match="session's E2E account"):
        _invocation(instance, (_source(foreign),))
    closed = _source(instance)
    closed._closed = True
    with pytest.raises(ValueError, match="already been closed"):
        _invocation(instance, (closed,))


def test_cleanup_refuses_unowned_databases_and_prefixes():
    with pytest.raises(ValueError, match="not a suite-owned"):
        _delete_database(_Refuse(), "e2e_db")
    with pytest.raises(ValueError, match="not a suite-owned"):
        _delete_prefix(_Refuse(), S3Location("bucket", "cli-e2e-v2/"), "e2e_db")
    with pytest.raises(ValueError, match="does not own"):
        _delete_prefix(_Refuse(), S3Location("bucket", "cli-e2e-v2/"), _DATABASE)


def test_s3_locations_are_parsed_and_owned_under_the_staging_bucket():
    assert default_data_root("s3://athena-results/output/") == S3Location("athena-results", "cli-e2e-v2/")
    assert S3Location.parse("s3://bucket/a/b").prefix == "a/b/"
    assert S3Location.parse("s3://bucket").prefix == ""
    assert S3Location("bucket", "cli-e2e-v2/").child(_DATABASE).uri == f"s3://bucket/cli-e2e-v2/{_DATABASE}/"
    for invalid in ("https://bucket/x", "bucket/x"):
        with pytest.raises(ValueError):
            S3Location.parse(invalid)
    with pytest.raises(ValueError):
        S3Location("bucket", "").child("a/b")


def test_seed_values_render_as_typed_athena_literals():
    assert render_value(None, "int") == "CAST(NULL AS integer)"
    assert render_value(True, "boolean") == "CAST(TRUE AS boolean)"
    assert render_value(127, "tinyint") == "CAST(127 AS tinyint)"
    assert render_value(Decimal("1.50"), "decimal(10,2)") == "CAST(1.50 AS decimal(10,2))"
    assert render_value("O'Brien", "string") == "CAST('O''Brien' AS varchar)"
    assert render_value(date(2022, 8, 8), "date") == "CAST(DATE '2022-08-08' AS date)"
    assert render_value(datetime(2022, 8, 8, 1, 2, 3), "timestamp") == (
        "CAST(TIMESTAMP '2022-08-08 01:02:03' AS timestamp)"
    )
    assert render_value(b"ab", "binary") == "CAST(X'6162' AS varbinary)"
    assert render_value(Raw("ARRAY['a']"), "array<string>") == "ARRAY['a']"
    with pytest.raises(TypeError):
        render_value(object(), "string")


def test_table_ddl_and_inserts_keep_partitions_last():
    table = AthenaTable(
        name="events",
        table_format=TableFormat.HIVE,
        columns=(AthenaColumn("id", "int", "Key."),),
        partition_columns=(AthenaColumn("day", "string"),),
        rows=({"id": 1, "day": "2026-01-01"},),
        comment="Events.",
    )
    assert create_table_ddl(table, database=_DATABASE, location="s3://bucket/p/events/") == (
        f"CREATE EXTERNAL TABLE `{_DATABASE}`.`events` (`id` int COMMENT 'Key.') COMMENT 'Events.' "
        "PARTITIONED BY (`day` string) STORED AS PARQUET LOCATION 's3://bucket/p/events/'"
    )
    assert insert_sql(table, database=_DATABASE) == (
        f'INSERT INTO "{_DATABASE}"."events" ("id", "day") VALUES (CAST(1 AS integer), CAST(\'2026-01-01\' AS varchar))'
    )
    iceberg = build_athena_baseline().table("orders")
    assert create_table_ddl(iceberg, database=_DATABASE, location="s3://bucket/p/orders/").endswith(
        "LOCATION 's3://bucket/p/orders/' TBLPROPERTIES ('table_type'='ICEBERG')"
    )


def test_every_seeded_table_and_view_has_an_expectation():
    baseline = build_athena_baseline()
    declared = {table.name for table in baseline.tables} | {view.name for view in baseline.views}
    assert declared == ALL_TABLES
    expected = athena_schema(_DATABASE)
    for table in baseline.tables:
        columns = {column.name for column in table.insert_columns}
        assert {column.name for column in next(t for t in expected.tables if t.name == table.name).columns} == columns
        for row in table.rows:
            assert set(row) == columns, table.name
    with pytest.raises(ValueError, match="Unknown Athena fixture tables"):
        athena_schema(_DATABASE, tables={"missing"})
