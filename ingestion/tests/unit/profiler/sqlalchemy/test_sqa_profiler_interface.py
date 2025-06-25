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
Test SQA Interface
"""

import os
from datetime import datetime
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import TEXT, Column, Integer, String, inspect
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm.session import Session

from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    ColumnProfile,
    DataType,
    Table,
    TableProfile,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.core import (
    ComposedMetric,
    MetricTypes,
    QueryMetric,
    StaticMetric,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.static.row_count import RowCount
from metadata.profiler.processor.default import get_default_metrics
from metadata.sampler.sqlalchemy.sampler import SQASampler


class User(declarative_base()):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)


@pytest.fixture
def table_entity():
    return Table(
        id=uuid4(),
        name="user",
        columns=[
            EntityColumn(
                name=ColumnName("id"),
                dataType=DataType.INT,
            )
        ],
    )


@pytest.fixture
def sqlite_conn():
    return SQLiteConnection(
        scheme=SQLiteScheme.sqlite_pysqlite,
    )


@pytest.fixture
def sqa_profiler_interface(table_entity, sqlite_conn):
    with patch.object(SQASampler, "build_table_orm", return_value=User):
        sampler = SQASampler(
            service_connection_config=sqlite_conn,
            ometa_client=None,
            entity=None,
        )

    with patch.object(SQASampler, "build_table_orm", return_value=User):
        interface = SQAProfilerInterface(
            sqlite_conn, None, table_entity, None, sampler, 5, 43200
        )
    return interface


def test_init_interface(sqa_profiler_interface):
    """Test we can instantiate our interface object correctly"""
    assert isinstance(sqa_profiler_interface.session, Session)


@pytest.fixture(scope="class")
def db_path():
    return os.path.join(os.path.dirname(__file__), "test.db")


@pytest.fixture(scope="class")
def class_sqlite_conn(db_path):
    return SQLiteConnection(
        scheme=SQLiteScheme.sqlite_pysqlite,
        databaseMode=db_path + "?check_same_thread=False",
    )


@pytest.fixture(scope="class")
def class_table_entity():
    return Table(
        id=uuid4(),
        name="user",
        columns=[
            EntityColumn(
                name=ColumnName("id"),
                dataType=DataType.INT,
            )
        ],
    )


@pytest.fixture(scope="class")
def class_sqa_profiler_interface(class_sqlite_conn, class_table_entity):
    with patch.object(SQASampler, "build_table_orm", return_value=User):
        sampler = SQASampler(
            service_connection_config=class_sqlite_conn,
            ometa_client=None,
            entity=None,
        )

    interface = SQAProfilerInterface(
        class_sqlite_conn,
        None,
        class_table_entity,
        None,
        sampler,
        5,
        43200,
    )
    return interface


@pytest.fixture(scope="class", autouse=True)
def setup_database(class_sqa_profiler_interface):
    """Setup test database and tables"""
    try:
        # Drop the table if it exists
        User.__table__.drop(
            bind=class_sqa_profiler_interface.session.get_bind(), checkfirst=True
        )
        # Create the table
        User.__table__.create(bind=class_sqa_profiler_interface.session.get_bind())
    except Exception as e:
        print(f"Error during table setup: {str(e)}")
        raise e

    data = [
        User(name="John", fullname="John Doe", nickname="johnny b goode", age=30),
        User(name="Jane", fullname="Jone Doe", nickname=None, age=31),
    ]
    class_sqa_profiler_interface.session.add_all(data)
    class_sqa_profiler_interface.session.commit()

    yield

    # Cleanup
    try:
        User.__table__.drop(
            bind=class_sqa_profiler_interface.session.get_bind(), checkfirst=True
        )
        class_sqa_profiler_interface.session.close()
    except Exception as e:
        print(f"Error during cleanup: {str(e)}")
        raise e


@pytest.fixture(scope="class")
def metrics(class_sqa_profiler_interface):
    metrics = get_default_metrics(Metrics, User)
    return {
        "all": metrics,
        "static": [metric for metric in metrics if issubclass(metric, StaticMetric)],
        "composed": [
            metric for metric in metrics if issubclass(metric, ComposedMetric)
        ],
        "window": [
            metric
            for metric in metrics
            if issubclass(metric, StaticMetric) and metric.is_window_metric()
        ],
        "query": [
            metric
            for metric in metrics
            if issubclass(metric, QueryMetric) and metric.is_col_metric()
        ],
    }


def test_init_interface_multi_thread(class_sqa_profiler_interface):
    """Test we can instantiate our interface object correctly"""
    assert isinstance(class_sqa_profiler_interface.session, Session)


def test_get_all_metrics(class_sqa_profiler_interface, metrics):
    table_metrics = [
        ThreadPoolMetrics(
            metrics=[
                metric
                for metric in metrics["all"]
                if (not metric.is_col_metric() and not metric.is_system_metrics())
            ],
            metric_type=MetricTypes.Table,
            column=None,
            table=User,
        )
    ]
    column_metrics = []
    query_metrics = []
    window_metrics = []
    for col in inspect(User).c:
        column_metrics.append(
            ThreadPoolMetrics(
                metrics=[
                    metric
                    for metric in metrics["static"]
                    if metric.is_col_metric() and not metric.is_window_metric()
                ],
                metric_type=MetricTypes.Static,
                column=col,
                table=User,
            )
        )
        for query_metric in metrics["query"]:
            query_metrics.append(
                ThreadPoolMetrics(
                    metrics=query_metric,
                    metric_type=MetricTypes.Query,
                    column=col,
                    table=User,
                )
            )
        window_metrics.append(
            ThreadPoolMetrics(
                metrics=[
                    metric for metric in metrics["window"] if metric.is_window_metric()
                ],
                metric_type=MetricTypes.Window,
                column=col,
                table=User,
            )
        )

    all_metrics = [*table_metrics, *column_metrics, *query_metrics, *window_metrics]

    profile_results = class_sqa_profiler_interface.get_all_metrics(
        all_metrics,
    )

    column_profile = [
        ColumnProfile(**profile_results["columns"].get(col.name))
        for col in inspect(User).c
        if profile_results["columns"].get(col.name)
    ]

    table_profile = TableProfile(
        columnCount=profile_results["table"].get("columnCount"),
        rowCount=profile_results["table"].get(RowCount.name()),
        timestamp=Timestamp(int(datetime.now().timestamp())),
    )

    profile_request = CreateTableProfileRequest(
        tableProfile=table_profile, columnProfile=column_profile
    )

    assert profile_request.tableProfile.columnCount == 6
    assert profile_request.tableProfile.rowCount == 2
    name_column_profile = [
        profile for profile in profile_request.columnProfile if profile.name == "name"
    ][0]
    id_column_profile = [
        profile for profile in profile_request.columnProfile if profile.name == "id"
    ][0]
    assert name_column_profile.nullCount == 0
    assert id_column_profile.median == 1.0


def test_compute_metrics_in_thread_success(sqa_profiler_interface):
    """Test successful execution of compute_metrics_in_thread"""
    # Create a mock metric function
    mock_metric = ThreadPoolMetrics(
        metrics=[RowCount],
        metric_type=MetricTypes.Table,
        column=None,
        table=User,
    )

    # Mock the _get_metric_fn to return a known value
    sqa_profiler_interface._get_metric_fn = {
        MetricTypes.Table.value: Mock(return_value={"rowCount": 2})
    }

    # Execute the method
    result, column, metric_type = sqa_profiler_interface.compute_metrics_in_thread(
        mock_metric
    )

    # Verify results
    assert result == {"rowCount": 2}
    assert column is None
    assert metric_type == MetricTypes.Table.value


def test_compute_metrics_in_thread_disconnect_retry_success(sqa_profiler_interface):
    """Test successful retry after disconnection error"""
    # Create a mock metric function
    mock_metric = ThreadPoolMetrics(
        metrics=[RowCount],
        metric_type=MetricTypes.Table,
        column=None,
        table=User,
    )

    # Mock the _get_metric_fn to raise a disconnection error once, then succeed
    mock_fn = Mock(
        side_effect=[DBAPIError("disconnected", None, None), {"rowCount": 2}]
    )
    sqa_profiler_interface._get_metric_fn = {MetricTypes.Table.value: mock_fn}

    # Mock the dialect's is_disconnect to return True
    with patch.object(
        sqa_profiler_interface.session.get_bind().dialect,
        "is_disconnect",
        return_value=True,
    ):
        result, column, metric_type = sqa_profiler_interface.compute_metrics_in_thread(
            mock_metric
        )

    # Verify results
    assert result == {"rowCount": 2}
    assert column is None
    assert metric_type == MetricTypes.Table.value
    assert mock_fn.call_count == 2  # Called twice - once for error, once for success


def test_compute_metrics_in_thread_max_retries_exceeded(sqa_profiler_interface):
    """Test behavior when max retries are exceeded"""
    # Create a mock metric function
    mock_metric = ThreadPoolMetrics(
        metrics=[RowCount],
        metric_type=MetricTypes.Table,
        column=None,
        table=User,
    )

    # Mock the _get_metric_fn to always raise a disconnection error
    mock_fn = Mock(side_effect=DBAPIError("disconnected", None, None))
    sqa_profiler_interface._get_metric_fn = {MetricTypes.Table.value: mock_fn}

    # Mock the dialect's is_disconnect to return True
    with patch.object(
        sqa_profiler_interface.session.get_bind().dialect,
        "is_disconnect",
        return_value=True,
    ):
        result, column, metric_type = sqa_profiler_interface.compute_metrics_in_thread(
            mock_metric
        )

    # Verify results - should return None values after max retries
    assert result is None
    assert column is None
    assert metric_type is None
    assert mock_fn.call_count == 3  # Called 3 times (max_retries)


def test_compute_metrics_in_thread_other_exception(sqa_profiler_interface):
    """Test behavior with non-disconnection exception"""
    # Create a mock metric function
    mock_metric = ThreadPoolMetrics(
        metrics=[RowCount],
        metric_type=MetricTypes.Table,
        column=None,
        table=User,
    )

    # Mock the _get_metric_fn to raise a regular exception
    mock_fn = Mock(side_effect=Exception("Some other error"))
    sqa_profiler_interface._get_metric_fn = {MetricTypes.Table.value: mock_fn}

    # Mock the dialect's is_disconnect to return False
    with patch.object(
        sqa_profiler_interface.session.get_bind().dialect,
        "is_disconnect",
        return_value=False,
    ):
        result, column, metric_type = sqa_profiler_interface.compute_metrics_in_thread(
            mock_metric
        )

    # Verify results - should return None values after exception
    assert result is None
    assert column is None
    assert metric_type is None
    assert mock_fn.call_count == 1  # Called only once before breaking
