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
Validator for column value max to be between test case
"""

import math
from typing import List, Optional

from sqlalchemy import Column, case, func, inspect, literal, or_

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValueMaxToBeBetween import (
    BaseColumnValueMaxToBeBetweenValidator,
)
from metadata.data_quality.validations.impact_score import DEFAULT_TOP_DIMENSIONS
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValueMaxToBeBetweenValidator(
    BaseColumnValueMaxToBeBetweenValidator, SQAValidatorMixin
):
    """Validator for column value max to be between test case"""

    def _get_column_name(self, column_name: Optional[str] = None) -> Column:
        """Get column object for the given column name

        Args:
            column_name: Optional column name. If None, returns the main validation column.

        Returns:
            Column: Column object
        """
        if column_name is None:
            return self.get_column_name(
                self.test_case.entityLink.root,
                inspect(self.runner.dataset).c,
            )
        return self.get_column_name(
            column_name,
            inspect(self.runner.dataset).c,
        )

    def _run_results(self, metric: Metrics, column: Column) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_query_results(self.runner, metric, column)

    def _execute_dimensional_validation(
        self,
        column: Column,
        dimension_col: Column,
        metrics_to_compute: dict,
        test_params: dict,
    ) -> List[DimensionResult]:
        """Execute dimensional validation for max with proper aggregation

        Uses the statistical aggregation helper to:
        1. Compute raw metrics (max) per dimension
        2. Calculate impact score based on whether max is within bounds
        3. Aggregate "Others" using MAX(individual_maxes)

        Args:
            column: The column being validated
            dimension_col: The dimension column to group by
            metrics_to_compute: Dict mapping metric names to Metrics enums
            test_params: Test parameters (min/max bounds)

        Returns:
            List[DimensionResult]: Top N dimensions plus "Others"
        """
        dimension_results = []

        try:
            min_bound = test_params["minValueForMaxInCol"]
            max_bound = test_params["maxValueForMaxInCol"]

            metric_expressions = {
                DIMENSION_TOTAL_COUNT_KEY: func.count(),
                Metrics.MAX.name: func.max(column),
            }

            def build_failed_count(cte1):
                max_col = getattr(cte1.c, Metrics.MAX.name)
                count_col = getattr(cte1.c, DIMENSION_TOTAL_COUNT_KEY)

                conditions = []
                if not math.isinf(min_bound):
                    conditions.append(max_col < min_bound)
                if not math.isinf(max_bound):
                    conditions.append(max_col > max_bound)

                if not conditions:
                    return literal(0)

                violation = or_(*conditions) if len(conditions) > 1 else conditions[0]

                return case(
                    (max_col.is_(None), literal(0)),
                    (violation, count_col),
                    else_=literal(0),
                )

            def build_max_final(cte):
                return func.max(getattr(cte.c, Metrics.MAX.name))

            result_rows = self._execute_with_others_aggregation_statistical(
                dimension_col,
                metric_expressions,
                build_failed_count,
                final_metric_builders={Metrics.MAX.name: build_max_final},
                exclude_from_final=[],
                top_dimensions_count=DEFAULT_TOP_DIMENSIONS,
            )

            for row in result_rows:
                max_value = row.get(Metrics.MAX.name)

                if max_value is None:
                    continue

                metric_values = {
                    Metrics.MAX.name: max_value,
                }

                evaluation = self._evaluate_test_condition(metric_values, test_params)

                dimension_result = self._create_dimension_result(
                    row,
                    dimension_col.name,
                    metric_values,
                    evaluation,
                    test_params,
                )

                dimension_results.append(dimension_result)

        except Exception as exc:
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)

        return dimension_results
