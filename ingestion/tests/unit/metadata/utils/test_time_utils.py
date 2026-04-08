from datetime import datetime, timedelta, timezone

import pytest

from metadata.generated.schema.type.basic import Timestamp
from metadata.utils.time_utils import timedelta_to_string, timestamp_to_datetime


@pytest.mark.parametrize(
    "parameter,expected",
    [
        (
            timedelta(days=1, hours=1, minutes=1, seconds=1),
            "1 day 1 hour 1 minute 1 second",
        ),
        (timedelta(days=1), "1 day"),
        (
            timedelta(seconds=0),
            "0 seconds",
        ),
        (timedelta(days=1), "1 day"),
        (timedelta(hours=1000000.123456), "41666 days 16 hours 7 minutes 24 seconds"),
    ],
)
def test_timedelta_to_string(parameter, expected):
    assert timedelta_to_string(parameter).startswith(expected)


@pytest.mark.parametrize(
    "timestamp, expected_datetime",
    [
        (
            Timestamp(root=1638316800000),
            datetime(2021, 12, 1, 0, 0, tzinfo=timezone.utc),
        ),
        (
            Timestamp(root=1609459200000),
            datetime(2021, 1, 1, 0, 0, tzinfo=timezone.utc),
        ),
        (Timestamp(root=0), datetime(1970, 1, 1, 0, 0, tzinfo=timezone.utc)),
    ],
)
def test_timestamp_to_datetime(timestamp, expected_datetime):
    assert timestamp_to_datetime(timestamp) == expected_datetime


from datetime import datetime, timedelta, timezone

import pytest

from metadata.utils.time_utils import datetime_to_timestamp, utc_from_timestamp


@pytest.mark.parametrize(
    "timestamp_input, expected_datetime",
    [
        (0, datetime(1970, 1, 1, 0, 0, 0)),
        (1625127852, datetime(2021, 7, 1, 8, 24, 12)),
        (1625127852.5, datetime(2021, 7, 1, 8, 24, 12, 500000)),
    ],
)
def test_utc_from_timestamp(timestamp_input, expected_datetime):
    result = utc_from_timestamp(timestamp_input)
    assert result == expected_datetime
    assert result.tzinfo is None


@pytest.mark.parametrize(
    "datetime_value, milliseconds, expected_timestamp",
    [
        # Naive datetime (assumed to be in UTC)
        (datetime(2021, 12, 1, 0, 0, 0), False, 1638316800),
        (datetime(2021, 12, 1, 0, 0, 0), True, 1638316800000),
        # Timezone-aware datetime (UTC)
        (datetime(2021, 12, 1, 0, 0, 0, tzinfo=timezone.utc), False, 1638316800),
        (datetime(2021, 12, 1, 0, 0, 0, tzinfo=timezone.utc), True, 1638316800000),
        # Timezone-aware datetime (non-UTC)
        (
            datetime(2021, 12, 1, 0, 0, 0, tzinfo=timezone(timedelta(hours=1))),
            False,
            1638313200,
        ),
        (
            datetime(2021, 12, 1, 0, 0, 0, tzinfo=timezone(timedelta(hours=1))),
            True,
            1638313200000,
        ),
    ],
)
def test_datetime_to_timestamp(datetime_value, milliseconds, expected_timestamp):
    assert datetime_to_timestamp(datetime_value, milliseconds) == expected_timestamp
