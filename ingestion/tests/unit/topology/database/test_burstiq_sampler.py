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
Unit tests for BurstIQSampler.

Covers: get_client, raw_dataset pagination/sampling, fetch_sample_data,
_cast_dataframe type coercion, and fallback methods.
"""
import math
from unittest.mock import Mock, PropertyMock, patch
from uuid import uuid4

import pandas as pd
import pytest

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    DataType,
    ProfileSampleType,
    Table,
    TableData,
)
from metadata.generated.schema.entity.services.connections.database.burstIQConnection import (
    BurstIQConnection,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sampler.models import SampleConfig
from metadata.sampler.pandas.burstiq.sampler import _PAGE_SIZE, BurstIQSampler
from metadata.utils.constants import SAMPLE_DATA_MAX_CELL_LENGTH
from metadata.utils.sqa_like_column import SQALikeColumn


class _ConcreteBurstIQSampler(BurstIQSampler):
    """Concrete subclass used in tests — provides get_columns() which BurstIQSampler
    leaves abstract (it is normally supplied by the profiler interface layer)."""

    def get_columns(self):
        return [
            SQALikeColumn(name=col.name.root, type=col.dataType)
            for col in (self.entity.columns or [])
        ]


BURSTIQ_CONNECTION = BurstIQConnection(
    username="u",
    password="p",
    realmName="realm",
    biqSdzName="sdz",
    biqCustomerName="cust",
)

TABLE_ENTITY = Table(
    id=uuid4(),
    name="TestChain",
    databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="schema"),
    columns=[
        EntityColumn(name=ColumnName("score"), dataType=DataType.DOUBLE),
        EntityColumn(name=ColumnName("age"), dataType=DataType.INT),
        EntityColumn(name=ColumnName("created_at"), dataType=DataType.DATETIME),
    ],
)


@pytest.fixture
def mock_client():
    return Mock()


@pytest.fixture
def sampler(mock_client):
    with patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=mock_client,
    ):
        s = _ConcreteBurstIQSampler(
            service_connection_config=BURSTIQ_CONNECTION,
            ometa_client=None,
            entity=TABLE_ENTITY,
            sample_config=SampleConfig(),
        )
    return s


class TestBurstIQSamplerGetClient:
    def test_get_client_returns_connection(self, sampler):
        assert sampler.client is sampler.connection


class TestBurstIQSamplerRawDataset:
    def test_rows_sample_type_limits_to_exact_count(self, sampler, mock_client):
        sampler.sample_config = SampleConfig(
            profileSample=3,
            profileSampleType=ProfileSampleType.ROWS,
        )
        mock_client.get_records_by_tql.return_value = [
            {"score": 1.0, "age": i} for i in range(3)
        ]

        dfs = list(sampler.raw_dataset())

        mock_client.get_records_by_tql.assert_called_once_with(
            "TestChain", limit=3, skip=0
        )
        assert len(dfs) == 1
        assert len(dfs[0]) == 3

    def test_percentage_sample_type_queries_chain_metrics(self, sampler, mock_client):
        sampler.sample_config = SampleConfig(
            profileSample=50,
            profileSampleType=ProfileSampleType.PERCENTAGE,
        )
        mock_client.get_chain_metrics.return_value = {"TestChain": 100}
        mock_client.get_records_by_tql.return_value = [
            {"score": float(i)} for i in range(50)
        ]

        dfs = list(sampler.raw_dataset())

        mock_client.get_chain_metrics.assert_called_once()
        mock_client.get_records_by_tql.assert_called_once_with(
            "TestChain", limit=50, skip=0
        )
        assert sum(len(df) for df in dfs) == 50

    def test_no_sample_fetches_all_via_pagination(self, sampler, mock_client):
        sampler.sample_config = SampleConfig()
        mock_client.get_records_by_tql.return_value = [
            {"score": float(i)} for i in range(10)
        ]

        dfs = list(sampler.raw_dataset())

        mock_client.get_chain_metrics.assert_not_called()
        assert sum(len(df) for df in dfs) == 10

    def test_empty_chain_yields_single_empty_dataframe(self, sampler, mock_client):
        sampler.sample_config = SampleConfig()
        mock_client.get_records_by_tql.return_value = []

        dfs = list(sampler.raw_dataset())

        mock_client.get_chain_metrics.assert_not_called()
        assert len(dfs) == 1
        assert dfs[0].empty

    def test_pagination_splits_into_multiple_pages(self, sampler, mock_client):
        sampler.sample_config = SampleConfig()
        page1 = [{"score": float(i)} for i in range(_PAGE_SIZE)]
        page2 = [{"score": float(i)} for i in range(_PAGE_SIZE, _PAGE_SIZE * 2)]
        page3 = [
            {"score": float(i)}
            for i in range(_PAGE_SIZE * 2, _PAGE_SIZE * 2 + _PAGE_SIZE // 2)
        ]
        mock_client.get_records_by_tql.side_effect = [page1, page2, page3]

        dfs = list(sampler.raw_dataset())

        mock_client.get_chain_metrics.assert_not_called()
        assert len(dfs) == 3
        assert len(dfs[0]) == _PAGE_SIZE
        assert len(dfs[1]) == _PAGE_SIZE
        assert len(dfs[2]) == _PAGE_SIZE // 2

    def test_stops_early_on_short_page(self, sampler, mock_client):
        sampler.sample_config = SampleConfig()
        mock_client.get_records_by_tql.return_value = [
            {"score": float(i)} for i in range(5)
        ]

        dfs = list(sampler.raw_dataset())

        mock_client.get_chain_metrics.assert_not_called()
        assert mock_client.get_records_by_tql.call_count == 1
        assert len(dfs) == 1
        assert len(dfs[0]) == 5

    def test_get_dataset_delegates_to_raw_dataset(self, sampler):
        sentinel = Mock()
        with patch.object(
            type(sampler),
            "raw_dataset",
            new_callable=PropertyMock,
            return_value=sentinel,
        ):
            result = sampler.get_dataset()

        assert result is sentinel


class TestBurstIQSamplerFetchSampleData:
    def _patch_raw(self, sampler, df):
        return patch.object(
            type(sampler),
            "raw_dataset",
            new_callable=PropertyMock,
            return_value=lambda: iter([df]),
        )

    def test_empty_dataframe_returns_empty_tabledata(self, sampler):
        cols = [SQALikeColumn(name="score", type=DataType.DOUBLE)]
        with self._patch_raw(sampler, pd.DataFrame()):
            result = sampler.fetch_sample_data(cols)

        col_names = [c.root for c in result.columns]
        assert result.rows == []
        assert col_names == ["score"]

    def test_respects_sample_limit(self, sampler):
        df = pd.DataFrame({"score": list(range(10)), "age": list(range(10))})
        sampler.sample_limit = 3
        cols = [
            SQALikeColumn(name="score", type=DataType.DOUBLE),
            SQALikeColumn(name="age", type=DataType.INT),
        ]
        with self._patch_raw(sampler, df):
            result = sampler.fetch_sample_data(cols)

        assert len(result.rows) == 3

    def test_filters_to_requested_columns_only(self, sampler):
        df = pd.DataFrame({"score": [1.0, 2.0], "age": [10, 20]})
        cols = [SQALikeColumn(name="score", type=DataType.DOUBLE)]
        with self._patch_raw(sampler, df):
            result = sampler.fetch_sample_data(cols)

        col_names = [c.root for c in result.columns]
        assert col_names == ["score"]
        assert "age" not in col_names

    def test_skips_columns_absent_from_dataframe(self, sampler):
        df = pd.DataFrame({"score": [1.0]})
        cols = [
            SQALikeColumn(name="score", type=DataType.DOUBLE),
            SQALikeColumn(name="missing_col", type=DataType.STRING),
        ]
        with self._patch_raw(sampler, df):
            result = sampler.fetch_sample_data(cols)

        col_names = [c.root for c in result.columns]
        assert "score" in col_names
        assert "missing_col" not in col_names

    def test_truncates_oversized_cell_values(self, sampler):
        oversized = "x" * (SAMPLE_DATA_MAX_CELL_LENGTH + 100)
        df = pd.DataFrame({"score": [oversized]})
        cols = [SQALikeColumn(name="score", type=DataType.STRING)]
        with self._patch_raw(sampler, df):
            result = sampler.fetch_sample_data(cols)

        assert len(result.rows[0][0]) == SAMPLE_DATA_MAX_CELL_LENGTH


class TestBurstIQSamplerCastDataframe:
    def test_numeric_column_cast_to_float(self, sampler):
        df = pd.DataFrame({"score": ["1.5", "2.5", "3.5"]})
        result = sampler._cast_dataframe(df)

        assert pd.api.types.is_numeric_dtype(result["score"])

    def test_scientific_notation_string_parsed(self, sampler):
        df = pd.DataFrame({"score": ["9.87E+08", "1.23E+06"]})
        result = sampler._cast_dataframe(df)

        assert abs(result["score"].iloc[0] - 987_000_000.0) < 1.0
        assert abs(result["score"].iloc[1] - 1_230_000.0) < 1.0

    def test_unparseable_numeric_becomes_nan(self, sampler):
        df = pd.DataFrame({"age": ["not_a_number", "42"]})
        result = sampler._cast_dataframe(df)

        assert math.isnan(result["age"].iloc[0])
        assert result["age"].iloc[1] == 42.0

    def test_datetime_column_parsed_to_utc(self, sampler):
        df = pd.DataFrame({"created_at": ["2024-01-01", "2024-06-15"]})
        result = sampler._cast_dataframe(df)

        assert hasattr(result["created_at"].dtype, "tz")
        assert str(result["created_at"].dtype) == "datetime64[ns, UTC]"

    def test_empty_dataframe_returns_unchanged(self, sampler):
        df = pd.DataFrame()
        result = sampler._cast_dataframe(df)

        assert result.empty

    def test_missing_column_in_df_silently_skipped(self, sampler):
        df = pd.DataFrame({"age": [10, 20, 30]})
        result = sampler._cast_dataframe(df)

        assert "score" not in result.columns
        assert list(result["age"]) == [10, 20, 30]

    def test_non_entity_column_left_untouched(self, sampler):
        df = pd.DataFrame({"extra": ["hello", "world"]})
        result = sampler._cast_dataframe(df)

        assert result["extra"].iloc[0] == "hello"
        assert result["extra"].dtype == object


class TestBurstIQSamplerFallbacks:
    def test_rdn_sample_from_user_query_returns_raw_dataset(self, sampler):
        sentinel = Mock()
        with patch.object(
            type(sampler),
            "raw_dataset",
            new_callable=PropertyMock,
            return_value=sentinel,
        ):
            result = sampler._rdn_sample_from_user_query()

        assert result is sentinel

    def test_fetch_sample_data_from_user_query_delegates_to_fetch_sample_data(
        self, sampler
    ):
        sampler._columns = [SQALikeColumn(name="score", type=DataType.DOUBLE)]
        df = pd.DataFrame({"score": [1.0, 2.0]})
        with patch.object(
            type(sampler),
            "raw_dataset",
            new_callable=PropertyMock,
            return_value=lambda: iter([df]),
        ):
            result = sampler._fetch_sample_data_from_user_query()

        assert isinstance(result, TableData)
        assert "score" in [c.root for c in result.columns]
