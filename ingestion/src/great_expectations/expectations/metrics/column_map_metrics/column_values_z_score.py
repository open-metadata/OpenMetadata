from typing import Optional

import pandas as pd

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
from great_expectations.expectations.metrics.import_manager import F, sa
from great_expectations.expectations.metrics.map_metric_provider import (
    ColumnMapMetricProvider,
    column_condition_partial,
    column_function_partial,
)
from great_expectations.validator.validation_graph import MetricConfiguration


class ColumnValuesZScore(ColumnMapMetricProvider):
    condition_metric_name = "column_values.z_score.under_threshold"
    condition_value_keys = (
        "double_sided",
        "threshold",
    )
    default_kwarg_values = {"double_sided": True, "threshold": None}

    function_metric_name = "column_values.z_score"
    function_value_keys = tuple()

    @column_function_partial(engine=PandasExecutionEngine)
    def _pandas_function(self, column, _metrics, **kwargs):
        # return the z_score values
        mean = _metrics.get("column.mean")
        std_dev = _metrics.get("column.standard_deviation")
        try:
            return (column - mean) / std_dev
        except TypeError:
            raise (
                TypeError(
                    "Cannot complete Z-score calculations on a non-numerical column."
                )
            )

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas_condition(
        cls, column, _metrics, threshold, double_sided, **kwargs
    ) -> pd.Series:
        z_score, _, _ = _metrics["column_values.z_score.map"]
        try:
            if double_sided:
                under_threshold = z_score.abs() < abs(threshold)
            else:
                under_threshold = z_score < threshold
            return under_threshold
        except TypeError:
            raise (
                TypeError("Cannot check if a string lies under a numerical threshold")
            )

    @column_function_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy_function(cls, column, _metrics, _dialect, **kwargs):
        mean = _metrics["column.mean"]
        standard_deviation = _metrics["column.standard_deviation"]
        return (column - mean) / standard_deviation

    @column_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy_condition(cls, column, _metrics, threshold, double_sided, **kwargs):

        z_score, _, _ = _metrics["column_values.z_score.map"]
        if double_sided:
            under_threshold = sa.func.abs(z_score) < abs(threshold)
        else:
            under_threshold = z_score < threshold

        return under_threshold

    @column_function_partial(engine=SparkDFExecutionEngine)
    def _spark_function(cls, column, _metrics, **kwargs):
        mean = _metrics["column.mean"]
        standard_deviation = _metrics["column.standard_deviation"]

        return (column - mean) / standard_deviation

    @column_condition_partial(engine=SparkDFExecutionEngine)
    def _spark_condition(cls, column, _metrics, threshold, double_sided, **kwargs):
        z_score, _, _ = _metrics["column_values.z_score.map"]

        if double_sided:
            threshold = abs(threshold)
            z_score = F.abs(z_score)

        return z_score < threshold

    @classmethod
    def _get_evaluation_dependencies(
        cls,
        metric: MetricConfiguration,
        configuration: Optional[ExpectationConfiguration] = None,
        execution_engine: Optional[ExecutionEngine] = None,
        runtime_configuration: Optional[dict] = None,
    ):
        """Returns a dictionary of given metric names and their corresponding configuration, specifying the metric
        types and their respective domains"""
        dependencies: dict = super()._get_evaluation_dependencies(
            metric=metric,
            configuration=configuration,
            execution_engine=execution_engine,
            runtime_configuration=runtime_configuration,
        )

        if metric.metric_name == "column_values.z_score.under_threshold.condition":
            dependencies["column_values.z_score.map"] = MetricConfiguration(
                metric_name="column_values.z_score.map",
                metric_domain_kwargs=metric.metric_domain_kwargs,
            )

        if metric.metric_name == "column_values.z_score.map":
            dependencies["column.mean"] = MetricConfiguration(
                metric_name="column.mean",
                metric_domain_kwargs=metric.metric_domain_kwargs,
            )
            dependencies["column.standard_deviation"] = MetricConfiguration(
                metric_name="column.standard_deviation",
                metric_domain_kwargs=metric.metric_domain_kwargs,
            )

        return dependencies
