#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Test SQA Interface
"""

import os
from datetime import datetime, timezone
from unittest import TestCase, mock
from uuid import uuid4

from sqlalchemy import TEXT, Column, Integer, String, inspect
from sqlalchemy.orm import declarative_base

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
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.pandas.profiler_interface import (
    PandasProfilerInterface,
)
from metadata.profiler.metrics.core import (
    ComposedMetric,
    MetricTypes,
    QueryMetric,
    StaticMetric,
)
from metadata.profiler.metrics.static.row_count import RowCount
from metadata.profiler.processor.default import get_default_metrics


class User(declarative_base()):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)


class FakeConnection:
    def client(self):
        return None


class PandasInterfaceTest(TestCase):

    import pandas as pd

    col_names = [
        "name",
        "fullname",
        "nickname",
        "comments",
        "age",
        "dob",
        "tob",
        "doe",
        "json",
        "array",
    ]
    root_dir = os.path.dirname(os.path.abspath(__file__))
    csv_dir = "../custom_csv"
    df1 = pd.read_csv(
        os.path.join(root_dir, csv_dir, "test_datalake_metrics_1.csv"), names=col_names
    )
    df2 = pd.read_csv(
        os.path.join(root_dir, csv_dir, "test_datalake_metrics_2.csv"), names=col_names
    )

    table_entity = Table(
        id=uuid4(),
        name="user",
        columns=[
            EntityColumn(
                name=ColumnName(__root__="id"),
                dataType=DataType.INT,
            )
        ],
    )

    @classmethod
    @mock.patch(
        "metadata.profiler.interface.profiler_interface.get_connection",
        return_value=FakeConnection,
    )
    @mock.patch.object(
        PandasProfilerInterface,
        "_convert_table_to_list_of_dataframe_objects",
        return_value=[df1, pd.concat([df2, pd.DataFrame(index=df1.index)])],
    )
    def setUp(cls, mock_get_connection, mocked_dfs) -> None:
        cls.datalake_profiler_interface = PandasProfilerInterface(
            entity=cls.table_entity,
            service_connection_config=None,
            storage_config=None,
            ometa_client=None,
            thread_count=None,
            profile_sample_config=None,
            source_config=None,
            sample_query=None,
            table_partition_config=None,
        )

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """

        cls.table = User
        cls.metrics = get_default_metrics(cls.table)
        cls.static_metrics = [
            metric for metric in cls.metrics if issubclass(metric, StaticMetric)
        ]
        cls.composed_metrics = [
            metric for metric in cls.metrics if issubclass(metric, ComposedMetric)
        ]
        cls.window_metrics = [
            metric
            for metric in cls.metrics
            if issubclass(metric, StaticMetric) and metric.is_window_metric()
        ]
        cls.query_metrics = [
            metric
            for metric in cls.metrics
            if issubclass(metric, QueryMetric) and metric.is_col_metric()
        ]

    def test_get_all_metrics(self):
        table_metrics = [
            ThreadPoolMetrics(
                metrics=[
                    metric
                    for metric in self.metrics
                    if (not metric.is_col_metric() and not metric.is_system_metrics())
                ],
                metric_type=MetricTypes.Table,
                column=None,
                table=self.table_entity,
            )
        ]
        column_metrics = []
        query_metrics = []
        window_metrics = []
        for col in inspect(User).c:
            if col.name == "id":
                continue
            column_metrics.append(
                ThreadPoolMetrics(
                    metrics=[
                        metric
                        for metric in self.static_metrics
                        if metric.is_col_metric() and not metric.is_window_metric()
                    ],
                    metric_type=MetricTypes.Static,
                    column=col,
                    table=self.table_entity,
                )
            )
            for query_metric in self.query_metrics:
                query_metrics.append(
                    ThreadPoolMetrics(
                        metrics=query_metric,
                        metric_type=MetricTypes.Query,
                        column=col,
                        table=self.table_entity,
                    )
                )
            window_metrics.append(
                ThreadPoolMetrics(
                    metrics=[
                        metric
                        for metric in self.window_metrics
                        if metric.is_window_metric()
                    ],
                    metric_type=MetricTypes.Window,
                    column=col,
                    table=self.table_entity,
                )
            )

        all_metrics = [*table_metrics, *column_metrics, *query_metrics, *window_metrics]

        profile_results = self.datalake_profiler_interface.get_all_metrics(
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
            timestamp=datetime.now(tz=timezone.utc).timestamp(),
        )

        profile_request = CreateTableProfileRequest(
            tableProfile=table_profile, columnProfile=column_profile
        )

        assert profile_request.tableProfile.columnCount == 10
        assert profile_request.tableProfile.rowCount == 6
        name_column_profile = [
            profile
            for profile in profile_request.columnProfile
            if profile.name == "name"
        ][0]
        age_column_profile = [
            profile
            for profile in profile_request.columnProfile
            if profile.name == "age"
        ][0]
        assert name_column_profile.nullCount == 2.0
        assert age_column_profile.median == 31.0
