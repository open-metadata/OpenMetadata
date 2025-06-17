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
import sys
from datetime import datetime
from unittest import TestCase, mock
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
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
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.generated.schema.type.entityReference import EntityReference
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
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.static.row_count import RowCount
from metadata.profiler.processor.default import get_default_metrics
from metadata.sampler.pandas.sampler import DatalakeSampler

if sys.version_info < (3, 9):
    pytest.skip(
        "requires python 3.9+ due to incompatibility with object patch",
        allow_module_level=True,
    )


class User(declarative_base()):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)


class FakeClient:
    def __init__(self):
        self._client = None


class FakeConnection:
    def __init__(self):
        self.client = FakeClient()


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
        databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="name"),
        fileFormat="csv",
        columns=[
            EntityColumn(
                name=ColumnName("name"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("fullname"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("nickname"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("comments"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("age"),
                dataType=DataType.INT,
            ),
            EntityColumn(
                name=ColumnName("dob"),
                dataType=DataType.DATETIME,
            ),
            EntityColumn(
                name=ColumnName("tob"),
                dataType=DataType.DATE,
            ),
            EntityColumn(
                name=ColumnName("doe"),
                dataType=DataType.DATE,
            ),
            EntityColumn(
                name=ColumnName("json"),
                dataType=DataType.JSON,
            ),
            EntityColumn(
                name=ColumnName("array"),
                dataType=DataType.ARRAY,
            ),
        ],
    )

    @classmethod
    @mock.patch(
        "metadata.profiler.interface.profiler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    @mock.patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def setUp(cls, mock_get_connection, *_) -> None:
        import pandas as pd

        with (
            patch.object(
                DatalakeSampler,
                "raw_dataset",
                new_callable=lambda: [
                    cls.df1,
                    pd.concat([cls.df2, pd.DataFrame(index=cls.df1.index)]),
                ],
            ),
            patch.object(DatalakeSampler, "get_client", return_value=Mock()),
        ):
            cls.sampler = DatalakeSampler(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=cls.table_entity,
            )
            cls.datalake_profiler_interface = PandasProfilerInterface(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=cls.table_entity,
                source_config=None,
                sampler=cls.sampler,
            )

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """

        cls.table = User
        cls.metrics = get_default_metrics(Metrics, cls.table)
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
            timestamp=Timestamp(int(datetime.now().timestamp())),
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
