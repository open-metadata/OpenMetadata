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
Test that the datalake and storage samplers keep each column's own type when
every column is numeric or a timestamp.
"""

import io
import uuid
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pandas as pd
import pytest

from metadata.generated.schema.entity.data.container import Container, FileFormat
from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table, TableData
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.sampler.pandas.sampler import DatalakeSampler
from metadata.sampler.sampler_config import DatabaseSamplerConfig
from metadata.sampler.storage.sampler import StorageSampler

TABLE_ENTITY = Table(
    id=uuid4(),
    name="orders",
    databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="schema"),
    fileFormat="csv",
    columns=[
        EntityColumn(name=ColumnName("order_id"), dataType=DataType.BIGINT),
        EntityColumn(name=ColumnName("card_number"), dataType=DataType.BIGINT),
        EntityColumn(name=ColumnName("amount"), dataType=DataType.FLOAT),
    ],
)

CONTAINER_ENTITY = Container(
    id=Uuid(root=uuid.uuid4()),
    name=EntityName(root="orders"),
    fullyQualifiedName=FullyQualifiedEntityName(root="service.orders"),
    service=EntityReference(id=Uuid(root=uuid.uuid4()), type="storageService"),
    fileFormats=[FileFormat.csv],
)

EXPECTED_ROWS = [
    [1234567890123456789, 4111111111111111, 19.99],
    [1234567890123456790, 5500005555555559, 5.0],
]

EXPECTED_TIMESTAMPS = [[pd.Timestamp("2024-01-02 03:04:05")], [pd.Timestamp("2024-05-06 07:08:09")]]


def _numeric_df():
    return pd.read_csv(
        io.StringIO(
            "order_id,card_number,amount\n"
            "1234567890123456789,4111111111111111,19.99\n"
            "1234567890123456790,5500005555555559,5.00\n"
        )
    )


def _timestamp_df():
    return pd.DataFrame({"created": pd.to_datetime(["2024-01-02 03:04:05", "2024-05-06 07:08:09"])})


class FakeConnection:
    def __init__(self):
        self.client = Mock(_client=None)


def _datalake_rows(df):
    with (
        patch(
            "metadata.sampler.pandas.sampler.get_ssl_connection",
            return_value=FakeConnection(),
        ),
        patch.object(
            DatalakeSampler,
            "get_dataframes",
            return_value=DatalakeColumnWrapper(dataframes=lambda: iter([df]), columns=None, raw_data=None),
        ),
        patch.object(DatalakeSampler, "get_client", return_value=Mock()),
    ):
        sampler = DatalakeSampler(
            service_connection_config=DatalakeConnection(configSource={}),
            ometa_client=None,
            entity=TABLE_ENTITY,
            config=DatabaseSamplerConfig(),
        )
        return sampler.fetch_sample_data().rows


class _CsvStorageSampler(StorageSampler):
    def get_client(self):
        return Mock()

    def _get_sample_file_path(self):
        return "orders.csv"

    def _get_bucket_name(self):
        return "bucket"

    def _get_config_source(self):
        return Mock()


def _storage_rows(df, sample_limit=None):
    with patch(
        "metadata.sampler.storage.sampler.fetch_dataframe_first_chunk",
        return_value=iter([df]),
    ):
        sampler = _CsvStorageSampler(
            service_connection_config=MagicMock(),
            ometa_client=None,
            entity=CONTAINER_ENTITY,
        )
        if sample_limit is not None:
            sampler.sample_limit = sample_limit
        return sampler.fetch_sample_data(columns=None).rows


def _assert_ints_kept(rows):
    assert rows == EXPECTED_ROWS
    assert [[type(cell) for cell in row] for row in rows] == [[int, int, float]] * 2


def test_datalake_sampler_keeps_integer_columns_as_integers():
    _assert_ints_kept(_datalake_rows(_numeric_df()))


def test_storage_sampler_keeps_integer_columns_as_integers():
    _assert_ints_kept(_storage_rows(_numeric_df()))


def test_storage_sampler_still_applies_the_sample_limit():
    assert _storage_rows(_numeric_df(), sample_limit=1) == EXPECTED_ROWS[:1]


def test_datalake_sampler_returns_timestamps_from_a_timestamp_only_frame():
    assert _datalake_rows(_timestamp_df()) == EXPECTED_TIMESTAMPS


def test_storage_sampler_returns_timestamps_from_a_timestamp_only_frame():
    assert _storage_rows(_timestamp_df()) == EXPECTED_TIMESTAMPS


@pytest.mark.parametrize(
    "df,expected",
    [
        (
            pd.DataFrame({"created": pd.to_datetime(["2024-01-02 03:04:05", None])}),
            [[pd.Timestamp("2024-01-02 03:04:05")], [None]],
        ),
        (
            pd.DataFrame({"created": pd.to_datetime(["2024-01-02 03:04:05", None]), "amount": [1.5, None]}),
            [[pd.Timestamp("2024-01-02 03:04:05"), 1.5], [None, None]],
        ),
        (
            pd.DataFrame({"created": pd.to_datetime(["2024-01-02 03:04:05", None]), "name": ["a", "b"]}),
            [[pd.Timestamp("2024-01-02 03:04:05"), "a"], [None, "b"]],
        ),
    ],
)
def test_storage_sampler_returns_missing_values_as_none(df, expected):
    rows = _storage_rows(df)

    assert rows == expected
    # A NaT left in a row would make the upload's model_dump_json() fail.
    TableData(columns=df.columns.tolist(), rows=rows).model_dump_json()
