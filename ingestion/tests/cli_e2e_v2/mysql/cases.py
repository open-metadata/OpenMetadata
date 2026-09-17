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
"""MySQL cases and fixture-specific persisted-state checks."""

from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.ingestion.ometa.utils import model_str

from ..features.database.catalog.differ import catalog_matches
from ..features.database.catalog.snapshot import read_catalog
from ..features.database.catalog.types import MatchMode
from ..features.database.entities import column, entity_exists, procedure_has_code
from ..features.database.pipelines import MetadataPipeline
from ..runtime.case import WorkflowCase
from ..runtime.expect import Query
from .connector import mysql_invocation
from .expected import mysql_expected


def mysql_catalog_matches(expected):
    structural = catalog_matches(expected, mode=MatchMode.STRICT)

    def check(snapshot):
        structural(snapshot)
        for database in expected.databases:
            for schema in database.schemas:
                base = f"{expected.name}.{database.name}.{schema.name}"
                for wanted in schema.tables:
                    fqn = f"{base}.{wanted.name}"
                    table = snapshot.find(Table, fqn)
                    if wanted.name == "customer_txn_summary":
                        assert table.tableType == TableType.View, (
                            f"{fqn}: table type: expected View, got {table.tableType}"
                        )
                    if wanted.description is not None:
                        actual = model_str(table.description)
                        assert actual == wanted.description, (
                            f"{fqn}: description: expected {wanted.description!r}, got {actual!r}"
                        )
                    for item in wanted.columns:
                        if item.description is not None:
                            actual = model_str(column(table, item.name).description)
                            assert actual == item.description, (
                                f"{fqn}.{item.name}: description: expected {item.description!r}, got {actual!r}"
                            )

    return check


def catalog_case(*, source, service_name, server, om, filters=None, tables=None):
    expected = mysql_expected(service_name, schema=source.schema, tables=tables)
    return WorkflowCase(
        mysql_invocation(
            service_name=service_name,
            sources=(source,),
            options=MetadataPipeline(includeDDL=True, includeStoredProcedures=True),
            filters=filters or {},
            server=server,
        ),
        Query(f"catalog for {service_name}", lambda: read_catalog(om, service_name)),
        mysql_catalog_matches(expected),
    )


def procedures_have_bodies(snapshot):
    for name, fragments in (
        ("sp_active_customer_count", ("SELECT COUNT(*)",)),
        ("sp_update_customer_status", ("p_customer_id", "UPDATE")),
    ):
        procedure = next((item for item in snapshot.procedures if item.name.root == name), None)
        for fragment in fragments:
            procedure_has_code(fragment)(procedure)


NATIVE_SAMPLE_VALUES = {
    "tiny_int_col": -12,
    "small_int_col": 1234,
    "medium_int_col": 70000,
    "int_col": 123456,
    "big_int_col": 9000000000,
    "float_col": 1.5,
    "double_col": 2.25,
    "decimal_col": 1234.56,
    "char_col": "fixed",
    "varchar_col": "variable",
    "tinytext_col": "tiny text",
    "text_col": "text value",
    "mediumtext_col": "medium text",
    "longtext_col": "long text",
    "binary_col": "0123456789abcdef",
    "varbinary_col": "variable bytes",
    "tinyblob_col": "tiny blob",
    "blob_col": "blob value",
    "mediumblob_col": "[base64]bWVkaXVtIGJsb2I=",
    "longblob_col": "[base64]bG9uZyBibG9i",
    "date_col": "2026-01-02",
    "time_col": "12:34:56",
    "datetime_col": "2026-01-02T12:34:56",
    "timestamp_col": "2026-01-02T12:34:56",
    "year_col": 2026,
    "bit_col": 5,
    "json_col": {"kind": "fixture", "count": 2},
    "enum_col": "beta",
    "set_col": "x,z",
}


def native_sample_rows(table):
    entity_exists(table)
    fqn = model_str(table.fullyQualifiedName)
    assert table.sampleData is not None, f"{fqn}: sample data missing"
    names = [name.root for name in table.sampleData.columns]
    expected_names = {"id", *NATIVE_SAMPLE_VALUES}
    assert len(names) == len(expected_names), (
        f"{fqn}: sample column count: expected {len(expected_names)}, got {len(names)} ({names!r})"
    )
    assert set(names) == expected_names, (
        f"{fqn}: sample columns: missing {sorted(expected_names - set(names))!r}, "
        f"unexpected {sorted(set(names) - expected_names)!r}"
    )
    rows = table.sampleData.rows
    assert len(rows) == 3, f"{fqn}: sample row count: expected 3, got {len(rows)}"
    lengths = [len(row) for row in rows]
    assert all(length == len(names) for length in lengths), (
        f"{fqn}: sample row widths: expected {len(names)} each, got {lengths!r}"
    )
    keyed = {row[names.index("id")]: dict(zip(names, row, strict=True)) for row in rows}
    assert set(keyed) == {1, 2, 3}, f"{fqn}: sample row IDs: expected {{1, 2, 3}}, got {set(keyed)!r}"
    return keyed


def native_samples_match(table, *, int_value=123456):
    keyed = native_sample_rows(table)
    expected_rows = {
        1: {"id": 1, **NATIVE_SAMPLE_VALUES, "int_col": int_value},
        2: {"id": 2, **dict.fromkeys(NATIVE_SAMPLE_VALUES)},
        3: {"id": 3, **dict.fromkeys(NATIVE_SAMPLE_VALUES)},
    }
    differences = {
        (key, name): (wanted, keyed[key][name])
        for key, expected in expected_rows.items()
        for name, wanted in expected.items()
        if keyed[key][name] != wanted
    }
    assert not differences, f"native sample cells differ (row, column): (expected, actual): {differences!r}"
