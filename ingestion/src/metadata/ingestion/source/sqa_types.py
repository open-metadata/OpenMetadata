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
"""
Define custom types as wrappers on top of
existing SQA types to have a bridge between
SQA dialects and OM rich type system
"""

from sqlalchemy import types
from sqlalchemy.sql.sqltypes import TypeDecorator

from metadata.utils.sqlalchemy_utils import convert_numpy_to_list


class SQAMap(types.String):
    """
    Custom Map type definition
    """


class SQAStruct(TypeDecorator):
    """
    Custom Struct type definition
    """

    impl = types.String
    cache_ok = True

    def process_result_value(self, value, dialect):
        """This is executed during result retrieval

        Args:
            value: database record
            dialect: database dialect
        Returns:
            python list conversion of ndarray
        """

        return convert_numpy_to_list(value)


class SQADateTimeRange(types.String):
    """
    Custom DateTimeRange type definition
    """


class SQAUnion(types.String):
    """
    Custom Struct type definition
    """


class SQASet(types.ARRAY):
    """
    Custom Set type definition
    """

    def __init__(
        self, item_type=None, as_tuple=False, dimensions=None, zero_indexes=False
    ):
        self.item_type = item_type
        if not self.item_type:
            self.item_type = "string"
        super().__init__(self.item_type, as_tuple, dimensions, zero_indexes)


class SQASGeography(types.String):
    """
    Custom Geography type definition
    """
