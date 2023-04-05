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
Test Metrics behavior
"""
import os
from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import TEXT, Column, Date, DateTime, Integer, String, Time
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.profiler.core import Profiler
from metadata.profiler.profiler.interface.pandas import pandas_profiler_interface

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)
    dob = Column(DateTime)  # date of birth
    tob = Column(Time)  # time of birth
    doe = Column(Date)  # date of employment


class DatalakeMetricsTest(TestCase):
    """
    Run checks on different metrics
    """

    import pandas as pd

    root_dir = os.path.dirname(os.path.abspath(__file__))
    csv_dir = "custom_csv"
    df1 = pd.read_csv(os.path.join(root_dir, csv_dir, "test_datalake_metrics_1.csv"))
    df2 = pd.read_csv(os.path.join(root_dir, csv_dir, "test_datalake_metrics_2.csv"))

    @patch.object(
        pandas_profiler_interface.PandasProfilerInterface,
        "get_connection_client",
        return_value=None,
    )
    @patch.object(
        pandas_profiler_interface.PandasInterfaceMixin,
        "return_ometa_dataframes_sampled",
        return_value=[df1, df2],
    )
    def __init__(
        self, methodName, return_ometa_dataframes_sampled, get_connection_client
    ):
        super().__init__(methodName)
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

        self.datalake_profiler_interface = (
            pandas_profiler_interface.PandasProfilerInterface(
                entity=table_entity,
                service_connection_config=None,
                ometa_client=None,
                thread_count=None,
                profile_sample_config=None,
                source_config=None,
                sample_query=None,
                table_partition_config=None,
            )
        )

    def test_count(self):
        """
        Check the Count metric
        """
        count = Metrics.COUNT.value
        profiler = Profiler(
            count,
            profiler_interface=self.datalake_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        # Note how we can get the result value by passing the metrics name
        assert res.get(User.name.name).get(Metrics.COUNT.name) == 5

    def test_min(self):
        """
        Check the Min metric
        """
        min_age = Metrics.MIN.value
        profiler = Profiler(
            min_age,
            profiler_interface=self.datalake_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        # Note how we can get the result value by passing the metrics name
        assert res.get(User.age.name).get(Metrics.MIN.name) == 30

    def test_std(self):
        """
        Check STD metric
        """
        std_age = Metrics.STDDEV.value
        profiler = Profiler(
            std_age,
            profiler_interface=self.datalake_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        assert round(res.get(User.age.name).get(Metrics.STDDEV.name), 2) == 6.85

    def test_time(self):
        """
        Check Earliest Time Metric
        """
        earliest_time = Metrics.MIN.value
        profiler = Profiler(
            earliest_time,
            profiler_interface=self.datalake_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results
        # string as min returns 0
        assert res.get(User.dob.name).get(Metrics.MIN.name) == 0
        assert res.get(User.tob.name).get(Metrics.MIN.name) == 0
        assert res.get(User.doe.name).get(Metrics.MIN.name) == 0

    def test_null_count(self):
        """
        Check null count
        """
        null_count = Metrics.NULL_COUNT.value
        profiler = Profiler(
            null_count,
            profiler_interface=self.datalake_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        assert res.get(User.nickname.name).get(Metrics.NULL_COUNT.name) == 1

    def test_null_ratio(self):
        """
        Check composed metric run
        """
        count = Metrics.COUNT.value
        null_count = Metrics.NULL_COUNT.value

        # Build the ratio based on the other two metrics
        null_ratio = Metrics.NULL_RATIO.value

        profiler = Profiler(
            count,
            null_count,
            null_ratio,
            profiler_interface=self.datalake_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results
        assert (
            str(round(res.get(User.nickname.name).get(Metrics.NULL_RATIO.name), 2))
            == "0.2"
        )

    def test_table_row_count(self):
        """
        Check Table Metric run
        """
        table_count = Metrics.ROW_COUNT.value
        profiler = Profiler(
            table_count,
            profiler_interface=self.datalake_profiler_interface,
        )
        res = profiler.compute_metrics()._table_results
        assert res.get(Metrics.ROW_COUNT.name) == 5

    def test_table_column_count(self):
        """
        Check Column Count metric
        """
        col_count = add_props(table=User)(Metrics.COLUMN_COUNT.value)
        profiler = Profiler(
            col_count,
            profiler_interface=self.datalake_profiler_interface,
        )
        res = profiler.compute_metrics()._table_results
        # Not counting id here
        assert res.get(Metrics.COLUMN_COUNT.name) == 8

    def test_avg(self):
        """
        Check avg for distinct types
        """

        # Integer
        avg = Metrics.MEAN.value
        res = (
            Profiler(
                avg,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert round(res.get(User.age.name)[Metrics.MEAN.name], 2) == 35.25

        # String
        avg = Metrics.MEAN.value
        res = (
            Profiler(
                avg,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.MEAN.name] == 4.0

        # Text
        avg = Metrics.MEAN.value
        res = (
            Profiler(
                avg,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert round(res.get(User.comments.name)[Metrics.MEAN.name], 2) == 17.0

    def test_duplicate_count(self):
        """
        Check composed duplicate count
        """
        count = Metrics.COUNT.value
        unique = Metrics.DISTINCT_COUNT.value
        dup_count = Metrics.DUPLICATE_COUNT.value
        res = (
            Profiler(
                count,
                unique,
                dup_count,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.DUPLICATE_COUNT.name] == 0

    def test_histogram(self):
        """
        Check histogram computation
        """

        hist = Metrics.HISTOGRAM.value
        count = Metrics.COUNT.value
        min = Metrics.MIN.value
        max = Metrics.MAX.value
        first_quartile = Metrics.FIRST_QUARTILE.value
        third_quartile = Metrics.THIRD_QUARTILE.value
        iqr = Metrics.IQR.value

        res = (
            Profiler(
                hist,
                count,
                min,
                max,
                first_quartile,
                third_quartile,
                iqr,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        age_histogram = res.get(User.age.name)[Metrics.HISTOGRAM.name]

        assert age_histogram
        assert len(age_histogram["frequencies"]) == 2

    def test_max(self):
        """
        Check MAX metric
        """
        _max = Metrics.MAX.value

        res = (
            Profiler(
                _max,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.MAX.name] == 45

    def test_min_length(self):
        """
        Check MIN_LENGTH metric
        """

        min_length = Metrics.MIN_LENGTH.value

        # Integer
        res = (
            Profiler(
                min_length,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name).get(Metrics.MIN_LENGTH.name) is None

        # String
        res = (
            Profiler(
                min_length,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.MIN_LENGTH.name] == 4

        # Text
        res = (
            Profiler(
                min_length,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.comments.name)[Metrics.MIN_LENGTH.name] == 11

    def test_max_length(self):
        """
        Check MAX_LENGTH metric
        """
        max_length = Metrics.MAX_LENGTH.value

        # Integer
        res = (
            Profiler(
                max_length,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name).get(Metrics.MAX_LENGTH.name) is None

        # String
        res = (
            Profiler(
                max_length,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.MAX_LENGTH.name] == 4

        # Text
        res = (
            Profiler(
                max_length,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.comments.name)[Metrics.MAX_LENGTH.name] == 19

    def test_sum(self):
        """
        Check SUM Metric
        """
        _sum = Metrics.SUM.value

        res = (
            Profiler(
                _sum,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.SUM.name] == 141

        res = (
            Profiler(
                _sum,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name).get(Metrics.SUM.name) is None

    def test_unique_count(self):
        """
        Check Unique Count metric
        """
        unique_count = Metrics.UNIQUE_COUNT.value
        res = (
            Profiler(
                unique_count,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.UNIQUE_COUNT.name] == 1

    def test_unique_ratio(self):
        """
        Check Unique Count metric
        """
        count = Metrics.COUNT.value
        unique_count = Metrics.UNIQUE_COUNT.value
        unique_ratio = Metrics.UNIQUE_RATIO.value
        res = (
            Profiler(
                count,
                unique_count,
                unique_ratio,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert (
            str(round(res.get(User.name.name)[Metrics.UNIQUE_RATIO.name], 2)) == "0.2"
        )

    def test_distinct_count(self):
        """
        Check Distinct Count Metric
        """
        count = Metrics.DISTINCT_COUNT.value
        res = (
            Profiler(
                count,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.DISTINCT_COUNT.name] == 3

    def test_distinct_ratio(self):
        """
        Check Distinct Ratio Metric
        """
        count = Metrics.COUNT.value
        distinct_count = Metrics.DISTINCT_COUNT.value
        distinct_ratio = Metrics.DISTINCT_RATIO.value
        res = (
            Profiler(
                count,
                distinct_count,
                distinct_ratio,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert (
            str(round(res.get(User.name.name)[Metrics.DISTINCT_RATIO.name], 2)) == "0.6"
        )

    def test_count_in_set(self):
        """
        Check Count In Set metric
        """

        set_count = add_props(values=["John"])(Metrics.COUNT_IN_SET.value)
        res = (
            Profiler(
                set_count,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.COUNT_IN_SET.name] == 2.0

        set_count = add_props(values=["John", "Jane"])(Metrics.COUNT_IN_SET.value)
        res = (
            Profiler(
                set_count,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.COUNT_IN_SET.name] == 3

    def test_median(self):
        """
        Check MEDIAN
        """

        median = Metrics.MEDIAN.value
        res = (
            Profiler(
                median,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.MEDIAN.name] == 33.0

    def test_first_quartile(self):
        """
        Check first quartile
        """

        first_quartile = Metrics.FIRST_QUARTILE.value
        res = (
            Profiler(
                first_quartile,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )
        assert res.get(User.age.name)[Metrics.FIRST_QUARTILE.name] == 30.5

    def test_third_quartile(self):
        """
        Check third quartile
        """

        third_quartile = Metrics.THIRD_QUARTILE.value
        res = (
            Profiler(
                third_quartile,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.THIRD_QUARTILE.name] == 40

    def test_iqr(self):
        """Check IQR metric"""
        iqr = Metrics.IQR.value
        first_quartile = Metrics.FIRST_QUARTILE.value
        third_quartile = Metrics.THIRD_QUARTILE.value
        res = (
            Profiler(
                first_quartile,
                third_quartile,
                iqr,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.IQR.name] == 9.5

    def test_sum_function(self):
        """Check overwritten sum function"""
        sum_metric = Metrics.SUM.value
        res = (
            Profiler(
                sum_metric,
                profiler_interface=self.datalake_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.SUM.name] == 141

    @classmethod
    def tearDownClass(cls) -> None:
        return super().tearDownClass()
