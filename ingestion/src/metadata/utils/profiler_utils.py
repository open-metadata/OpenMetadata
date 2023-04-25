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

"""Profiler utils class and functions"""

from typing import Optional

from metadata.utils.sqa_utils import is_array


class ColumnLike:
    """We don't have column information at this stage (only metric entities)
    we'll create a column like onject with the attributes needed in handle_array()

    Attrs:
        is_array (bool): is array or not
        array_col (Optional[str]): column name for the array column
    """

    def __init__(self, _is_array: bool, _array_col: Optional[str]) -> None:
        self._is_array = _is_array
        self._array_col = _array_col

    @classmethod
    def create(cls, kwargs: dict) -> "ColumnLike":
        """instantiate the class with the required logic

        Args:
            is_array (bool): is array or not
            array_col (Optional[str]): column name for the array column

        Returns:
            ColumnLike: ColumnLike isntante
        """
        try:
            return cls(is_array(kwargs), kwargs.pop("array_col"))
        except KeyError:
            return cls(False, None)
