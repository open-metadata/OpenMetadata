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
Test Sample behavior
"""
import os
from unittest import TestCase, mock
from uuid import uuid4

import pytest
from sqlalchemy import TEXT, Column, Integer, String
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.profiler.api.models import ProfileSampleConfig
from metadata.profiler.interface.pandas.profiler_interface import (
    PandasProfilerInterface,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.core import Profiler
from metadata.profiler.processor.sampler.pandas.sampler import DatalakeSampler

Base = declarative_base()


class User(Base):
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


class DatalakeSampleTest(TestCase):
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
            ),
            EntityColumn(
                name=ColumnName(__root__="name"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName(__root__="fullname"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName(__root__="nickname"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName(__root__="comments"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName(__root__="age"),
                dataType=DataType.INT,
            ),
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
    def setUpClass(cls, mock_get_connection, mocked_dfs) -> None:
        """
        Prepare Ingredients
        """
        cls.datalake_profiler_interface = PandasProfilerInterface(
            entity=cls.table_entity,
            service_connection_config=None,
            ometa_client=None,
            thread_count=None,
            profile_sample_config=ProfileSampleConfig(profile_sample=50.0),
            source_config=None,
            sample_query=None,
            table_partition_config=None,
        )

    def test_random_sampler(self):
        """
        The random sampler should be able to
        generate a random subset of data
        """
        sampler = DatalakeSampler(
            client=FakeConnection().client(),
            table=[self.df1, self.df2],
            profile_sample_config=ProfileSampleConfig(profile_sample=50.0),
        )
        random_sample = sampler.random_sample()
        res = sum(len(r) for r in random_sample)
        assert res < 5

    @mock.patch(
        "metadata.profiler.interface.profiler_interface.get_connection",
        return_value=FakeConnection,
    )
    @mock.patch.object(
        PandasProfilerInterface,
        "_convert_table_to_list_of_dataframe_objects",
        return_value=[df1, pd.concat([df2, pd.DataFrame(index=df1.index)])],
    )
    def test_sample_property(self, mock_get_connection, mocked_dfs):
        """
        Sample property should be properly generated
        """
        datalake_profiler_interface = PandasProfilerInterface(
            entity=self.table_entity,
            service_connection_config=None,
            ometa_client=None,
            thread_count=None,
            profile_sample_config=ProfileSampleConfig(profile_sample=50.0),
            source_config=None,
            sample_query=None,
            table_partition_config=None,
        )

        random_sample = datalake_profiler_interface._get_sampler().random_sample()
        res = sum(len(r) for r in random_sample)
        assert res < 5

    def test_table_row_count(self):
        """
        Profile sample should be ignored in row count
        """

        table_count = Metrics.ROW_COUNT.value
        profiler = Profiler(
            table_count,
            profiler_interface=self.datalake_profiler_interface,
        )
        res = profiler.compute_metrics()._table_results
        assert res.get(Metrics.ROW_COUNT.name) == 3

    @pytest.mark.skip(reason="Flaky test due to small sample size")
    def test_random_sample_histogram(self):
        """
        Histogram should run correctly
        """
        hist = Metrics.HISTOGRAM.value
        count = Metrics.COUNT.value
        min = Metrics.MIN.value
        max = Metrics.MAX.value
        first_quartile = Metrics.FIRST_QUARTILE.value
        third_quartile = Metrics.THIRD_QUARTILE.value
        iqr = Metrics.IQR.value

        profiler = Profiler(
            hist,
            count,
            min,
            max,
            first_quartile,
            third_quartile,
            iqr,
            profiler_interface=self.datalake_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        # The sum of all frequencies should be sampled
        assert sum(res.get(User.age.name)[Metrics.HISTOGRAM.name]["frequencies"]) < 30

    def test_sample_data(self):
        """
        We should be able to pick up sample data from the sampler
        """
        sampler = DatalakeSampler(
            client=FakeConnection().client(),
            table=[self.df1, self.df2],
        )
        sample_data = sampler.fetch_sample_data()

        assert len(sample_data.columns) == 10
        # we drop na values when fecthing sample data
        assert len(sample_data.rows) == 4

    def test_sample_from_user_query(self):
        """
        Test sample data are returned based on user query
        """
        stmt = "`age` > 30"
        sampler = DatalakeSampler(
            client=FakeConnection().client(),
            table=[self.df1, self.df2],
            profile_sample_query=stmt,
        )
        sample_data = sampler.fetch_sample_data()

        assert len(sample_data.columns) == 10
        assert len(sample_data.rows) == 3
