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
Test Profiler behavior
"""
import os
from concurrent.futures import TimeoutError
from datetime import datetime
from unittest import TestCase
from unittest.mock import patch
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
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.source import sqa_types
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.core import MetricTypes, add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.core import MissingMetricException, Profiler
from metadata.profiler.processor.default import DefaultProfiler
from metadata.sampler.sqlalchemy.sampler import SQASampler

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    age = Column(Integer)


class ProfilerTest(TestCase):
    """
    Run checks on different metrics
    """

    db_path = os.path.join(
        os.path.dirname(__file__), f"{os.path.splitext(__file__)[0]}.db"
    )
    sqlite_conn = SQLiteConnection(
        scheme=SQLiteScheme.sqlite_pysqlite,
        databaseMode=db_path + "?check_same_thread=False",
    )

    table_entity = Table(
        id=uuid4(),
        name="user",
        columns=[
            EntityColumn(
                name=ColumnName("id"),
                dataType=DataType.INT,
                customMetrics=[
                    CustomMetric(
                        name="custom_metric",
                        description="custom metric",
                        expression="SELECT cos(id) FROM users",
                    )
                ],
            )
        ],
        customMetrics=[
            CustomMetric(
                name="custom_metric",
                description="custom metric",
                expression="SELECT COUNT(id) / COUNT(age) FROM users",
            ),
            CustomMetric(
                name="custom_metric_two",
                description="custom metric",
                expression="SELECT COUNT(id) * COUNT(age) FROM users",
            ),
        ],
    )

    with patch.object(SQASampler, "build_table_orm", return_value=User):
        sampler = SQASampler(
            service_connection_config=sqlite_conn,
            ometa_client=None,
            entity=table_entity,
        )

    sqa_profiler_interface = SQAProfilerInterface(
        sqlite_conn, None, table_entity, None, sampler, 5, 43200
    )

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """
        User.__table__.create(bind=cls.sqa_profiler_interface.session.get_bind())

        data = [
            User(name="John", fullname="John Doe", nickname="johnny b goode", age=30),
            User(name="Jane", fullname="Jone Doe", nickname=None, age=31),
        ]
        cls.sqa_profiler_interface.session.add_all(data)
        cls.sqa_profiler_interface.session.commit()

    def test_default_profiler(self):
        """
        Check our pre-cooked profiler
        """
        simple = DefaultProfiler(
            profiler_interface=self.sqa_profiler_interface, metrics_registry=Metrics
        )
        simple.compute_metrics()

        profile = simple.get_profile()

        assert profile.tableProfile.rowCount == 2
        assert profile.tableProfile.columnCount == 5

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
            valuesCount=2,
            valuesPercentage=None,
            validCount=None,
            duplicateCount=None,
            nullCount=0,
            nullProportion=0.0,
            uniqueCount=2,
            uniqueProportion=1.0,
            min=30.0,
            max=31.0,
            minLength=None,
            maxLength=None,
            mean=30.5,
            sum=61.0,
            stddev=0.25,
            variance=None,
            distinctCount=2.0,
            distinctProportion=1.0,
            median=30.0,
            timestamp=age_profile.timestamp,
            firstQuartile=30.0,
            thirdQuartile=31.0,
            interQuartileRange=1.0,
            nonParametricSkew=2.0,
            histogram=Histogram(boundaries=["30.000 and up"], frequencies=[2]),
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
            profiler_interface=self.sqa_profiler_interface,
        )

        with pytest.raises(MissingMetricException):
            # We are missing ingredients here
            Profiler(
                like,
                like_ratio,
                profiler_interface=self.sqa_profiler_interface,
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
            profiler_interface=self.sqa_profiler_interface,
        )

        assert not profiler.column_results

    def test__check_profile_and_handle(self):
        """test _check_profile_and_handle returns as expected"""
        profiler = Profiler(
            Metrics.COUNT.value,
            profiler_interface=self.sqa_profiler_interface,
        )

        profiler._check_profile_and_handle(
            CreateTableProfileRequest(
                tableProfile=TableProfile(
                    timestamp=Timestamp(int(datetime.now().timestamp())), columnCount=10
                )
            )
        )

        with pytest.raises(Exception):
            profiler._check_profile_and_handle(
                CreateTableProfileRequest(
                    tableProfile=TableProfile(
                        timestamp=Timestamp(int(datetime.now().timestamp())),
                        profileSample=100,
                    )
                )
            )

    def test__prepare_column_metrics(self):
        """test _prepare_column_metrics returns as expected"""
        profiler = Profiler(
            Metrics.FIRST_QUARTILE.value,
            profiler_interface=self.sqa_profiler_interface,
        )

        metrics = profiler._prepare_column_metrics()
        for metric in metrics:
            if metric.metrics:
                if isinstance(metric.metrics[0], CustomMetric):
                    assert metric.metrics[0].name.root == "custom_metric"
                else:
                    assert metric.metrics[0].name() == "firstQuartile"

    def test__prepare_table_metrics(self):
        """test _prepare_table_metrics returns as expected"""
        profiler = Profiler(
            Metrics.COLUMN_COUNT.value,
            profiler_interface=self.sqa_profiler_interface,
        )
        metrics = profiler._prepare_table_metrics()
        self.assertEqual(2, len(metrics))

    def test_profiler_with_timeout(self):
        """check timeout is properly used"""

        sqa_profiler_interface = SQAProfilerInterface(
            self.sqlite_conn,
            None,
            self.table_entity,
            None,
            self.sampler,
            5,
            0,
        )

        simple = DefaultProfiler(
            profiler_interface=sqa_profiler_interface, metrics_registry=Metrics
        )

        with pytest.raises(TimeoutError):
            simple.compute_metrics()

    def test_profiler_get_col_metrics(self):
        """check getc column metrics"""
        metric_filter = ["mean", "min", "max", "firstQuartile"]
        custom_metric_filter = ["custom_metric"]
        self.sqa_profiler_interface.table_entity.tableProfilerConfig = (
            TableProfilerConfig(
                includeColumns=[
                    ColumnProfilerConfig(columnName="id", metrics=metric_filter)
                ]
            )
        )  # type: ignore

        default_profiler = DefaultProfiler(
            profiler_interface=self.sqa_profiler_interface, metrics_registry=Metrics
        )

        column_metrics = default_profiler._prepare_column_metrics()
        for metric in column_metrics:
            if (
                metric.metric_type is not MetricTypes.Table
                and metric.column.name == "id"
            ):
                assert all(
                    metric_filter.count(m.name())
                    for m in metric.metrics
                    if not isinstance(m, CustomMetric)
                )
                assert all(
                    custom_metric_filter.count(m.name.root)
                    for m in metric.metrics
                    if isinstance(m, CustomMetric)
                )

    @classmethod
    def tearDownClass(cls) -> None:
        os.remove(cls.db_path)
