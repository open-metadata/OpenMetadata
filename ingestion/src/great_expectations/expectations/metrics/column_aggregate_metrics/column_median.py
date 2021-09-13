from typing import Any, Dict, Optional, Tuple

import numpy as np

from great_expectations.core import ExpectationConfiguration
from great_expectations.execution_engine import (
    ExecutionEngine,
    PandasExecutionEngine,
    SparkDFExecutionEngine,
)
from great_expectations.execution_engine.execution_engine import MetricDomainTypes
from great_expectations.execution_engine.sqlalchemy_execution_engine import (
    SqlAlchemyExecutionEngine,
)
from great_expectations.expectations.metrics.column_aggregate_metric_provider import (
    ColumnAggregateMetricProvider,
    column_aggregate_value,
)
from great_expectations.expectations.metrics.import_manager import F, sa
from great_expectations.expectations.metrics.metric_provider import (
    MetricProvider,
    metric_value,
)
from great_expectations.validator.validation_graph import MetricConfiguration


class ColumnMedian(ColumnAggregateMetricProvider):
    """MetricProvider Class for Aggregate Mean MetricProvider"""

    metric_name = "column.median"

    @column_aggregate_value(engine=PandasExecutionEngine)
    def _pandas(cls, column, **kwargs):
        """Pandas Median Implementation"""
        return column.median()

    @metric_value(engine=SqlAlchemyExecutionEngine, metric_fn_type="value")
    def _sqlalchemy(
        cls,
        execution_engine: "SqlAlchemyExecutionEngine",
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        (
            selectable,
            compute_domain_kwargs,
            accessor_domain_kwargs,
        ) = execution_engine.get_compute_domain(
            metric_domain_kwargs, MetricDomainTypes.COLUMN
        )
        column_name = accessor_domain_kwargs["column"]
        column = sa.column(column_name)
        sqlalchemy_engine = execution_engine.engine
        dialect = sqlalchemy_engine.dialect
        """SqlAlchemy Median Implementation"""
        if dialect.name.lower() == "awsathena":
            raise NotImplementedError("AWS Athena does not support OFFSET.")
        nonnull_count = metrics.get("column_values.nonnull.count")
        if not nonnull_count:
            return None
        element_values = sqlalchemy_engine.execute(
            sa.select([column])
            .order_by(column)
            .where(column != None)
            .offset(max(nonnull_count // 2 - 1, 0))
            .limit(2)
            .select_from(selectable)
        )

        column_values = list(element_values.fetchall())

        if len(column_values) == 0:
            column_median = None
        elif nonnull_count % 2 == 0:
            # An even number of column values: take the average of the two center values
            column_median = (
                float(
                    column_values[0][0]
                    + column_values[1][0]  # left center value  # right center value
                )
                / 2.0
            )  # Average center values
        else:
            # An odd number of column values, we can just take the center value
            column_median = column_values[1][0]  # True center value
        return column_median

    @metric_value(engine=SparkDFExecutionEngine, metric_fn_type="value")
    def _spark(
        cls,
        execution_engine: "SqlAlchemyExecutionEngine",
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        (
            df,
            compute_domain_kwargs,
            accessor_domain_kwargs,
        ) = execution_engine.get_compute_domain(
            metric_domain_kwargs, MetricDomainTypes.COLUMN
        )
        column = accessor_domain_kwargs["column"]
        # We will get the two middle values by choosing an epsilon to add
        # to the 50th percentile such that we always get exactly the middle two values
        # (i.e. 0 < epsilon < 1 / (2 * values))

        # Note that this can be an expensive computation; we are not exposing
        # spark's ability to estimate.
        # We add two to 2 * n_values to maintain a legitimate quantile
        # in the degenerate case when n_values = 0

        """Spark Median Implementation"""
        table_row_count = metrics.get("table.row_count")
        result = df.approxQuantile(
            column, [0.5, 0.5 + (1 / (2 + (2 * table_row_count)))], 0
        )
        return np.mean(result)

    @classmethod
    def _get_evaluation_dependencies(
        cls,
        metric: MetricConfiguration,
        configuration: Optional[ExpectationConfiguration] = None,
        execution_engine: Optional[ExecutionEngine] = None,
        runtime_configuration: Optional[dict] = None,
    ):
        """This should return a dictionary:
        {
          "dependency_name": MetricConfiguration,
          ...
        }
        """
        dependencies: dict = super()._get_evaluation_dependencies(
            metric=metric,
            configuration=configuration,
            execution_engine=execution_engine,
            runtime_configuration=runtime_configuration,
        )

        if isinstance(execution_engine, SqlAlchemyExecutionEngine):
            dependencies["column_values.nonnull.count"] = MetricConfiguration(
                metric_name="column_values.nonnull.count",
                metric_domain_kwargs=metric.metric_domain_kwargs,
            )

        table_domain_kwargs: dict = {
            k: v for k, v in metric.metric_domain_kwargs.items() if k != "column"
        }
        dependencies["table.row_count"] = MetricConfiguration(
            metric_name="table.row_count",
            metric_domain_kwargs=table_domain_kwargs,
            metric_value_kwargs=None,
            metric_dependencies=None,
        )

        return dependencies
