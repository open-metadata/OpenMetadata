from typing import Any, Dict, Tuple

import pandas as pd

from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
    SqlAlchemyExecutionEngine,
)
from great_expectations.execution_engine.execution_engine import MetricDomainTypes
from great_expectations.expectations.metrics.column_aggregate_metric_provider import (
    ColumnAggregateMetricProvider,
)
from great_expectations.expectations.metrics.import_manager import F, sa
from great_expectations.expectations.metrics.metric_provider import metric_value


class ColumnValueCounts(ColumnAggregateMetricProvider):
    metric_name = "column.value_counts"
    value_keys = ("sort", "collate")

    default_kwarg_values = {"sort": "value", "collate": None}

    @metric_value(engine=PandasExecutionEngine)
    def _pandas(
        cls,
        execution_engine: PandasExecutionEngine,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        sort = metric_value_kwargs.get("sort", cls.default_kwarg_values["sort"])
        collate = metric_value_kwargs.get(
            "collate", cls.default_kwarg_values["collate"]
        )

        if sort not in ["value", "count", "none"]:
            raise ValueError("sort must be either 'value', 'count', or 'none'")
        if collate is not None:
            raise ValueError("collate parameter is not supported in PandasDataset")

        df, _, accessor_domain_kwargs = execution_engine.get_compute_domain(
            metric_domain_kwargs, MetricDomainTypes.COLUMN
        )
        column = accessor_domain_kwargs["column"]

        counts = df[column].value_counts()
        if sort == "value":
            try:
                counts.sort_index(inplace=True)
            except TypeError:
                # Having values of multiple types in a object dtype column (e.g., strings and floats)
                # raises a TypeError when the sorting method performs comparisons.
                if df[column].dtype == object:
                    counts.index = counts.index.astype(str)
                    counts.sort_index(inplace=True)
        elif sort == "counts":
            counts.sort_values(inplace=True)
        counts.name = "count"
        counts.index.name = "value"
        return counts

    @metric_value(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(
        cls,
        execution_engine: SqlAlchemyExecutionEngine,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        sort = metric_value_kwargs.get("sort", cls.default_kwarg_values["sort"])
        collate = metric_value_kwargs.get(
            "collate", cls.default_kwarg_values["collate"]
        )

        if sort not in ["value", "count", "none"]:
            raise ValueError("sort must be either 'value', 'count', or 'none'")
        if collate is not None:
            raise ValueError("collate parameter is not supported in PandasDataset")

        selectable, _, accessor_domain_kwargs = execution_engine.get_compute_domain(
            metric_domain_kwargs, MetricDomainTypes.COLUMN
        )
        column = accessor_domain_kwargs["column"]

        if sort not in ["value", "count", "none"]:
            raise ValueError("sort must be either 'value', 'count', or 'none'")

        query = (
            sa.select(
                [
                    sa.column(column).label("value"),
                    sa.func.count(sa.column(column)).label("count"),
                ]
            )
            .where(sa.column(column) != None)
            .group_by(sa.column(column))
        )
        if sort == "value":
            # NOTE: depending on the way the underlying database collates columns,
            # ordering can vary. postgresql collate "C" matches default sort
            # for python and most other systems, but is not universally supported,
            # so we use the default sort for the system, unless specifically overridden
            if collate is not None:
                query = query.order_by(sa.column(column).collate(collate))
            else:
                query = query.order_by(sa.column(column))
        elif sort == "count":
            query = query.order_by(sa.column("count").desc())
        results = execution_engine.engine.execute(
            query.select_from(selectable)
        ).fetchall()
        series = pd.Series(
            [row[1] for row in results],
            index=pd.Index(data=[row[0] for row in results], name="value"),
            name="count",
        )
        return series

    @metric_value(engine=SparkDFExecutionEngine)
    def _spark(
        cls,
        execution_engine: SparkDFExecutionEngine,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        sort = metric_value_kwargs.get("sort", cls.default_kwarg_values["sort"])
        collate = metric_value_kwargs.get(
            "collate", cls.default_kwarg_values["collate"]
        )

        if sort not in ["value", "count", "none"]:
            raise ValueError("sort must be either 'value', 'count', or 'none'")
        if collate is not None:
            raise ValueError("collate parameter is not supported in SparkDFDataset")

        df, _, accessor_domain_kwargs = execution_engine.get_compute_domain(
            metric_domain_kwargs, MetricDomainTypes.COLUMN
        )
        column = accessor_domain_kwargs["column"]

        value_counts = (
            df.select(column).where(F.col(column).isNotNull()).groupBy(column).count()
        )
        if sort == "value":
            value_counts = value_counts.orderBy(column)
        elif sort == "count":
            value_counts = value_counts.orderBy(F.desc("count"))
        value_counts = value_counts.collect()
        series = pd.Series(
            [row["count"] for row in value_counts],
            index=pd.Index(data=[row[column] for row in value_counts], name="value"),
            name="count",
        )
        return series
