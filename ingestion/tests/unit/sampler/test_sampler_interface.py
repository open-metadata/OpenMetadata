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
import logging
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.configuration.profilerConfiguration import (
    SampleDataIngestionConfig,
)
from metadata.generated.schema.entity.data.table import TableData
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT, SAMPLE_DATA_MAX_CELL_LENGTH
from metadata.utils.logger import sampler_logger

SAMPLER_LOGGER = sampler_logger().name


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


class TestSkippableSamplingErrors:
    @pytest.mark.parametrize(
        "error",
        [
            RuntimeError("[UC_DEPENDENCY_DOES_NOT_EXIST]"),
            RuntimeError("boom"),
        ],
    )
    def test_base_sampler_does_not_skip_sampling_errors(self, error):
        assert not SamplerInterface.is_skippable_sampling_error(error)


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

        sample_table_data = TableData(
            columns=["col1", "col2"],
            rows=[["val1", "val2"], ["val3", "val4"]],
        )
        sampler.fetch_sample_data.return_value = sample_table_data

        sampler.generate_sample_data = SamplerInterface.generate_sample_data.__get__(sampler, SamplerInterface)
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


def _handoff_sampler(rows: list[list], sample_limit: int, columns: list[str] | None = None) -> MagicMock:
    sampler = MagicMock(spec=SamplerInterface)
    sampler.entity = MagicMock()
    sampler.entity.fullyQualifiedName.root = "test_service.db.schema.table"
    sampler.columns = []
    sampler.sample_limit = sample_limit
    sampler.fetch_sample_data.return_value = TableData(columns=columns or ["id", "body"], rows=rows)
    sampler.generate_sample_data = SamplerInterface.generate_sample_data.__get__(sampler, SamplerInterface)
    sampler._truncate_cell = SamplerInterface._truncate_cell
    return sampler


def _rows(count: int) -> list[list]:
    return [[idx, f"value {idx}"] for idx in range(count)]


def _sampler_warnings(caplog) -> list[str]:
    return [
        record.getMessage()
        for record in caplog.records
        if record.name == SAMPLER_LOGGER and record.levelno >= logging.WARNING
    ]


class TestSampleDataHandoffDiagnostics:
    """Issue #34299: report sampled data that is lost before classification."""

    def test_handoff_loss_is_reported(self, caplog):
        sampler = _handoff_sampler(_rows(60), sample_limit=60)

        with caplog.at_level(logging.DEBUG, logger=SAMPLER_LOGGER):
            result = sampler.generate_sample_data(None)

        assert len(result.rows) == SAMPLE_DATA_DEFAULT_COUNT
        warnings = _sampler_warnings(caplog)
        assert len(warnings) == 1
        assert "60 rows requested and 60 fetched, but only 50 handed off" in warnings[0]
        assert "10 rows were dropped" in warnings[0]

    @pytest.mark.parametrize(
        "fetched,sample_limit",
        [
            (50, 50),  # ordinary run
            (20, 60),  # table smaller than the requested sample
            (100, 50),  # custom query returns more rows than requested
        ],
    )
    def test_no_loss_warning_when_requested_rows_are_handed_off(self, caplog, fetched, sample_limit):
        sampler = _handoff_sampler(_rows(fetched), sample_limit=sample_limit)

        with caplog.at_level(logging.DEBUG, logger=SAMPLER_LOGGER):
            result = sampler.generate_sample_data(None)

        assert len(result.rows) == min(fetched, sample_limit, SAMPLE_DATA_DEFAULT_COUNT)
        assert _sampler_warnings(caplog) == []
        assert f"{sample_limit} rows requested, {fetched} fetched, {len(result.rows)} handed off" in caplog.text

    @pytest.mark.parametrize("truncated_by_fetch", [True, False])
    def test_long_value_reports_one_sampler_truncation(self, caplog, truncated_by_fetch):
        long_value = "x" * (SAMPLE_DATA_MAX_CELL_LENGTH + 1)
        if truncated_by_fetch:
            # Concrete samplers truncate while fetching, generate_sample_data checks again.
            long_value = SamplerInterface._truncate_cell(long_value)
        sampler = _handoff_sampler([[1, long_value], [2, "short"]], sample_limit=50)

        with caplog.at_level(logging.DEBUG, logger=SAMPLER_LOGGER):
            result = sampler.generate_sample_data(None)

        warnings = _sampler_warnings(caplog)
        assert len(warnings) == 1
        assert f"longer than {SAMPLE_DATA_MAX_CELL_LENGTH} characters" in warnings[0]
        assert warnings[0].endswith("body=1")
        assert "x" * 100 not in caplog.text
        assert type(result.rows[0][1]) is str
        assert len(result.rows[0][1]) == SAMPLE_DATA_MAX_CELL_LENGTH

    def test_value_at_limit_is_not_reported_as_truncated(self, caplog):
        sampler = _handoff_sampler([[1, "y" * SAMPLE_DATA_MAX_CELL_LENGTH]], sample_limit=50)

        with caplog.at_level(logging.DEBUG, logger=SAMPLER_LOGGER):
            sampler.generate_sample_data(None)

        assert _sampler_warnings(caplog) == []

    def test_truncation_in_rows_that_are_not_handed_off_is_not_counted(self, caplog):
        rows = _rows(50) + [[50, SamplerInterface._truncate_cell("z" * (SAMPLE_DATA_MAX_CELL_LENGTH + 1))]]
        sampler = _handoff_sampler(rows, sample_limit=50)

        with caplog.at_level(logging.DEBUG, logger=SAMPLER_LOGGER):
            sampler.generate_sample_data(None)

        assert _sampler_warnings(caplog) == []
