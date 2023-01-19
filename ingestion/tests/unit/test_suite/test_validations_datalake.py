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
Test Table and Column Tests' validate implementations.

Each test should validate the Success, Failure and Aborted statuses
"""

from datetime import datetime

import pytest
from pandas import DataFrame

from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.test_suite.validations.core import validation_enum_registry

EXECUTION_DATE = datetime.strptime("2021-07-03", "%Y-%m-%d")
DL_DATA = (
    ["1", "John", "Jo", "John Doe", "johnny b goode", 30],
    ["2", "Jane", "Ja", "Jone Doe", "Johnny d", 31],
    ["3", "John", "Joh", "John Doe", None, None],
) * 10


DATALAKE_DATA_FRAME = DataFrame(
    DL_DATA, columns=["id", "name", "first name", "fullname", "nickname", "age"]
)

# pylint: disable=line-too-long
@pytest.mark.parametrize(
    "test_case_name,test_case_type,expected",
    [
        (
            "test_case_column_value_length_to_be_between",
            "columnValueLengthsToBeBetween",
            (TestCaseResult, "4", "14", TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_length_to_be_between_col_space",
            "columnValueLengthsToBeBetween",
            (TestCaseResult, "2", "3", TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_length_to_be_between_no_min",
            "columnValueLengthsToBeBetween",
            (TestCaseResult, None, None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_max_to_be_between",
            "columnValueMaxToBeBetween",
            (TestCaseResult, "31.0", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_max_to_be_between_no_min",
            "columnValueMaxToBeBetween",
            (TestCaseResult, None, None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_mean_to_be_between",
            "columnValueMeanToBeBetween",
            (TestCaseResult, "30.5", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_mean_to_be_between_no_max",
            "columnValueMeanToBeBetween",
            (TestCaseResult, None, None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_median_to_be_between",
            "columnValueMedianToBeBetween",
            (TestCaseResult, "30.5", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_min_to_be_between",
            "columnValueMinToBeBetween",
            (TestCaseResult, "30.0", None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_min_to_be_between_no_min",
            "columnValueMinToBeBetween",
            (TestCaseResult, None, None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_stddev_to_be_between",
            "columnValueStdDevToBeBetween",
            (TestCaseResult, "0.512989176042577", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_stddev_to_be_between_no_min",
            "columnValueStdDevToBeBetween",
            (TestCaseResult, None, None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_in_set",
            "columnValuesToBeInSet",
            (TestCaseResult, "20", None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_values_missing_count_to_be_equal",
            "columnValuesMissingCount",
            (TestCaseResult, "10", None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_values_missing_count_to_be_equal_missing_valuesl",
            "columnValuesMissingCount",
            (TestCaseResult, "20", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_values_not_in_set",
            "columnValuesToBeNotInSet",
            (TestCaseResult, "20", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_sum_to_be_between",
            "columnValuesSumToBeBetween",
            (TestCaseResult, "610.0", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_values_to_be_between",
            "columnValuesToBeBetween",
            (TestCaseResult, "30.0", None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_values_to_be_not_null",
            "columnValuesToBeNotNull",
            (TestCaseResult, "10", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_values_to_be_unique",
            "columnValuesToBeUnique",
            (TestCaseResult, "30", "2", TestCaseStatus.Failed),
        ),
        (
            "test_case_table_column_count_to_be_between",
            "tableColumnCountToBeBetween",
            (TestCaseResult, "6", None, TestCaseStatus.Success),
        ),
        (
            "test_case_table_column_count_to_equal",
            "tableColumnCountToEqual",
            (TestCaseResult, "6", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_table_column_name_to_exist",
            "tableColumnNameToExist",
            (TestCaseResult, "True", None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_to_match_set",
            "tableColumnToMatchSet",
            (
                TestCaseResult,
                "['id', 'name', 'first name', 'fullname', 'nickname', 'age']",
                None,
                TestCaseStatus.Failed,
            ),
        ),
        (
            "test_case_column_to_match_set_ordered",
            "tableColumnToMatchSet",
            (TestCaseResult, None, None, TestCaseStatus.Failed),
        ),
        (
            "test_case_table_row_count_to_be_between",
            "tableRowCountToBeBetween",
            (TestCaseResult, "30", None, TestCaseStatus.Success),
        ),
        (
            "test_case_table_row_count_to_be_equal",
            "tableRowCountToEqual",
            (TestCaseResult, "30", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_table_row_inserted_count_to_be_between",
            "tableRowInsertedCountToBeBetween",
            (TestCaseResult, None, None, TestCaseStatus.Aborted),
        ),
    ],
)
def test_suite_validation_datalake(
    test_case_name,
    test_case_type,
    expected,
    request,
):
    """Generic test runner for test validations"""
    test_case = request.getfixturevalue(test_case_name)
    type_, val_1, val_2, status = expected

    res = validation_enum_registry.registry[test_case_type](
        DATALAKE_DATA_FRAME,
        test_case=test_case,
        execution_date=EXECUTION_DATE.timestamp(),
    )

    assert isinstance(res, type_)
    if val_1:
        assert res.testResultValue[0].value == val_1
    if val_2:
        assert res.testResultValue[1].value == val_2
    assert res.testCaseStatus == status
