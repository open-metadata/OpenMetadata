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
Validator for column value to not be in set test case
"""

import traceback
from ast import literal_eval

from sqlalchemy import Column, inspect

from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.test_suite.validations.base_test_handler import BaseTestHandler
from metadata.test_suite.validations.mixins.sqa_validator_mixin import SQAValidatorMixin
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValuesToBeInSetValidator(BaseTestHandler, SQAValidatorMixin):
    """ "Validator for column value to be not in set test case"""

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        allowed_values = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "allowedValues",
            literal_eval,
        )
        try:
            column: Column = self.get_column_name(
                self.test_case.entityLink.__root__,
                inspect(self.runner.table).c,
            )
            res = self.run_query_results(
                self.runner, Metrics.COUNT_IN_SET, column, values=allowed_values
            )
        except ValueError as exc:
            msg = f"Error computing {self.test_case.name} for {self.runner.table.__tablename__}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name="allowedValueCount", value=None)],
            )

        return self.get_test_case_result_object(
            self.execution_date,
            TestCaseStatus.Success if res >= 1 else TestCaseStatus.Failed,
            f"Found countInSet={res}.",
            [TestResultValue(name="allowedValueCount", value=str(res))],
        )
