from datetime import datetime

from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
)
from great_expectations.expectations.metrics.import_manager import F, sparktypes
from great_expectations.expectations.metrics.map_metric_provider import (
    ColumnMapMetricProvider,
    column_condition_partial,
)


class ColumnValuesMatchStrftimeFormat(ColumnMapMetricProvider):
    condition_metric_name = "column_values.match_strftime_format"
    condition_value_keys = ("strftime_format",)

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, strftime_format, **kwargs):
        def is_parseable_by_format(val):
            try:
                datetime.strptime(val, strftime_format)
                return True
            except TypeError:
                raise TypeError(
                    "Values passed to expect_column_values_to_match_strftime_format must be of type string.\nIf you want to validate a column of dates or timestamps, please call the expectation before converting from string format."
                )
            except ValueError:
                return False

        return column.map(is_parseable_by_format)

    @column_condition_partial(engine=SparkDFExecutionEngine)
    def _spark(cls, column, strftime_format, **kwargs):
        # Below is a simple validation that the provided format can both format and parse a datetime object.
        # %D is an example of a format that can format but not parse, e.g.
        try:
            datetime.strptime(
                datetime.strftime(datetime.now(), strftime_format), strftime_format
            )
        except ValueError as e:
            raise ValueError(f"Unable to use provided strftime_format: {str(e)}")

        def is_parseable_by_format(val):
            if val is None:
                return False
            try:
                datetime.strptime(val, strftime_format)
                return True
            except TypeError:
                raise TypeError(
                    "Values passed to expect_column_values_to_match_strftime_format must be of type string.\nIf you want to validate a column of dates or timestamps, please call the expectation before converting from string format."
                )
            except ValueError:
                return False

        success_udf = F.udf(is_parseable_by_format, sparktypes.BooleanType())
        return success_udf(column)
