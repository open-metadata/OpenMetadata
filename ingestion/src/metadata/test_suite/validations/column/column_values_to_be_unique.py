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
ColumnValuesToBeUnique validation implementation
"""
# pylint: disable=duplicate-code,protected-access

import traceback
from datetime import datetime

from sqlalchemy import inspect
from sqlalchemy.orm.util import AliasedClass

from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.utils.entity_link import get_decoded_column
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


def column_values_to_be_unique(
    test_case: TestCase,
    execution_date: datetime,
    runner: QueryRunner,
) -> TestCaseResult:
    """
    Validate Column Values metric
    :param _: ColumnValuesToBeUnique. Just used to trigger singledispatch
    :param col_profile: should contain count and distinct count metrics
    :param execution_date: Datetime when the tests ran
    :return: TestCaseResult with status and results
    """

    try:
        column_name = get_decoded_column(test_case.entityLink.__root__)
        col = next(
            (col for col in inspect(runner.table).c if col.name == column_name),
            None,
        )
        if col is None:
            raise ValueError(
                f"Cannot find the configured column {column_name} for test case {test_case.name.__root__}"
            )

        value_count_value_dict = dict(
            runner.dispatch_query_select_first(Metrics.COUNT.value(col).fn())
        )
        value_count_value_res = value_count_value_dict.get(Metrics.COUNT.name)
        unique_count_value_dict = dict(
            runner.select_all_from_query(
                Metrics.UNIQUE_COUNT.value(col).query(
                    sample=runner._sample
                    if isinstance(runner._sample, AliasedClass)
                    else runner.table,
                    session=runner._session,
                )
            )[0]
        )
        unique_count_value_res = unique_count_value_dict.get(Metrics.UNIQUE_COUNT.name)

    except Exception as exc:
        msg = f"Error computing {test_case.name.__root__} for {runner.table.__tablename__}: {exc}"
        logger.debug(traceback.format_exc())
        logger.warning(msg)
        return TestCaseResult(
            timestamp=execution_date,
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
            testResultValue=[
                TestResultValue(name="valueCount", value=None),
                TestResultValue(name="uniqueCount", value=None),
            ],
        )

    status = (
        TestCaseStatus.Success
        if value_count_value_res == unique_count_value_res
        else TestCaseStatus.Failed
    )
    result = (
        f"Found valuesCount={value_count_value_res} vs. uniqueCount={unique_count_value_res}."
        + " Both counts should be equal for column values to be unique."
    )

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[
            TestResultValue(name="valueCount", value=str(value_count_value_res)),
            TestResultValue(name="uniqueCount", value=str(unique_count_value_res)),
        ],
    )
