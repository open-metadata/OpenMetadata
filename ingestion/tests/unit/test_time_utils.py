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

"""test time utils"""

from datetime import datetime, timezone
from unittest import mock
from unittest.mock import patch

from metadata.utils.time_utils import (
    convert_timestamp,
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)

NOW_UTC = datetime(2022, 11, 15, 10, 30, 45, 776132)


@patch("metadata.utils.time_utils.datetime", wraps=datetime)
def test_get_beginning_of_day_timestamp_mill(mock_dt):
    mock_dt.now = mock.Mock(return_value=NOW_UTC)
    assert get_beginning_of_day_timestamp_mill() == 1668470400000


@patch("metadata.utils.time_utils.datetime", wraps=datetime)
def test_get_end_of_day_timestamp_mill(mock_dt):
    mock_dt.now.return_value = NOW_UTC
    assert get_end_of_day_timestamp_mill() == 1668556799999


# ---- convert_timestamp tests ----

def test_convert_timestamp_iso_with_microseconds():
    """Human-readable datetime string (the failing case) must parse correctly."""
    # '2023-04-04 13:53:13.042525' is naive UTC
    result = convert_timestamp("2023-04-04 13:53:13.042525")
    expected = datetime(2023, 4, 4, 13, 53, 13, 42525, tzinfo=timezone.utc).timestamp()
    assert result == expected


def test_convert_timestamp_iso_t_separator():
    """ISO 8601 string with T separator must parse correctly."""
    result = convert_timestamp("2023-04-04T13:53:13")
    expected = datetime(2023, 4, 4, 13, 53, 13, tzinfo=timezone.utc).timestamp()
    assert result == expected


def test_convert_timestamp_iso_with_timezone():
    """Timezone-aware ISO string must be converted using its own offset."""
    result = convert_timestamp("2023-04-04T13:53:13+00:00")
    expected = datetime(2023, 4, 4, 13, 53, 13, tzinfo=timezone.utc).timestamp()
    assert result == expected


def test_convert_timestamp_numeric_seconds():
    """Numeric seconds string (len < 13) must be returned as int."""
    assert convert_timestamp("1680616393") == 1680616393


def test_convert_timestamp_numeric_milliseconds():
    """Numeric milliseconds string (len >= 13) must be divided by 1000."""
    assert convert_timestamp("1680616393000") == 1680616393.0
