from typing import Any, Dict, Optional, Tuple

from great_expectations.core import ExpectationConfiguration
from great_expectations.execution_engine import (
    ExecutionEngine,
    PandasExecutionEngine,
    SparkDFExecutionEngine,
)
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
from great_expectations.expectations.metrics.import_manager import F
from great_expectations.expectations.metrics.metric_provider import metric_value
from great_expectations.validator.validation_graph import MetricConfiguration


class ColumnMostCommonValue(ColumnAggregateMetricProvider):
    metric_name = "column.most_common_value"

    @column_aggregate_value(engine=PandasExecutionEngine)
    def _pandas(cls, column, **kwargs):
        mode_list = list(column.mode().values)
        return mode_list

    @metric_value(engine=SparkDFExecutionEngine)
    def _spark(
        cls,
        execution_engine: "SqlAlchemyExecutionEngine",
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        column_value_counts = metrics.get("column.value_counts")
        return list(
            column_value_counts[column_value_counts == column_value_counts.max()].index
        )

    @metric_value(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(
        cls,
        execution_engine: "SqlAlchemyExecutionEngine",
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        column_value_counts = metrics.get("column.value_counts")
        return list(
            column_value_counts[column_value_counts == column_value_counts.max()].index
        )

    @classmethod
    def _get_evaluation_dependencies(
        cls,
        metric: MetricConfiguration,
        configuration: Optional[ExpectationConfiguration] = None,
        execution_engine: Optional[ExecutionEngine] = None,
        runtime_configuration: Optional[Dict] = None,
    ):
        """Returns a dictionary of given metric names and their corresponding configuration,
        specifying the metric types and their respective domains"""
        dependencies: dict = super()._get_evaluation_dependencies(
            metric=metric,
            configuration=configuration,
            execution_engine=execution_engine,
            runtime_configuration=runtime_configuration,
        )

        if isinstance(
            execution_engine, (SparkDFExecutionEngine, SqlAlchemyExecutionEngine)
        ):
            dependencies["column.value_counts"] = MetricConfiguration(
                metric_name="column.value_counts",
                metric_domain_kwargs=metric.metric_domain_kwargs,
                metric_value_kwargs={
                    "sort": "value",
                    "collate": None,
                },
            )

        return dependencies
