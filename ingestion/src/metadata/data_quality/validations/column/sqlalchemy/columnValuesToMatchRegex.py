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
Validator for column values to match regex test case
"""

from typing import List, Optional, Tuple

from sqlalchemy import Column
from sqlalchemy.exc import CompileError, SQLAlchemyError

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToMatchRegex import (
    BaseColumnValuesToMatchRegexValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValuesToMatchRegexValidator(
    BaseColumnValuesToMatchRegexValidator, SQAValidatorMixin
):
    """Validator for column values to match regex test case"""

    def _run_results(
        self, metric: Tuple[Metrics], column: Column, **kwargs
    ) -> Tuple[Optional[int], Optional[int]]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        try:
            regex_count = Metrics.REGEX_COUNT(column)
            regex_count.expression = kwargs.get("expression")
            regex_count_fn = regex_count.fn()

            res = dict(
                self.runner.dispatch_query_select_first(
                    Metrics.COUNT(column).fn(),
                    regex_count_fn,
                )
            )
        except (CompileError, SQLAlchemyError) as err:
            logger.warning(
                f"Could not use `REGEXP` due to - {err}. Falling back to `LIKE`"
            )
            regex_count = Metrics.LIKE_COUNT(column)
            regex_count.expression = kwargs.get("expression")
            regex_count_fn = regex_count.fn()
            res = dict(
                self.runner.dispatch_query_select_first(
                    Metrics.COUNT(column).fn(),
                    regex_count_fn,
                )
            )

        if not res:
            # pylint: disable=line-too-long
            raise ValueError(
                f"\nQuery on table/column {column.name if column is not None else ''} returned None. Your table might be empty. "
                "If you confirmed your table is not empty and are still seeing this message you can:\n"
                "\t1. check the documentation: https://docs.open-metadata.org/v1.3.x/connectors/ingestion/workflows/data-quality/tests\n"
                "\t2. reach out to the Collate team for support"
            )
            # pylint: enable=line-too-long

        return res.get(Metrics.COUNT.name), res.get(regex_count.name())

    def _execute_dimensional_validation(
        self,
        column: Column,
        dimension_col: Column,
        metrics_to_compute: dict,
        test_params: dict,
    ) -> List[DimensionResult]:
        """Execute dimensional query with impact scoring and Others aggregation

        Calculates impact scores for all dimension values and aggregates
        low-impact dimensions into "Others" category using CTEs.

        Args:
            column: The column being validated
            dimension_col: Single Column object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects
            test_params: Dictionary with test-specific parameters (allowed_values, match_enum)

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        dimension_results = []

        try:
            regex = test_params[BaseColumnValuesToMatchRegexValidator.REGEX]

            metric_expressions = {
                Metrics.REGEX_COUNT.name: add_props(expression=regex)(
                    Metrics.REGEX_COUNT.value
                )(column).fn(),
                Metrics.COUNT.name: Metrics.COUNT(column).fn(),
                Metrics.ROW_COUNT.name: Metrics.ROW_COUNT().fn(),
                DIMENSION_TOTAL_COUNT_KEY: Metrics.ROW_COUNT().fn(),
            }

            metric_expressions[DIMENSION_FAILED_COUNT_KEY] = (
                metric_expressions[Metrics.COUNT.name]
                - metric_expressions[Metrics.REGEX_COUNT.name]
            )

            normalized_dimension = self._get_normalized_dimension_expression(
                dimension_col
            )

            result_rows = self._run_dimensional_validation_query(
                source=self.runner.dataset,
                dimension_expr=normalized_dimension,
                metric_expressions=metric_expressions,
            )

            for row in result_rows:
                # Build metric_values dict using helper method
                metric_values = self._build_metric_values_from_row(
                    row, metrics_to_compute, test_params
                )

                # Evaluate test condition
                evaluation = self._evaluate_test_condition(metric_values, test_params)

                # Create dimension result using helper method
                dimension_result = self._create_dimension_result(
                    row, dimension_col.name, metric_values, evaluation, test_params
                )

                dimension_results.append(dimension_result)

        except Exception as exc:
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)

        return dimension_results

    def compute_row_count(self, column: Column):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for

        Raises:
            NotImplementedError:
        """
        return self._compute_row_count(self.runner, column)
