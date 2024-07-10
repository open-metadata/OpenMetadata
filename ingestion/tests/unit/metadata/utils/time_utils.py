import pytest
from datetime import timedelta

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
    ],
)
def test_timedelta_to_string(parameter, expected):
    assert timedelta_to_string(parameter).startswith(expected)
