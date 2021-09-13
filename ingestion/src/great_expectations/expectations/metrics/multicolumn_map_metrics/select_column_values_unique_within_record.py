import logging
from functools import reduce

from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
    SqlAlchemyExecutionEngine,
)
from great_expectations.expectations.metrics.import_manager import F, sa
from great_expectations.expectations.metrics.map_metric_provider import (
    MulticolumnMapMetricProvider,
    multicolumn_condition_partial,
)

logger = logging.getLogger(__name__)


class SelectColumnValuesUniqueWithinRecord(MulticolumnMapMetricProvider):
    condition_metric_name = "select_column_values.unique.within_record"
    condition_domain_keys = (
        "batch_id",
        "table",
        "column_list",
        "row_condition",
        "condition_parser",
        "ignore_row_if",
    )

    @multicolumn_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column_list, **kwargs):
        num_columns = len(column_list.columns)
        row_wise_cond = column_list.nunique(dropna=False, axis=1) >= num_columns
        return row_wise_cond

    @multicolumn_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column_list, **kwargs):
        """
        The present approach relies on an inefficient query condition construction implementation, whose computational
        cost is O(num_columns^2).  However, until a more efficient implementation compatible with SQLAlchemy is
        available, this is the only feasible mechanism under the current architecture, where map metric providers must
        return a condition.  Nevertheless, SQL query length limit is 1GB (sufficient for most practical scenarios).
        """
        num_columns = len(column_list)

        # An arbitrary "num_columns" value used for issuing an explanatory message as a warning.
        if num_columns > 100:
            logger.warning(
                f"""Batch data with {num_columns} columns is detected.  Computing the "{cls.condition_metric_name}" \
metric for wide tables using SQLAlchemy leads to long WHERE clauses for the underlying database engine to process.
"""
            )

        conditions = sa.or_(
            *(
                sa.or_(
                    column_list[idx_src] == column_list[idx_dest],
                    sa.and_(
                        column_list[idx_src] == None, column_list[idx_dest] == None
                    ),
                )
                for idx_src in range(num_columns - 1)
                for idx_dest in range(idx_src + 1, num_columns)
            )
        )
        row_wise_cond = sa.not_(sa.or_(conditions))
        return row_wise_cond

    @multicolumn_condition_partial(engine=SparkDFExecutionEngine)
    def _spark(cls, column_list, **kwargs):
        column_names = column_list.columns
        num_columns = len(column_names)

        conditions = []
        for idx_src in range(num_columns - 1):
            for idx_dest in range(idx_src + 1, num_columns):
                conditions.append(
                    F.col(column_names[idx_src]).eqNullSafe(
                        F.col(column_names[idx_dest])
                    )
                )

        row_wise_cond = ~reduce(lambda a, b: a | b, conditions)
        return row_wise_cond
