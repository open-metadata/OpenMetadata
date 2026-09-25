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
"""Offline MySQL case and strict sample-read boundary regressions."""

import sqlite3
import sys
from dataclasses import replace
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import DataType, Table, TableData, TableType
from metadata.generated.schema.entity.services.databaseService import DatabaseService, DatabaseServiceType
from metadata.ingestion.ometa.client import APIError, RestTransportError
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from ..features.database.catalog.differ import StructuralMismatch, catalog_matches
from ..features.database.catalog.snapshot import CatalogSnapshot
from ..features.database.catalog.types import (
    ExpectedColumn,
    ExpectedDatabase,
    ExpectedSchema,
    ExpectedService,
    ExpectedTable,
)
from ..features.database.entities import table_query
from ..features.database.pipelines import pipeline_spec
from ..features.database.samples import sample_query
from ..mysql.checks import native_sample_rows, native_samples_match
from ..mysql.expected import mysql_expected
from ..mysql.test_samples import test_reingest_replaces_persisted_samples as sample_replacement_scenario
from ..runtime import expect
from ..runtime.cli import CliRunner, WorkflowInvocation
from ..runtime.expect import Query


@pytest.fixture
def sample_table():
    return Table(
        id="00000000-0000-0000-0000-000000000001",
        name="all_types",
        fullyQualifiedName="svc.default.demo.all_types",
        columns=[{"name": "id", "dataType": "INT"}],
        sampleData={"columns": ["id"], "rows": [[1]]},
    )


def scripted_sample_query(table, responses):
    pending = iter(responses)

    def get(path):
        assert path == "/tables/00000000-0000-0000-0000-000000000001/sampleData"
        value = next(pending)
        if isinstance(value, Exception):
            raise value
        return value

    return sample_query(SimpleNamespace(client=SimpleNamespace(get=get), get_suffix=OpenMetadata.get_suffix), table)


def sample_present(table):
    assert table is not None and table.sampleData is not None


def test_sample_absence_converges_via_generated_table_parser(polling_clock, sample_table):
    query = scripted_sample_query(
        sample_table, [APIError({"code": 404, "message": "Not found"}), sample_table.model_dump(mode="json")]
    )
    observed = expect.poll(query).satisfies(sample_present)
    assert isinstance(observed, Table)
    assert observed.sampleData.rows == [[1]]


@pytest.mark.parametrize("code", [401, 403, 500])
def test_sample_http_failure_is_not_retryable_absence(polling_clock, sample_table, code):
    error = APIError({"code": code, "message": "Sample request failed"})
    with pytest.raises(APIError) as raised:
        expect.poll(scripted_sample_query(sample_table, [error, sample_table.model_dump()])).satisfies(sample_present)
    assert raised.value is error


@pytest.mark.parametrize(
    "error", [RestTransportError("GET", "samples", TimeoutError("request timed out")), ValueError("invalid JSON")]
)
def test_sample_transport_or_json_failure_propagates(polling_clock, sample_table, error):
    with pytest.raises(type(error)) as raised:
        expect.poll(scripted_sample_query(sample_table, [error, sample_table.model_dump()])).satisfies(sample_present)
    assert raised.value is error


@pytest.mark.parametrize("malformed", [{}, {"id": "not-a-uuid"}, None])
def test_sample_generated_model_parse_failure_propagates(polling_clock, sample_table, malformed):
    with pytest.raises(ValidationError):
        expect.poll(scripted_sample_query(sample_table, [malformed, sample_table.model_dump()])).satisfies(
            sample_present
        )


def test_filter_expectation_preserves_procedures_and_explicit_schema():
    expected = mysql_expected("svc", schema="owned_schema", tables={"customers"})
    assert expected.name == "svc"
    assert [database.name for database in expected.databases] == ["default"]
    schema = expected.databases[0].schemas[0]
    assert schema.name == "owned_schema"
    assert [table.name for table in schema.tables] == ["customers"]
    assert {procedure.name for procedure in schema.stored_procedures} == {
        "sp_active_customer_count",
        "sp_update_customer_status",
    }


@pytest.fixture
def catalog():
    identifier = "00000000-0000-0000-0000-000000000001"
    service_ref = {"id": identifier, "type": "databaseService", "fullyQualifiedName": "svc"}
    database_ref = {"id": identifier, "type": "database", "fullyQualifiedName": "svc.default"}
    schema_ref = {"id": identifier, "type": "databaseSchema", "fullyQualifiedName": "svc.default.demo"}
    return CatalogSnapshot(
        DatabaseService(id=identifier, name="svc", fullyQualifiedName="svc", serviceType="Mysql"),
        (Database(id=identifier, name="default", fullyQualifiedName="svc.default", service=service_ref),),
        (
            DatabaseSchema(
                id=identifier,
                name="demo",
                fullyQualifiedName="svc.default.demo",
                database=database_ref,
                service=service_ref,
            ),
        ),
        (
            Table(
                id=identifier,
                name="customer_txn_summary",
                fullyQualifiedName="svc.default.demo.customer_txn_summary",
                databaseSchema=schema_ref,
                tableType="View",
                description="Fixture view",
                columns=[{"name": "customer_id", "dataType": "INT", "description": "Customer identity"}],
            ),
        ),
    )


def catalog_check(*, service="svc", database="default", schema="demo", table="customer_txn_summary"):
    return catalog_matches(
        ExpectedService(
            service,
            DatabaseServiceType.Mysql,
            [
                ExpectedDatabase(
                    database,
                    [
                        ExpectedSchema(
                            schema,
                            [
                                ExpectedTable(
                                    table,
                                    [ExpectedColumn("customer_id", DataType.INT, description="Customer identity")],
                                    description="Fixture view",
                                    table_type=TableType.View,
                                )
                            ],
                        )
                    ],
                )
            ],
        )
    )


@pytest.mark.parametrize(
    "table_name,table_fqn",
    [
        ("customer_txn_summary", '"svc.prod"."db.prod"."schema.prod".customer_txn_summary'),
        ("summary.archive", '"svc.prod"."db.prod"."schema.prod"."summary.archive"'),
    ],
)
def test_catalog_field_checks_resolve_canonical_quoted_identifiers(catalog, table_name, table_fqn):
    identities = {
        "svc": ("svc.prod", '"svc.prod"'),
        "svc.default": ("db.prod", '"svc.prod"."db.prod"'),
        "svc.default.demo": ("schema.prod", '"svc.prod"."db.prod"."schema.prod"'),
        "svc.default.demo.customer_txn_summary": (table_name, table_fqn),
    }

    def rename(entity):
        payload = entity.model_dump(mode="json")
        payload["name"], payload["fullyQualifiedName"] = identities[payload["fullyQualifiedName"]]
        for field in ("service", "database", "databaseSchema"):
            if payload.get(field):
                payload[field]["fullyQualifiedName"] = identities[payload[field]["fullyQualifiedName"]][1]
        return type(entity).model_validate(payload)

    catalog = replace(
        catalog,
        service=rename(catalog.service),
        databases=tuple(rename(entity) for entity in catalog.databases),
        schemas=tuple(rename(entity) for entity in catalog.schemas),
        tables=tuple(rename(entity) for entity in catalog.tables),
    )
    check = catalog_check(service="svc.prod", database="db.prod", schema="schema.prod", table=table_name)
    check(catalog)
    changed = catalog.tables[0].model_copy(update={"description": "Fixture view with stale suffix"})
    with pytest.raises(AssertionError, match="description"):
        check(replace(catalog, tables=(changed,)))


def test_catalog_requires_exact_descriptions_view_type_and_no_extra_entities(catalog):
    check = catalog_check()
    check(catalog)
    for changed in (
        catalog.tables[0].model_copy(update={"description": "Fixture view with stale suffix"}),
        catalog.tables[0].model_copy(update={"tableType": TableType.Regular}),
    ):
        with pytest.raises(AssertionError):
            check(replace(catalog, tables=(changed,)))
    with pytest.raises(AssertionError):
        check(replace(catalog, tables=()))
    extra = catalog.tables[0].model_copy(deep=True)
    extra.name.root = "extra_view"
    extra.fullyQualifiedName.root = "svc.default.demo.extra_view"
    with pytest.raises(AssertionError):
        check(replace(catalog, tables=(*catalog.tables, extra)))
    changed = catalog.tables[0].model_copy(deep=True)
    changed.columns[0].description.root = "Customer identity stale"
    with pytest.raises(AssertionError):
        check(replace(catalog, tables=(changed,)))


def test_mysql_view_declaration_rejects_a_persisted_regular_table(catalog):
    view = next(
        table
        for table in mysql_expected("svc", schema="demo").databases[0].schemas[0].tables
        if table.name == "customer_txn_summary"
    )
    expected = ExpectedService(
        "svc", DatabaseServiceType.Mysql, [ExpectedDatabase("default", [ExpectedSchema("demo", [view])])]
    )
    payload = catalog.tables[0].model_dump(mode="json")
    payload["columns"] = [
        {"name": "customer_id", "dataType": "INT"},
        {"name": "full_name", "dataType": "VARCHAR"},
        {"name": "customer_status", "dataType": "VARCHAR"},
        {"name": "txn_count", "dataType": "BIGINT"},
        {"name": "total_amount", "dataType": "DECIMAL"},
    ]
    snapshot = replace(catalog, tables=(Table.model_validate(payload),))
    check = catalog_matches(expected)
    check(snapshot)
    changed = snapshot.tables[0].model_copy(update={"tableType": TableType.Regular})
    with pytest.raises(StructuralMismatch, match="tableType"):
        check(replace(snapshot, tables=(changed,)))


def test_catalog_reports_all_field_mismatches_in_one_observation(catalog):
    changed = catalog.tables[0].model_copy(deep=True)
    changed.tableType = TableType.Regular
    changed.description.root = "Fixture view stale"
    changed.columns[0].description.root = "Customer identity stale"
    with pytest.raises(StructuralMismatch) as raised:
        catalog_check()(replace(catalog, tables=(changed,)))
    assert {diff.path for diff in raised.value.diffs} == {
        "svc.default.demo.table[customer_txn_summary].tableType",
        "svc.default.demo.table[customer_txn_summary].description",
        "svc.default.demo.table[customer_txn_summary].column[customer_id].description",
    }


@pytest.mark.parametrize(
    "field, expected, actual",
    [
        ("tableType", "View", "Regular"),
        ("description", "Fixture view", "Fixture view with stale suffix"),
        ("column_description", "Customer identity", "Customer identity with stale suffix"),
    ],
)
def test_catalog_poll_failure_identifies_entity_and_mismatched_values(catalog, polling_clock, field, expected, actual):
    changed = catalog.tables[0].model_copy(deep=True)
    if field == "column_description":
        changed.columns[0].description.root = actual
    elif field == "description":
        changed.description.root = actual
    else:
        changed.tableType = TableType.Regular
    query = Query("MySQL catalog", lambda: replace(catalog, tables=(changed,)))
    with pytest.raises(AssertionError) as raised:
        expect.poll(query, timeout=1).satisfies(catalog_check())
    message = str(raised.value)
    assert "svc.default.demo.table[customer_txn_summary]" in message
    if field == "column_description":
        assert ".column[customer_id].description" in message
    assert "expected" in message and "actual" in message
    assert expected in message and actual in message


def test_native_samples_reject_missing_null_only_and_incomplete_samples(sample_table):
    for sample in (None, sample_table, sample_table.model_copy(update={"sampleData": None})):
        with pytest.raises(AssertionError):
            native_samples_match(sample)


@pytest.fixture
def native_sample_table(sample_table):
    names = [
        "id",
        "tiny_int_col",
        "small_int_col",
        "medium_int_col",
        "int_col",
        "big_int_col",
        "float_col",
        "double_col",
        "decimal_col",
        "char_col",
        "varchar_col",
        "tinytext_col",
        "text_col",
        "mediumtext_col",
        "longtext_col",
        "binary_col",
        "varbinary_col",
        "tinyblob_col",
        "blob_col",
        "mediumblob_col",
        "longblob_col",
        "date_col",
        "time_col",
        "datetime_col",
        "timestamp_col",
        "year_col",
        "bit_col",
        "json_col",
        "enum_col",
        "set_col",
    ]
    populated = [
        1,
        -12,
        1234,
        70000,
        123456,
        9000000000,
        1.5,
        2.25,
        1234.56,
        "fixed",
        "variable",
        "tiny text",
        "text value",
        "medium text",
        "long text",
        "0123456789abcdef",
        "variable bytes",
        "tiny blob",
        "blob value",
        "[base64]bWVkaXVtIGJsb2I=",
        "[base64]bG9uZyBibG9i",
        "2026-01-02",
        "12:34:56",
        "2026-01-02T12:34:56",
        "2026-01-02T12:34:56",
        2026,
        5,
        {"kind": "fixture", "count": 2},
        "beta",
        "x,z",
    ]
    sample_table.sampleData = TableData(columns=names, rows=[[3, *([None] * 29)], populated, [2, *([None] * 29)]])
    return sample_table


def test_native_samples_match_by_id_without_losing_null_rows(native_sample_table):
    native_samples_match(native_sample_table)
    native_sample_table.sampleData.rows[1][4] = 654321
    with pytest.raises(AssertionError):
        native_samples_match(native_sample_table)
    native_samples_match(native_sample_table, int_value=654321)


def test_native_sample_rows_leave_independent_update_and_strict_values_observable(native_sample_table):
    names = [name.root for name in native_sample_table.sampleData.columns]
    for row in native_sample_table.sampleData.rows:
        row[names.index("year_col")] = "OPENMETADATA_UNDETERMIND[]"
        if row[0] == 1:
            row[names.index("int_col")] = 654321
    rows = native_sample_rows(native_sample_table)
    assert {key: row["int_col"] for key, row in rows.items()} == {1: 654321, 2: None, 3: None}
    assert rows[2]["year_col"] == "OPENMETADATA_UNDETERMIND[]"
    with pytest.raises(AssertionError, match="year_col"):
        native_samples_match(native_sample_table, int_value=654321)


@pytest.mark.parametrize(
    "mutation", ["null-payload", "wrong-value", "duplicate-id", "lost-null-row", "duplicate-column"]
)
def test_native_samples_reject_corruption(native_sample_table, mutation):
    data = native_sample_table.sampleData
    if mutation == "null-payload":
        data.rows[1][1:] = [None] * 29
    elif mutation == "wrong-value":
        data.rows[1][8] = "1234.56"
    elif mutation == "duplicate-id":
        data.rows[0][0] = 2
    elif mutation == "lost-null-row":
        data.rows.pop()
    else:
        data.columns.append(data.columns[-1])
        for row in data.rows:
            row.append(row[-1])
    with pytest.raises(AssertionError):
        native_samples_match(native_sample_table)


@pytest.mark.parametrize("sampler", ["replace", "write-once", "wrong-initial"])
def test_sample_replacement_scenario_requires_both_persisted_states(
    tmp_path, polling_clock, native_sample_table, sampler
):
    database = tmp_path / "samples.db"
    with sqlite3.connect(database) as connection:
        connection.executescript(
            "CREATE TABLE all_types (id INTEGER PRIMARY KEY, int_col INTEGER);"
            "INSERT INTO all_types VALUES (1, 123456);"
            "CREATE TABLE persisted_sample (int_col INTEGER);"
            "CREATE TABLE persisted_table (id TEXT PRIMARY KEY);"
        )
    script = tmp_path / "sampler.py"
    script.write_text("""
import json
import sqlite3
import sys
from pathlib import Path
import yaml

config = yaml.safe_load(Path(sys.argv[sys.argv.index("-c") + 1]).read_text())
subcommand = sys.argv[1]
with sqlite3.connect(config["database"]) as connection:
    if subcommand == "ingest":
        connection.execute("INSERT INTO persisted_table VALUES ('00000000-0000-0000-0000-000000000001')")
    elif subcommand == "classify":
        assert connection.execute("SELECT id FROM persisted_table").fetchone() is not None
        value = connection.execute("SELECT int_col FROM all_types WHERE id = 1").fetchone()[0]
        previous = connection.execute("SELECT int_col FROM persisted_sample").fetchone()
        if config["sampler"] != "write-once" or previous is None:
            connection.execute("DELETE FROM persisted_sample")
            connection.execute("INSERT INTO persisted_sample VALUES (?)",
                               (654321 if config["sampler"] == "wrong-initial" else value,))
    else:
        raise AssertionError(f"unexpected subcommand: {subcommand}")
status = {"source_type": "sqlite", "success": True,
          "steps": [{"name": "Sampler", "records": 1, "updated_records": 0,
                     "warnings": 0, "errors": 0, "filtered": 0, "failures": []}]}
Path(sys.argv[sys.argv.index("--status-file") + 1]).write_text(json.dumps(status))
""")
    cli = CliRunner(tmp_path / "cli", command=(sys.executable, str(script)))

    def set_value(table, key, column, value):
        assert (table, key, column) == ("all_types", 1, "int_col")
        with sqlite3.connect(database) as connection:
            connection.execute("UPDATE all_types SET int_col = ? WHERE id = ?", (value, key))

    def get_sample(path):
        assert path == "/tables/00000000-0000-0000-0000-000000000001/sampleData"
        with sqlite3.connect(database) as connection:
            stored = connection.execute("SELECT int_col FROM persisted_sample").fetchone()
        table = native_sample_table.model_copy(deep=True)
        if stored is None:
            table.sampleData = None
        else:
            names = [name.root for name in table.sampleData.columns]
            for row in table.sampleData.rows:
                if row[names.index("id")] == 1:
                    row[names.index("int_col")] = stored[0]
        return table.model_dump(mode="json")

    def get_table(*, entity, fqn, fields, include):
        assert entity is Table and fqn == "svc.default.demo.all_types"
        with sqlite3.connect(database) as connection:
            if connection.execute("SELECT id FROM persisted_table").fetchone() is None:
                return None
            assert connection.execute("SELECT int_col FROM persisted_sample").fetchone() is None
        return native_sample_table.model_copy(update={"sampleData": None})

    def run():
        om = SimpleNamespace(
            get_by_name=get_table,
            client=SimpleNamespace(get=get_sample),
            get_suffix=OpenMetadata.get_suffix,
        )
        sample_replacement_scenario(
            cli=cli,
            mysql=SimpleNamespace(
                om=om,
                invocation=lambda options, *, filters: WorkflowInvocation(
                    pipeline_spec(options).cli_subcommand, {"database": str(database), "sampler": sampler}
                ),
                table_query=lambda name: table_query(om, f"svc.default.demo.{name}"),
                source=SimpleNamespace(schema="demo", set_value=set_value),
            ),
        )

    if sampler == "replace":
        run()
        with sqlite3.connect(database) as connection:
            assert connection.execute("SELECT int_col FROM persisted_sample").fetchall() == [(654321,)]
    else:
        expected, actual = (654321, 123456) if sampler == "write-once" else (123456, 654321)
        with pytest.raises(AssertionError, match=rf"int_col samples: expected.*{expected}.*got.*{actual}"):
            run()
