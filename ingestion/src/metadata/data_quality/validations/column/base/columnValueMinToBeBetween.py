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
Validator for column value min to be between test case
"""

import traceback
from abc import abstractmethod
from typing import Union

from sqlalchemy import Column

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()

MIN = "min"


class BaseColumnValueMinToBeBetweenValidator(BaseTestValidator):
    """Validator for column value min to be between test case"""

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        try:
            column: Union[SQALikeColumn, Column] = self._get_column_name()
            res = self._run_results(Metrics.MIN, column)
        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name=MIN, value=None)],
            )

        min_bound = self.get_min_bound("minValueForMinInCol")
        max_bound = self.get_max_bound("maxValueForMinInCol")

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(min_bound <= res <= max_bound),
            f"Found min={res} vs.  the expected min={min_bound}, max={max_bound}.",
            [TestResultValue(name=MIN, value=str(res))],
            min_bound=min_bound,
            max_bound=max_bound,
        )

    @abstractmethod
    def _get_column_name(self):
        raise NotImplementedError

    @abstractmethod
    def _run_results(self, metric: Metrics, column: Union[SQALikeColumn, Column]):
        raise NotImplementedError
