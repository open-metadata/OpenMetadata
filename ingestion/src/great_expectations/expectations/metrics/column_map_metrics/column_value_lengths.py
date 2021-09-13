from typing import Optional

from great_expectations.core import ExpectationConfiguration
from great_expectations.execution_engine import (
    ExecutionEngine,
    PandasExecutionEngine,
    SparkDFExecutionEngine,
)
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


class ColumnValuesValueLengthEquals(ColumnMapMetricProvider):
    condition_metric_name = "column_values.value_length.equals"
    condition_value_keys = ("value",)

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, value, _metrics, **kwargs):
        column_lengths, _, _ = _metrics.get("column_values.value_length.map")
        return column_lengths == value

    @column_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column, value, _metrics, **kwargs):
        column_lengths, _, _ = _metrics.get("column_values.value_length.map")
        return column_lengths == value

    @column_condition_partial(engine=SparkDFExecutionEngine)
    def _spark(cls, column, value, _metrics, **kwargs):
        column_lengths, _, _ = _metrics.get("column_values.value_length.map")
        return column_lengths == value

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

        if metric.metric_name == "column_values.value_length.equals.condition":
            dependencies["column_values.value_length.map"] = MetricConfiguration(
                metric_name="column_values.value_length.map",
                metric_domain_kwargs=metric.metric_domain_kwargs,
            )

        return dependencies


class ColumnValuesValueLength(ColumnMapMetricProvider):
    condition_metric_name = "column_values.value_length.between"
    function_metric_name = "column_values.value_length"

    condition_value_keys = (
        "min_value",
        "max_value",
        "strict_min",
        "strict_max",
    )

    @column_function_partial(engine=PandasExecutionEngine)
    def _pandas_function(cls, column, **kwargs):
        return column.astype(str).str.len()

    @column_function_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy_function(cls, column, **kwargs):
        return sa.func.length(column)

    @column_function_partial(engine=SparkDFExecutionEngine)
    def _spark_function(cls, column, **kwargs):
        return F.length(column)

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(
        cls,
        column,
        _metrics,
        min_value=None,
        max_value=None,
        strict_min=None,
        strict_max=None,
        **kwargs
    ):
        column_lengths, _, _ = _metrics.get("column_values.value_length.map")

        metric_series = None
        if min_value is not None and max_value is not None:
            if strict_min and strict_max:
                metric_series = column_lengths.between(
                    min_value, max_value, inclusive=False
                )
            elif strict_min and not strict_max:
                metric_series = (column_lengths > min_value) & (
                    column_lengths <= max_value
                )
            elif not strict_min and strict_max:
                metric_series = (column_lengths >= min_value) & (
                    column_lengths < max_value
                )
            elif not strict_min and not strict_max:
                metric_series = column_lengths.between(
                    min_value, max_value, inclusive=True
                )
        elif min_value is None and max_value is not None:
            if strict_max:
                metric_series = column_lengths < max_value
            else:
                metric_series = column_lengths <= max_value
        elif min_value is not None and max_value is None:
            if strict_min:
                metric_series = column_lengths > min_value
            else:
                metric_series = column_lengths >= min_value

        else:
            raise ValueError("Invalid configuration")

        return metric_series

    @column_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(
        cls,
        column,
        _metrics,
        min_value=None,
        max_value=None,
        strict_min=None,
        strict_max=None,
        **kwargs
    ):
        column_lengths, _, _ = _metrics.get("column_values.value_length.map")

        if min_value is None and max_value is None:
            raise ValueError("min_value and max_value cannot both be None")

        # Assert that min_value and max_value are integers
        try:
            if min_value is not None and not float(min_value).is_integer():
                raise ValueError("min_value and max_value must be integers")

            if max_value is not None and not float(max_value).is_integer():
                raise ValueError("min_value and max_value must be integers")

        except ValueError:
            raise ValueError("min_value and max_value must be integers")

        if min_value is not None and max_value is not None:
            return sa.and_(
                column_lengths >= min_value,
                column_lengths <= max_value,
            )

        elif min_value is None and max_value is not None:
            return column_lengths <= max_value

        elif min_value is not None and max_value is None:
            return column_lengths >= min_value

    @column_condition_partial(engine=SparkDFExecutionEngine)
    def _spark(
        cls,
        column,
        _metrics,
        min_value=None,
        max_value=None,
        strict_min=None,
        strict_max=None,
        **kwargs
    ):
        column_lengths, _, _ = _metrics.get("column_values.value_length.map")

        if min_value is None and max_value is None:
            raise ValueError("min_value and max_value cannot both be None")

        # Assert that min_value and max_value are integers
        try:
            if min_value is not None and not float(min_value).is_integer():
                raise ValueError("min_value and max_value must be integers")

            if max_value is not None and not float(max_value).is_integer():
                raise ValueError("min_value and max_value must be integers")

        except ValueError:
            raise ValueError("min_value and max_value must be integers")

        if min_value is not None and max_value is not None:
            return (column_lengths >= min_value) & (column_lengths <= max_value)

        elif min_value is None and max_value is not None:
            return column_lengths <= max_value

        elif min_value is not None and max_value is None:
            return column_lengths >= min_value

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

        if metric.metric_name == "column_values.value_length.between.condition":
            dependencies["column_values.value_length.map"] = MetricConfiguration(
                metric_name="column_values.value_length.map",
                metric_domain_kwargs=metric.metric_domain_kwargs,
            )

        return dependencies
