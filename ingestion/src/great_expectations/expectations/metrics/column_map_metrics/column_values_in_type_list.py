import numpy as np
import pandas as pd

from great_expectations.execution_engine import PandasExecutionEngine
from great_expectations.expectations.core.expect_column_values_to_be_of_type import (
    _native_type_type_map,
)
from great_expectations.expectations.metrics.map_metric_provider import (
    ColumnMapMetricProvider,
    column_condition_partial,
)


class ColumnValuesInTypeList(ColumnMapMetricProvider):
    condition_metric_name = "column_values.in_type_list"
    condition_value_keys = ("type_list",)

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, type_list, **kwargs):
        comp_types = []
        for type_ in type_list:
            try:
                comp_types.append(np.dtype(type_).type)
            except TypeError:
                try:
                    pd_type = getattr(pd, type_)
                    if isinstance(pd_type, type):
                        comp_types.append(pd_type)
                except AttributeError:
                    pass

                try:
                    pd_type = getattr(pd.core.dtypes.dtypes, type_)
                    if isinstance(pd_type, type):
                        comp_types.append(pd_type)
                except AttributeError:
                    pass

            native_type = _native_type_type_map(type_)
            if native_type is not None:
                comp_types.extend(native_type)

        if len(comp_types) < 1:
            raise ValueError("No recognized numpy/python type in list: %s" % type_list)

        return column.map(lambda x: isinstance(x, tuple(comp_types)))
