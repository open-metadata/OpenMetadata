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

from datetime import datetime, timedelta

import pytest
from pandas import DataFrame

from metadata.data_quality.validations.validator import Validator
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.utils.importer import import_test_case_class

EXECUTION_DATE = datetime.strptime("2021-07-03", "%Y-%m-%d")
DL_DATA = (
    [
        "1",
        "John",
        "Jo",
        "John Doe",
        "johnny b goode",
        30,
        datetime.today() - timedelta(days=1),
    ],
    [
        "2",
        "Jane",
        "Ja",
        "Jone Doe",
        "Johnny d",
        31,
        datetime.today() - timedelta(days=2),
    ],
    ["3", "John", "Joh", "John Doe", None, None, datetime.today() - timedelta(days=3)],
)


DATALAKE_DATA_FRAME = lambda times_increase_sample_data: DataFrame(
    DL_DATA * times_increase_sample_data,
    columns=[
        "id",
        "name",
        "first name",
        "fullname",
        "nickname",
        "age",
        "inserted_date",
    ],
)


# pylint: disable=line-too-long
@pytest.mark.parametrize(
    "test_case_name,test_case_type,test_type,expected",
    [
        (
            "test_case_column_value_length_to_be_between",
            "columnValueLengthsToBeBetween",
            "COLUMN",
            (TestCaseResult, "8", "14", TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_length_to_be_between_col_space",
            "columnValueLengthsToBeBetween",
            "COLUMN",
            (TestCaseResult, "2", "3", TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_length_to_be_between_no_min",
            "columnValueLengthsToBeBetween",
            "COLUMN",
            (TestCaseResult, None, None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_max_to_be_between",
            "columnValueMaxToBeBetween",
            "COLUMN",
            (TestCaseResult, "31.0", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_max_to_be_between_no_min",
            "columnValueMaxToBeBetween",
            "COLUMN",
            (TestCaseResult, None, None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_mean_to_be_between",
            "columnValueMeanToBeBetween",
            "COLUMN",
            (TestCaseResult, "30.5", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_mean_to_be_between_no_max",
            "columnValueMeanToBeBetween",
            "COLUMN",
            (TestCaseResult, None, None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_median_to_be_between",
            "columnValueMedianToBeBetween",
            "COLUMN",
            (TestCaseResult, "30.5", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_min_to_be_between",
            "columnValueMinToBeBetween",
            "COLUMN",
            (TestCaseResult, "30.0", None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_min_to_be_between_no_min",
            "columnValueMinToBeBetween",
            "COLUMN",
            (TestCaseResult, None, None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_stddev_to_be_between",
            "columnValueStdDevToBeBetween",
            "COLUMN",
            (TestCaseResult, "0.500062511721192", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_value_stddev_to_be_between_no_min",
            "columnValueStdDevToBeBetween",
            "COLUMN",
            (TestCaseResult, None, None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_value_in_set",
            "columnValuesToBeInSet",
            "COLUMN",
            (TestCaseResult, "4000", None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_values_missing_count_to_be_equal",
            "columnValuesMissingCount",
            "COLUMN",
            (TestCaseResult, "2000", None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_values_missing_count_to_be_equal_missing_values",
            "columnValuesMissingCount",
            "COLUMN",
            (TestCaseResult, "4000", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_values_not_in_set",
            "columnValuesToBeNotInSet",
            "COLUMN",
            (TestCaseResult, "4000", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_sum_to_be_between",
            "columnValuesSumToBeBetween",
            "COLUMN",
            (TestCaseResult, "122000.0", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_values_to_be_between",
            "columnValuesToBeBetween",
            "COLUMN",
            (TestCaseResult, "30.0", None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_values_to_be_not_null",
            "columnValuesToBeNotNull",
            "COLUMN",
            (TestCaseResult, "2000", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_column_values_to_be_unique",
            "columnValuesToBeUnique",
            "COLUMN",
            (TestCaseResult, "4000", "0", TestCaseStatus.Failed),
        ),
        (
            "test_case_column_values_to_match_regex",
            "columnValuesToMatchRegex",
            "COLUMN",
            (TestCaseResult, "6000", None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_values_to_not_match_regex",
            "columnValuesToNotMatchRegex",
            "COLUMN",
            (TestCaseResult, "0", None, TestCaseStatus.Success),
        ),
        (
            "test_case_table_column_count_to_be_between",
            "tableColumnCountToBeBetween",
            "TABLE",
            (TestCaseResult, "7", None, TestCaseStatus.Success),
        ),
        (
            "test_case_table_column_count_to_equal",
            "tableColumnCountToEqual",
            "TABLE",
            (TestCaseResult, "7", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_table_column_name_to_exist",
            "tableColumnNameToExist",
            "TABLE",
            (TestCaseResult, "1", None, TestCaseStatus.Success),
        ),
        (
            "test_case_column_to_match_set",
            "tableColumnToMatchSet",
            "TABLE",
            (
                TestCaseResult,
                "0",
                None,
                TestCaseStatus.Failed,
            ),
        ),
        (
            "test_case_column_to_match_set_ordered",
            "tableColumnToMatchSet",
            "TABLE",
            (TestCaseResult, None, None, TestCaseStatus.Failed),
        ),
        (
            "test_case_table_custom_sql_query_failed_dl",
            "tableCustomSQLQuery",
            "TABLE",
            (TestCaseResult, None, None, TestCaseStatus.Failed),
        ),
        (
            "test_case_table_custom_sql_query_success_dl",
            "tableCustomSQLQuery",
            "TABLE",
            (TestCaseResult, None, None, TestCaseStatus.Success),
        ),
        (
            "test_case_table_row_count_to_be_between",
            "tableRowCountToBeBetween",
            "TABLE",
            (TestCaseResult, "6000", None, TestCaseStatus.Success),
        ),
        (
            "test_case_table_row_count_to_be_equal",
            "tableRowCountToEqual",
            "TABLE",
            (TestCaseResult, "6000", None, TestCaseStatus.Failed),
        ),
        (
            "test_case_table_row_inserted_count_to_be_between",
            "tableRowInsertedCountToBeBetween",
            "TABLE",
            (TestCaseResult, "2000", None, TestCaseStatus.Success),
        ),
    ],
)
def test_suite_validation_datalake(
    test_case_name,
    test_case_type,
    test_type,
    expected,
    request,
):
    """Generic test runner for test validations"""
    import pandas as pd

    test_case = request.getfixturevalue(test_case_name)
    type_, val_1, val_2, status = expected

    test_handler_obj = import_test_case_class(
        test_type,
        "pandas",
        test_case_type,
    )

    test_handler = test_handler_obj(
        [DATALAKE_DATA_FRAME(1_000), DATALAKE_DATA_FRAME(1_000)],
        test_case=test_case,
        execution_date=EXECUTION_DATE.timestamp(),
    )

    validator = Validator(test_handler)
    res = validator.validate()

    assert isinstance(res, type_)
    if val_1:
        assert res.testResultValue[0].value == val_1
    if val_2:
        assert res.testResultValue[1].value == val_2
        assert res.testCaseStatus == status
