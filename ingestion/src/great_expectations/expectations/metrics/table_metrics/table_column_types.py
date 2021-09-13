from typing import Any, Dict, Tuple

from great_expectations.exceptions import GreatExpectationsError
from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
    SqlAlchemyExecutionEngine,
)
from great_expectations.execution_engine.execution_engine import MetricDomainTypes
from great_expectations.execution_engine.sqlalchemy_batch_data import (
    SqlAlchemyBatchData,
)
from great_expectations.expectations.metrics.import_manager import sparktypes
from great_expectations.expectations.metrics.metric_provider import metric_value
from great_expectations.expectations.metrics.table_metric_provider import (
    TableMetricProvider,
)
from great_expectations.expectations.metrics.util import get_sqlalchemy_column_metadata

try:
    from sqlalchemy.sql.elements import TextClause
except ImportError:
    TextClause = None


class ColumnTypes(TableMetricProvider):
    metric_name = "table.column_types"
    value_keys = ("include_nested",)
    default_kwarg_values = {"include_nested": True}

    @metric_value(engine=PandasExecutionEngine)
    def _pandas(
        cls,
        execution_engine: PandasExecutionEngine,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        df, _, _ = execution_engine.get_compute_domain(
            metric_domain_kwargs, domain_type=MetricDomainTypes.TABLE
        )
        return [
            {"name": name, "type": dtype}
            for (name, dtype) in zip(df.columns, df.dtypes)
        ]

    @metric_value(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(
        cls,
        execution_engine: SqlAlchemyExecutionEngine,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        batch_id = metric_domain_kwargs.get("batch_id")
        if batch_id is None:
            if execution_engine.active_batch_data_id is not None:
                batch_id = execution_engine.active_batch_data_id
            else:
                raise GreatExpectationsError(
                    "batch_id could not be determined from domain kwargs and no active_batch_data is loaded into the "
                    "execution engine"
                )
        batch_data = execution_engine.loaded_batch_data_dict.get(batch_id)
        if batch_data is None:
            raise GreatExpectationsError(
                "the requested batch is not available; please load the batch into the execution engine."
            )
        return _get_sqlalchemy_column_metadata(execution_engine.engine, batch_data)

    @metric_value(engine=SparkDFExecutionEngine)
    def _spark(
        cls,
        execution_engine: SparkDFExecutionEngine,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        metrics: Dict[Tuple, Any],
        runtime_configuration: Dict,
    ):
        df, _, _ = execution_engine.get_compute_domain(
            metric_domain_kwargs, domain_type=MetricDomainTypes.TABLE
        )
        return _get_spark_column_metadata(
            df.schema, include_nested=metric_value_kwargs["include_nested"]
        )


def _get_sqlalchemy_column_metadata(engine, batch_data: SqlAlchemyBatchData):
    # if a custom query was passed
    if isinstance(batch_data.selectable, TextClause):
        table_selectable: TextClause = batch_data.selectable
        schema_name = None
    else:
        table_selectable: str = (
            batch_data.source_table_name or batch_data.selectable.name
        )
        schema_name = batch_data.source_schema_name or batch_data.selectable.schema
    return get_sqlalchemy_column_metadata(
        engine=engine,
        table_selectable=table_selectable,
        schema_name=schema_name,
    )


def _get_spark_column_metadata(field, parent_name="", include_nested=True):
    cols = []
    if parent_name != "":
        parent_name = parent_name + "."

    if isinstance(field, sparktypes.StructType):
        for child in field.fields:
            cols += _get_spark_column_metadata(child, parent_name=parent_name)
    elif isinstance(field, sparktypes.StructField):
        if "." in field.name:
            name = parent_name + "`" + field.name + "`"
        else:
            name = parent_name + field.name
        field_metadata = {"name": name, "type": field.dataType}
        cols.append(field_metadata)
        if include_nested and isinstance(field.dataType, sparktypes.StructType):
            for child in field.dataType.fields:
                cols += _get_spark_column_metadata(
                    child,
                    parent_name=parent_name + field.name,
                    include_nested=include_nested,
                )
    else:
        raise ValueError("unrecognized field type")

    return cols
