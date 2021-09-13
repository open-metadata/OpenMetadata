import numpy as np
import pandas as pd

from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
)
from great_expectations.execution_engine.sqlalchemy_execution_engine import (
    SqlAlchemyExecutionEngine,
)
from great_expectations.expectations.metrics.map_metric_provider import (
    ColumnMapMetricProvider,
    column_condition_partial,
)
from great_expectations.expectations.metrics.util import parse_value_set


class ColumnValuesNotInSet(ColumnMapMetricProvider):
    condition_metric_name = "column_values.not_in_set"
    condition_value_keys = (
        "value_set",
        "parse_strings_as_datetimes",
    )

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, value_set, **kwargs):
        if value_set is None:
            # Vacuously true
            return np.ones(len(column), dtype=np.bool_)
        if pd.api.types.is_datetime64_any_dtype(column):
            parsed_value_set = parse_value_set(value_set=value_set)
        else:
            parsed_value_set = value_set

        return ~column.isin(parsed_value_set)

    @column_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column, value_set, parse_strings_as_datetimes, **kwargs):
        if parse_strings_as_datetimes:
            parsed_value_set = parse_value_set(value_set)
        else:
            parsed_value_set = value_set

        if parsed_value_set is None or len(parsed_value_set) == 0:
            return True

        return column.notin_(tuple(parsed_value_set))

    @column_condition_partial(engine=SparkDFExecutionEngine)
    def _spark(cls, column, value_set, **kwargs):
        return ~column.isin(value_set)
