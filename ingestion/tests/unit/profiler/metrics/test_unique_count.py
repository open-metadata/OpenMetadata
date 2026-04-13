from unittest.mock import Mock

from sqlalchemy import Column

from metadata.profiler.metrics.static.unique_count import UniqueCount
from metadata.profiler.orm.registry import Dialects


def test_bigquery_unique_count():
    # Mocking session binding
    session_mock = Mock()
    session_mock.get_bind().dialect.name = Dialects.BigQuery

    unique_count_metric = UniqueCount(Column("test_col"))
    result = unique_count_metric.fn(session_mock)

    assert "countif" in str(result).lower()
