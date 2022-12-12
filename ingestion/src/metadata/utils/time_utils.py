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
    now_utc = datetime.utcnow()
    delta = timedelta(
        weeks=weeks,
        days=days,
        hours=hours,
        minutes=minutes,
        seconds=seconds,
        microseconds=microseconds,
        milliseconds=milliseconds,
    )
    return datetime_to_timestamp(
        datetime.combine(now_utc - delta, time.min, tzinfo=timezone.utc),
        milliseconds=True,
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
    now_utc = datetime.utcnow()
    delta = timedelta(
        weeks=weeks,
        days=days,
        hours=hours,
        minutes=minutes,
        seconds=seconds,
        microseconds=microseconds,
        milliseconds=milliseconds,
    )
    return datetime_to_timestamp(
        datetime.combine(now_utc - delta, time.max, tzinfo=timezone.utc),
        milliseconds=True,
    )
