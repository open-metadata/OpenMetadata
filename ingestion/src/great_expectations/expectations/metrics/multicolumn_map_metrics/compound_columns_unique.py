from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
    SqlAlchemyExecutionEngine,
)
from great_expectations.expectations.metrics.import_manager import F, Window, sa
from great_expectations.expectations.metrics.map_metric_provider import (
    MulticolumnMapMetricProvider,
    multicolumn_condition_partial,
)


class CompoundColumnsUnique(MulticolumnMapMetricProvider):
    condition_metric_name = "compound_columns.unique"
    condition_domain_keys = (
        "batch_id",
        "table",
        "column_list",
        "row_condition",
        "condition_parser",
        "ignore_row_if",
    )

    # TODO: <Alex>ALEX -- only Pandas and Spark implementations are provided (SQLAlchemy to follow).</Alex>
    @multicolumn_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column_list, **kwargs):
        row_wise_cond = ~column_list.duplicated(keep=False)
        return row_wise_cond

    @multicolumn_condition_partial(engine=SparkDFExecutionEngine)
    def _spark(cls, column_list, **kwargs):
        column_names = column_list.columns
        row_wise_cond = (
            F.count(F.lit(1)).over(Window.partitionBy(F.struct(*column_names))) <= 1
        )
        return row_wise_cond
