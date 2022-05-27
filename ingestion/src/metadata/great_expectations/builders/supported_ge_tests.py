#  Copyright 2022 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Supported GE tests for Open Metadata"""

from enum import Enum

from metadata.great_expectations.builders.column.values_lengths_to_be_between import (
    ColumnValuesLengthsToBeBetweenBuilder,
)
from metadata.great_expectations.builders.column.values_to_be_between import (
    ColumnValuesToBeBetweenBuilder,
)
from metadata.great_expectations.builders.column.values_to_be_not_in_set import (
    ColumnValuesToBeNotInSetBuilder,
)
from metadata.great_expectations.builders.column.values_to_be_not_null import (
    ColumnValuesToBeNotNullBuilder,
)
from metadata.great_expectations.builders.column.values_to_be_unique import (
    ColumnValuesToBeUniqueBuilder,
)
from metadata.great_expectations.builders.column.values_to_match_regex import (
    ColumnValuesToMatchRegexBuilder,
)
from metadata.great_expectations.builders.table.column_count_to_equal import (
    TableColumCountToEqualBuilder,
)
from metadata.great_expectations.builders.table.row_count_to_be_between import (
    TableRowCountToBeBetweenBuilder,
)
from metadata.great_expectations.builders.table.row_count_to_equal import (
    TableRowCountToEqualBuilder,
)


class SupportedGETests(Enum):
    """list of supported GE test OMeta builders"""

    # pylint: disable=invalid-name
    expect_table_column_count_to_equal = TableColumCountToEqualBuilder()
    expect_table_row_count_to_be_between = TableRowCountToBeBetweenBuilder()
    expect_table_row_count_to_equal = TableRowCountToEqualBuilder()
    expect_column_value_lengths_to_be_between = ColumnValuesLengthsToBeBetweenBuilder()
    expect_column_values_to_be_between = ColumnValuesToBeBetweenBuilder()
    expect_column_values_to_not_be_in_set = ColumnValuesToBeNotInSetBuilder()
    expect_column_values_to_not_be_null = ColumnValuesToBeNotNullBuilder()
    expect_column_values_to_be_unique = ColumnValuesToBeUniqueBuilder()
    expect_column_values_to_match_regex = ColumnValuesToMatchRegexBuilder()
