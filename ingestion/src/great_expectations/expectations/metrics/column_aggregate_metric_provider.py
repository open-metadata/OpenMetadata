import logging
from functools import wraps
from typing import Any, Callable, Dict, Optional, Type

import great_expectations.exceptions as ge_exceptions
from great_expectations.core import ExpectationConfiguration
from great_expectations.execution_engine import ExecutionEngine, PandasExecutionEngine
from great_expectations.execution_engine.execution_engine import (
    MetricDomainTypes,
    MetricPartialFunctionTypes,
)
from great_expectations.execution_engine.sparkdf_execution_engine import (
    SparkDFExecutionEngine,
)
from great_expectations.execution_engine.sqlalchemy_execution_engine import (
    SqlAlchemyExecutionEngine,
    sa,
)
from great_expectations.expectations.metrics import DeprecatedMetaMetricProvider
from great_expectations.expectations.metrics.metric_provider import (
    metric_partial,
    metric_value,
)
from great_expectations.expectations.metrics.table_metric_provider import (
    TableMetricProvider,
)
from great_expectations.validator.validation_graph import MetricConfiguration

logger = logging.getLogger(__name__)


def column_aggregate_value(
    engine: Type[ExecutionEngine],
    metric_fn_type="value",
    domain_type="column",
    **kwargs,
):
    """Return the column aggregate metric decorator for the specified engine.

    Args:
        engine:
        **kwargs:

    Returns:

    """
    if issubclass(engine, PandasExecutionEngine):

        def wrapper(metric_fn: Callable):
            @metric_value(
                engine=PandasExecutionEngine,
                metric_fn_type=metric_fn_type,
                domain_type=domain_type,
            )
            @wraps(metric_fn)
            def inner_func(
                cls,
                execution_engine: PandasExecutionEngine,
                metric_domain_kwargs: Dict,
                metric_value_kwargs: Dict,
                metrics: Dict[str, Any],
                runtime_configuration: Dict,
            ):
                filter_column_isnull = kwargs.get(
                    "filter_column_isnull", getattr(cls, "filter_column_isnull", False)
                )

                df, _, accessor_domain_kwargs = execution_engine.get_compute_domain(
                    domain_kwargs=metric_domain_kwargs, domain_type=domain_type
                )

                column_name = accessor_domain_kwargs["column"]

                if column_name not in metrics["table.columns"]:
                    raise ge_exceptions.ExecutionEngineError(
                        message=f'Error: The column "{column_name}" in BatchData does not exist.'
                    )

                if filter_column_isnull:
                    df = df[df[column_name].notnull()]

                return metric_fn(
                    cls,
                    column=df[column_name],
                    **metric_value_kwargs,
                    _metrics=metrics,
                )

            return inner_func

        return wrapper
    else:
        raise ValueError(
            "column_aggregate_value decorator only supports PandasExecutionEngine"
        )


def column_aggregate_partial(engine: Type[ExecutionEngine], **kwargs):
    """Return the column aggregate metric decorator for the specified engine.

    Args:
        engine:
        **kwargs:

    Returns:

    """
    partial_fn_type = MetricPartialFunctionTypes.AGGREGATE_FN
    domain_type = MetricDomainTypes.COLUMN
    if issubclass(engine, SqlAlchemyExecutionEngine):

        def wrapper(metric_fn: Callable):
            @metric_partial(
                engine=SqlAlchemyExecutionEngine,
                partial_fn_type=partial_fn_type,
                domain_type=domain_type,
            )
            @wraps(metric_fn)
            def inner_func(
                cls,
                execution_engine: SqlAlchemyExecutionEngine,
                metric_domain_kwargs: Dict,
                metric_value_kwargs: Dict,
                metrics: Dict[str, Any],
                runtime_configuration: Dict,
            ):
                filter_column_isnull = kwargs.get(
                    "filter_column_isnull", getattr(cls, "filter_column_isnull", False)
                )
                if filter_column_isnull:
                    compute_domain_kwargs = execution_engine.add_column_row_condition(
                        metric_domain_kwargs
                    )
                else:
                    # We do not copy here because if compute domain is different, it will be copied by get_compute_domain
                    compute_domain_kwargs = metric_domain_kwargs
                (
                    selectable,
                    compute_domain_kwargs,
                    accessor_domain_kwargs,
                ) = execution_engine.get_compute_domain(
                    compute_domain_kwargs, domain_type=domain_type
                )

                column_name: str = accessor_domain_kwargs["column"]

                sqlalchemy_engine: sa.engine.Engine = execution_engine.engine

                if column_name not in metrics["table.columns"]:
                    raise ge_exceptions.ExecutionEngineError(
                        message=f'Error: The column "{column_name}" in BatchData does not exist.'
                    )

                dialect = sqlalchemy_engine.dialect
                metric_aggregate = metric_fn(
                    cls,
                    column=sa.column(column_name),
                    **metric_value_kwargs,
                    _dialect=dialect,
                    _table=selectable,
                    _column_name=column_name,
                    _sqlalchemy_engine=sqlalchemy_engine,
                    _metrics=metrics,
                )
                return metric_aggregate, compute_domain_kwargs, accessor_domain_kwargs

            return inner_func

        return wrapper

    elif issubclass(engine, SparkDFExecutionEngine):

        def wrapper(metric_fn: Callable):
            @metric_partial(
                engine=SparkDFExecutionEngine,
                partial_fn_type=partial_fn_type,
                domain_type=domain_type,
            )
            @wraps(metric_fn)
            def inner_func(
                cls,
                execution_engine: SparkDFExecutionEngine,
                metric_domain_kwargs: Dict,
                metric_value_kwargs: Dict,
                metrics: Dict[str, Any],
                runtime_configuration: Dict,
            ):
                filter_column_isnull = kwargs.get(
                    "filter_column_isnull", getattr(cls, "filter_column_isnull", False)
                )

                if filter_column_isnull:
                    compute_domain_kwargs = execution_engine.add_column_row_condition(
                        metric_domain_kwargs
                    )
                else:
                    # We do not copy here because if compute domain is different, it will be copied by get_compute_domain
                    compute_domain_kwargs = metric_domain_kwargs

                (
                    data,
                    compute_domain_kwargs,
                    accessor_domain_kwargs,
                ) = execution_engine.get_compute_domain(
                    domain_kwargs=compute_domain_kwargs, domain_type=domain_type
                )

                column_name = accessor_domain_kwargs["column"]

                if column_name not in metrics["table.columns"]:
                    raise ge_exceptions.ExecutionEngineError(
                        message=f'Error: The column "{column_name}" in BatchData does not exist.'
                    )

                column = data[column_name]
                metric_aggregate = metric_fn(
                    cls,
                    column=column,
                    **metric_value_kwargs,
                    _table=data,
                    _column_name=column_name,
                    _metrics=metrics,
                )
                return metric_aggregate, compute_domain_kwargs, accessor_domain_kwargs

            return inner_func

        return wrapper

    else:
        raise ValueError("Unsupported engine for column_aggregate_partial")


class ColumnAggregateMetricProvider(TableMetricProvider):
    domain_keys = (
        "batch_id",
        "table",
        "column",
        "row_condition",
        "condition_parser",
    )
    filter_column_isnull = False

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
        dependencies["table.columns"] = MetricConfiguration(
            metric_name="table.columns",
            metric_domain_kwargs=table_domain_kwargs,
            metric_value_kwargs=None,
            metric_dependencies=None,
        )
        return dependencies


class ColumnMetricProvider(
    ColumnAggregateMetricProvider, metaclass=DeprecatedMetaMetricProvider
):
    _DeprecatedMetaMetricProvider__alias = ColumnAggregateMetricProvider
