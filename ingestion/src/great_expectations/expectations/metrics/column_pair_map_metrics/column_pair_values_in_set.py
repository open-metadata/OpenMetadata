from functools import reduce

import numpy as np
import pandas as pd

from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
    SqlAlchemyExecutionEngine,
)
from great_expectations.execution_engine.sparkdf_execution_engine import F
from great_expectations.expectations.metrics.import_manager import sa
from great_expectations.expectations.metrics.map_metric_provider import (
    ColumnPairMapMetricProvider,
    column_pair_condition_partial,
)


class ColumnPairValuesInSet(ColumnPairMapMetricProvider):
    condition_metric_name = "column_pair_values.in_set"
    condition_value_keys = ("value_pairs_set",)
    condition_domain_keys = (
        "batch_id",
        "table",
        "column_A",
        "column_B",
        "ignore_row_if",
    )

    # noinspection PyPep8Naming
    @column_pair_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column_A, column_B, **kwargs):
        value_pairs_set = kwargs.get("value_pairs_set")

        if value_pairs_set is None:
            # vacuously true
            return np.ones(len(column_A), dtype=np.bool_)

        temp_df = pd.DataFrame({"A": column_A, "B": column_B})
        value_pairs_set = {(x, y) for x, y in value_pairs_set}

        results = []
        for i, t in temp_df.iterrows():
            if pd.isnull(t["A"]):
                a = None
            else:
                a = t["A"]

            if pd.isnull(t["B"]):
                b = None
            else:
                b = t["B"]

            results.append((a, b) in value_pairs_set)

        return pd.Series(results)

    @column_pair_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column_A, column_B, **kwargs):
        value_pairs_set = kwargs.get("value_pairs_set")

        if value_pairs_set is None:
            # vacuously true
            return sa.case([(column_A == column_B, True)], else_=True)

        value_pairs_set = [(x, y) for x, y in value_pairs_set]

        # or_ implementation was required due to mssql issues with in_
        conditions = [
            sa.or_(sa.and_(column_A == x, column_B == y)) for x, y in value_pairs_set
        ]
        row_wise_cond = sa.or_(*conditions)

        return row_wise_cond

    # noinspection PyPep8Naming
    @column_pair_condition_partial(engine=SparkDFExecutionEngine)
    def _spark(cls, column_A, column_B, **kwargs):
        value_pairs_set = kwargs.get("value_pairs_set")

        if value_pairs_set is None:
            # vacuously true
            return column_A == column_B

        value_pairs_set = [(x, y) for x, y in value_pairs_set]
        conditions = [
            (column_A.eqNullSafe(F.lit(x)) & column_B.eqNullSafe(F.lit(y)))
            for x, y in value_pairs_set
        ]
        row_wise_cond = reduce(lambda a, b: a | b, conditions)

        return row_wise_cond
