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
Validator for column value length to be between test case
"""

import traceback
from ast import literal_eval

from metadata.generated.schema.tests.basic import (TestCaseResult,
                                                   TestCaseStatus,
                                                   TestResultValue)
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.test_suite.validations.base_test_handler import \
    BaseTestHandler
from metadata.test_suite.validations.column.mixins.sqa_validator_mixin import \
    SQAValidatorMixin
from metadata.utils.logger import test_suite_logger
from sqlalchemy import Column, inspect

logger = test_suite_logger()

class ColumnValuesMissingCountValidator(BaseTestHandler, SQAValidatorMixin):
    """"Validator for column value missing count to be equal test case"""

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        try:
            column: Column = self.get_column_name(
                self.test_case.entityLink.__root__,
                inspect(self.runner.table).c,
            )
            null_res = self.run_query_results(self.runner, Metrics.NULL_COUNT, column)
        except ValueError as exc:
            msg = (
                f"Error computing {self.test_case.name} for {self.runner.table.__tablename__}: {exc}"  # type: ignore
            )
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name="nullCount", value=None),],
            )

        missing_values = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "missingValueMatch",
            literal_eval,
        )

        missing_count_value = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "missingCountValue",
            literal_eval,
        )

        if missing_values:
            # if user supplies missing values, we need to compute the count of missing values
            # in addition to the count of null values
            try:
                set_res = self.run_query_results(
                    self.runner,
                    Metrics.COUNT_IN_SET,
                    column,
                    values=missing_values
                )

                null_res += set_res
            except ValueError as exc:
                msg = (
                    f"Error computing {self.test_case.name} for {self.runner.table.__tablename__}: {exc}"  # type: ignore
                )
                logger.debug(traceback.format_exc())
                logger.warning(msg)
                return self.get_test_case_result_object(
                    self.execution_date,
                    TestCaseStatus.Aborted,
                    msg,
                    [TestResultValue(name="nullCount", value=None),],
                )

        return self.get_test_case_result_object(
            self.execution_date,
            TestCaseStatus.Success if null_res == missing_count_value else TestCaseStatus.Failed,
            f"Found missingCount={null_res}. It should be {missing_count_value}.",
            [TestResultValue(name="missingCount", value=str(null_res))],
        )
