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
"""Exasol-specific persisted-state queries and checks: native samples and query-log usage."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import text

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.utils import model_str

from ..features.database.entities import entity_exists
from ..runtime.expect import Query
from .baseline import NATIVE_COLUMN_NAMES, NATIVE_ROWS


def native_sample_rows(table) -> list[dict]:
    """Return the persisted sample of the native table as {column: value} rows ordered by id."""
    entity_exists(table)
    fqn = model_str(table.fullyQualifiedName)
    assert table.sampleData is not None, f"{fqn}: sample data missing"
    names = [model_str(name) for name in table.sampleData.columns]
    assert sorted(names) == sorted(NATIVE_COLUMN_NAMES), f"{fqn}: sample columns {names!r}"
    rows = [dict(zip(names, row, strict=True)) for row in table.sampleData.rows]
    return sorted(rows, key=lambda row: row["id"])


def _as_text(value) -> str:
    # The date/time separator differs between drivers and serializers; the instant does not.
    text_value = value.isoformat() if isinstance(value, (date, datetime)) else str(value)
    return text_value.replace("T", " ")


def native_samples_match(table, *, decimal_value: float = NATIVE_ROWS[0]["col_decimal"]):
    """Both seeded rows, with the first row's DOUBLE possibly replaced by a mutation."""
    rows = native_sample_rows(table)
    assert len(rows) == len(NATIVE_ROWS), f"sample rows: expected {len(NATIVE_ROWS)}, got {len(rows)}"
    expected_rows = [{**NATIVE_ROWS[0], "col_decimal": decimal_value}, *NATIVE_ROWS[1:]]
    for actual, expected in zip(rows, expected_rows, strict=True):
        for name, value in expected.items():
            observed = actual[name]
            if isinstance(value, date):
                # Samples persist dates and timestamps as text; compare their calendar value.
                assert _as_text(observed).startswith(_as_text(value)), f"{name} sample: {observed!r} != {value!r}"
            else:
                assert observed == value, f"{name} sample: expected {value!r}, got {observed!r}"


def sample_row_count(expected: int):
    def check(table):
        entity_exists(table)
        assert table.sampleData is not None, "sample data missing"
        actual = len(table.sampleData.rows)
        assert actual == expected, f"sample rows: expected {expected}, got {actual}"

    return check


def audited_select_query(engine, schema: str) -> Query[int]:
    """Successful SELECTs naming the schema, as the connector's usage query sees them.

    Exasol writes audit rows from its statistics buffer; FLUSH STATISTICS forces them
    out so the usage workflow cannot run before the statement is visible.
    """

    def read() -> int:
        with engine.begin() as connection:
            connection.execute(text("FLUSH STATISTICS"))
            return connection.execute(
                text(
                    "SELECT COUNT(*) FROM EXA_STATISTICS.EXA_DBA_AUDIT_SQL "
                    "WHERE command_name = 'SELECT' AND success = TRUE "
                    "AND INSTR(LOWER(sql_text), :schema) > 0"
                ),
                {"schema": f"{schema}."},
            ).scalar_one()

    return Query(f"audited SELECTs on {schema}", read)


def at_least(minimum: int):
    def check(count: int) -> None:
        assert count >= minimum, f"expected at least {minimum}, got {count}"

    return check


def usage_query(om, fqn: str) -> Query[tuple[Table | None, list]]:
    """The table with its usage fields, plus the query entities attached to it."""

    def read():
        table = om.get_by_name(entity=Table, fqn=fqn, fields=["usageSummary", "lifeCycle", "joins"])
        queries = [] if table is None else om.get_entity_queries(table.id.root, fields=["queryUsedIn"])
        return table, queries

    return Query(f"usage of {fqn}", read)


def _used_in(query) -> list:
    return query.queryUsedIn.root if query.queryUsedIn else []


def table_has_join_usage(column: str, joined_column_fqn: str):
    """Usage summary, access time, the SELECT attributed to the table, and the column join."""

    def check(observation) -> None:
        table, queries = observation
        entity_exists(table)
        summary = table.usageSummary
        assert summary is not None, "usage summary missing"
        for period in ("dailyStats", "weeklyStats", "monthlyStats"):
            count = getattr(summary, period).count
            assert count >= 1, f"{period}.count: expected at least 1, got {count}"
        assert table.lifeCycle is not None and table.lifeCycle.accessed is not None, "lifeCycle.accessed missing"
        selects = [query for query in queries or [] if model_str(query.query).lstrip().upper().startswith("SELECT")]
        assert selects, "no SELECT query attached to the table"
        assert any(used.id.root == table.id.root for query in selects for used in _used_in(query)), (
            "no SELECT query lists the table in queryUsedIn"
        )
        joins = table.joins.columnJoins if table.joins and table.joins.columnJoins else []
        column_join = next((item for item in joins if model_str(item.columnName).lower() == column), None)
        assert column_join is not None, f"no column join recorded for {column}"
        joined = {model_str(item.fullyQualifiedName).lower() for item in column_join.joinedWith}
        assert joined_column_fqn.lower() in joined, f"{column} joins {sorted(joined)}, not {joined_column_fqn}"

    return check
