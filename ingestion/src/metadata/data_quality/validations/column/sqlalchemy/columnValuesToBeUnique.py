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

from sqlalchemy import Column, func, inspect, literal_column, select
from sqlalchemy.exc import SQLAlchemyError

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeUnique import (
    BaseColumnValuesToBeUniqueValidator,
)
from metadata.data_quality.validations.impact_score import DEFAULT_TOP_DIMENSIONS
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.registry import Dialects

logger = logging.getLogger(__name__)


class ColumnValuesToBeUniqueValidator(
    BaseColumnValuesToBeUniqueValidator, SQAValidatorMixin
):
    """Validator for column values to be unique test case"""

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
        self,
        column: Column,
        dimension_col: Column,
        metrics_to_compute: dict,
        test_params: Optional[dict] = None,
    ) -> List[DimensionResult]:
        """Execute dimensional query with impact scoring and Others aggregation

        Calculates impact scores for all dimension values and aggregates
        low-impact dimensions into "Others" category using CTEs.

        Args:
            column: The column being validated
            dimension_col: Single Column object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects
            test_params: Optional test parameters (empty dict for uniqueness validator)

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        dimension_results = []

        try:
            # For UNIQUE_COUNT, we need a correlated subquery that counts values
            # appearing exactly once within each dimension
            # SQL pattern: SELECT COUNT(*) FROM (
            #   SELECT column FROM table WHERE dimension_col = outer.dimension_col
            #   GROUP BY column HAVING COUNT(*) = 1
            # )

            # Get the table object from the ORM class
            table = self.runner.dataset.__table__
            inner_table = table.alias("inner_table")

            # Correlated subquery: values appearing exactly once in this dimension
            unique_values_subquery = (
                select(literal_column("1"))
                .select_from(inner_table)
                .where(getattr(inner_table.c, dimension_col.name) == dimension_col)
                .group_by(getattr(inner_table.c, column.name))
                .having(func.count() == 1)
            ).subquery("unique_values")

            # Count those unique values
            unique_count_expr = (
                select(func.count())
                .select_from(unique_values_subquery)
                .scalar_subquery()
            )

            metric_expressions = {
                Metrics.COUNT.name: func.count(column),
                Metrics.UNIQUE_COUNT.name: unique_count_expr,
                DIMENSION_TOTAL_COUNT_KEY: func.count(),
            }

            metric_expressions[DIMENSION_FAILED_COUNT_KEY] = (
                metric_expressions[Metrics.COUNT.name]
                - metric_expressions[Metrics.UNIQUE_COUNT.name]
            )

            result_rows = self._execute_with_others_aggregation(
                dimension_col, metric_expressions, DEFAULT_TOP_DIMENSIONS
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
