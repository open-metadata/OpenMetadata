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
Validator Mixin for SQA tests cases
"""

from typing import Any, Callable, Dict, List, Optional, cast

from sqlalchemy import Column, Table, case, func, inspect, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.expression import ClauseElement

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_IMPACT_SCORE_KEY,
    DIMENSION_OTHERS_LABEL,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.impact_score import (
    DEFAULT_TOP_DIMENSIONS,
    get_impact_score_expression,
)
from metadata.data_quality.validations.mixins.protocols import HasValidatorContext
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.entity_link import get_decoded_column
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

# Type alias for failed count builder in SQL
# Takes metric expression and total count expression, returns failed count expression
FailedCountBuilderSQA = Callable[[ClauseElement], ClauseElement]

# CTE names for dimensional queries
CTE_DIMENSION_STATS = "dimension_stats"
CTE_TOP_DIMENSIONS = "top_dimensions"
CTE_CATEGORIZED = "categorized"
CTE_DIMENSION_RAW_METRICS = (
    "dimension_raw_metrics"  # For statistical validators: raw aggregates
)
CTE_DIMENSION_WITH_IMPACT = (
    "dimension_with_impact"  # For statistical validators: metrics + impact score
)
CTE_FINAL_METRICS = "final_metrics"  # For final aggregated metrics

DIMENSION_GROUP_LABEL = "dimension_group"


class SQAValidatorMixin:
    """Validator mixin for SQA test cases"""

    def get_column(
        self: HasValidatorContext, column_name: Optional[str] = None
    ) -> Column:
        """Get column object for the given column name

        Args:
            column_name: Optional column name. If None, returns the main validation column.

        Returns:
            Column: Column object
        """
        table: Table = cast(Table, inspect(cast(QueryRunner, self.runner).dataset))
        if column_name is None:
            return SQAValidatorMixin.get_column_from_list(
                self.test_case.entityLink.root,
                table.c,
            )
        return SQAValidatorMixin.get_column_from_list(
            column_name,
            table.c,
        )

    @staticmethod
    def get_column_from_list(entity_link: str, columns: List) -> Column:
        """Given a column name get the column object

        Args:
            column_name (str): Column name
        Returns:
            Column: Column object
        """
        column = get_decoded_column(entity_link)
        column_obj = next(
            (col for col in columns if col.name == column),
            None,
        )
        if column_obj is None:
            raise ValueError(f"Cannot find column {column}")
        return column_obj

    def run_query_results(
        self,
        runner: QueryRunner,
        metric: Metrics,
        column: Optional[Column] = None,
        **kwargs: Optional[Any],
    ) -> Optional[int]:
        """Run the metric query against the column

        Args:
            runner (QueryRunner): runner object witj sqlalchemy session object
            metric (Metrics): metric object
            column (Column): column object
            props_ (Optional[Any], optional): props to pass to metric object at runtime. Defaults to None.

        Raises:
            ValueError: error if no value is returned

        Returns:
            Any: value returned by the metric query
        """
        metric_obj = add_props(**kwargs)(metric.value) if kwargs else metric.value
        metric_fn = metric_obj(column).fn() if column is not None else metric_obj().fn()

        try:
            value = dict(runner.dispatch_query_select_first(metric_fn))  # type: ignore
            res = value.get(metric.name)
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

    def _compute_row_count_between(
        self,
        runner: QueryRunner,
        column: Column,
        query_filter: dict,
    ):
        """compute row count for between tests

        Args:
            runner (QueryRunner): runner
            column (Column): column
            query_filter (dict): filter to apply to the query

        Raises:
            SQLAlchemyError:

        Returns:
        """
        try:
            value = dict(
                runner.dispatch_query_select_first(
                    Metrics.ROW_COUNT(column).fn(),
                    query_filter_=query_filter,
                )
            )
            res = value.get(Metrics.ROW_COUNT.name)
        except Exception as exc:
            raise SQLAlchemyError(exc)

        return res

    def _compute_row_count(self, runner: QueryRunner, column: Column, **kwargs):
        """compute row count

        Args:
            runner (QueryRunner): runner to run the test case against)
            column (SQALikeColumn): column to compute row count for
        """
        return self.run_query_results(runner, Metrics.ROW_COUNT, column, **kwargs)

    def _execute_with_others_aggregation(
        self,
        dimension_col: Column,
        metric_expressions: Dict[str, ClauseElement],
        top_dimensions_count: int = DEFAULT_TOP_DIMENSIONS,
    ) -> List[Dict[str, Any]]:
        """Execute dimensional query with CTE-based Others aggregation and impact scoring.

        This shared method is used by all dimensional validators to:
        1. Calculate dimension stats with impact scores
        2. Select top N dimensions by impact score
        3. Aggregate remaining dimensions as "Others"

        NOTE: The metric_expressions dict MUST contain:
        - DIMENSION_TOTAL_COUNT_KEY: Expression for total count
        - DIMENSION_FAILED_COUNT_KEY: Expression for failed count
        These are used for impact score calculation.

        Args:
            dimension_col: The column to group by
            metric_expressions: Dict mapping metric names to SQLAlchemy expressions
                                Must include 'total_count' and 'failed_count' keys
            top_dimensions_count: Number of top dimensions to keep before aggregating

        Returns:
            List of dicts with dimension results ordered by impact score
        """
        # Validate required metrics are present
        if DIMENSION_TOTAL_COUNT_KEY not in metric_expressions:
            raise ValueError(
                f"metric_expressions must contain '{DIMENSION_TOTAL_COUNT_KEY}' key"
            )
        if DIMENSION_FAILED_COUNT_KEY not in metric_expressions:
            raise ValueError(
                f"metric_expressions must contain '{DIMENSION_FAILED_COUNT_KEY}' key"
            )

        # Build expressions using dictionary iteration
        select_expressions = {
            DIMENSION_VALUE_KEY: dimension_col,
        }

        # Add all metric expressions from the dictionary
        select_expressions.update(metric_expressions)

        # Add impact scoring expression
        select_expressions[DIMENSION_IMPACT_SCORE_KEY] = get_impact_score_expression(
            metric_expressions[DIMENSION_FAILED_COUNT_KEY],
            metric_expressions[DIMENSION_TOTAL_COUNT_KEY],
        )

        # CTE 1: Calculate all dimension stats
        dimension_stats_columns = [
            expr.label(name) for name, expr in select_expressions.items()
        ]

        dimension_stats = (
            select(dimension_stats_columns)
            .select_from(self.runner.dataset)
            .group_by(dimension_col)
            .cte(CTE_DIMENSION_STATS)
        )

        # CTE 2: Get top N dimensions by impact score
        top_dimensions = (
            select([dimension_stats.c.dimension_value])
            .order_by(dimension_stats.c.impact_score.desc())
            .limit(top_dimensions_count)
            .cte(CTE_TOP_DIMENSIONS)
        )

        # CTE 3: Categorize as top N or "Others"
        categorized_columns = [
            case(
                [
                    (
                        dimension_stats.c.dimension_value.in_(
                            select([top_dimensions.c.dimension_value])
                        ),
                        dimension_stats.c.dimension_value,
                    )
                ],
                else_=DIMENSION_OTHERS_LABEL,
            ).label(DIMENSION_GROUP_LABEL)
        ]

        # Add all metric columns from dimension_stats
        for name in select_expressions.keys():
            if name != DIMENSION_VALUE_KEY:
                categorized_columns.append(getattr(dimension_stats.c, name))

        categorized = (
            select(categorized_columns)
            .select_from(dimension_stats)
            .cte(CTE_CATEGORIZED)
        )

        # Final query: Aggregate by dimension_group
        final_columns = [
            getattr(categorized.c, DIMENSION_GROUP_LABEL).label(DIMENSION_VALUE_KEY)
        ]

        # Aggregate numeric columns
        for name in select_expressions.keys():
            if name == DIMENSION_VALUE_KEY:
                continue
            elif name == DIMENSION_IMPACT_SCORE_KEY:
                # Recalculate impact score for aggregated "Others"
                final_columns.append(
                    case(
                        [
                            (
                                getattr(categorized.c, DIMENSION_GROUP_LABEL)
                                != DIMENSION_OTHERS_LABEL,
                                func.max(getattr(categorized.c, name)),
                            )
                        ],
                        else_=get_impact_score_expression(
                            func.sum(
                                getattr(categorized.c, DIMENSION_FAILED_COUNT_KEY)
                            ),
                            func.sum(getattr(categorized.c, DIMENSION_TOTAL_COUNT_KEY)),
                        ),
                    ).label(name)
                )
            else:
                # Sum all other metrics
                final_columns.append(func.sum(getattr(categorized.c, name)).label(name))

        final_query = (
            select(final_columns)
            .select_from(categorized)
            .group_by(getattr(categorized.c, DIMENSION_GROUP_LABEL))
            .order_by(text(f"{DIMENSION_IMPACT_SCORE_KEY} DESC"))
        )

        # Execute and return as list of dicts
        results = self.runner.session.execute(final_query)
        return [
            {col.name: value for col, value in zip(final_query.selected_columns, row)}
            for row in results
        ]

    def _execute_with_others_aggregation_statistical(
        self,
        dimension_col: Column,
        metric_expressions: Dict[str, ClauseElement],
        failed_count_builder: FailedCountBuilderSQA,
        final_metric_builders: Optional[Dict[str, Any]] = None,
        exclude_from_results: Optional[List[str]] = None,
        top_dimensions_count: int = DEFAULT_TOP_DIMENSIONS,
    ) -> List[Dict[str, Any]]:
        """Execute dimensional query for statistical validators with flexible aggregation

        This specialized method supports both row-by-row and statistical validators by
        allowing custom aggregation strategies for metrics in the final SELECT.

        Key features:
        1. Impact score computed in separate CTE after raw aggregates
        2. Failed count determined via custom builder function
        3. Final aggregation: default to SUM, override for non-summable metrics
        4. "Others" uses recomputed/weighted values where specified

        TODO: Once proven stable, consider merging with _execute_with_others_aggregation
        to provide unified interface for all validators.

        Args:
            dimension_col: The column to group by
            metric_expressions: Dict of SQLAlchemy expressions for CTE1 raw aggregates.
                Keys become CTE column names (use constants!).
                Must include DIMENSION_TOTAL_COUNT_KEY.
            failed_count_expr_builder: Callable(cte1) -> ClauseElement that returns
                expression for failed_count. References CTE1 columns via
                getattr(cte1.c, KEY_CONSTANT).
            final_metric_builders: Optional dict of custom aggregation builders for
                specific metrics. If not provided, metrics default to func.sum().
                Format: {metric_name: Callable(categorized_cte) -> ClauseElement}
            exclude_from_results: Optional list of metric names to exclude from final SELECT.
                Useful for intermediate metrics (e.g., sum_value used only for calculations).
            top_dimensions_count: Number of top dimensions before Others aggregation

        Returns:
            List of dicts with dimension results ordered by impact score

        Example - Statistical validator (Mean):
            metric_expressions = {
                DIMENSION_SUM_VALUE_KEY: func.sum(column),
                DIMENSION_TOTAL_COUNT_KEY: func.count(),
                "mean": func.avg(column),
            }

            def build_failed_count(cte1):
                mean_col = getattr(cte1.c, "mean")
                count_col = getattr(cte1.c, DIMENSION_TOTAL_COUNT_KEY)
                return func.case(
                    ((mean_col < min_bound) | (mean_col > max_bound), count_col),
                    else_=func.literal(0)
                )

            def build_mean_final(cte):
                return func.case(
                    [(getattr(cte.c, DIMENSION_GROUP_LABEL) != DIMENSION_OTHERS_LABEL,
                      func.max(getattr(cte.c, "mean")))],
                    else_=(func.sum(getattr(cte.c, DIMENSION_SUM_VALUE_KEY)) /
                           func.sum(getattr(cte.c, DIMENSION_TOTAL_COUNT_KEY)))
                )

            results = self._execute_with_others_aggregation_statistical(
                dimension_col,
                metric_expressions,
                build_failed_count,
                final_metric_builders={"mean": build_mean_final},
                exclude_from_results=[DIMENSION_SUM_VALUE_KEY],  # Don't output sum_value
            )

        Example - Row-by-row validator (defaults to SUM):
            metric_expressions = {
                DIMENSION_TOTAL_COUNT_KEY: func.count(),
                "count_in_set": Metrics.COUNT_IN_SET(...).fn(),
            }
            # No final_metric_builders needed - everything gets summed
        """
        if DIMENSION_TOTAL_COUNT_KEY not in metric_expressions:
            raise ValueError(
                f"metric_expressions must contain '{DIMENSION_TOTAL_COUNT_KEY}'"
            )

        final_metric_builders = final_metric_builders or {}
        exclude_from_results = exclude_from_results or []

        # ---- CTE 1: Raw aggregates per dimension
        raw_agg_columns = [dimension_col.label(DIMENSION_VALUE_KEY)]
        for name, expr in metric_expressions.items():
            raw_agg_columns.append(expr.label(name))

        raw_aggregates = (
            select(raw_agg_columns)
            .select_from(self.runner.dataset)
            .group_by(dimension_col)
            .cte(CTE_DIMENSION_RAW_METRICS)
        )

        # ---- CTE 2: Add failed_count and impact_score
        total_count_col = getattr(raw_aggregates.c, DIMENSION_TOTAL_COUNT_KEY)
        failed_count_expr = failed_count_builder(raw_aggregates)

        impact_score_expr = get_impact_score_expression(
            failed_count_expr, total_count_col
        )

        stats_with_impact_columns = [col for col in raw_aggregates.c]
        stats_with_impact_columns.append(
            failed_count_expr.label(DIMENSION_FAILED_COUNT_KEY)
        )
        stats_with_impact_columns.append(
            impact_score_expr.label(DIMENSION_IMPACT_SCORE_KEY)
        )

        stats_with_impact = (
            select(
                *[col for col in raw_aggregates.c],
                failed_count_expr.label(DIMENSION_FAILED_COUNT_KEY),
                impact_score_expr.label(DIMENSION_IMPACT_SCORE_KEY),
            )
            .select_from(raw_aggregates)
            .cte(CTE_DIMENSION_WITH_IMPACT)
        )

        # CTE 3: Top N dimensions by impact score
        top_dimensions = (
            select([getattr(stats_with_impact.c, DIMENSION_VALUE_KEY)])
            .order_by(getattr(stats_with_impact.c, DIMENSION_IMPACT_SCORE_KEY).desc())
            .limit(top_dimensions_count)
            .cte(CTE_TOP_DIMENSIONS)
        )

        # CTE 4: Categorize as top N or "Others"
        is_dimension_top_n = getattr(stats_with_impact.c, DIMENSION_VALUE_KEY).in_(
            select([getattr(top_dimensions.c, DIMENSION_VALUE_KEY)])
        )

        categorized_columns = [
            case(
                (is_dimension_top_n, getattr(stats_with_impact.c, DIMENSION_VALUE_KEY)),
                else_=DIMENSION_OTHERS_LABEL,
            ).label(DIMENSION_GROUP_LABEL)
        ]

        for col in stats_with_impact.c:
            if col.name != DIMENSION_VALUE_KEY:
                categorized_columns.append(col)

        categorized = (
            select(categorized_columns)
            .select_from(stats_with_impact)
            .cte(CTE_CATEGORIZED)
        )

        # CTE 5: Aggregate Metrics for 'Others'
        final_columns = [
            getattr(categorized.c, DIMENSION_GROUP_LABEL).label(DIMENSION_VALUE_KEY),
            func.max(getattr(categorized.c, DIMENSION_IMPACT_SCORE_KEY)).label(
                DIMENSION_IMPACT_SCORE_KEY
            ),
        ]

        def build_final_metric(metric_name: str) -> ColumnElement:
            if metric_name in final_metric_builders:
                return final_metric_builders[metric_name](categorized)
            return func.sum(getattr(categorized.c, metric_name))

        for metric_name in metric_expressions.keys():
            final_columns.append(build_final_metric(metric_name).label(metric_name))

        final_failed_count = func.sum(
            getattr(categorized.c, DIMENSION_FAILED_COUNT_KEY)
        ).label(DIMENSION_FAILED_COUNT_KEY)
        final_columns.append(final_failed_count)

        final_cte = (
            select(final_columns)
            .select_from(categorized)
            .group_by(getattr(categorized.c, DIMENSION_GROUP_LABEL))
            .cte(CTE_FINAL_METRICS)
        )

        # --- Results Query
        result_columns = []
        for col in final_cte.c:
            if (
                col.name not in (DIMENSION_FAILED_COUNT_KEY, DIMENSION_IMPACT_SCORE_KEY)
                and col.name not in exclude_from_results
            ):
                result_columns.append(col)

        failed_count_expr = failed_count_builder(final_cte)

        result_failed_count = case(
            (
                getattr(final_cte.c, DIMENSION_VALUE_KEY) != DIMENSION_OTHERS_LABEL,
                getattr(final_cte.c, DIMENSION_FAILED_COUNT_KEY),
            ),
            else_=failed_count_expr,
        ).label(DIMENSION_FAILED_COUNT_KEY)
        result_columns.append(result_failed_count)

        # Impact score: preserve for top N, recompute for "Others" automatically
        result_impact = case(
            (
                getattr(final_cte.c, DIMENSION_VALUE_KEY) != DIMENSION_OTHERS_LABEL,
                getattr(final_cte.c, DIMENSION_IMPACT_SCORE_KEY),
            ),
            else_=get_impact_score_expression(
                failed_count_expr,
                getattr(final_cte.c, DIMENSION_TOTAL_COUNT_KEY),
            ),
        ).label(DIMENSION_IMPACT_SCORE_KEY)
        result_columns.append(result_impact)

        results_query = (
            select(result_columns)
            .select_from(final_cte)
            .order_by(
                result_impact.desc(), getattr(final_cte.c, DIMENSION_VALUE_KEY).asc()
            )
        )

        # Execute and return
        results = self.runner.session.execute(results_query)
        return results.mappings().all()
