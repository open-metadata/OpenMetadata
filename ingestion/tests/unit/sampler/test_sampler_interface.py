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
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.configuration.profilerConfiguration import (
    SampleDataIngestionConfig,
)
from metadata.generated.schema.entity.data.table import TableData
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.constants import SAMPLE_DATA_MAX_CELL_LENGTH


class TestTruncateCell:
    @pytest.mark.parametrize(
        "value,expected",
        [
            ("short string", "short string"),
            (12345, 12345),
            (None, None),
            (True, True),
            (3.14, 3.14),
            (b"bytes", b"bytes"),
        ],
    )
    def test_non_oversized_values_pass_through(self, value, expected):
        assert SamplerInterface._truncate_cell(value) == expected

    def test_string_at_limit_is_not_truncated(self):
        value = "a" * SAMPLE_DATA_MAX_CELL_LENGTH
        result = SamplerInterface._truncate_cell(value)
        assert result == value
        assert len(result) == SAMPLE_DATA_MAX_CELL_LENGTH

    def test_string_over_limit_is_truncated(self):
        value = "a" * (SAMPLE_DATA_MAX_CELL_LENGTH + 500)
        result = SamplerInterface._truncate_cell(value)
        assert len(result) == SAMPLE_DATA_MAX_CELL_LENGTH

    def test_truncation_preserves_prefix(self):
        prefix = "important_data_"
        value = prefix + "x" * SAMPLE_DATA_MAX_CELL_LENGTH
        result = SamplerInterface._truncate_cell(value)
        assert result.startswith(prefix)
        assert len(result) == SAMPLE_DATA_MAX_CELL_LENGTH

    def test_very_large_string_is_truncated(self):
        value = "z" * 10_000_000
        result = SamplerInterface._truncate_cell(value)
        assert len(result) == SAMPLE_DATA_MAX_CELL_LENGTH


class TestGenerateSampleData:
    """Test SamplerInterface.generate_sample_data with SampleDataIngestionConfig"""

    @pytest.fixture
    def sampler(self):
        """Create a concrete SamplerInterface subclass for testing"""
        sampler = MagicMock(spec=SamplerInterface)
        sampler.entity = MagicMock()
        sampler.entity.fullyQualifiedName.root = "test_service.db.schema.table"
        sampler.columns = [MagicMock(name="col1"), MagicMock(name="col2")]
        sampler.sample_limit = 50
        sampler.storage_config = None

        sample_table_data = TableData(
            columns=["col1", "col2"],
            rows=[["val1", "val2"], ["val3", "val4"]],
        )
        sampler.fetch_sample_data.return_value = sample_table_data

        sampler.generate_sample_data = (
            SamplerInterface.generate_sample_data.__wrapped__.__get__(
                sampler, SamplerInterface
            )
        )
        sampler._truncate_cell = SamplerInterface._truncate_cell

        return sampler

    def test_both_disabled_returns_empty(self, sampler):
        config = SampleDataIngestionConfig(storeSampleData=False, readSampleData=False)
        result = sampler.generate_sample_data(config)

        assert result.rows == []
        assert result.columns == []
        sampler.fetch_sample_data.assert_not_called()

    def test_read_only_fetches_but_does_not_store(self, sampler):
        config = SampleDataIngestionConfig(storeSampleData=False, readSampleData=True)
        result = sampler.generate_sample_data(config)

        assert len(result.rows) == 2
        sampler.fetch_sample_data.assert_called_once()

    def test_store_enabled_fetches_data(self, sampler):
        config = SampleDataIngestionConfig(storeSampleData=True, readSampleData=False)
        result = sampler.generate_sample_data(config)

        assert len(result.rows) == 2
        sampler.fetch_sample_data.assert_called_once()

    def test_both_enabled_fetches_data(self, sampler):
        config = SampleDataIngestionConfig(storeSampleData=True, readSampleData=True)
        result = sampler.generate_sample_data(config)

        assert len(result.rows) == 2
        sampler.fetch_sample_data.assert_called_once()

    def test_none_config_defaults_to_both_enabled(self, sampler):
        result = sampler.generate_sample_data(None)

        assert len(result.rows) == 2
        sampler.fetch_sample_data.assert_called_once()

    def test_store_enabled_with_storage_config_uploads(self, sampler):
        sampler.storage_config = MagicMock()
        config = SampleDataIngestionConfig(storeSampleData=True, readSampleData=True)
        with patch(
            "metadata.sampler.sampler_interface.upload_sample_data"
        ) as mock_upload:
            result = sampler.generate_sample_data(config)

            mock_upload.assert_called_once()
            assert len(result.rows) == 2

    def test_store_disabled_with_storage_config_does_not_upload(self, sampler):
        sampler.storage_config = MagicMock()
        config = SampleDataIngestionConfig(storeSampleData=False, readSampleData=True)
        with patch(
            "metadata.sampler.sampler_interface.upload_sample_data"
        ) as mock_upload:
            result = sampler.generate_sample_data(config)

            mock_upload.assert_not_called()
            assert len(result.rows) == 2
