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
Test Metrics behavior
"""
import os
import sys
from unittest import TestCase, mock
from unittest.mock import Mock, patch
from uuid import uuid4

import pandas as pd
import pytest

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.interface.pandas.profiler_interface import (
    PandasProfilerInterface,
)
from metadata.profiler.processor.core import Profiler
from metadata.sampler.pandas.sampler import DatalakeSampler

BUCKET_NAME = "MyBucket"
REGION = "us-west-1"


if sys.version_info < (3, 9):
    pytest.skip(
        "requires python 3.9+ due to incompatibility with object patch",
        allow_module_level=True,
    )


class FakeClient:
    def __init__(self):
        self._client = None


class FakeConnection:
    def __init__(self):
        self.client = FakeClient()


class MetricsTest(TestCase):
    """
    Run checks on different metrics
    """

    current_dir = os.path.dirname(__file__)
    resources_dir = os.path.join(current_dir, "resources")

    datalake_conn = DatalakeConnection(
        configSource=S3Config(
            securityConfig=AWSCredentials(
                awsAccessKeyId="fake_access_key",
                awsSecretAccessKey="fake_secret_key",
                awsRegion=REGION,
            )
        )
    )

    dfs = [
        pd.read_csv(os.path.join(resources_dir, "profiler_test_.csv"), parse_dates=[5])
    ]

    table_entity = Table(
        id=uuid4(),
        name="user",
        databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="name"),
        columns=[
            EntityColumn(
                name=ColumnName("id"),
                dataType=DataType.INT,
            ),
            EntityColumn(
                name=ColumnName("first_name"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("last_name"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("city"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("country"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("birthdate"),
                dataType=DataType.DATE,
            ),
            EntityColumn(
                name=ColumnName("age"),
                dataType=DataType.INT,
            ),
        ],
    )

    @mock.patch(
        "metadata.profiler.interface.profiler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    @mock.patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def setUp(self, *_):
        with (
            patch.object(DatalakeSampler, "raw_dataset", new_callable=lambda: self.dfs),
            patch.object(DatalakeSampler, "get_client", return_value=Mock()),
        ):
            self.sampler = DatalakeSampler(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=self.table_entity,
            )
            self.datalake_profiler_interface = PandasProfilerInterface(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=self.table_entity,
                source_config=None,
                sampler=self.sampler,
                thread_count=1,
            )

    @mock.patch(
        "metadata.profiler.interface.profiler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    @mock.patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def test_table_custom_metric(self, *_):
        table_entity = Table(
            id=uuid4(),
            name="user",
            databaseSchema=EntityReference(
                id=uuid4(), type="databaseSchema", name="name"
            ),
            columns=[
                EntityColumn(
                    name=ColumnName("id"),
                    dataType=DataType.INT,
                ),
                EntityColumn(
                    name=ColumnName("first_name"),
                    dataType=DataType.STRING,
                ),
                EntityColumn(
                    name=ColumnName("last_name"),
                    dataType=DataType.STRING,
                ),
                EntityColumn(
                    name=ColumnName("city"),
                    dataType=DataType.STRING,
                ),
                EntityColumn(
                    name=ColumnName("country"),
                    dataType=DataType.STRING,
                ),
                EntityColumn(
                    name=ColumnName("birthdate"),
                    dataType=DataType.DATE,
                ),
                EntityColumn(
                    name=ColumnName("age"),
                    dataType=DataType.INT,
                ),
            ],
            customMetrics=[
                CustomMetric(
                    name="LastNameFilter",
                    expression="'last_name' != Doe",
                ),
                CustomMetric(
                    name="notUS",
                    expression="'country == US'",
                ),
            ],
        )

        with (
            patch.object(DatalakeSampler, "raw_dataset", new_callable=lambda: self.dfs),
            patch.object(DatalakeSampler, "get_client", return_value=Mock()),
        ):
            sampler = DatalakeSampler(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=table_entity,
            )
            datalake_profiler_interface = PandasProfilerInterface(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=table_entity,
                source_config=None,
                sampler=sampler,
                thread_count=1,
            )
            profiler = Profiler(
                profiler_interface=datalake_profiler_interface,
            )
            metrics = profiler.compute_metrics()
            for k, v in metrics._table_results.items():
                for metric in v:
                    if metric.name == "LastNameFilter":
                        assert metric.value == 1
                    if metric.name == "notUS":
                        assert metric.value == 2

    @mock.patch(
        "metadata.profiler.interface.profiler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    @mock.patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    )
    def test_column_custom_metric(self, *_):
        table_entity = Table(
            id=uuid4(),
            name="user",
            databaseSchema=EntityReference(
                id=uuid4(), type="databaseSchema", name="name"
            ),
            columns=[
                EntityColumn(
                    name=ColumnName("id"),
                    dataType=DataType.INT,
                    customMetrics=[
                        CustomMetric(
                            name="LastNameFilter",
                            columnName="id",
                            expression="'last_name' != Doe",
                        ),
                        CustomMetric(
                            name="notUS",
                            columnName="id",
                            expression="'country == US'",
                        ),
                    ],
                )
            ],
        )
        with (
            patch.object(DatalakeSampler, "raw_dataset", new_callable=lambda: self.dfs),
            patch.object(DatalakeSampler, "get_client", return_value=Mock()),
        ):
            sampler = DatalakeSampler(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=table_entity,
            )
            datalake_profiler_interface = PandasProfilerInterface(
                service_connection_config=DatalakeConnection(configSource={}),
                ometa_client=None,
                entity=table_entity,
                source_config=None,
                sampler=sampler,
                thread_count=1,
            )

            profiler = Profiler(
                profiler_interface=datalake_profiler_interface,
            )
            metrics = profiler.compute_metrics()
            for k, v in metrics._column_results.items():
                for metric in v.get("customMetrics", []):
                    if metric.name == "CustomerBornAfter1991":
                        assert metric.value == 1
                    if metric.name == "AverageAge":
                        assert metric.value == 2
