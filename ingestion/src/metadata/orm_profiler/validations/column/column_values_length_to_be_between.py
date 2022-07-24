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
ColumnValueLengthsToBeBetween validation implementation
"""
# pylint: disable=duplicate-code

from datetime import datetime

from metadata.generated.schema.entity.data.table import ColumnProfile
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.column.columnValuesLengthsToBeBetween import (
    ColumnValueLengthsToBeBetween,
)
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


def column_value_length_to_be_between(
    test_case: ColumnValueLengthsToBeBetween,
    col_profile: ColumnProfile,
    execution_date: datetime,
    **__,
) -> TestCaseResult:
    """
    Validate Column Values metric
    :param test_case: ColumnValueLengthsToBeBetween
    :param col_profile: should contain minLength & maxLength metrics
    :param execution_date: Datetime when the tests ran
    :return: TestCaseResult with status and results
    """

    if col_profile.minLength is None or col_profile.maxLength is None:
        msg = (
            "We expect `minLength` & `maxLength` to be informed on the profiler for ColumnValueLengthsToBeBetween"
            + f" but got minLength={col_profile.minLength}, maxLength={col_profile.maxLength}."
        )
        logger.error(msg)
        return TestCaseResult(
            executionTime=execution_date.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
        )

    status = (
        TestCaseStatus.Success
        if col_profile.minLength >= test_case.minLength
        and col_profile.maxLength <= test_case.maxLength
        else TestCaseStatus.Failed
    )
    result = (
        f"Found minLength={col_profile.minLength}, maxLength={col_profile.maxLength} vs."
        + f" the expected minLength={test_case.minLength}, maxLength={test_case.maxLength}."
    )

    return TestCaseResult(
        executionTime=execution_date.timestamp(), testCaseStatus=status, result=result
    )
