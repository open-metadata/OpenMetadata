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
Tests for 100% PERCENTAGE sampling edge case (#21304).

Verifies that the get_dataset() short-circuit at 100% correctly
respects the randomizedSample flag. Only an explicit True enables
randomization; None and False both skip randomization.
"""
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.table import ProfileSampleType
from metadata.sampler.models import SampleConfig


class TestSQASampler100Pct:
    """Test SQASampler.get_dataset() at 100% PERCENTAGE sampling."""

    def _make_sampler(self, randomized_sample):
        """Create a SQASampler mock with the given randomizedSample value."""
        with patch(
            "metadata.sampler.sqlalchemy.sampler.SQASampler.__init__",
            return_value=None,
        ):
            from metadata.sampler.sqlalchemy.sampler import SQASampler

            sampler = SQASampler()
            sampler.sample_config = SampleConfig(
                profileSample=100,
                profileSampleType=ProfileSampleType.PERCENTAGE,
                randomizedSample=randomized_sample,
            )
            sampler.sample_query = None
            sampler.partition_details = None
            sampler._table = MagicMock(name="raw_table")
            sampler.get_sample_query = MagicMock(
                name="get_sample_query", return_value=MagicMock(name="sample_cte")
            )
            return sampler

    def test_100_pct_randomized_true_delegates_to_sample_query(self):
        """100% + randomizedSample=True should NOT short-circuit."""
        sampler = self._make_sampler(randomized_sample=True)
        result = sampler.get_dataset()
        sampler.get_sample_query.assert_called_once()
        assert result == sampler.get_sample_query.return_value

    def test_100_pct_randomized_false_returns_raw_dataset(self):
        """100% + randomizedSample=False should short-circuit to raw dataset."""
        sampler = self._make_sampler(randomized_sample=False)
        result = sampler.get_dataset()
        sampler.get_sample_query.assert_not_called()
        assert result == sampler._table

    def test_100_pct_randomized_none_returns_raw_dataset(self):
        """100% + randomizedSample=None should short-circuit (only explicit True randomizes)."""
        sampler = self._make_sampler(randomized_sample=None)
        result = sampler.get_dataset()
        sampler.get_sample_query.assert_not_called()
        assert result == sampler._table


class TestDatalakeSampler100Pct:
    """Test DatalakeSampler.get_dataset() at 100% PERCENTAGE sampling."""

    def _make_sampler(self, randomized_sample):
        """Create a DatalakeSampler mock with the given randomizedSample value."""
        with patch(
            "metadata.sampler.pandas.sampler.DatalakeSampler.__init__",
            return_value=None,
        ):
            from metadata.sampler.pandas.sampler import DatalakeSampler

            sampler = DatalakeSampler()
            sampler.sample_config = SampleConfig(
                profileSample=100,
                profileSampleType=ProfileSampleType.PERCENTAGE,
                randomizedSample=randomized_sample,
            )
            sampler.sample_query = None
            sampler.partition_details = None
            table_mock = MagicMock(name="table_wrapper")
            table_mock.dataframes = MagicMock(name="raw_dataframes")
            sampler._table = table_mock
            sampler.get_sampled_dataframe = MagicMock(
                name="get_sampled_dataframe",
                return_value=MagicMock(name="sampled_df"),
            )
            sampler.service_connection_config = MagicMock()
            sampler.connection = MagicMock()
            return sampler

    def test_100_pct_randomized_true_delegates_to_sampled_dataframe(self):
        """100% + randomizedSample=True should NOT short-circuit."""
        sampler = self._make_sampler(randomized_sample=True)
        result = sampler.get_dataset()
        sampler.get_sampled_dataframe.assert_called_once()
        assert result == sampler.get_sampled_dataframe.return_value

    def test_100_pct_randomized_false_returns_raw_dataset(self):
        """100% + randomizedSample=False should short-circuit to raw dataset."""
        sampler = self._make_sampler(randomized_sample=False)
        result = sampler.get_dataset()
        sampler.get_sampled_dataframe.assert_not_called()
        assert result == sampler._table.dataframes

    def test_100_pct_randomized_none_returns_raw_dataset(self):
        """100% + randomizedSample=None should short-circuit (only explicit True randomizes)."""
        sampler = self._make_sampler(randomized_sample=None)
        result = sampler.get_dataset()
        sampler.get_sampled_dataframe.assert_not_called()
        assert result == sampler._table.dataframes
