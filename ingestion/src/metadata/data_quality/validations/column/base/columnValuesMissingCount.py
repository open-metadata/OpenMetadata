#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Validator for column value missing count to be equal test case
"""

import traceback
from abc import abstractmethod
from ast import literal_eval
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

NULL_COUNT = "nullCount"


class BaseColumnValuesMissingCountValidator(BaseTestValidator):
    """Validator for column value missing count to be equal test case"""

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        try:
            column: Union[SQALikeColumn, Column] = self._get_column_name()
            null_res = self._run_results(
                Metrics.NULL_MISSING_COUNT,
                column,
            )
        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name=NULL_COUNT, value=None)],
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
                set_res = self._run_results(
                    Metrics.COUNT_IN_SET, column, values=missing_values
                )
                null_res += set_res
            except (ValueError, RuntimeError) as exc:
                msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
                logger.debug(traceback.format_exc())
                logger.warning(msg)
                return self.get_test_case_result_object(
                    self.execution_date,
                    TestCaseStatus.Aborted,
                    msg,
                    [
                        TestResultValue(name=NULL_COUNT, value=None),
                    ],
                )

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(missing_count_value == null_res),
            f"Found nullCount={null_res} vs. the expected nullCount={missing_count_value}.",
            [TestResultValue(name=NULL_COUNT, value=str(null_res))],
        )

    @abstractmethod
    def _get_column_name(self):
        raise NotImplementedError

    @abstractmethod
    def _run_results(
        self, metric: Metrics, column: Union[SQALikeColumn, Column], **kwargs
    ):
        raise NotImplementedError
