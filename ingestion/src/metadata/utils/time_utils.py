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

"""
Time utility functions
"""

from datetime import datetime, time, timedelta, timezone
from math import floor
from typing import Union

from metadata.utils.helpers import datetime_to_ts


def datetime_to_timestamp(datetime_value, milliseconds=False) -> int:
    """Convert a datetime object to timestamp integer

    Args:
        datetime_value (_type_): datetime object
        milliseconds (bool, optional): make it a milliseconds timestamp. Defaults to False.

    Returns:
        int:
    """
    if not getattr(datetime_value, "timestamp", None):
        raise TypeError(f"Object of type {datetime_value} has not method `timestamp()`")

    tmsap = datetime_value.timestamp()
    if milliseconds:
        return int(tmsap * 1000)
    return int(tmsap)


def get_beginning_of_day_timestamp_mill(
    days=0, seconds=0, microseconds=0, milliseconds=0, minutes=0, hours=0, weeks=0
) -> int:
    """Get the beginning of day timestamp

    Args:
        days (int, optional): delay in days. Defaults to 0.
        seconds (int, optional): delay in seconds. Defaults to 0.
        microseconds (int, optional): delay in microseconds. Defaults to 0.
        milliseconds (int, optional): delay in milliseconds. Defaults to 0.
        minutes (int, optional): delay in minutes. Defaults to 0.
        hours (int, optional): delay in hours. Defaults to 0.
        weeks (int, optional): delay in weeks. Defaults to 0.

    Returns:
        int: timestamp milliseconds
    """
    now_utc = datetime.now(timezone.utc)
    delta = timedelta(
        weeks=weeks,
        days=days,
        hours=hours,
        minutes=minutes,
        seconds=seconds,
        microseconds=microseconds,
        milliseconds=milliseconds,
    )
    return datetime_to_ts(
        datetime.combine(now_utc - delta, time.min, tzinfo=timezone.utc),
    )


def get_end_of_day_timestamp_mill(
    days=0, seconds=0, microseconds=0, milliseconds=0, minutes=0, hours=0, weeks=0
) -> int:
    """Get the end of day timestamp

    Args:
        days (int, optional): delay in days. Defaults to 0.
        seconds (int, optional): delay in seconds. Defaults to 0.
        microseconds (int, optional): delay in microseconds. Defaults to 0.
        milliseconds (int, optional): delay in milliseconds. Defaults to 0.
        minutes (int, optional): delay in minutes. Defaults to 0.
        hours (int, optional): delay in hours. Defaults to 0.
        weeks (int, optional): delay in weeks. Defaults to 0.

    Returns:
        int: timestamp milliseconds
    """
    now_utc = datetime.now(timezone.utc)
    delta = timedelta(
        weeks=weeks,
        days=days,
        hours=hours,
        minutes=minutes,
        seconds=seconds,
        microseconds=microseconds,
        milliseconds=milliseconds,
    )
    return datetime_to_ts(
        datetime.combine(now_utc - delta, time.max, tzinfo=timezone.utc),
    )


def convert_timestamp(timestamp: str) -> Union[int, float]:
    """convert timestamp to int
    Args:
        timestamp (str):
    Retunrs:
        int
    """
    if len(timestamp) < 13:  # check for ms timestamp
        return int(timestamp)
    return float(timestamp) / 1000


def convert_timestamp_to_milliseconds(timestamp: Union[int, float]) -> int:
    """convert timestamp to milliseconds
    Args:
        timestamp (int):
    Returns:
        int
    """
    if len(str(round(timestamp))) == 13:
        return timestamp
    return round(timestamp * 1000)


def timedelta_to_string(td: timedelta):
    """Convert timedelta to human readable string

    Example:
        >>> timedelta_to_string(timedelta(days=1, hours=2, minutes=3, seconds=4))
        '1 days 2 hours 3 minutes 4 seconds (total seconds: 93784.0)'

    Args:
        td (timedelta): timedelta object

    Returns:
        str: human readable string
    """
    res = []
    current = td
    if current.days:
        res.append(f"{floor(td.days)} day")
        if current.days > 1:
            res[-1] += "s"
        current -= timedelta(days=floor(td.days))
    hours = current.seconds // 3600
    if hours:
        res.append(f"{hours} hour")
        if hours > 1:
            res[-1] += "s"
        current -= timedelta(hours=hours)
    minutes = current.seconds // 60
    if minutes:
        res.append(f"{minutes} minute")
        if minutes > 1:
            res[-1] += "s"
        current -= timedelta(minutes=minutes)
    res.append(f"{current.seconds} second")
    if current.seconds != 1:
        res[-1] += "s"
    total_seconds = "total seconds: " + str(td.total_seconds())
    return " ".join(res) + f" ({total_seconds})"
