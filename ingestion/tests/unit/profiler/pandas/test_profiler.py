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
Test Profiler behavior
"""
import os
from datetime import datetime
from unittest import TestCase, mock
from uuid import uuid4

import pytest
import sqlalchemy.types
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    ColumnProfile,
    ColumnProfilerConfig,
    DataType,
    Histogram,
    Table,
    TableProfile,
    TableProfilerConfig,
)
from metadata.ingestion.source import sqa_types
from metadata.profiler.interface.pandas.profiler_interface import (
    PandasProfilerInterface,
)
from metadata.profiler.metrics.core import MetricTypes, add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.core import MissingMetricException, Profiler
from metadata.profiler.processor.default import DefaultProfiler

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    age = Column(Integer)


class FakeConnection:
    def client(self):
        return None


class ProfilerTest(TestCase):
    """
    Run checks on different metrics
    """

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
    def setUpClass(cls, mock_get_connection, mocked_dfs):
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

    def test_default_profiler(self):
        """
        Check our pre-cooked profiler
        """
        simple = DefaultProfiler(
            profiler_interface=self.datalake_profiler_interface,
        )
        simple.compute_metrics()

        profile = simple.get_profile()

        assert profile.tableProfile.rowCount == 6
        assert profile.tableProfile.columnCount == 10

        age_profile = next(
            (
                col_profile
                for col_profile in profile.columnProfile
                if col_profile.name == "age"
            ),
            None,
        )

        assert age_profile == ColumnProfile(
            name="age",
            timestamp=age_profile.timestamp,
            valuesCount=4.0,
            valuesPercentage=None,
            validCount=None,
            duplicateCount=None,
            nullCount=2.0,
            nullProportion=0.3333333333333333,
            missingPercentage=None,
            missingCount=None,
            uniqueCount=2.0,
            uniqueProportion=0.5,
            distinctCount=3.0,
            distinctProportion=0.75,
            min=30.0,
            max=32.0,
            minLength=None,
            maxLength=None,
            mean=31.0,
            sum=124.0,
            stddev=0.816496580927726,
            variance=None,
            median=31.0,
            firstQuartile=30.5,
            thirdQuartile=31.5,
            interQuartileRange=1.0,
            nonParametricSkew=0.0,
            histogram=Histogram(
                boundaries=["30.00 to 31.26", "31.26 and up"], frequencies=[3, 1]
            ),
        )

    def test_required_metrics(self):
        """
        Check that we raise properly MissingMetricException
        when not building the profiler with all the
        required ingredients
        """
        like = add_props(expression="J%")(Metrics.LIKE_COUNT.value)
        count = Metrics.COUNT.value
        like_ratio = Metrics.LIKE_RATIO.value

        # This should run properly
        Profiler(
            like,
            count,
            like_ratio,
            profiler_interface=self.datalake_profiler_interface,
        )

        with pytest.raises(MissingMetricException):
            # We are missing ingredients here
            Profiler(
                like,
                like_ratio,
                profiler_interface=self.datalake_profiler_interface,
            )

    def test_skipped_types(self):
        """
        Check that we are properly skipping computations for
        not supported types
        """

        class NotCompute(Base):
            __tablename__ = "not_compute"
            id = Column(Integer, primary_key=True)
            null_col = Column(sqlalchemy.types.NULLTYPE)
            array_col = Column(sqlalchemy.ARRAY(Integer, dimensions=2))
            json_col = Column(sqlalchemy.JSON)
            map_col = Column(sqa_types.SQAMap)
            struct_col = Column(sqa_types.SQAStruct)

        profiler = Profiler(
            Metrics.COUNT.value,
            profiler_interface=self.datalake_profiler_interface,
        )

        assert not profiler.column_results

    def test__check_profile_and_handle(self):
        """test _check_profile_and_handle returns as expected"""
        profiler = Profiler(
            Metrics.COUNT.value,
            profiler_interface=self.datalake_profiler_interface,
        )

        profiler._check_profile_and_handle(
            CreateTableProfileRequest(
                tableProfile=TableProfile(
                    timestamp=datetime.now().timestamp(), columnCount=10
                )
            )
        )

        with pytest.raises(Exception):
            profiler._check_profile_and_handle(
                CreateTableProfileRequest(
                    tableProfile=TableProfile(
                        timestamp=datetime.now().timestamp(), profileSample=100
                    )
                )
            )

    def test_profiler_get_col_metrics(self):
        """check getc column metrics"""
        metric_filter = ["mean", "min", "max", "firstQuartile"]
        self.datalake_profiler_interface.table_entity.tableProfilerConfig = (
            TableProfilerConfig(
                includeColumns=[
                    ColumnProfilerConfig(columnName="age", metrics=metric_filter)
                ]
            )
        )  # type: ignore

        default_profiler = DefaultProfiler(
            profiler_interface=self.datalake_profiler_interface,
        )

        column_metrics = default_profiler._prepare_column_metrics()
        for metric in column_metrics:
            if (
                metric.metric_type is not MetricTypes.Table
                and metric.column.name == "id"
            ):
                assert all(metric_filter.count(m.name()) for m in metric.metrics)
