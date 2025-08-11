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

# pylint: disable=abstract-method

"""
Expand sqlalchemy types to map them to OpenMetadata DataType
"""
from sqlalchemy.sql.sqltypes import String, TypeDecorator

from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class CustomDateTimeRange(TypeDecorator):
    """
    Convert CustomDateTimeRange to String to distinguish upper and lower inc/inf bounds along with lower and upper range
    """

    impl = String
    cache_ok = True

    @property
    def python_type(self):
        return str

    def process_result_value(self, value, _):
        """
        This is executed during result retrieval
        Needs to be done, as DateTimeRange returns DateTimeRange object which is not json serializable.
        example of how tsrange looks like: [2010-01-01 14:30, 2010-01-01 15:30)
        The input for a range value must follow one of the below patterns
            (lower-bound,upper-bound)
            (lower-bound,upper-bound]
            [lower-bound,upper-bound)
            [lower-bound,upper-bound]
            empty
        Args:
            value: database datetimerange
        Returns:
            python conversion DateTimeRange for sample data
        """
        return str(value) if value else None
