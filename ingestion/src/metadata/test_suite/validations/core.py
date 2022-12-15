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
Core Validation definitions.

In this module we define how to check specific test case
behavior based on the computed metrics of the profiler.

These functions should not raise an error, but rather
mark the test as Failure/Aborted and pass a proper
result string. The ORM Processor will be the one in charge
of logging these issues.
"""

from metadata.test_suite.validations.column.column_value_max_to_be_between import (
    column_value_max_to_be_between,
)
from metadata.test_suite.validations.column.column_value_mean_to_be_between import (
    column_value_mean_to_be_between,
)
from metadata.test_suite.validations.column.column_value_median_to_be_between import (
    column_value_median_to_be_between,
)
from metadata.test_suite.validations.column.column_value_min_to_be_between import (
    column_value_min_to_be_between,
)
from metadata.test_suite.validations.column.column_value_stddev_to_be_between import (
    column_value_stddev_to_be_between,
)
from metadata.test_suite.validations.column.column_values_in_set import (
    column_values_in_set,
)
from metadata.test_suite.validations.column.column_values_length_to_be_between import (
    column_value_length_to_be_between,
)
from metadata.test_suite.validations.column.column_values_missing_count_to_be_equal import (
    column_values_missing_count_to_be_equal,
)
from metadata.test_suite.validations.column.column_values_not_in_set import (
    column_values_not_in_set,
)
from metadata.test_suite.validations.column.column_values_sum_to_be_between import (
    column_values_sum_to_be_between,
)
from metadata.test_suite.validations.column.column_values_to_be_between import (
    column_values_to_be_between,
)
from metadata.test_suite.validations.column.column_values_to_be_not_null import (
    column_values_to_be_not_null,
)
from metadata.test_suite.validations.column.column_values_to_be_unique import (
    column_values_to_be_unique,
)
from metadata.test_suite.validations.column.column_values_to_match_regex import (
    column_values_to_match_regex,
)
from metadata.test_suite.validations.column.column_values_to_not_match_regex import (
    column_values_to_not_match_regex,
)
from metadata.test_suite.validations.table.table_column_count_to_be_between import (
    table_column_count_to_be_between,
)
from metadata.test_suite.validations.table.table_column_count_to_equal import (
    table_column_count_to_equal,
)
from metadata.test_suite.validations.table.table_column_name_to_exist import (
    table_column_name_to_exist,
)
from metadata.test_suite.validations.table.table_column_to_match_set import (
    table_column_to_match_set,
)
from metadata.test_suite.validations.table.table_custom_sql_query import (
    table_custom_sql_query,
)
from metadata.test_suite.validations.table.table_row_count_to_be_between import (
    table_row_count_to_be_between,
)
from metadata.test_suite.validations.table.table_row_count_to_equal import (
    table_row_count_to_equal,
)
from metadata.utils.dispatch import enum_register
from metadata.utils.logger import profiler_logger

logger = profiler_logger()

validation_enum_registry = enum_register()

# Table Tests
validation_enum_registry.add("tableRowCountToEqual")(table_row_count_to_equal)
validation_enum_registry.add("tableRowCountToBeBetween")(table_row_count_to_be_between)
validation_enum_registry.add("tableColumnCountToEqual")(table_column_count_to_equal)
validation_enum_registry.add("tableColumnCountToBeBetween")(
    table_column_count_to_be_between
)
validation_enum_registry.add("tableColumnToMatchSet")(table_column_to_match_set)
validation_enum_registry.add("tableColumnNameToExist")(table_column_name_to_exist)
validation_enum_registry.add("tableCustomSQLQuery")(table_custom_sql_query)

# # # Column Tests
validation_enum_registry.add("columnValuesToBeBetween")(column_values_to_be_between)
validation_enum_registry.add("columnValuesToBeUnique")(column_values_to_be_unique)
validation_enum_registry.add("columnValuesToBeNotNull")(column_values_to_be_not_null)
validation_enum_registry.add("columnValueLengthsToBeBetween")(
    column_value_length_to_be_between
)
validation_enum_registry.add("columnValueMaxToBeBetween")(
    column_value_max_to_be_between
)
validation_enum_registry.add("columnValueMinToBeBetween")(
    column_value_min_to_be_between
)
validation_enum_registry.add("columnValuesSumToBeBetween")(
    column_values_sum_to_be_between
)
validation_enum_registry.add("columnValueMeanToBeBetween")(
    column_value_mean_to_be_between
)
validation_enum_registry.add("columnValueMedianToBeBetween")(
    column_value_median_to_be_between
)
validation_enum_registry.add("columnValueStdDevToBeBetween")(
    column_value_stddev_to_be_between
)

# # # Column Session Tests
validation_enum_registry.add("columnValuesToBeNotInSet")(column_values_not_in_set)
validation_enum_registry.add("columnValuesToBeInSet")(column_values_in_set)
validation_enum_registry.add("columnValuesToMatchRegex")(column_values_to_match_regex)
validation_enum_registry.add("columnValuesToNotMatchRegex")(
    column_values_to_not_match_regex
)
validation_enum_registry.add("columnValuesMissingCount")(
    column_values_missing_count_to_be_equal
)
