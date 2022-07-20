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
utils package for the profiler
"""

from typing import List

from sqlalchemy import BINARY, Column
from sqlalchemy_bigquery import BYTES


def bytes_to_hex(table: list, indexes: list) -> list:
    """Given a list of data and indexes, transforms
    data at index `i` from byte to hex string

    Args:
        data: blob of data to process
        indexes: list of indexes where bytes data are located
    """

    transformed_data = []

    return [transform_bytes_to_hex(row, indexes) for row in table]


def transform_bytes_to_hex(row: tuple, indexes: list) -> tuple:
    """Given a list of data and indexes, transforms
    data at index `i` from byte to hex string

    Args:
        data: blob of data to process
        indexes: list of indexes where bytes data are located
    """

    transformed_data = []

    for i, datum in enumerate(row):
        if i in indexes and datum is not None:
            transformed_data.append(datum.hex())
        else:
            transformed_data.append(datum)

    return tuple(transformed_data)


def get_bytes_column_indexes(columns: List[Column]) -> List[int]:
    """Given a list of SQA columns return index of bytes columns

    Args:
        columns: list of SQA columns
    Returns:
        indexes
    """
    return [
        columns.index(col) for col in columns if isinstance(col.type, (BINARY, BYTES))
    ] or None
