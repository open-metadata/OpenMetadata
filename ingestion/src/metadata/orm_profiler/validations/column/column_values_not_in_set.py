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

from datetime import datetime
from typing import Optional

from sqlalchemy import inspect
from sqlalchemy.orm import DeclarativeMeta

from metadata.generated.schema.entity.data.table import ColumnProfile
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.column.columnValuesToBeNotInSet import (
    ColumnValuesToBeNotInSet,
)
from metadata.orm_profiler.metrics.core import add_props
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


def column_values_not_in_set(
    test_case: ColumnValuesToBeNotInSet,
    col_profile: ColumnProfile,
    execution_date: datetime,
    runner: QueryRunner = None,
    table: Optional[DeclarativeMeta] = None,
) -> TestCaseResult:
    """
    Validate Column Values metric
    :param test_case: ColumnValuesToBeUnique. Just used to trigger singledispatch
    :param col_profile: should contain count and distinct count metrics
    :param execution_date: Datetime when the tests ran
    :param session: SQLAlchemy Session, for tests that need to compute new metrics
    :param table: SQLAlchemy Table, for tests that need to compute new metrics
    :param profile_sample: % of the data to run the profiler on
    :return: TestCaseResult with status and results
    """

    set_count = add_props(values=test_case.forbiddenValues)(Metrics.COUNT_IN_SET.value)

    try:
        col = next(
            (col for col in inspect(table).c if col.name == col_profile.name),
            None,
        )
        if col is None:
            raise ValueError(
                f"Cannot find the configured column {col_profile.name} for ColumnValuesToBeNotInSet"
            )
        set_count_dict = dict(runner.select_first_from_sample(set_count(col).fn()))
        set_count_res = set_count_dict.get(Metrics.COUNT_IN_SET.name)

    except Exception as err:  # pylint: disable=broad-except
        msg = f"Error computing {test_case.__class__.__name__} for {table.__tablename__}.{col_profile.name} - {err}"
        logger.error(msg)
        return TestCaseResult(
            executionTime=execution_date.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
        )

    status = TestCaseStatus.Success if set_count_res == 0 else TestCaseStatus.Failed
    result = f"Found countInSet={set_count_res}. It should be 0."

    return TestCaseResult(
        executionTime=execution_date.timestamp(), testCaseStatus=status, result=result
    )
