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
Tests for SQASampler._warn_empty_partition.

The warning is the visible half of the fix for issue #33084: when a partition
filter yields an empty sample, an unexamined table must not look identical to a
table that was examined and found clean. These tests pin the wording of both
branches (time-based vs. non-time-based partition types) and the edge cases in
how the interval unit and table name are surfaced.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    PartitionIntervalUnit,
)
from metadata.sampler.sqlalchemy.sampler import SQASampler


def _make_sampler(
    interval_type=None,
    partition_interval=None,
    partition_interval_unit=None,
    tablename="my_table",
):
    """Build an unbound SQASampler mock with just the attributes
    _warn_empty_partition reads. Mirrors the MagicMock(spec=...) pattern used by
    the sibling _get_asset_row_count tests."""
    sampler = MagicMock(spec=SQASampler)
    sampler.raw_dataset = MagicMock()
    sampler.raw_dataset.__tablename__ = tablename
    partition_details = MagicMock()
    partition_details.partitionIntervalType = interval_type
    partition_details.partitionInterval = partition_interval
    partition_details.partitionIntervalUnit = partition_interval_unit
    sampler.partition_details = partition_details
    return sampler


class TestWarnEmptyPartition:
    """SQASampler._warn_empty_partition wording per partition type."""

    @pytest.mark.parametrize(
        "interval_type",
        [PartitionIntervalTypes.TIME_UNIT, PartitionIntervalTypes.INGESTION_TIME],
    )
    def test_time_based_partition_warns_with_window(self, interval_type):
        sampler = _make_sampler(
            interval_type=interval_type,
            partition_interval=3,
            partition_interval_unit=PartitionIntervalUnit.DAY,
        )
        with patch("metadata.sampler.sqlalchemy.sampler.logger") as mock_logger:
            SQASampler._warn_empty_partition(sampler)

        mock_logger.warning.assert_called_once()
        fmt, *args = mock_logger.warning.call_args.args
        assert "returned 0 rows" in fmt
        assert "may not cover" in fmt
        # table name, interval count and unit are all surfaced to the operator
        assert "my_table" in args
        assert 3 in args
        assert "DAY" in args

    def test_hour_window_reports_hour_unit(self):
        sampler = _make_sampler(
            interval_type=PartitionIntervalTypes.TIME_UNIT,
            partition_interval=24,
            partition_interval_unit=PartitionIntervalUnit.HOUR,
        )
        with patch("metadata.sampler.sqlalchemy.sampler.logger") as mock_logger:
            SQASampler._warn_empty_partition(sampler)

        _, *args = mock_logger.warning.call_args.args
        assert 24 in args
        assert "HOUR" in args

    @pytest.mark.parametrize(
        "interval_type",
        [
            PartitionIntervalTypes.INTEGER_RANGE,
            PartitionIntervalTypes.COLUMN_VALUE,
            None,
        ],
    )
    def test_non_time_partition_uses_generic_message(self, interval_type):
        """INTEGER_RANGE and other non-time types must not advise widening a time
        window (greptile P2): they get the generic 'verify the partition config'
        message with no interval=None None wording."""
        sampler = _make_sampler(interval_type=interval_type)
        with patch("metadata.sampler.sqlalchemy.sampler.logger") as mock_logger:
            SQASampler._warn_empty_partition(sampler)

        fmt, *args = mock_logger.warning.call_args.args
        assert "Verify the partition config" in fmt
        assert "may not cover" not in fmt
        assert interval_type in args

    def test_interval_unit_falls_back_when_not_enum(self):
        """partitionIntervalUnit may be a plain string rather than an enum member;
        the getattr(..., 'value', ...) fallback must surface the raw string."""
        sampler = _make_sampler(
            interval_type=PartitionIntervalTypes.TIME_UNIT,
            partition_interval=3,
            partition_interval_unit="DAY",
        )
        with patch("metadata.sampler.sqlalchemy.sampler.logger") as mock_logger:
            SQASampler._warn_empty_partition(sampler)

        _, *args = mock_logger.warning.call_args.args
        assert "DAY" in args

    def test_missing_tablename_defaults_to_unknown(self):
        sampler = MagicMock(spec=SQASampler)
        sampler.raw_dataset = object()  # no __tablename__
        partition_details = MagicMock()
        partition_details.partitionIntervalType = PartitionIntervalTypes.TIME_UNIT
        partition_details.partitionInterval = 3
        partition_details.partitionIntervalUnit = PartitionIntervalUnit.DAY
        sampler.partition_details = partition_details
        with patch("metadata.sampler.sqlalchemy.sampler.logger") as mock_logger:
            SQASampler._warn_empty_partition(sampler)

        _, *args = mock_logger.warning.call_args.args
        assert "unknown" in args
