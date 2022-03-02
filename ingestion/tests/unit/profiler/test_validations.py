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

from metadata.generated.schema.entity.data.table import ColumnProfile, TableProfile
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.column.columnValuesToBeBetween import (
    ColumnValuesToBeBetween,
)
from metadata.generated.schema.tests.column.columnValuesToBeUnique import (
    ColumnValuesToBeUnique,
)
from metadata.generated.schema.tests.table.tableRowCountToEqual import (
    TableRowCountToEqual,
)
from metadata.orm_profiler.validations.core import validate

EXECUTION_DATE = datetime.strptime("2021-07-03", "%Y-%m-%d")


def test_table_row_count_to_equal():
    """
    Check TableRowCountToEqual
    """
    table_profile = TableProfile(
        profileDate=EXECUTION_DATE.strftime("%Y-%m-%d"),
        rowCount=100,
    )

    res_ok = validate(
        TableRowCountToEqual(value=100),
        table_profile=table_profile,
        execution_date=EXECUTION_DATE,
    )
    assert res_ok == TestCaseResult(
        executionTime=EXECUTION_DATE.timestamp(),
        testCaseStatus=TestCaseStatus.Success,
        result="Found 100.0 rows vs. the expected 100",
    )

    res_ko = validate(
        TableRowCountToEqual(value=50),
        table_profile=table_profile,
        execution_date=EXECUTION_DATE,
    )

    assert res_ko == TestCaseResult(
        executionTime=EXECUTION_DATE.timestamp(),
        testCaseStatus=TestCaseStatus.Failed,
        result="Found 100.0 rows vs. the expected 50",
    )

    table_profile_aborted = TableProfile(
        profileDate=EXECUTION_DATE.strftime("%Y-%m-%d"),
    )

    res_aborted = validate(
        TableRowCountToEqual(value=100),
        table_profile=table_profile_aborted,
        execution_date=EXECUTION_DATE,
    )

    assert res_aborted == TestCaseResult(
        executionTime=EXECUTION_DATE.timestamp(),
        testCaseStatus=TestCaseStatus.Aborted,
        result="rowCount should not be None for TableRowCountToEqual",
    )


def test_column_values_to_be_between():
    """
    Check ColumnValuesToBeBetween
    """

    column_profile = ColumnProfile(
        min=1,
        max=3,
    )

    res_ok = validate(
        ColumnValuesToBeBetween(
            minValue=0,
            maxValue=3,
        ),
        col_profile=column_profile,
        execution_date=EXECUTION_DATE,
    )
    assert res_ok == TestCaseResult(
        executionTime=EXECUTION_DATE.timestamp(),
        testCaseStatus=TestCaseStatus.Success,
        result="Found min=1.0, max=3.0 vs. the expected min=0, max=3.",
    )

    res_ko = validate(
        ColumnValuesToBeBetween(
            minValue=0,
            maxValue=2,
        ),
        col_profile=column_profile,
        execution_date=EXECUTION_DATE,
    )

    assert res_ko == TestCaseResult(
        executionTime=EXECUTION_DATE.timestamp(),
        testCaseStatus=TestCaseStatus.Failed,
        result="Found min=1.0, max=3.0 vs. the expected min=0, max=2.",
    )

    column_profile_aborted = ColumnProfile(
        min=1,
    )

    res_aborted = validate(
        ColumnValuesToBeBetween(
            minValue=0,
            maxValue=3,
        ),
        col_profile=column_profile_aborted,
        execution_date=EXECUTION_DATE,
    )

    assert res_aborted == TestCaseResult(
        executionTime=EXECUTION_DATE.timestamp(),
        testCaseStatus=TestCaseStatus.Aborted,
        result=(
            "We expect `min` & `max` to be informed on the profiler for ColumnValuesToBeBetween"
            + " but got min=1.0, max=None."
        ),
    )


def test_column_values_to_be_unique():
    """
    Check ColumnValuesToBeUnique
    """

    column_profile = ColumnProfile(
        valuesCount=10,
        uniqueCount=10,
    )

    res_ok = validate(
        ColumnValuesToBeUnique(),
        col_profile=column_profile,
        execution_date=EXECUTION_DATE,
    )
    assert res_ok == TestCaseResult(
        executionTime=EXECUTION_DATE.timestamp(),
        testCaseStatus=TestCaseStatus.Success,
        result=(
            "Found valuesCount=10.0 vs. uniqueCount=10.0."
            + " Both counts should be equal for column values to be unique."
        ),
    )

    column_profile_ko = ColumnProfile(
        valuesCount=10,
        uniqueCount=5,
    )

    res_ko = validate(
        ColumnValuesToBeUnique(),
        col_profile=column_profile_ko,
        execution_date=EXECUTION_DATE,
    )

    assert res_ko == TestCaseResult(
        executionTime=EXECUTION_DATE.timestamp(),
        testCaseStatus=TestCaseStatus.Failed,
        result=(
            "Found valuesCount=10.0 vs. uniqueCount=5.0."
            + " Both counts should be equal for column values to be unique."
        ),
    )

    column_profile_aborted = ColumnProfile()

    res_aborted = validate(
        ColumnValuesToBeUnique(),
        col_profile=column_profile_aborted,
        execution_date=EXECUTION_DATE,
    )

    assert res_aborted == TestCaseResult(
        executionTime=EXECUTION_DATE.timestamp(),
        testCaseStatus=TestCaseStatus.Aborted,
        result=(
            "We expect `valuesCount` & `uniqueCount` to be informed on the profiler for ColumnValuesToBeUnique"
            + " but got valuesCount=None, uniqueCount=None."
        ),
    )
