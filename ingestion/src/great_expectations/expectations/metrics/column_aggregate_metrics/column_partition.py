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
    column_aggregate_partial,
    column_aggregate_value,
)
from great_expectations.expectations.metrics.metric_provider import metric_value
from great_expectations.validator.validation_graph import MetricConfiguration


class ColumnPartition(ColumnAggregateMetricProvider):
    metric_name = "column.partition"
    value_keys = ("bins", "n_bins", "allow_relative_error")
    default_kwarg_values = {
        "bins": "uniform",
        "n_bins": 10,
        "allow_relative_error": False,
    }

    @metric_value(engine=PandasExecutionEngine)
    def _pandas(
        cls,
        execution_engine: PandasExecutionEngine,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        bins = metric_value_kwargs.get("bins", cls.default_kwarg_values["bins"])
        n_bins = metric_value_kwargs.get("n_bins", cls.default_kwarg_values["n_bins"])
        return _get_column_partition_using_metrics(bins, n_bins, metrics)

    @metric_value(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(
        cls,
        execution_engine: PandasExecutionEngine,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        bins = metric_value_kwargs.get("bins", cls.default_kwarg_values["bins"])
        n_bins = metric_value_kwargs.get("n_bins", cls.default_kwarg_values["n_bins"])
        return _get_column_partition_using_metrics(bins, n_bins, metrics)

    @metric_value(engine=SparkDFExecutionEngine)
    def _spark(
        cls,
        execution_engine: PandasExecutionEngine,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        bins = metric_value_kwargs.get("bins", cls.default_kwarg_values["bins"])
        n_bins = metric_value_kwargs.get("n_bins", cls.default_kwarg_values["n_bins"])
        return _get_column_partition_using_metrics(bins, n_bins, metrics)

    @classmethod
    def _get_evaluation_dependencies(
        cls,
        metric: MetricConfiguration,
        configuration: Optional[ExpectationConfiguration] = None,
        execution_engine: Optional[ExecutionEngine] = None,
        runtime_configuration: Optional[dict] = None,
    ):
        bins = metric.metric_value_kwargs.get("bins", cls.default_kwarg_values["bins"])
        n_bins = metric.metric_value_kwargs.get(
            "n_bins", cls.default_kwarg_values["n_bins"]
        )
        allow_relative_error = metric.metric_value_kwargs["allow_relative_error"]

        dependencies: dict = super()._get_evaluation_dependencies(
            metric=metric,
            configuration=configuration,
            execution_engine=execution_engine,
            runtime_configuration=runtime_configuration,
        )

        if bins == "uniform":
            dependencies["column.min"] = MetricConfiguration(
                metric_name="column.min",
                metric_domain_kwargs=metric.metric_domain_kwargs,
            )
            dependencies["column.max"] = MetricConfiguration(
                metric_name="column.max",
                metric_domain_kwargs=metric.metric_domain_kwargs,
            )
        elif bins in ["ntile", "quantile", "percentile"]:
            dependencies["column.quantile_values"] = MetricConfiguration(
                metric_name="column.quantile_values",
                metric_domain_kwargs=metric.metric_domain_kwargs,
                metric_value_kwargs={
                    "quantiles": np.linspace(start=0, stop=1, num=n_bins + 1).tolist(),
                    "allow_relative_error": allow_relative_error,
                },
            )
        elif bins == "auto":
            dependencies["column_values.nonnull.count"] = MetricConfiguration(
                metric_name="column_values.nonnull.count",
                metric_domain_kwargs=metric.metric_domain_kwargs,
            )
            dependencies["column.quantile_values"] = MetricConfiguration(
                metric_name="column.quantile_values",
                metric_domain_kwargs=metric.metric_domain_kwargs,
                metric_value_kwargs={
                    "quantiles": (0.0, 0.25, 0.75, 1.0),
                    "allow_relative_error": allow_relative_error,
                },
            )
        else:
            raise ValueError("Invalid parameter for bins argument")

        return dependencies


def _get_column_partition_using_metrics(bins, n_bins, _metrics):
    if bins == "uniform":
        min_ = _metrics["column.min"]
        max_ = _metrics["column.max"]
        # PRECISION NOTE: some implementations of quantiles could produce
        # varying levels of precision (e.g. a NUMERIC column producing
        # Decimal from a SQLAlchemy source, so we cast to float for numpy)
        bins = np.linspace(start=float(min_), stop=float(max_), num=n_bins + 1).tolist()
    elif bins in ["ntile", "quantile", "percentile"]:
        bins = _metrics["column.quantile_values"]
    elif bins == "auto":
        # Use the method from numpy histogram_bin_edges
        nonnull_count = _metrics["column_values.nonnull.count"]
        sturges = np.log2(nonnull_count + 1)
        min_, _25, _75, max_ = _metrics["column.quantile_values"]
        iqr = _75 - _25
        if iqr < 1e-10:  # Consider IQR 0 and do not use variance-based estimator
            n_bins = sturges
        else:
            fd = (2 * float(iqr)) / (nonnull_count ** (1 / 3))
            n_bins = max(int(np.ceil(sturges)), int(np.ceil(float(max_ - min_) / fd)))
        bins = np.linspace(start=float(min_), stop=float(max_), num=n_bins + 1).tolist()
    else:
        raise ValueError("Invalid parameter for bins argument")
    return bins
