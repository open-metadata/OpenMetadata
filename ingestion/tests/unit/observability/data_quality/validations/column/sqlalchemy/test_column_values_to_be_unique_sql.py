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
Validate the SQL the columnValuesToBeUnique validator emits against the real BigQuery dialect.
"""

import re
from types import SimpleNamespace

import sqlalchemy as sa
from sqlalchemy.orm import Session
from sqlalchemy_bigquery.base import BigQueryDialect

from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeUnique import (
    ColumnValuesToBeUniqueValidator,
)
from metadata.profiler.metrics.registry import Metrics

TABLE_NAME = "users"
# Mirrors BigQueryProfilerInterface._get_struct_columns, which names a STRUCT subfield
# with a literal dot so the inner query can address it as a record path.
NESTED_COLUMN = "customer.email"
FLAT_COLUMN = "email"

DIALECT = BigQueryDialect()


class _BigQuerySession(Session):
    """A real ORM Session that reports the BigQuery dialect without needing GCP credentials."""

    def get_bind(self, *args, **kwargs):
        return SimpleNamespace(dialect=DIALECT)


class _RecordingRunner:
    """Captures the statement the validator would have executed instead of hitting BigQuery."""

    def __init__(self, dataset, session):
        self.dataset = dataset
        self._session = session
        self.dialect = DIALECT.name
        self.statement = None

    def _select_from_dataset(self, dataset, *entities, **_kwargs):
        self.statement = sa.select(*entities).select_from(dataset)
        row = SimpleNamespace(_mapping={Metrics.valuesCount.name: 10, Metrics.uniqueCount.name: 7})
        return SimpleNamespace(first=lambda: row)


def _validator_sql(column_name):
    """Run the real validator result path and return the SQL it would have executed."""
    dataset = sa.Table(TABLE_NAME, sa.MetaData(), sa.Column(column_name, sa.String))
    runner = _RecordingRunner(dataset, _BigQuerySession())

    ColumnValuesToBeUniqueValidator._run_results(
        SimpleNamespace(runner=runner, value=None),
        metric=Metrics.uniqueCount,
        column=sa.Column(column_name, sa.String),
    )

    assert runner.statement is not None, "The validator never produced a statement"
    compiled = runner.statement.compile(dialect=DIALECT, compile_kwargs={"literal_binds": True})
    return " ".join(str(compiled).split())


def _cte_output_label(sql):
    match = re.search(r"AS `([^`]+)` FROM `" + TABLE_NAME + "`", sql)
    assert match, f"No grouped_cte output alias found in:\n{sql}"
    return match.group(1)


def _single_arg(sql, function_name):
    match = re.search(re.escape(function_name) + r"\(([^()]+?)\)", sql)
    assert match, f"No {function_name}(...) call found in:\n{sql}"
    return match.group(1)


def test_nested_struct_sum_references_the_grouped_cte_alias():
    """A STRUCT subfield must not leak its dotted path into the outer CTE reference.

    Reading the CTE back as `grouped_cte`.`customer`.`email` is not a resolvable BigQuery
    reference: the CTE only ever exposes the single, dot-substituted label it was given.
    """
    sql = _validator_sql(NESTED_COLUMN)

    alias = _cte_output_label(sql)
    assert _single_arg(sql, "sum") == f"`grouped_cte`.`{alias}`", f"SUM does not read the CTE alias back:\n{sql}"
    assert "`grouped_cte`.`customer`.`email`" not in sql, f"SUM still references the dotted STRUCT path:\n{sql}"


def test_nested_struct_countif_agrees_with_the_grouped_cte_alias():
    """The uniqueCount COUNTIF runs over the same CTE, so it must reference the same alias."""
    sql = _validator_sql(NESTED_COLUMN)

    alias = _cte_output_label(sql)
    assert _single_arg(sql, "countif") == f"`{alias}` = 1", f"COUNTIF does not read the CTE alias back:\n{sql}"


def test_nested_struct_cte_still_counts_the_struct_path():
    """The fix must not break addressing the STRUCT subfield inside the CTE."""
    sql = _validator_sql(NESTED_COLUMN)

    assert "count(`customer`.`email`)" in sql, sql
    assert "GROUP BY `customer`.`email`" in sql, sql


def test_flat_column_sum_and_countif_agree_with_the_grouped_cte_alias():
    """Ordinary columns must keep agreeing between the CTE label and both references."""
    sql = _validator_sql(FLAT_COLUMN)

    alias = _cte_output_label(sql)
    assert _single_arg(sql, "sum") == f"`grouped_cte`.`{alias}`", sql
    assert _single_arg(sql, "countif") == f"`{alias}` = 1", sql
