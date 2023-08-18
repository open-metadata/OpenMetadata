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

# pylint: disable=abstract-method

"""
Expand sqlalchemy types to map them to OpenMetadata DataType
"""
from sqlalchemy.sql.sqltypes import TIMESTAMP, TypeDecorator

from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class CustomTimestamp(TypeDecorator):
    """
    Convert RowVersion
    """

    impl = TIMESTAMP
    cache_ok = True

    @property
    def python_type(self):
        return str

    def process_result_value(self, value, dialect):
        """This is executed during result retrieval

        Args:
            value: database record
            dialect: database dialect
        Returns:
            python rowversion conversion to timestamp
        """
        import struct  # pylint: disable=import-outside-toplevel

        if dialect.name == "mssql" and isinstance(value, bytes):
            bytes_to_int = struct.unpack(">Q", value)[0]
            return bytes_to_int
        return value
