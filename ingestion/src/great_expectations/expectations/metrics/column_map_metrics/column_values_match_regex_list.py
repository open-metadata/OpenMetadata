import logging

import pandas as pd

from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
)
from great_expectations.execution_engine.sqlalchemy_execution_engine import (
    SqlAlchemyExecutionEngine,
)
from great_expectations.expectations.metrics.import_manager import sa
from great_expectations.expectations.metrics.map_metric_provider import (
    ColumnMapMetricProvider,
    column_condition_partial,
)
from great_expectations.expectations.metrics.util import get_dialect_regex_expression

logger = logging.getLogger(__name__)


class ColumnValuesMatchRegexList(ColumnMapMetricProvider):
    condition_metric_name = "column_values.match_regex_list"
    condition_value_keys = (
        "regex_list",
        "match_on",
    )
    default_kwarg_values = {"match_on": "any"}

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, regex_list, match_on, **kwargs):
        regex_matches = []
        for regex in regex_list:
            regex_matches.append(column.astype(str).str.contains(regex))
        regex_match_df = pd.concat(regex_matches, axis=1, ignore_index=True)

        if match_on == "any":
            result = regex_match_df.any(axis="columns")
        elif match_on == "all":
            result = regex_match_df.all(axis="columns")
        else:
            raise ValueError("match_on must be either 'any' or 'all'")

        return result

    @column_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column, regex_list, match_on, _dialect, **kwargs):
        if match_on not in ["any", "all"]:
            raise ValueError("match_on must be any or all")

        if len(regex_list) == 0:
            raise ValueError("At least one regex must be supplied in the regex_list.")

        regex_expression = get_dialect_regex_expression(column, regex_list[0], _dialect)
        if regex_expression is None:
            logger.warning("Regex is not supported for dialect %s" % str(_dialect))
            raise NotImplementedError

        if match_on == "any":
            condition = sa.or_(
                *(
                    get_dialect_regex_expression(column, regex, _dialect)
                    for regex in regex_list
                )
            )
        else:
            condition = sa.and_(
                *(
                    get_dialect_regex_expression(column, regex, _dialect)
                    for regex in regex_list
                )
            )
        return condition

    @column_condition_partial(engine=SparkDFExecutionEngine)
    def _spark(cls, column, regex_list, match_on, **kwargs):
        if match_on == "any":
            return column.rlike("|".join(regex_list))
        elif match_on == "all":
            formatted_regex_list = [f"(?={regex})" for regex in regex_list]
            return column.rlike("".join(formatted_regex_list))
        else:
            raise ValueError("match_on must be either 'any' or 'all'")
