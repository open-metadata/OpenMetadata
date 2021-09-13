from typing import Optional

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
    column_aggregate_partial,
    column_aggregate_value,
)
from great_expectations.expectations.metrics.column_aggregate_metric_provider import (
    sa as sa,
)
from great_expectations.expectations.metrics.metric_provider import metric_value
from great_expectations.validator.validation_graph import MetricConfiguration


def unique_proportion(_metrics):
    """Computes the proportion of unique non-null values out of all non-null values"""
    total_values = _metrics.get("table.row_count")
    unique_values = _metrics.get("column.distinct_values.count")
    null_count = _metrics.get("column_values.nonnull.unexpected_count")

    # Ensuring that we do not divide by 0, returning 0 if all values are nulls (we only consider non-nulls unique values)
    if total_values > 0 and total_values != null_count:
        return unique_values / (total_values - null_count)
    else:
        return 0


class ColumnUniqueProportion(ColumnAggregateMetricProvider):
    metric_name = "column.unique_proportion"

    @metric_value(engine=PandasExecutionEngine)
    def _pandas(*args, metrics, **kwargs):
        return unique_proportion(metrics)

    @metric_value(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(*args, metrics, **kwargs):
        return unique_proportion(metrics)

    @metric_value(engine=SparkDFExecutionEngine)
    def _spark(*args, metrics, **kwargs):
        return unique_proportion(metrics)

    @classmethod
    def _get_evaluation_dependencies(
        cls,
        metric: MetricConfiguration,
        configuration: Optional[ExpectationConfiguration] = None,
        execution_engine: Optional[ExecutionEngine] = None,
        runtime_configuration: Optional[dict] = None,
    ):
        dependencies: dict = super()._get_evaluation_dependencies(
            metric=metric,
            configuration=configuration,
            execution_engine=execution_engine,
            runtime_configuration=runtime_configuration,
        )

        dependencies["column.distinct_values.count"] = MetricConfiguration(
            metric_name="column.distinct_values.count",
            metric_domain_kwargs=metric.metric_domain_kwargs,
        )

        dependencies["column_values.nonnull.unexpected_count"] = MetricConfiguration(
            metric_name="column_values.nonnull.unexpected_count",
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
