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
"""
Validate the SQL the profiler emits for BigQuery against the real BigQuery dialect.
"""

import re
from types import SimpleNamespace

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session
from sqlalchemy.sql.sqltypes import NullType
from sqlalchemy_bigquery import STRUCT
from sqlalchemy_bigquery.base import BigQueryDialect

from metadata.profiler.interface.sqlalchemy.bigquery.profiler_interface import (
    BigQueryProfilerInterface,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.static.unique_count import UniqueCount

TABLE_NAME = "users"
# Mirrors BigQueryProfilerInterface._get_struct_columns, which names a STRUCT subfield
# with a literal dot so the inner query can address it as a record path.
NESTED_COLUMN = "customer.email"
FLAT_COLUMN = "email"

# `pyformat` is the paramstyle the BigQuery DBAPI actually uses; it is the only one that
# renders the `%(name:TYPE)s` bind annotations we assert on below.
DIALECT = BigQueryDialect(paramstyle="pyformat")


class _BigQuerySession(Session):
    """A real ORM Session that reports the BigQuery dialect without needing GCP credentials.

    Only the connection is stubbed - statement construction and compilation stay real.
    """

    def get_bind(self, *args, **kwargs):
        return SimpleNamespace(dialect=DIALECT)


class _RecordingRunner:
    """Captures the query the profiler would have executed instead of hitting BigQuery."""

    def __init__(self):
        self.query = None

    def select_first_from_query(self, query):
        self.query = query
        return SimpleNamespace(_asdict=lambda: {UniqueCount.name(): 1})


def _sample_table(column_name):
    return sa.Table(TABLE_NAME, sa.MetaData(), sa.Column(column_name, sa.String))


def _compile(statement, literal_binds=True):
    compiled = statement.compile(dialect=DIALECT, compile_kwargs={"literal_binds": literal_binds})
    return " ".join(str(compiled).split())


def _profiler_unique_count_sql(column_name, column_type=sa.String, literal_binds=True):
    """Run the real profiler query-metric path for uniqueCount and return the emitted SQL."""
    sample = _sample_table(column_name)
    runner = _RecordingRunner()
    session = _BigQuerySession()

    SQAProfilerInterface._compute_query_metrics(
        SimpleNamespace(session=session),
        metric=Metrics.uniqueCount.value,
        runner=runner,
        column=sa.Column(column_name, column_type),
        session=session,
        sample=sample,
    )

    assert runner.query is not None, "The profiler never produced a uniqueCount query"
    return _compile(runner.query.statement, literal_binds=literal_binds)


def _countif_operand(sql):
    match = re.search(r"countif\((.+?) = ", sql)
    assert match, f"No COUNTIF comparison found in:\n{sql}"
    return match.group(1)


def _grouped_output_label(sql, source):
    """The alias the grouped sub-select/CTE exposes to the enclosing query."""
    match = re.search(r"AS `([^`]+)` FROM `" + re.escape(source) + "`", sql)
    assert match, f"No grouped output alias found in:\n{sql}"
    return match.group(1)


def test_struct_columns_are_attached_to_the_profiled_table():
    struct = STRUCT(email=sa.String)
    table = sa.Table(TABLE_NAME, sa.MetaData(), sa.Column("customer", struct))
    profiler = object.__new__(BigQueryProfilerInterface)
    profiler._table = SimpleNamespace(__table__=table)

    columns = profiler._get_struct_columns(struct._STRUCT_fields, "customer")

    assert [column.name for column in columns] == [NESTED_COLUMN]
    assert columns[0].table is table


def test_nested_struct_countif_references_the_grouped_subquery_alias():
    """A STRUCT subfield must not leak its dotted path into the COUNTIF operand.

    BigQuery's preparer quotes `customer.email` part-by-part as `customer`.`email` while
    format_label rewrites the dot, so a dotted label can never be referenced back and the
    query dies with `Unrecognized name: customer; Did you mean customer_email?`.
    """
    sql = _profiler_unique_count_sql(NESTED_COLUMN)

    alias = _grouped_output_label(sql, TABLE_NAME)
    assert _countif_operand(sql) == f"`{alias}`", f"COUNTIF operand does not match the subquery alias:\n{sql}"
    assert "`customer`.`email` = " not in sql, f"COUNTIF still references the dotted STRUCT path:\n{sql}"


def test_nested_struct_unique_count_still_addresses_the_struct_path_in_the_inner_query():
    """The fix must not break addressing the STRUCT subfield against the base table."""
    sql = _profiler_unique_count_sql(NESTED_COLUMN)

    assert "count(`customer`.`email`)" in sql, sql
    assert f"GROUP BY `{TABLE_NAME}`.`customer`.`email`" in sql, sql


def test_flat_column_countif_references_the_grouped_subquery_alias():
    """Ordinary columns must keep agreeing between the label and the reference."""
    sql = _profiler_unique_count_sql(FLAT_COLUMN)

    alias = _grouped_output_label(sql, TABLE_NAME)
    assert _countif_operand(sql) == f"`{alias}`", sql
    assert f"count(`{FLAT_COLUMN}`)" in sql, sql


def test_countif_bind_renders_as_int64_smoke():
    """Smoke check that the emitted comparison binds `1` as INT64, not as the column type.

    Binding it as the column type made BigQuery reject the profile with
    `Unparseable query parameter ... Invalid timestamp: '1'`.

    This does NOT pin our code: SQLAlchemy's `coerce_compared_value` maps the Python `1` to
    `Integer` before the dialect sees it, so the bind renders INT64 even for a typed column.
    It only guards against a dependency bump that reintroduces column-typed binds.
    `test_countif_column_is_untyped` is what actually guards the fix.
    """
    sql = _profiler_unique_count_sql(NESTED_COLUMN, column_type=sa.TIMESTAMP, literal_binds=False)

    assert re.search(r"countif\(.+ = %\(\w+:INT64\)s\)", sql), sql


def test_countif_column_is_untyped():
    """The COUNTIF operand must stay untyped so no column type reaches the comparison.

    This is the only assertion that fails if the reference is rebuilt as
    `column(UNIQUE_COUNT_GROUP_ALIAS, col.type)`: the compiled SQL is identical either way
    because SQLAlchemy coerces the bind to `Integer` regardless of the column's type.
    """
    session = _BigQuerySession()
    metric_query = UniqueCount(sa.Column(NESTED_COLUMN, sa.String)).query(sample=None, session=session)

    countif_operand = next(iter(metric_query.element.clauses))
    assert isinstance(countif_operand.left.type, NullType)


def test_non_bigquery_dialects_keep_the_grouped_having_implementation():
    """The COUNTIF shortcut is BigQuery-only; other dialects must keep the HAVING subquery."""
    postgres_dialect = postgresql.dialect()

    class _PostgresSession(Session):
        def get_bind(self, *args, **kwargs):
            return SimpleNamespace(dialect=postgres_dialect)

    sample = _sample_table(FLAT_COLUMN)
    metric_query = UniqueCount(sa.Column(FLAT_COLUMN, sa.String)).query(sample=sample, session=_PostgresSession())
    sql = " ".join(str(metric_query.statement.compile(dialect=postgres_dialect)).split())

    assert "countif" not in sql.lower(), sql
    assert "GROUP BY" in sql and "HAVING" in sql, sql
