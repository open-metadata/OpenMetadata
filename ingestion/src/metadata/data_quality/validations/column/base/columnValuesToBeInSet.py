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
Validator for column value to be in set test case
"""

import traceback
from abc import abstractmethod
from ast import literal_eval
from typing import List, Optional, Union

from sqlalchemy import Column

from metadata.data_quality.validations import utils
from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()

ALLOWED_VALUE_COUNT = "allowedValueCount"


class BaseColumnValuesToBeInSetValidator(BaseTestValidator):
    """Validator for column value to be in set test case"""

    def _run_validation(self) -> TestCaseResult:
        """Execute the specific test validation logic

        This method contains the core validation logic that was previously
        in the run_validation method.

        Returns:
            TestCaseResult: The test case result for the overall validation
        """
        matched = False
        allowed_values = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "allowedValues",
            literal_eval,
        )

        match_enum = utils.get_bool_test_case_param(
            self.test_case.parameterValues, "matchEnum"
        )

        try:
            column: Union[SQALikeColumn, Column] = self._get_column_name()
            res = self._run_results(Metrics.COUNT_IN_SET, column, values=allowed_values)
            matched = res > 0
            if match_enum:
                count = self._run_results(
                    Metrics.ROW_COUNT, column, values=allowed_values
                )
                matched = count - res == 0
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

        if self.test_case.computePassedFailedRowCount:
            row_count = self.get_row_count()
        else:
            row_count = None

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(matched),
            f"Found countInSet={res}.",
            [TestResultValue(name=ALLOWED_VALUE_COUNT, value=str(res))],
            row_count=row_count,
            passed_rows=res,
        )

    def _run_dimensional_validation(self) -> List[DimensionResult]:
        """Execute dimensional validation for column values to be in set

        The new approach runs separate queries for each dimension column instead of
        combining them with GROUP BY. For example, if dimensionColumns = ["region", "age"],
        this method will:
        1. Run one query: GROUP BY region -> {"mumbai": result1, "delhi": result2}
        2. Run another query: GROUP BY age -> {"25": result3, "30": result4}

        Returns:
            List[DimensionResult]: List of dimension-specific test results
        """
        try:
            dimension_columns = self.test_case.dimensionColumns or []
            if not dimension_columns:
                return []

            column: Union[SQALikeColumn, Column] = self._get_column_name()

            allowed_values = self.get_test_case_param_value(
                self.test_case.parameterValues,  # type: ignore
                "allowedValues",
                literal_eval,
            )

            match_enum = utils.get_bool_test_case_param(
                self.test_case.parameterValues, "matchEnum"
            )

            metrics_to_compute = {
                "count_in_set": Metrics.COUNT_IN_SET,
            }

            if match_enum:
                metrics_to_compute["row_count"] = Metrics.ROW_COUNT

            test_params = {
                "allowed_values": allowed_values,
                "match_enum": match_enum,
            }

            dimension_results = []
            for dimension_column in dimension_columns:
                try:
                    dimension_col = self._get_column_name(dimension_column)

                    single_dimension_results = self._execute_dimensional_validation(
                        column, dimension_col, metrics_to_compute, test_params
                    )

                    dimension_results.extend(single_dimension_results)

                except Exception as exc:
                    logger.warning(
                        f"Error executing dimensional query for column {dimension_column}: {exc}"
                    )
                    continue

            return dimension_results

        except Exception as exc:
            logger.warning(f"Error executing dimensional validation: {exc}")
            # Return empty list on error (test continues without dimensions)
            return []

    @abstractmethod
    def _execute_dimensional_validation(
        self, column, dimension_col, metrics_to_compute, test_params
    ):
        """Execute dimensional query for column values to be in set

        Args:
            column: The main column being validated
            dimension_col: Single dimension column object
            metrics_to_compute: Dictionary mapping metric names to Metrics objects
            test_params: Dictionary with test-specific parameters (allowed_values, match_enum)

        Returns:
            List[DimensionResult]: List of dimension results for this dimension column
        """
        raise NotImplementedError

    @abstractmethod
    def _get_column_name(self, column_name: Optional[str] = None):
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
