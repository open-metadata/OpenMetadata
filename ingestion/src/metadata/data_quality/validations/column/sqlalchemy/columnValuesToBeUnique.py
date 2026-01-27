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

from sqlalchemy import Column, case, func, literal_column, select
from sqlalchemy.exc import SQLAlchemyError

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeUnique import (
    BaseColumnValuesToBeUniqueValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.functions.unique_count import _unique_count_dimensional_cte
from metadata.profiler.orm.registry import Dialects

logger = logging.getLogger(__name__)


class ColumnValuesToBeUniqueValidator(
    BaseColumnValuesToBeUniqueValidator, SQAValidatorMixin
):
    """Validator for column values to be unique test case"""

    @staticmethod
    def _calculate_failed_count(count: int, unique_count: int) -> int:
        """Calculate number of non-unique values (count - unique_count)

        Args:
            count: Total count of non-NULL values
            unique_count: Count of unique values

        Returns:
            Number of non-unique (duplicate) values
        """
        return count - unique_count

    def _run_results(self, metric: Metrics, column: Column) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        count = Metrics.COUNT.value(column).fn()
        grouped_cte = (
            select(count.label(column.name))
            .select_from(self.runner.dataset)
            .group_by(column)
            .cte("grouped_cte")
        )
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
                self.runner._select_from_dataset(
                    grouped_cte,
                    func.sum(grouped_cte.c[column.name]).label(Metrics.COUNT.name),
                    unique_count.label(Metrics.UNIQUE_COUNT.name),
                    query_group_by_=query_group_by_,
                ).first()
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
        """Execute dimensional validation for uniqueness using two-pass approach

        Two-pass query strategy for accurate "Others" unique count:

        Pass 1: Compute metrics for top N dimensions using CTE-based aggregation
                Returns "Others" row with approximate summed unique_count

        Pass 2: Recompute unique count for "Others" from value_counts CTE
                Query: Filter value_counts WHERE dimension NOT IN (top_N_values),
                       then recalculate unique count across all "Others" dimensions
                This ensures mathematical accuracy (unique_count is not additive)

        This approach ensures accuracy while maintaining performance for common case.

        Args:
            column: The column being validated
            dimension_col: Single Column object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects
            test_params: Optional test parameters (empty dict for uniqueness validator)

        Returns:
            List[DimensionResult]: Top N dimensions plus "Others" with accurate unique count
        """
        dimension_results = []

        try:
            if hasattr(self.runner.dataset, "__table__"):
                table = self.runner.dataset.__table__
            else:

                table = self.runner.dataset

            dialect = self.runner._session.bind.dialect.name

            normalized_dimension = self._get_normalized_dimension_expression(
                dimension_col
            )

            # Build dialect-specific value_counts CTE for dimensional unique count
            value_counts_cte, unique_count_expr = _unique_count_dimensional_cte(
                column, table, normalized_dimension, dialect
            )

            metric_expressions = {
                DIMENSION_TOTAL_COUNT_KEY: func.sum(value_counts_cte.c.row_count),
                Metrics.COUNT.name: func.sum(value_counts_cte.c.occurrence_count),
                Metrics.UNIQUE_COUNT.name: unique_count_expr,
                DIMENSION_FAILED_COUNT_KEY: func.sum(
                    value_counts_cte.c.occurrence_count
                )
                - unique_count_expr,
            }

            result_rows = self._run_dimensional_validation_query(
                source=value_counts_cte,
                dimension_expr=value_counts_cte.c.dim_value,
                metric_expressions=metric_expressions,
                others_source_builder=self._get_others_source_builder(value_counts_cte),
                others_metric_expressions_builder=self._get_others_metric_expressions_builder(),
            )

            for row in result_rows:
                metric_values = self._build_metric_values_from_row(
                    row, metrics_to_compute, test_params
                )
                evaluation = self._evaluate_test_condition(metric_values, test_params)
                dimension_result = self._create_dimension_result(
                    row, dimension_col.name, metric_values, evaluation, test_params
                )
                dimension_results.append(dimension_result)

        except Exception as exc:
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)

        return dimension_results

    def _get_others_source_builder(self, value_counts_cte):
        def build_others_source(top_values):
            return (
                select(
                    value_counts_cte.c.col_value,
                    func.sum(value_counts_cte.c.occurrence_count).label(
                        "occurrence_count"
                    ),
                    func.sum(value_counts_cte.c.row_count).label("row_count"),
                )
                .select_from(value_counts_cte)
                .where(value_counts_cte.c.dim_value.notin_(top_values))
                .group_by(value_counts_cte.c.col_value)
            ).cte("others_source")

        return build_others_source

    def _get_others_metric_expressions_builder(self):
        def build_others_metric_expressions(others_source):
            unique_count_expr = func.sum(
                case((others_source.c.occurrence_count == 1, 1), else_=0)
            )
            return {
                DIMENSION_TOTAL_COUNT_KEY: func.sum(others_source.c.row_count),
                Metrics.COUNT.name: func.sum(others_source.c.occurrence_count),
                Metrics.UNIQUE_COUNT.name: unique_count_expr,
                DIMENSION_FAILED_COUNT_KEY: func.sum(others_source.c.occurrence_count)
                - unique_count_expr,
            }

        return build_others_metric_expressions
