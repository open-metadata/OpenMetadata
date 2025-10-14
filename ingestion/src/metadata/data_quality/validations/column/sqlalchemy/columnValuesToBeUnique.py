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
Validator for column values to be unique test case
"""

import logging
from typing import List, Optional

from sqlalchemy import Column, func, inspect, literal_column
from sqlalchemy.exc import SQLAlchemyError

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_NULL_LABEL,
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeUnique import (
    BaseColumnValuesToBeUniqueValidator,
)
from metadata.data_quality.validations.impact_score import DEFAULT_TOP_DIMENSIONS
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.basic import TestResultValue
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.registry import Dialects

logger = logging.getLogger(__name__)


class ColumnValuesToBeUniqueValidator(
    BaseColumnValuesToBeUniqueValidator, SQAValidatorMixin
):
    """Validator for column values to be unique test case"""

    def _get_column_name(self, column_name: Optional[str] = None) -> Column:
        """Get column object for the given column name

        If column_name is None, returns the main column being validated.
        If column_name is provided, returns the column object for that specific column.

        Args:
            column_name: Optional column name. If None, returns the main validation column.

        Returns:
            Column: Column object
        """
        if column_name is None:
            # Get the main column being validated (original behavior)
            return self.get_column_name(
                self.test_case.entityLink.root,
                inspect(self.runner.dataset).c,
            )
        else:
            # Get a specific column by name (for dimension columns)
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
        count = Metrics.COUNT.value(column).fn()
        unique_count = Metrics.UNIQUE_COUNT.value(column).query(
            sample=self.runner.dataset,
            session=self.runner._session,  # pylint: disable=protected-access
        )  # type: ignore

        try:
            if self.runner.dialect == Dialects.Oracle:
                query_group_by_ = [literal_column("2")]
            else:
                query_group_by_ = None

            self.value = dict(
                self.runner.dispatch_query_select_first(
                    count,
                    unique_count.scalar_subquery().label("uniqueCount"),
                    query_group_by_=query_group_by_,
                )
            )  # type: ignore
            res = self.value.get(Metrics.COUNT.name)
        except Exception as exc:
            raise SQLAlchemyError(exc)

        if res is None:
            raise ValueError(
                f"\nQuery on table/column {column.name if column is not None else ''} returned None. Your table might be empty. "
                "If you confirmed your table is not empty and are still seeing this message you can:\n"
                "\t1. check the documentation: https://docs.open-metadata.org/v1.3.x/connectors/ingestion/workflows/data-quality/tests\n"
                "\t2. reach out to the Collate team for support"
            )

        return res

    def _get_unique_count(self, metric: Metrics, column: Column) -> Optional[int]:
        """Get unique count of values"""

        return self.value.get(metric.name)

    def _execute_dimensional_validation(
        self, column: Column, dimension_col: Column, metrics_to_compute: dict
    ) -> List[DimensionResult]:
        """Execute dimensional query with impact scoring and Others aggregation

        Calculates impact scores for all dimension values and aggregates
        low-impact dimensions into "Others" category using CTEs.

        Args:
            column: The column being validated
            dimension_col: Single Column object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping metric names to Metrics objects

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        dimension_results = []

        try:
            # Build metric expressions dictionary
            metric_expressions = {}
            for metric_name, metric in metrics_to_compute.items():
                metric_instance = metric.value(column)

                if metric_name == "unique_count":
                    # For UNIQUE_COUNT in dimensional context, use COUNT(DISTINCT column)
                    metric_expressions[metric_name] = func.count(func.distinct(column))
                elif hasattr(metric_instance, "fn"):
                    # StaticMetric - use fn() method
                    metric_expressions[metric_name] = metric_instance.fn()
                else:
                    # Skip unsupported metrics
                    logger.warning(
                        f"Unsupported metric type for {metric_name}, skipping"
                    )
                    continue

            metric_expressions[DIMENSION_TOTAL_COUNT_KEY] = metric_expressions["count"]
            metric_expressions[DIMENSION_FAILED_COUNT_KEY] = (
                metric_expressions["count"] - metric_expressions["unique_count"]
            )

            result_rows = self._execute_with_others_aggregation(
                dimension_col, metric_expressions, DEFAULT_TOP_DIMENSIONS
            )

            for row in result_rows:
                dimension_value = (
                    str(row["dimension_value"])
                    if row["dimension_value"] is not None
                    else DIMENSION_NULL_LABEL
                )

                total_count = row.get("count", 0) or 0
                unique_count = row.get("unique_count", 0) or 0
                duplicate_count = total_count - unique_count
                matched = total_count == unique_count

                impact_score = row.get("impact_score", 0.0)

                dimension_result = self.get_dimension_result_object(
                    dimension_values={dimension_col.name: dimension_value},
                    test_case_status=self.get_test_case_status(matched),
                    result=f"Dimension {dimension_col.name}={dimension_value}: Found valuesCount={total_count} vs. uniqueCount={unique_count}",
                    test_result_value=[
                        TestResultValue(name="valuesCount", value=str(total_count)),
                        TestResultValue(name="uniqueCount", value=str(unique_count)),
                    ],
                    total_rows=total_count,
                    passed_rows=unique_count,
                    failed_rows=duplicate_count,
                    impact_score=impact_score,
                )

                # Add to results list
                dimension_results.append(dimension_result)

        except Exception as exc:
            # Use the same error handling pattern as _run_results
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)
            # Return empty list on error (test continues without dimensions)

        return dimension_results
