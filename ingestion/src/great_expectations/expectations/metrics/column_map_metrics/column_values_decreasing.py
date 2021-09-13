from typing import Any, Dict, Optional, Tuple

from great_expectations.core import ExpectationConfiguration
from great_expectations.execution_engine import (
    ExecutionEngine,
    PandasExecutionEngine,
    SparkDFExecutionEngine,
)
from great_expectations.execution_engine.execution_engine import (
    MetricDomainTypes,
    MetricPartialFunctionTypes,
)
from great_expectations.expectations.metrics.import_manager import F, Window, sparktypes
from great_expectations.expectations.metrics.map_metric_provider import (
    ColumnMapMetricProvider,
    column_condition_partial,
)
from great_expectations.expectations.metrics.metric_provider import (
    metric_partial,
    metric_value,
)
from great_expectations.validator.validation_graph import MetricConfiguration


class ColumnValuesDecreasing(ColumnMapMetricProvider):
    condition_metric_name = "column_values.decreasing"
    condition_value_keys = ("strictly",)
    default_kwarg_values = {"strictly": False}

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, strictly, **kwargs):
        series_diff = column.diff()
        # The first element is null, so it gets a bye and is always treated as True
        series_diff[series_diff.isnull()] = -1

        if strictly:
            return series_diff < 0
        else:
            return series_diff <= 0

    @metric_partial(
        engine=SparkDFExecutionEngine,
        partial_fn_type=MetricPartialFunctionTypes.WINDOW_CONDITION_FN,
        domain_type=MetricDomainTypes.COLUMN,
    )
    def _spark(
        cls,
        execution_engine: SparkDFExecutionEngine,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        # check if column is any type that could have na (numeric types)
        column_name = metric_domain_kwargs["column"]
        table_columns = metrics["table.column_types"]
        column_metadata = [col for col in table_columns if col["name"] == column_name][
            0
        ]
        if isinstance(
            column_metadata["type"],
            (
                sparktypes.LongType,
                sparktypes.DoubleType,
                sparktypes.IntegerType,
            ),
        ):
            # if column is any type that could have NA values, remove them (not filtered by .isNotNull())
            compute_domain_kwargs = execution_engine.add_column_row_condition(
                metric_domain_kwargs,
                filter_null=cls.filter_column_isnull,
                filter_nan=True,
            )
        else:
            compute_domain_kwargs = metric_domain_kwargs

        (
            df,
            compute_domain_kwargs,
            accessor_domain_kwargs,
        ) = execution_engine.get_compute_domain(
            compute_domain_kwargs, MetricDomainTypes.COLUMN
        )

        # NOTE: 20201105 - parse_strings_as_datetimes is not supported here;
        # instead detect types naturally
        column = F.col(column_name)
        if isinstance(
            column_metadata["type"], (sparktypes.TimestampType, sparktypes.DateType)
        ):
            diff = F.datediff(
                column, F.lag(column).over(Window.orderBy(F.lit("constant")))
            )
        else:
            diff = column - F.lag(column).over(Window.orderBy(F.lit("constant")))
            diff = F.when(diff.isNull(), -1).otherwise(diff)

        # NOTE: because in spark we are implementing the window function directly,
        # we have to return the *unexpected* condition
        if metric_value_kwargs["strictly"]:
            return (
                F.when(diff >= 0, F.lit(True)).otherwise(F.lit(False)),
                compute_domain_kwargs,
                accessor_domain_kwargs,
            )
        # If we expect values to be flat or decreasing then unexpected values are those
        # that are decreasing
        else:
            return (
                F.when(diff > 0, F.lit(True)).otherwise(F.lit(False)),
                compute_domain_kwargs,
                accessor_domain_kwargs,
            )

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
        table_domain_kwargs: dict = {
            k: v for k, v in metric.metric_domain_kwargs.items() if k != "column"
        }
        dependencies["table.column_types"] = MetricConfiguration(
            metric_name="table.column_types",
            metric_domain_kwargs=table_domain_kwargs,
            metric_value_kwargs={
                "include_nested": True,
            },
            metric_dependencies=None,
        )
        return dependencies
