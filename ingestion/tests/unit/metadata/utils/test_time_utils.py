from datetime import timedelta

import pytest

from metadata.utils.time_utils import timedelta_to_string


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
