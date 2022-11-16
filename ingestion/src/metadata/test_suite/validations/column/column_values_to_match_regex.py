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
ColumnValuesToBeNotNull validation implementation
"""
# pylint: disable=duplicate-code
import traceback
from datetime import datetime

from sqlalchemy import inspect

from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.orm_profiler.metrics.core import add_props
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.utils.entity_link import get_decoded_column
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


def column_values_to_match_regex(
    test_case: TestCase,
    execution_date: datetime,
    runner: QueryRunner,
) -> TestCaseResult:
    """
    Validate Column Values metric
    :param test_case: ColumnValuesToMatchRegex
    :param col_profile: should contain count and distinct count metrics
    :param execution_date: Datetime when the tests ran
    :param session: SQLAlchemy Session, for tests that need to compute new metrics
    :param table: SQLAlchemy Table, for tests that need to compute new metrics
    :param profile_sample: % of the data to run the profiler on
    :return: TestCaseResult with status and results
    """

    regex = next(
        (param.value for param in test_case.parameterValues if param.name == "regex")
    )
    like_count = add_props(expression=regex)(Metrics.LIKE_COUNT.value)

    try:
        column_name = get_decoded_column(test_case.entityLink.__root__)
        col = next(
            (col for col in inspect(runner.table).c if col.name == column_name),
            None,
        )
        if col is None:
            raise ValueError(
                f"Cannot find the configured column {column_name} for test case {test_case.name}"
            )

        value_count_value_dict = dict(
            runner.dispatch_query_select_first(Metrics.COUNT.value(col).fn())
        )
        value_count_value_res = value_count_value_dict.get(Metrics.COUNT.name)
        like_count_value_dict = dict(
            runner.dispatch_query_select_first(
                like_count(col).fn()  # pylint: disable=abstract-class-instantiated
            )
        )
        like_count_value_res = like_count_value_dict.get(Metrics.LIKE_COUNT.name)

    except Exception as exc:
        msg = (
            f"Error computing {test_case.name} for {runner.table.__tablename__}: {exc}"
        )
        logger.debug(traceback.format_exc())
        logger.warning(msg)
        return TestCaseResult(
            timestamp=execution_date,
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
            testResultValue=[TestResultValue(name="likeCount", value=None)],
        )

    status = (
        TestCaseStatus.Success
        if value_count_value_res == like_count_value_res
        else TestCaseStatus.Failed
    )
    result = (
        f"Found {like_count_value_res} value(s) matching regex pattern vs "
        f"{value_count_value_res} value(s) in the column."
    )

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[
            TestResultValue(name="likeCount", value=str(like_count_value_res))
        ],
    )
