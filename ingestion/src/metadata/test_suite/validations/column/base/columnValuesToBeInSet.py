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
# pylint: disable=invalid-name

"""
Validator for column value to not be in set test case
"""

from abc import abstractmethod
import traceback
from ast import literal_eval
from typing import Union

from metadata.generated.schema.tests.basic import (TestCaseResult,
                                                   TestCaseStatus,
                                                   TestResultValue)
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.test_suite.validations.base_test_handler import BaseTestValidator
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn
from sqlalchemy import Column

logger = test_suite_logger()

ALLOWED_VALUE_COUNT = "allowedValueCount"

class BaseColumnValuesToBeInSetValidator(BaseTestValidator):
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
            column: Union[SQALikeColumn, Column] = self._get_column_name()
            res = self._run_results(Metrics.COUNT_IN_SET, column, values=allowed_values)
        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name=ALLOWED_VALUE_COUNT, value=None)],
            )

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(res >= 1),
            f"Found countInSet={res}.",
            [TestResultValue(name=ALLOWED_VALUE_COUNT, value=str(res))],
        )

    @abstractmethod
    def _get_column_name(self):
        raise NotImplementedError

    @abstractmethod
    def _run_results(self, metric: Metrics, column: Union[SQALikeColumn, Column], **kwargs):
        raise NotImplementedError
