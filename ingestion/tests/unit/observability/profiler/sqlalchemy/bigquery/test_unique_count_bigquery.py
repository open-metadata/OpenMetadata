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
Test UniqueCount metric and validator for BigQuery dialect
"""

from unittest.mock import Mock, patch

from sqlalchemy import Column, Date, DateTime, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy_bigquery.base import BigQueryDialect

from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeUnique import (
    ColumnValuesToBeUniqueValidator,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.static.unique_count import VALUE_COUNT_ALIAS, UniqueCount
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.processor.runner import QueryRunner


class Base(DeclarativeBase):
    pass


class Orders(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    created_at = Column("created_at", DateTime, key="created_at")
    created_date = Column("created_date", Date, key="created_date")
    customer_email = Column("customer.email", String(256), key="customer_email")


def test_unique_count_bigquery_timestamp_and_struct():
    """Test BigQuery uniqueCount SQL generation via SQAProfilerInterface for TIMESTAMP, DATE, and nested STRUCT columns"""
    dialect = BigQueryDialect()
    assert dialect.name == Dialects.BigQuery

    engine = create_engine("sqlite:///:memory:")
    session = Session(engine)

    mock_bind = Mock()
    mock_bind.dialect = dialect
    mock_session = Mock(spec=Session)
    mock_session.get_bind.return_value = mock_bind
    mock_session.query = session.query

    runner = QueryRunner(
        session=mock_session,
        dataset=Orders,
        raw_dataset=Orders,
        partition_details=None,
        profile_sample_query=None,
    )

    interface = SQAProfilerInterface.__new__(SQAProfilerInterface)
    interface.session = mock_session

    # 1. Test TIMESTAMP column created_at via profiler_interface
    col_timestamp = Orders.__table__.c["created_at"]

    captured_query_ts = None

    def mock_select_ts(q):
        nonlocal captured_query_ts
        captured_query_ts = q
        mock_row = Mock()
        mock_row._asdict.return_value = {Metrics.uniqueCount.name: 1}
        return mock_row

    with patch.object(runner, "select_first_from_query", side_effect=mock_select_ts):
        interface._compute_query_metrics(
            metric=UniqueCount,
            runner=runner,
            column=col_timestamp,
            session=mock_session,
            sample=Orders,
        )

    sql_ts = str(
        captured_query_ts.statement.compile(
            dialect=dialect, compile_kwargs={"literal_binds": True}
        )
    )

    # Verify outer countif uses value_count integer alias and literal 1 (no timestamp type mismatch)
    assert "countif(`value_count` = 1)" in sql_ts
    assert "timestamp" not in sql_ts.lower()

    # 2. Test DATE column created_date via profiler_interface
    col_date = Orders.__table__.c["created_date"]

    captured_query_date = None

    def mock_select_date(q):
        nonlocal captured_query_date
        captured_query_date = q
        mock_row = Mock()
        mock_row._asdict.return_value = {Metrics.uniqueCount.name: 1}
        return mock_row

    with patch.object(runner, "select_first_from_query", side_effect=mock_select_date):
        interface._compute_query_metrics(
            metric=UniqueCount,
            runner=runner,
            column=col_date,
            session=mock_session,
            sample=Orders,
        )

    sql_date = str(
        captured_query_date.statement.compile(
            dialect=dialect, compile_kwargs={"literal_binds": True}
        )
    )

    # Verify outer countif uses value_count integer alias and literal 1 (no date type mismatch)
    assert "countif(`value_count` = 1)" in sql_date
    assert "SELECT count(`created_date`) AS `value_count`" in sql_date

    # 3. Test nested STRUCT column customer.email via profiler_interface
    col_struct = Orders.__table__.c["customer_email"]

    captured_query_struct = None

    def mock_select_struct(q):
        nonlocal captured_query_struct
        captured_query_struct = q
        mock_row = Mock()
        mock_row._asdict.return_value = {Metrics.uniqueCount.name: 1}
        return mock_row

    with patch.object(runner, "select_first_from_query", side_effect=mock_select_struct):
        interface._compute_query_metrics(
            metric=UniqueCount,
            runner=runner,
            column=col_struct,
            session=mock_session,
            sample=Orders,
        )

    sql_struct = str(
        captured_query_struct.statement.compile(
            dialect=dialect, compile_kwargs={"literal_binds": True}
        )
    )

    # Verify outer expression isolates countif(`value_count` = 1) without dotted path in outer query
    assert "countif(`value_count` = 1) AS `uniqueCount`" in sql_struct
    assert "SELECT count(`customer`.`email`) AS `value_count`" in sql_struct
    assert "GROUP BY `orders`.`customer`.`email`" in sql_struct


def test_column_values_to_be_unique_validator_bigquery():
    """Test BigQuery SQL generation for ColumnValuesToBeUniqueValidator"""
    dialect = BigQueryDialect()
    assert dialect.name == Dialects.BigQuery

    engine = create_engine("sqlite:///:memory:")
    session = Session(engine)

    mock_bind = Mock()
    mock_bind.dialect = dialect
    mock_session = Mock(spec=Session)
    mock_session.get_bind.return_value = mock_bind
    mock_session.query = session.query

    validator = ColumnValuesToBeUniqueValidator.__new__(ColumnValuesToBeUniqueValidator)
    validator.runner = Mock()
    validator.runner.dataset = Orders
    validator.runner._session = mock_session
    validator.runner.dialect = Dialects.BigQuery

    col_struct = Orders.__table__.c["customer_email"]

    captured_args = None

    def mock_select_from_dataset(grouped_cte, *entities, **kwargs):
        nonlocal captured_args
        captured_args = (grouped_cte, entities)
        mock_res = Mock()
        mock_row = Mock()
        mock_row._mapping = {Metrics.valuesCount.name: 3, Metrics.uniqueCount.name: 3}
        mock_res.first.return_value = mock_row
        return mock_res

    validator.runner._select_from_dataset = mock_select_from_dataset

    validator._run_results(Metrics.uniqueCount, col_struct)

    grouped_cte, entities = captured_args

    # Check CTE definition uses VALUE_COUNT_ALIAS
    cte_sql = str(
        grouped_cte.element.compile(
            dialect=dialect, compile_kwargs={"literal_binds": True}
        )
    )
    assert "SELECT count(`customer`.`email`) AS `value_count`" in cte_sql

    # Note: unique_count expression is wrapped with .label(Metrics.uniqueCount.name)
    # in validator._run_results for result mapping keys.
    unique_count_expr = entities[1]
    expr_sql = str(
        unique_count_expr.element.compile(
            dialect=dialect, compile_kwargs={"literal_binds": True}
        )
    )
    assert "countif(`value_count` = 1)" in expr_sql
