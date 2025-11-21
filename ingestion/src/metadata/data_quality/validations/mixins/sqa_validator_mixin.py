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

from enum import Enum, auto
from typing import Any, Callable, Dict, List, Optional, cast

from sqlalchemy import Column, String, Table, case, func, inspect, literal, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.expression import ClauseElement, FromClause

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_IMPACT_SCORE_KEY,
    DIMENSION_NULL_LABEL,
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


class DataQualityQueryType(Enum):
    DIMENSIONAL = auto()
    OTHERS = auto()


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

    def _get_normalized_dimension_expression(
        self, dimension_col: Column
    ) -> ColumnElement:
        """Build normalized dimension expression for dimensional validation.

        Handles NULL values and type casting for compatibility with string literals
        ('NULL', 'Others'). This prevents type mismatch errors when mixing numeric
        dimension columns with string labels.

        Args:
            dimension_col: The dimension column to normalize

        Returns:
            ColumnElement: Normalized dimension expression (CASE statement)
        """
        dimension_col_as_string = func.cast(dimension_col, String)

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

        return normalized_dimension

    @staticmethod
    def _get_metrics_query(
        source: Any,
        dimension_expr: ColumnElement,
        metric_expressions: Dict[str, ClauseElement],
        query_type: DataQualityQueryType,
        filter_clause: Optional[ColumnElement] = None,
    ):
        """Build SELECT query for dimensional metrics with impact scoring.

        This method constructs identical queries for both top N dimensions and
        "Others" aggregation, differing only in filter/grouping/limit parameters.

        Args:
            source: CTE or table to select from (e.g., runner.dataset, value_counts_cte)
            dimension_expr: Normalized dimension expression
            metric_expressions: Dict mapping metric names to SQLAlchemy expressions
                               Must include keys specified by failed_count_key and total_count_key
            failed_count_key: Key in metric_expressions for failed count
            total_count_key: Key in metric_expressions for total count
            filter_clause: Optional WHERE filter (e.g., dimension.notin_(top_n_values))
            group_by_dimension: True = GROUP BY dimension (top N), False = aggregate all (Others)
            limit: Optional LIMIT clause (typically N+1 for top dimensions query)

        Returns:
            Select: SQLAlchemy Select object (not executed)
        """
        if DIMENSION_FAILED_COUNT_KEY not in metric_expressions:
            raise ValueError(
                f"metric_expressions must contain 'DIMENSION_FAILED_COUNT_KEY' key"
            )
        if DIMENSION_TOTAL_COUNT_KEY not in metric_expressions:
            raise ValueError(
                f"metric_expressions must contain 'DIMENSION_TOTAL_COUNT_KEY' key"
            )

        select_columns = []

        for metric_name, metric_expr in metric_expressions.items():
            select_columns.append(metric_expr.label(metric_name))

        failed_count_expr = metric_expressions[DIMENSION_FAILED_COUNT_KEY]
        total_count_expr = metric_expressions[DIMENSION_TOTAL_COUNT_KEY]
        impact_score_expr = get_impact_score_expression(
            failed_count_expr, total_count_expr
        )

        select_columns.append(impact_score_expr.label(DIMENSION_IMPACT_SCORE_KEY))

        match query_type:
            case DataQualityQueryType.DIMENSIONAL:
                select_columns.append(dimension_expr.label(DIMENSION_VALUE_KEY))
            case DataQualityQueryType.OTHERS:
                select_columns.append(
                    literal(DIMENSION_OTHERS_LABEL).label(DIMENSION_VALUE_KEY)
                )

        query = select(select_columns).select_from(source)

        if query_type == DataQualityQueryType.DIMENSIONAL:
            query = query.group_by(dimension_expr)
            query = query.order_by(impact_score_expr.desc(), dimension_expr.asc())
            query = query.limit(DEFAULT_TOP_DIMENSIONS + 1)

        if filter_clause is not None:
            query = query.where(filter_clause)

        return query

    def _run_dimensional_validation_query(
        self: HasValidatorContext,
        source: FromClause,
        dimension_expr: ColumnElement,
        metric_expressions: Dict[str, ClauseElement],
        others_source_builder: Optional[Callable[[List[str]], FromClause]] = None,
        others_metric_expressions_builder: Optional[
            Callable[[FromClause], Dict[str, ClauseElement]]
        ] = None,
    ) -> List[Dict[str, Any]]:
        """Execute two-pass dimensional validation with metrics.

        Pass 1: Get top N+1 dimensions with full metrics
        Pass 2: If N+1 exists, compute "Others" by rerunning aggregation with optional customization

        This pattern works for all validator types:
        - Simple validators: source = runner.dataset
        - Statistical validators: source = runner.dataset
        - Median validator: source = normalized_dimension_cte, custom Others metrics (no add_props)
        - Unique validator: source = value_counts_cte, custom Others source + metrics (re-grouped)

        Args:
            source: CTE or table to aggregate from for DIMENSIONAL query
            dimension_expr: Normalized dimension expression
            metric_expressions: Dict of {metric_name: SQLAlchemy expression} for DIMENSIONAL query
            others_source_builder: Optional callable(top_values) -> FromClause for custom Others source
                                   When provided, source is pre-filtered and no additional filter applied
            others_metric_expressions_builder: Optional callable(others_source) -> Dict for custom Others metrics
                                               Useful when metrics need different expressions for Others aggregation

        Returns:
            List[Dict]: Top N dimensions + "Others" (if exists), ordered by impact score
        """
        top_n_plus_one_query = SQAValidatorMixin._get_metrics_query(
            source=source,
            dimension_expr=dimension_expr,
            metric_expressions=metric_expressions,
            query_type=DataQualityQueryType.DIMENSIONAL,
        )

        top_n_plus_one_results = self.runner.session.execute(
            top_n_plus_one_query
        ).fetchall()

        result_dicts = [
            dict(row._mapping)
            for row in top_n_plus_one_results[:DEFAULT_TOP_DIMENSIONS]
        ]

        if len(top_n_plus_one_results) > DEFAULT_TOP_DIMENSIONS:
            top_n_values = [row[DIMENSION_VALUE_KEY] for row in result_dicts]

            # Build custom source and metrics if builders provided
            if others_source_builder:
                others_source_cte = others_source_builder(top_n_values)
                # Custom source should already be pre-filtered
                others_filter = None
            else:
                others_source_cte = source
                others_filter = dimension_expr.notin_(top_n_values)

            if others_metric_expressions_builder:
                others_metrics = others_metric_expressions_builder(others_source_cte)
            else:
                others_metrics = metric_expressions

            others_query = SQAValidatorMixin._get_metrics_query(
                source=others_source_cte,
                dimension_expr=dimension_expr,  # Only used for grouping, not SELECT
                metric_expressions=others_metrics,
                query_type=DataQualityQueryType.OTHERS,
                filter_clause=others_filter,
            )

            others_result = self.runner.session.execute(others_query).fetchone()

            if others_result:
                result_dicts.append(dict(others_result._mapping))

        return result_dicts
