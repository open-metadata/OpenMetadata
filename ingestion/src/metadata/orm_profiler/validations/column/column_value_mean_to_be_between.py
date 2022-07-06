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
ColumnValuesToBeBetween validation implementation
"""
# pylint: disable=duplicate-code

from datetime import datetime

from metadata.generated.schema.entity.data.table import ColumnProfile
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.column.columnValueMeanToBeBetween import (
    ColumnValueMeanToBeBetween,
)
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


def column_value_mean_to_be_between(
    test_case: ColumnValueMeanToBeBetween,
    col_profile: ColumnProfile,
    execution_date: datetime,
    **__,
) -> TestCaseResult:
    """
    Validate Column Values metric
    :param test_case: ColumnValuesToBeBetween
    :param col_profile: should contain MIN & MAX metrics
    :param execution_date: Datetime when the tests ran
    :return: TestCaseResult with status and results
    """

    if col_profile.mean is None:
        msg = (
            "We expect `mean` to be informed on the profiler for ColumnValueMeanToBeBetween"
            + f" mean={col_profile.stddev}."
        )
        logger.error(msg)
        return TestCaseResult(
            executionTime=execution_date.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
        )

    status = (
        TestCaseStatus.Success
        if test_case.minValueForMeanInCol
        <= col_profile.mean
        <= test_case.maxValueForMeanInCol
        else TestCaseStatus.Failed
    )
    result = (
        f"Found mean={col_profile.mean:.2f} vs."
        + f" the expected min={test_case.minValueForMeanInCol}, max={test_case.maxValueForMeanInCol}."
    )

    return TestCaseResult(
        executionTime=execution_date.timestamp(), testCaseStatus=status, result=result
    )
