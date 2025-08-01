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
Test Sample behavior
"""
import os
import sys
from unittest import TestCase, mock
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import TEXT, Column, Integer, String
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.interface.pandas.profiler_interface import (
    PandasProfilerInterface,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.core import Profiler
from metadata.sampler.models import SampleConfig
from metadata.sampler.pandas.sampler import DatalakeSampler

Base = declarative_base()


if sys.version_info < (3, 9):
    pytest.skip(
        "requires python 3.9+ due to incompatibility with object patch",
        allow_module_level=True,
    )


class User(Base):
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
    def setUpClass(cls, mock_get_connection, mock_sample_get_connection) -> None:
        """
        Prepare Ingredients
        """
        with (
            patch.object(
                DatalakeSampler, "raw_dataset", new_callable=lambda: [cls.df1, cls.df2]
            ),
            patch.object(DatalakeSampler, "get_client", return_value=Mock()),
        ):
            sampler = DatalakeSampler(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=cls.table_entity,
                sample_config=SampleConfig(profileSample=50.0),
            )
            cls.datalake_profiler_interface = PandasProfilerInterface(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=cls.table_entity,
                source_config=None,
                sampler=sampler,
                thread_count=None,
            )

    @mock.patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def test_random_sampler(self, _):
        """
        The random sampler should be able to
        generate a random subset of data
        """
        with (
            patch.object(
                DatalakeSampler,
                "raw_dataset",
                new_callable=lambda: [self.df1, self.df2],
            ),
            patch.object(DatalakeSampler, "get_client", return_value=Mock()),
        ):
            sampler = DatalakeSampler(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=self.table_entity,
                sample_config=SampleConfig(profileSample=50.0),
            )
            random_sample = sampler.get_dataset()
            res = sum(len(r) for r in random_sample)
            assert res < 5

    @mock.patch(
        "metadata.profiler.interface.profiler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    @mock.patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    @mock.patch(
        "metadata.mixins.pandas.pandas_mixin.fetch_dataframe",
        return_value=[df1, pd.concat([df2, pd.DataFrame(index=df1.index)])],
    )
    def test_sample_property(self, *_):
        """
        Sample property should be properly generated
        """
        with (
            patch.object(
                DatalakeSampler,
                "raw_dataset",
                new_callable=lambda: [self.df1, self.df2],
            ),
            patch.object(DatalakeSampler, "get_client", return_value=Mock()),
        ):
            sampler = DatalakeSampler(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=self.table_entity,
                sample_config=SampleConfig(profileSample=50.0),
            )
            datalake_profiler_interface = PandasProfilerInterface(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=self.table_entity,
                source_config=None,
                sampler=sampler,
                thread_count=None,
            )

            random_sample = datalake_profiler_interface.sampler.get_dataset()
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
        # We expect the full count of the table
        assert res.get(Metrics.ROW_COUNT.name) == 2

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

    @mock.patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def test_sample_data(self, *_):
        """
        We should be able to pick up sample data from the sampler
        """
        with (
            patch.object(
                DatalakeSampler,
                "raw_dataset",
                new_callable=lambda: [self.df1, self.df2],
            ),
            patch.object(DatalakeSampler, "get_client", return_value=Mock()),
        ):
            sampler = DatalakeSampler(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=self.table_entity,
                sample_config=SampleConfig(profileSample=50.0),
            )
            sample_data = sampler.fetch_sample_data()

            assert len(sample_data.columns) == 10
            # we drop na values when fecthing sample data
            assert len(sample_data.rows) == 4

    @mock.patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def test_sample_from_user_query(self, *_):
        """
        Test sample data are returned based on user query
        """
        with (
            patch.object(
                DatalakeSampler,
                "raw_dataset",
                new_callable=lambda: [self.df1, self.df2],
            ),
            patch.object(DatalakeSampler, "get_client", return_value=Mock()),
        ):
            sampler = DatalakeSampler(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=self.table_entity,
                default_sample_config=SampleConfig(profileSample=50.0),
                sample_query="`age` > 30",
            )
            sample_data = sampler.fetch_sample_data()

            assert len(sample_data.columns) == 10
            assert len(sample_data.rows) == 3
