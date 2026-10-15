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
from metadata.data_quality.validations.result_messages import format_count, format_value
from metadata.data_quality.validations.thresholds import ThresholdUnit
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

    # The user's query is executed as written, so the sampler never sees it.
    BYPASSES_SAMPLER = True

    def _run_validation(self) -> TestCaseResult:
        """Execute the specific test validation logic

        This method contains the core validation logic that was previously
        in the run_validation method.

        Returns:
            TestCaseResult: The test case result for the overall validation
        """
        sql_expression = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "sqlExpression",
            str,
        )

        operator = self.get_test_case_param_value(
            self.test_case.parameterValues,
            "operator",
            str,
            "<=",  # type: ignore
        )

        is_percentage = self.get_threshold_unit() is ThresholdUnit.PERCENTAGE

        # A row count is whole, a percentage is not: an ABSOLUTE threshold keeps being read
        # exactly as it always was.
        threshold = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "threshold",
            float if is_percentage else int,
            default=0,
        )

        strategy = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "strategy",
            Strategy,
        )

        operator = cast(str, operator)  # satisfy mypy  # noqa: TC006
        sql_expression = cast(str, sql_expression)  # satisfy mypy  # noqa: TC006
        threshold = cast(float, threshold)  # satisfy mypy  # noqa: TC006
        strategy = cast(Strategy, strategy)  # satisfy mypy  # noqa: TC006

        row_count = None
        try:
            rows = self._run_results(sql_expression, strategy)
            if is_percentage:
                row_count = self._get_total_row_count_if_needed()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            return self._aborted(f"Error computing {self.test_case.fullyQualifiedName}: {exc}")
        len_rows = rows if isinstance(rows, int) else len(rows)

        if is_percentage:
            percentage = self._percentage_of_row_count(len_rows, row_count)
            if percentage is None:
                return self._aborted(
                    f"Found {len_rows} row(s), but no row count to compute a percentage against. "
                    f"Test query is expected to return {operator} {format_value(threshold)}% of the row count."
                )
            test_passed = evaluate_threshold(threshold, operator, percentage)  # type: ignore
            threshold_rows = round(threshold * (row_count or 0) / 100)
            message = (
                f"Found {len_rows} row(s), {format_value(percentage)}% of the {format_count(row_count)} row(s) "
                f"counted. Test query is expected to return {operator} {format_value(threshold)}% of the row count."
            )
        else:
            test_passed = evaluate_threshold(threshold, operator, len_rows)  # type: ignore
            threshold_rows = int(threshold)
            message = f"Found {len_rows} row(s). Test query is expected to return {operator} {threshold} row(s)."

        status = TestCaseStatus.Success if test_passed else TestCaseStatus.Failed

        if self.test_case.computePassedFailedRowCount:
            if row_count is None:
                row_count = self._get_total_row_count_if_needed()
            passed_rows, failed_rows = self._calculate_passed_failed_rows(
                test_passed, operator, threshold_rows, len_rows, row_count
            )
        else:
            passed_rows = None
            failed_rows = None
            row_count = None

        return self.get_test_case_result_object(
            self.execution_date,
            status,
            message,
            [TestResultValue(name=RESULT_ROW_COUNT, value=str(len_rows))],
            row_count=row_count,
            failed_rows=failed_rows,
            passed_rows=passed_rows,
        )

    def _aborted(self, msg: str) -> TestCaseResult:
        logger.error(msg)
        return self.get_test_case_result_object(
            self.execution_date,
            TestCaseStatus.Aborted,
            msg,
            [TestResultValue(name=RESULT_ROW_COUNT, value=None)],
        )

    @staticmethod
    def _percentage_of_row_count(len_rows: int, row_count: int | None) -> float | None:
        """Share of the row count the query returned, or None when it cannot be computed

        A query can legitimately return more rows than the table holds (a join, an unnest), so the
        share is not capped at 100. An empty result is 0% of any row count, including one that
        could not be computed; any other result against no rows has nothing to be a share of.
        """
        if len_rows == 0:
            return 0.0
        if row_count:
            return len_rows * 100 / row_count
        return None

    @abstractmethod
    def _run_results(self, sql_expression: str, strategy: Strategy = Strategy.ROWS):
        raise NotImplementedError

    @abstractmethod
    def compute_row_count(self):
        """Compute row count for the given column

        Raises:
            NotImplementedError:
        """
        raise NotImplementedError

    def get_row_count(self) -> int:
        """Get row count

        Returns:
            Tuple[int, int]:
        """
        return self.compute_row_count()

    def _get_total_row_count_if_needed(self) -> int:
        """Get total row count if computePassedFailedRowCount is enabled"""
        return self.get_row_count()

    def _calculate_passed_failed_rows(
        self,
        test_passed: bool,
        operator: str,
        threshold: int,
        len_rows: int,
        row_count: int,
    ) -> tuple[int, int]:
        """Calculate passed and failed rows based on test result and operator

        Args:
            test_passed: Whether the test passed
            operator: Comparison operator (>, >=, <, <=, ==)
            threshold: Expected threshold value
            len_rows: Number of rows returned by the test query
            row_count: Total number of rows in the table (or None)

        Returns:
            Tuple of (passed_rows, failed_rows)
        """
        if test_passed:
            return self._calculate_passed_rows_success(operator, len_rows, row_count)
        return self._calculate_passed_rows_failure(operator, threshold, len_rows, row_count)

    def _calculate_passed_rows_success(self, operator: str, len_rows: int, row_count: int) -> tuple[int, int]:
        """Calculate passed/failed rows when test passed"""
        if operator in (">", ">="):
            passed_rows = len_rows
            failed_rows = (row_count - len_rows) if row_count else 0
        elif operator in ("<", "<="):
            passed_rows = row_count - len_rows
            failed_rows = len_rows
        elif operator == "==":
            passed_rows = len_rows
            failed_rows = row_count - len_rows
        else:
            passed_rows = len_rows
            failed_rows = 0

        return max(0, passed_rows), max(0, failed_rows)

    def _calculate_passed_rows_failure(
        self, operator: str, threshold: int, len_rows: int, row_count: int
    ) -> tuple[int, int]:
        """Calculate passed/failed rows when test failed"""
        if operator in (">", ">="):
            return self._calculate_greater_than_failure(len_rows, row_count)
        if operator in ("<", "<="):
            return self._calculate_less_than_failure(len_rows, row_count)
        if operator == "==":
            return self._calculate_equal_failure(threshold, len_rows, row_count)

        failed_rows = row_count if row_count else len_rows
        return 0, max(0, failed_rows)

    def _calculate_greater_than_failure(self, len_rows: int, row_count: int) -> tuple[int, int]:
        """Calculate rows for > or >= operator failure (expected more rows)"""
        passed_rows = len_rows
        failed_rows = (row_count - len_rows) if row_count else 0
        return max(0, passed_rows), max(0, failed_rows)

    def _calculate_less_than_failure(self, len_rows: int, row_count: int) -> tuple[int, int]:
        """Calculate rows for < or <= operator failure (expected fewer rows)"""
        failed_rows = len_rows
        passed_rows = row_count - failed_rows

        return max(0, passed_rows), max(0, failed_rows)

    def _calculate_equal_failure(self, threshold: int, len_rows: int, row_count: int) -> tuple[int, int]:
        """Calculate rows for == operator failure (expected exact count)"""
        if row_count:
            if len_rows > threshold:
                failed_rows = len_rows - threshold
                passed_rows = row_count - failed_rows
            else:
                failed_rows = row_count - len_rows
                passed_rows = len_rows
        else:
            failed_rows = abs(len_rows - threshold)
            passed_rows = 0

        return max(0, passed_rows), max(0, failed_rows)
