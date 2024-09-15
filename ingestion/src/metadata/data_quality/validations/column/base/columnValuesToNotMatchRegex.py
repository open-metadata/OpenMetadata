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
Validator for column values to not match regex test case
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

NOT_LIKE_COUNT = "notLikeCount"


class BaseColumnValuesToNotMatchRegexValidator(BaseTestValidator):
    """Validator for column values to not match regex test case"""

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        forbidden_regex: str = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "forbiddenRegex",
            str,
        )
        try:
            column: Union[SQALikeColumn, Column] = self._get_column_name()
            not_match_count = self._run_results(
                Metrics.NOT_REGEX_COUNT, column, expression=forbidden_regex
            )
        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name=NOT_LIKE_COUNT, value=None)],
            )

        if self.test_case.computePassedFailedRowCount:
            row_count = self.get_row_count()
        else:
            row_count = None

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(not not_match_count),
            f"Found {not_match_count} value(s) matching the forbidden regex pattern vs "
            f"{not_match_count} value(s) in the column.",
            [TestResultValue(name=NOT_LIKE_COUNT, value=str(not_match_count))],
            row_count=row_count,
            failed_rows=not_match_count,
        )

    @abstractmethod
    def _get_column_name(self):
        raise NotImplementedError

    @abstractmethod
    def _run_results(
        self, metric: Metrics, column: Union[SQALikeColumn, Column], **kwargs
    ):
        raise NotImplementedError

    @abstractmethod
    def compute_row_count(self, column: Union[SQALikeColumn, Column]):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for

        Raises:
            NotImplementedError:
        """
        raise NotImplementedError

    def get_row_count(self) -> int:
        """Get row count

        Returns:
            Tuple[int, int]:
        """
        return self.compute_row_count(self._get_column_name())
