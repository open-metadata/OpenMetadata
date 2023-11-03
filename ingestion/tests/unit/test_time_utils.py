#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""test time utils"""

from datetime import datetime
from unittest import mock
from unittest.mock import patch

from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)

NOW_UTC = datetime(2022, 11, 15, 10, 30, 45, 776132)


@patch("metadata.utils.time_utils.datetime", wraps=datetime)
def test_get_beginning_of_day_timestamp_mill(mock_dt):
    mock_dt.utcnow = mock.Mock(return_value=NOW_UTC)
    assert get_beginning_of_day_timestamp_mill() == 1668470400000


@patch("metadata.utils.time_utils.datetime", wraps=datetime)
def test_get_end_of_day_timestamp_mill(mock_dt):
    mock_dt.utcnow.return_value = NOW_UTC
    assert get_end_of_day_timestamp_mill() == 1668556799999
