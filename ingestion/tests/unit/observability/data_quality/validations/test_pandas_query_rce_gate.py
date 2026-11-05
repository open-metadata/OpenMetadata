"""Unit tests: user-authored pandas DQ expressions are gated before DataFrame.query().

DataFrame.query() evaluates Python (attribute access and calls are reachable in the
ingestion worker), so every user-authored expression reaching it must pass
is_safe_pandas_query, as the pandas samplers do. These tests drive the real validators
with real DataFrames and assert both the rejection of execution payloads and the
survival of legitimate filters.
"""

from datetime import datetime, timezone

import pytest
from pandas import DataFrame

from metadata.data_quality.validations.column.pandas.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator,
)
from metadata.data_quality.validations.table.pandas.tableCustomSQLQuery import (
    TableCustomSQLQueryValidator,
)
from metadata.data_quality.validations.table.pandas.tableRowInsertedCountToBeBetween import (
    TableRowInsertedCountToBeBetweenValidator,
)
from metadata.data_quality.validations.table.pandas.tableRuleLibrarySqlExpressionValidator import (
    TableRuleLibrarySqlExpressionValidator,
)
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.profiler.interface.pandas.profiler_interface import PandasProfilerInterface

UNSAFE_EXPRESSIONS = [
    "a > 0 and a.__class__.__init__.__globals__",
    "a.to_csv('/tmp/h4_pwned', index=False)",
    "(a > 0) or (a.values.tofile('/tmp/h4_pwned'))",
    "`name`.str.len() > 3",
    "a @ b",
    # backticks inside string literals must not hide a call from the AST pass
    "a > 0 or '`' == a.to_csv('/tmp/h4_pwned_bt', index=False) == '`'",
]


class PandasRunnerStub(list):
    """Iterable of DataFrames, as the validators receive from the sampler."""

    def __call__(self):
        return list(self)


def build_validator(cls, parameter_values=None):
    """Minimal validator built the way the runner does, without an OM client."""
    validator = cls.__new__(cls)
    validator.runner = PandasRunnerStub([DataFrame({"a": [1, 2, 3], "ts": [20260101, 20260102, 20260103]})])
    validator.test_case = type("TestCase", (), {"parameterValues": list(parameter_values or [])})()
    validator.execution_date = datetime.now(timezone.utc)
    return validator


def partition_param(expression):
    return [type("P", (), {"name": "partitionExpression", "value": expression})()]


class TestTableCustomSQLQueryGate:
    def test_unsafe_sql_expression_is_rejected(self):
        validator = build_validator(TableCustomSQLQueryValidator)
        for expression in UNSAFE_EXPRESSIONS:
            with pytest.raises(RuntimeError, match="Unsafe pandas query expression"):
                validator._run_results(expression)

    def test_unsafe_partition_expression_is_rejected(self):
        for expression in UNSAFE_EXPRESSIONS:
            validator = build_validator(TableCustomSQLQueryValidator, partition_param(expression))
            with pytest.raises(RuntimeError, match="Unsafe pandas query expression"):
                validator.compute_row_count()

    def test_safe_sql_expression_still_runs(self):
        validator = build_validator(TableCustomSQLQueryValidator)
        assert validator._run_results("a > 1") == 2

    def test_safe_partition_expression_still_runs(self):
        validator = build_validator(TableCustomSQLQueryValidator, partition_param("a > 1"))
        assert validator.compute_row_count() == 2

    def test_empty_partition_expression_is_still_no_filter(self):
        # An empty string previously meant "no filter"; the gate must not change that
        validator = build_validator(TableCustomSQLQueryValidator, partition_param(""))
        assert validator.compute_row_count() == 3


class TestRuleLibraryGates:
    def test_table_validator_rejects_unsafe_expression(self):
        validator = build_validator(TableRuleLibrarySqlExpressionValidator)
        for expression in UNSAFE_EXPRESSIONS:
            with pytest.raises(RuntimeError, match="Unsafe pandas query expression"):
                validator._run_results(expression)

    def test_table_validator_allows_legitimate_filter(self):
        validator = build_validator(TableRuleLibrarySqlExpressionValidator)
        assert validator._run_results("a > 1") == 2

    def test_column_validator_rejects_unsafe_expression(self):
        validator = build_validator(ColumnRuleLibrarySqlExpressionValidator)
        for expression in UNSAFE_EXPRESSIONS:
            with pytest.raises(RuntimeError, match="Unsafe pandas query expression"):
                validator._run_results(expression)

    def test_column_validator_allows_legitimate_filter(self):
        validator = build_validator(ColumnRuleLibrarySqlExpressionValidator)
        assert validator._run_results("a > 1") == 2


class TestTableRowInsertedCountGate:
    def test_injected_column_name_is_rejected(self, tmp_path):
        # A crafted columnName interpolates into the expression; the guard must reject it
        validator = build_validator(TableRowInsertedCountToBeBetweenValidator)
        with pytest.raises(RuntimeError, match="Unsafe pandas query expression"):
            validator._run_results(f"(a) or (a.to_csv('{tmp_path / 'pwned'}', index=False))", "DAY", 1)

    def test_legitimate_column_name_still_runs(self):
        validator = build_validator(TableRowInsertedCountToBeBetweenValidator)
        assert validator._run_results("ts", "DAY", 1) == 0


class TestProfilerCustomMetricGate:
    def test_unsafe_expression_is_not_executed(self, tmp_path):
        # Payloads that would leave a marker file if query() ran them; the result
        # alone is not sufficient, since an exception after execution also returns None
        profiler = PandasProfilerInterface.__new__(PandasProfilerInterface)
        payloads = [f"a > 0 and a.to_csv('{tmp_path / f'p{i}'}', index=False)" for i in range(3)]
        payloads.append(f"a > 0 or '`' == a.to_csv('{tmp_path / 'p_smuggled'}', index=False) == '`'")
        metrics = [CustomMetric(name=f"m{i}", expression=e) for i, e in enumerate(payloads)]
        df = DataFrame({"a": [1, 2, 3]})
        assert profiler._compute_custom_metrics(metrics, lambda: [df]) is None
        assert list(tmp_path.iterdir()) == []

    def test_safe_expression_is_still_profiled(self):
        profiler = PandasProfilerInterface.__new__(PandasProfilerInterface)
        result = profiler._compute_custom_metrics(
            [CustomMetric(name="ok", expression="a > 1")], lambda: [DataFrame({"a": [1, 2, 3]})]
        )
        profiles = result["customMetrics"]
        assert len(profiles) == 1
        assert profiles[0].name == "ok"
        assert profiles[0].value == 2
