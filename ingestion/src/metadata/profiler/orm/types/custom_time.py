#  Copyright 2025 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# pylint: disable=abstract-method

"""
Expand sqlalchemy types to map them to OpenMetadata DataType
"""
import datetime

from sqlalchemy.sql.sqltypes import TIME, TypeDecorator

from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class CustomTime(TypeDecorator):
    """
    Convert int time to timedelta object
    """

    __visit_name__ = "TIME"
    impl = TIME
    cache_ok = True

    def result_processor(self, dialect, coltype):
        time = datetime.time

        def process(value):
            # convert from a timedelta value
            if value is not None:
                if isinstance(value, int):
                    value = datetime.timedelta(seconds=value)
                microseconds = value.microseconds
                seconds = value.seconds
                minutes = seconds // 60
                return time(
                    minutes // 60,
                    minutes % 60,
                    seconds - minutes * 60,
                    microsecond=microseconds,
                )
            return None

        return process
