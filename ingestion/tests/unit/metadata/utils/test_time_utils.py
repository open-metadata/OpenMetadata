import time
from datetime import datetime, timedelta, timezone

import pytest

from metadata.generated.schema.type.basic import Timestamp
from metadata.utils.time_utils import (
    convert_timestamp,
    datetime_to_timestamp,
    timedelta_to_string,
    timestamp_to_datetime,
    utc_from_timestamp,
)


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


@pytest.mark.parametrize(
    "datetime_value,timezone_str,expected_timestamp",
    [
        (datetime(2021, 10, 31, 2, 30), "Europe/Madrid", 1635640200),
        (datetime(2021, 10, 31, 1, 30), "Europe/Dublin", 1635640200),
        (datetime(2021, 10, 31, 1, 30, fold=1), "Europe/Dublin", 1635643800),
        (datetime(2021, 3, 28, 2, 30), "Europe/Madrid", 1616895000),
        (datetime(2019, 5, 5, 2, 30), "Africa/Casablanca", 1557019800),
    ],
)
def test_datetime_to_timestamp_honors_fold(datetime_value, timezone_str, expected_timestamp):
    assert datetime_to_timestamp(datetime_value, timezone_str=timezone_str) == expected_timestamp


@pytest.mark.parametrize(
    "value, expected",
    [
        ("2023-02-01 05:00:00", datetime(2023, 2, 1, 5)),
        ("2023-02-01T05:00:00+05:30", datetime(2023, 1, 31, 23, 30)),
        ("2023-02-01T05:00:00-03:30", datetime(2023, 2, 1, 8, 30)),
        ("2023-02-01T05:00:00.123456Z", datetime(2023, 2, 1, 5, 0, 0, 123456)),
        ("2023-02-01T05:00:00z", datetime(2023, 2, 1, 5)),
        ("2023-02-01T05:00:00+0530", datetime(2023, 1, 31, 23, 30)),
        ("2023-02-01T05:00:00+05", datetime(2023, 2, 1)),
        ("2023-02-01T05:00:00,123456Z", datetime(2023, 2, 1, 5, 0, 0, 123456)),
        ("2023-W05-3T05:00:00Z", datetime(2023, 2, 1, 5)),
        ("2023-032T05:00:00Z", datetime(2023, 2, 1, 5)),
        ("2020-02-29", datetime(2020, 2, 29)),
        ("1969-12-31T23:59:59Z", datetime(1969, 12, 31, 23, 59, 59)),
        ("1669852800", datetime(2022, 12, 1, 0, 0, 0)),
        ("1669852800000", datetime(2022, 12, 1, 0, 0, 0)),
        ("2022-12-01T00:00:00", datetime(2022, 12, 1, 0, 0, 0)),
        ("2030-12-31T23:59:59", datetime(2030, 12, 31, 23, 59, 59)),
        ("2022-08-09 08:08:34.433967", datetime(2022, 8, 9, 8, 8, 34, 433967)),
        ("2022-12-01T00:00:00Z", datetime(2022, 12, 1, 0, 0, 0)),
        ("2022-12-01T02:00:00+02:00", datetime(2022, 12, 1, 0, 0, 0)),
        ("2022-12-01", datetime(2022, 12, 1, 0, 0, 0)),
        (" 2022-12-01T00:00:00 ", datetime(2022, 12, 1, 0, 0, 0)),
    ],
)
def test_convert_timestamp(value, expected):
    assert utc_from_timestamp(convert_timestamp(value)) == expected


@pytest.mark.parametrize(
    "value",
    [
        "not-a-date",
        "",
        " ",
        "2022-13-45T00:00:00",
        "2023-02-29",
        "2023-02-01T25:00:00",
        "02/01/2023",
        "NaN",
        "Infinity",
        "-Infinity",
        "1e309",
        "--1675227600",
    ],
)
def test_convert_timestamp_invalid(value):
    with pytest.raises(ValueError, match="Could not convert timestamp"):
        convert_timestamp(value)


@pytest.mark.parametrize(
    "value, expected",
    [
        ("0", 0),
        ("-1", -1),
        ("20230201", 20230201),
        ("1675227600", 1675227600),
        ("1675227600000", 1675227600),
        ("1675227600125", 1675227600.125),
        ("1675227600.125", 1675227600.125),
        ("1675227600.000000", 1675227600),
        ("1675227600125.0", 1675227600.125),
        ("+1675227600.125", 1675227600.125),
        ("-1675227600.125", -1675227600.125),
        ("-1675227600125", -1675227600.125),
        ("0.125", 0.125),
        ("-0.125", -0.125),
        ("1.6752276e9", 1675227600),
        ("1.6752276e12", 1675227600),
        ("0001675227600", 1675227600),
        ("  +1675227600  ", 1675227600),
        ("999999999999", 999999999999),
        ("-999999999999", -999999999999),
        ("+999999999999", 999999999999),
        ("1000000000000", 1000000000),
        ("-1000000000000", -1000000000),
    ],
)
def test_convert_numeric_timestamp(value, expected):
    assert convert_timestamp(value) == expected


@pytest.mark.parametrize("local_timezone", ["UTC", "America/Los_Angeles", "Asia/Kolkata"])
def test_convert_timestamp_naive_is_utc(monkeypatch, local_timezone):
    try:
        with monkeypatch.context() as environment:
            environment.setenv("TZ", local_timezone)
            time.tzset()
            assert convert_timestamp("2023-02-01 05:00:00") == 1675227600
    finally:
        time.tzset()
