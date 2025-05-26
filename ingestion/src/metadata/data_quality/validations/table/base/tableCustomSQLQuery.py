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
Validator for table custom SQL Query test case
"""

import traceback
from abc import abstractmethod
from enum import Enum
from typing import cast

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.utils.helpers import evaluate_threshold
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

RESULT_ROW_COUNT = "resultRowCount"


class Strategy(Enum):
    COUNT = "COUNT"
    ROWS = "ROWS"


class BaseTableCustomSQLQueryValidator(BaseTestValidator):
    """Validator table custom SQL Query test case"""

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        sql_expression = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "sqlExpression",
            str,
        )

        operator = self.get_test_case_param_value(
            self.test_case.parameterValues, "operator", str, "<="  # type: ignore
        )

        threshold = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "threshold",
            int,
            default=0,
        )

        strategy = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "strategy",
            Strategy,
        )

        operator = cast(str, operator)  # satisfy mypy
        sql_expression = cast(str, sql_expression)  # satisfy mypy
        threshold = cast(int, threshold)  # satisfy mypy
        strategy = cast(Strategy, strategy)  # satisfy mypy

        try:
            rows = self._run_results(sql_expression, strategy)
        except Exception as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name=RESULT_ROW_COUNT, value=None)],
            )
        len_rows = rows if isinstance(rows, int) else len(rows)
        if evaluate_threshold(
            threshold,
            operator,
            len_rows,
        ):
            status = TestCaseStatus.Success
            result_value = len_rows
        else:
            status = TestCaseStatus.Failed
            result_value = len_rows

        return self.get_test_case_result_object(
            self.execution_date,
            status,
            f"Found {result_value} row(s). Test query is expected to return {threshold} row.",
            [TestResultValue(name=RESULT_ROW_COUNT, value=str(result_value))],
        )

    @abstractmethod
    def _run_results(self, sql_expression: str, strategy: Strategy = Strategy.ROWS):
        raise NotImplementedError
