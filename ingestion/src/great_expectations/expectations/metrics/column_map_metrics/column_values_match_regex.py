import logging

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
from great_expectations.expectations.metrics.util import get_dialect_regex_expression

logger = logging.getLogger(__name__)


class ColumnValuesMatchRegex(ColumnMapMetricProvider):
    condition_metric_name = "column_values.match_regex"
    condition_value_keys = ("regex",)

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, regex, **kwargs):
        return column.astype(str).str.contains(regex)

    @column_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column, regex, _dialect, **kwargs):
        regex_expression = get_dialect_regex_expression(column, regex, _dialect)
        if regex_expression is None:
            logger.warning(
                "Regex is not supported for dialect %s" % str(_dialect.dialect.name)
            )
            raise NotImplementedError

        return regex_expression

    @column_condition_partial(engine=SparkDFExecutionEngine)
    def _spark(cls, column, regex, **kwargs):
        return column.rlike(regex)
