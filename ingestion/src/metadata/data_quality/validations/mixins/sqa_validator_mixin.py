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

from typing import Any, Dict, List, Optional

from sqlalchemy import Column, case, func, select, text
from sqlalchemy.exc import SQLAlchemyError
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
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.entity_link import get_decoded_column
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

# CTE names for dimensional queries
CTE_DIMENSION_STATS = "dimension_stats"
CTE_TOP_DIMENSIONS = "top_dimensions"
CTE_CATEGORIZED = "categorized"
DIMENSION_GROUP_LABEL = "dimension_group"


class SQAValidatorMixin:
    """Validator mixin for SQA test cases"""

    def get_column_name(self, entity_link: str, columns: List) -> Column:
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
