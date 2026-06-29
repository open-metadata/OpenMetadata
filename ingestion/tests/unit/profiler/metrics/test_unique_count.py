from unittest.mock import Mock

from sqlalchemy import Column, String
from sqlalchemy.sql.sqltypes import NullType

from metadata.profiler.metrics.static.unique_count import UniqueCount
from metadata.profiler.orm.registry import Dialects


def test_bigquery_unique_count():
    # Mocking session binding
    session_mock = Mock()
    session_mock.get_bind().dialect.name = Dialects.BigQuery

    # Pass a typed column to verify it does not leak into the countif expression
    unique_count_metric = UniqueCount(Column("test_col", String))
    
    # Bug 1 fix: use query(sample, session) instead of fn()
    result = unique_count_metric.query(sample=None, session=session_mock)

    assert "countif" in str(result).lower()

    # Quality 2 fix: verify the type of the column inside countif is untyped (NullType)
    # This prevents BigQuery type mismatch errors: No matching signature for operator = for argument types: INT64, STRING
    countif_args = list(result.element.clauses)
    binary_expression = countif_args[0]
    
    assert binary_expression.left.name == "test_col"
    assert isinstance(binary_expression.left.type, NullType)
