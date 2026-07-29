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
Regression tests for the BigQuery uniqueCount COUNTIF branch (issue #30152).

The BigQuery branch of ``UniqueCount.query`` builds a ``countif`` that wraps a
grouped occurrence-count subquery. It must reference that subquery's integer
occurrence-count column through a shared, dot-free alias instead of the source
column, otherwise:

  * TIMESTAMP/DATE columns bind ``1`` with the column's own SQL type, producing
    ``Unparseable query parameter ... in type TYPE_TIMESTAMP``.
  * nested STRUCT-subfield columns re-emit the dotted path ``customer.email``,
    which does not exist in the subquery, producing ``Unrecognized name: customer``.

These tests compile the generated SQL against the BigQuery dialect (no live
BigQuery needed) and assert the identifiers and bind parameter are well-formed.
"""

from unittest.mock import MagicMock

from sqlalchemy import Column, Integer, MetaData, Table, select
from sqlalchemy_bigquery import TIMESTAMP as BQ_TIMESTAMP
from sqlalchemy_bigquery import BigQueryDialect

from metadata.profiler.metrics.static.count import Count
from metadata.profiler.metrics.static.unique_count import UniqueCount
from metadata.profiler.orm.functions.unique_count import UNIQUE_COUNT_VALUE_ALIAS
from metadata.profiler.orm.registry import Dialects

DIALECT = BigQueryDialect()


def _bigquery_session():
    session = MagicMock()
    session.get_bind.return_value.dialect.name = Dialects.BigQuery
    return session


def _compiled_unique_count_sql(column_name: str, column_type) -> str:
    """Build the full uniqueCount SQL exactly as _compute_query_metrics does."""
    session = _bigquery_session()
    metric_query = UniqueCount(Column(column_name, column_type)).query(sample=None, session=session)

    table = Table("orders", MetaData(), Column(column_name, column_type), schema="analytics")
    sample_column = table.c[column_name]
    subquery = (
        select(Count(sample_column).fn().label(UNIQUE_COUNT_VALUE_ALIAS))
        .select_from(table)
        .group_by(sample_column)
        .subquery()
    )
    statement = select(metric_query).select_from(subquery)
    return str(statement.compile(dialect=DIALECT))


def test_unique_count_bigquery_timestamp_column():
    """TIMESTAMP columns reference the integer alias, not the column itself."""
    sql = _compiled_unique_count_sql("created_at", BQ_TIMESTAMP())

    assert f"countif(`{UNIQUE_COUNT_VALUE_ALIAS}` = " in sql
    assert f"AS `{UNIQUE_COUNT_VALUE_ALIAS}`" in sql
    assert "countif(`created_at`" not in sql


def test_unique_count_bigquery_nested_struct_subfield():
    """Nested STRUCT-subfield columns do not re-emit the dotted path."""
    sql = _compiled_unique_count_sql("customer.email", BQ_TIMESTAMP())

    assert f"countif(`{UNIQUE_COUNT_VALUE_ALIAS}` = " in sql
    assert "countif(`customer`.`email`" not in sql
    assert "= :customer.email" not in sql


def test_unique_count_bigquery_binds_integer_one():
    """The comparison value binds as INT64, independent of the column type."""
    metric_query = UniqueCount(Column("created_at", BQ_TIMESTAMP())).query(sample=None, session=_bigquery_session())
    compiled = select(metric_query).compile(dialect=DIALECT)

    bind_types = {str(bp.type) for bp in compiled.binds.values()}
    assert bind_types == {str(Integer())}
    assert all("." not in name for name in compiled.binds)
