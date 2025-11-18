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
from typing import Dict, List, Optional

from sqlalchemy import Column, String, case, func, literal, literal_column, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql import ColumnElement
from sqlalchemy.sql.selectable import CTE

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_IMPACT_SCORE_KEY,
    DIMENSION_NULL_LABEL,
    DIMENSION_OTHERS_LABEL,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeUnique import (
    BaseColumnValuesToBeUniqueValidator,
)
from metadata.data_quality.validations.impact_score import (
    DEFAULT_TOP_DIMENSIONS,
    get_impact_score_expression,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    DIMENSION_GROUP_LABEL,
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.functions.unique_count import _unique_count_dimensional_cte
from metadata.profiler.orm.registry import Dialects

logger = logging.getLogger(__name__)

# CTE names for dimensional validation query chain
CTE_VALUE_COUNTS = "value_counts"
CTE_DIMENSION_STATS = "dimension_stats"
CTE_STATS_WITH_IMPACT = "stats_with_impact"
CTE_TOP_DIMENSIONS = "top_dimensions"
CTE_CATEGORIZED = "categorized"
CTE_OTHERS_VALUE_COUNTS = "others_value_counts"


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
            # ==================== PASS 1: Top N Dimensions ====================
            # Handle both Table and CTE/Alias cases (when partitioning is enabled)
            if hasattr(self.runner.dataset, "__table__"):
                table = self.runner.dataset.__table__
            else:
                table = self.runner.dataset
            dialect = self.runner._session.bind.dialect.name

            # Cast dimension column to VARCHAR to ensure compatibility with string literals
            # This prevents type mismatch errors when mixing numeric columns with 'NULL'/'Others' labels
            dimension_col_as_string = func.cast(dimension_col, String)

            # Normalize dimension column for NULL handling
            normalized_dimension = case(
                [
                    (dimension_col.is_(None), literal(DIMENSION_NULL_LABEL)),
                    (
                        func.upper(dimension_col_as_string) == "NULL",
                        literal(DIMENSION_NULL_LABEL),
                    ),
                ],
                else_=dimension_col_as_string,
            )

            # Build dialect-specific value_counts CTE for dimensional unique count
            value_counts_cte, unique_count_expr = _unique_count_dimensional_cte(
                column, table, normalized_dimension, dialect
            )

            # CTE 2: Aggregate unique counts per dimension from value_counts
            # Use SUM(occurrence_count) to count non-NULL values only
            # Use SUM(row_count) for actual row count (for impact scoring)
            dimension_stats = (
                select(
                    value_counts_cte.c.dim_value.label(DIMENSION_VALUE_KEY),
                    func.sum(value_counts_cte.c.occurrence_count).label(
                        Metrics.COUNT.name
                    ),
                    unique_count_expr.label(Metrics.UNIQUE_COUNT.name),
                    func.sum(value_counts_cte.c.row_count).label(
                        DIMENSION_TOTAL_COUNT_KEY
                    ),
                )
                .select_from(value_counts_cte)
                .group_by(value_counts_cte.c.dim_value)
            ).cte(CTE_DIMENSION_STATS)

            # Calculate failed count (values that are NOT unique)
            failed_count_expr = getattr(
                dimension_stats.c, Metrics.COUNT.name
            ) - getattr(dimension_stats.c, Metrics.UNIQUE_COUNT.name)

            # CTE 3: Add failed count and impact score
            stats_with_impact = (
                select(
                    *[col for col in dimension_stats.c],
                    failed_count_expr.label(DIMENSION_FAILED_COUNT_KEY),
                    get_impact_score_expression(
                        failed_count_expr,
                        getattr(dimension_stats.c, DIMENSION_TOTAL_COUNT_KEY),
                    ).label(DIMENSION_IMPACT_SCORE_KEY),
                ).select_from(dimension_stats)
            ).cte(CTE_STATS_WITH_IMPACT)

            # CTE 4: Top N dimensions by impact score
            top_dimensions = (
                select([getattr(stats_with_impact.c, DIMENSION_VALUE_KEY)])
                .order_by(
                    getattr(stats_with_impact.c, DIMENSION_IMPACT_SCORE_KEY).desc()
                )
                .limit(DEFAULT_TOP_DIMENSIONS)
            ).cte(CTE_TOP_DIMENSIONS)

            # CTE 5: Categorize as top N or "Others"
            categorized = (
                select(
                    case(
                        (
                            getattr(stats_with_impact.c, DIMENSION_VALUE_KEY).in_(
                                select([getattr(top_dimensions.c, DIMENSION_VALUE_KEY)])
                            ),
                            getattr(stats_with_impact.c, DIMENSION_VALUE_KEY),
                        ),
                        else_=DIMENSION_OTHERS_LABEL,
                    ).label(DIMENSION_GROUP_LABEL),
                    *[
                        col
                        for col in stats_with_impact.c
                        if col.name != DIMENSION_VALUE_KEY
                    ],
                ).select_from(stats_with_impact)
            ).cte(CTE_CATEGORIZED)

            # Final query: Aggregate "Others" rows
            # For top N dimensions: use original metrics
            # For "Others": recalculate failed count and impact score from aggregated values
            summed_count = func.sum(getattr(categorized.c, Metrics.COUNT.name))
            summed_unique_count = func.sum(
                getattr(categorized.c, Metrics.UNIQUE_COUNT.name)
            )
            summed_total_count = func.sum(
                getattr(categorized.c, DIMENSION_TOTAL_COUNT_KEY)
            )

            # Recalculated failed count for "Others"
            recalculated_failed_count = summed_count - summed_unique_count

            # Recalculated impact score for "Others"
            recalculated_impact_score = get_impact_score_expression(
                recalculated_failed_count, summed_total_count
            )

            final_query = (
                select(
                    getattr(categorized.c, DIMENSION_GROUP_LABEL).label(
                        DIMENSION_VALUE_KEY
                    ),
                    summed_count.label(Metrics.COUNT.name),
                    summed_unique_count.label(Metrics.UNIQUE_COUNT.name),
                    summed_total_count.label(DIMENSION_TOTAL_COUNT_KEY),
                    case(
                        (
                            getattr(categorized.c, DIMENSION_GROUP_LABEL)
                            != DIMENSION_OTHERS_LABEL,
                            func.sum(
                                getattr(categorized.c, DIMENSION_FAILED_COUNT_KEY)
                            ),
                        ),
                        else_=recalculated_failed_count,
                    ).label(DIMENSION_FAILED_COUNT_KEY),
                    case(
                        (
                            getattr(categorized.c, DIMENSION_GROUP_LABEL)
                            != DIMENSION_OTHERS_LABEL,
                            func.max(
                                getattr(categorized.c, DIMENSION_IMPACT_SCORE_KEY)
                            ),
                        ),
                        else_=recalculated_impact_score,
                    ).label(DIMENSION_IMPACT_SCORE_KEY),
                )
                .select_from(categorized)
                .group_by(getattr(categorized.c, DIMENSION_GROUP_LABEL))
                .order_by(
                    case(
                        (
                            getattr(categorized.c, DIMENSION_GROUP_LABEL)
                            != DIMENSION_OTHERS_LABEL,
                            func.max(
                                getattr(categorized.c, DIMENSION_IMPACT_SCORE_KEY)
                            ),
                        ),
                        else_=recalculated_impact_score,
                    ).desc()
                )
            )

            # Execute query and build dimension results
            result_rows = self.runner._session.execute(final_query).fetchall()

            # ==================== PASS 2: Recompute "Others" Unique Count ====================
            # Convert immutable Row objects to mutable dicts for modification
            result_dicts = [dict(row._mapping) for row in result_rows]

            # Separate top N dimensions from "Others" row
            top_n_rows = [
                row
                for row in result_dicts
                if row[DIMENSION_VALUE_KEY] != DIMENSION_OTHERS_LABEL
            ]

            has_others = len(top_n_rows) < len(result_dicts)

            # Recompute "Others" only if it existed in Pass 1
            if has_others:
                if recomputed_others := self._compute_others_unique_count(
                    column,
                    normalized_dimension,
                    value_counts_cte,
                    top_n_rows,
                ):
                    result_dicts = top_n_rows + [recomputed_others]
                else:
                    result_dicts = top_n_rows
            else:
                result_dicts = top_n_rows

            # ==================== Process Results ====================
            for row in result_dicts:
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

    def _compute_others_unique_count(
        self,
        column: Column,
        normalized_dimension: ColumnElement,
        value_counts_cte: CTE,
        top_n_rows: List[Dict],
    ) -> Optional[Dict]:
        """Recompute unique count and metrics for "Others" dimension group.

        Uses two-pass approach: Pass 1 computed top N dimensions, this computes
        "Others" by going back to value_counts CTE and filtering for dimensions
        NOT IN top N, then recalculating unique count.

        This is necessary because unique_count is not additive - summing unique
        counts from different dimensions gives incorrect results.

        Args:
            column: The column being validated
            normalized_dimension: Normalized dimension column expression
            value_counts_cte: The value_counts CTE from Pass 1
            top_n_rows: Results from Pass 1 WITHOUT "Others" row (only top N dimensions)

        Returns:
            New "Others" row dict with recomputed metrics, or None if computation failed
        """
        # Extract top N dimension values
        top_dimension_values = [row[DIMENSION_VALUE_KEY] for row in top_n_rows]

        if not top_dimension_values:
            logger.debug(
                "No top dimension values found, skipping 'Others' recomputation"
            )
            return None

        try:
            # Filter value_counts CTE for "Others" dimensions
            # Query: SELECT * FROM value_counts WHERE dim_value NOT IN (top_N)
            others_value_counts = (
                select(
                    value_counts_cte.c.col_value,
                    func.sum(value_counts_cte.c.occurrence_count).label(
                        "occurrence_count"
                    ),
                    func.sum(value_counts_cte.c.row_count).label("row_count"),
                )
                .select_from(value_counts_cte)
                .where(value_counts_cte.c.dim_value.notin_(top_dimension_values))
                .group_by(value_counts_cte.c.col_value)
            ).cte(CTE_OTHERS_VALUE_COUNTS)

            # Recalculate unique count for "Others"
            # Count values that appear exactly once across all "Others" dimensions
            unique_count_expr = func.sum(
                case((others_value_counts.c.occurrence_count == 1, 1), else_=0)
            )

            # Calculate total count (non-NULL values)
            count_expr = func.sum(others_value_counts.c.occurrence_count)

            # Calculate row count (for impact scoring) from baked-in row_count column
            row_count_expr = func.sum(others_value_counts.c.row_count)

            # Build final query
            others_query = select(
                count_expr.label(Metrics.COUNT.name),
                unique_count_expr.label(Metrics.UNIQUE_COUNT.name),
                row_count_expr.label(DIMENSION_TOTAL_COUNT_KEY),
            ).select_from(others_value_counts)

            result = self.runner._session.execute(others_query).fetchone()

            if result:
                count_val, unique_count_val, total_count = result

                # Calculate failed count using helper method
                failed_count = self._calculate_failed_count(count_val, unique_count_val)

                # Calculate impact score
                impact_score_result = self.runner._session.execute(
                    select(
                        get_impact_score_expression(
                            literal(failed_count), literal(total_count)
                        )
                    )
                ).scalar()

                logger.debug(
                    "Recomputed 'Others': count=%s, unique=%s, failed=%d/%d, impact=%.4f",
                    count_val,
                    unique_count_val,
                    failed_count,
                    total_count,
                    impact_score_result or 0.0,
                )

                return {
                    DIMENSION_VALUE_KEY: DIMENSION_OTHERS_LABEL,
                    Metrics.COUNT.name: count_val,
                    Metrics.UNIQUE_COUNT.name: unique_count_val,
                    DIMENSION_TOTAL_COUNT_KEY: total_count,
                    DIMENSION_FAILED_COUNT_KEY: failed_count,
                    DIMENSION_IMPACT_SCORE_KEY: impact_score_result or 0.0,
                }

            return None

        except Exception as exc:
            logger.warning(
                "Failed to recompute 'Others' unique count, will be excluded: %s", exc
            )
            logger.debug("Full error details: ", exc_info=True)
            return None
