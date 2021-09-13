from dateutil.parser import parse

from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
    SqlAlchemyExecutionEngine,
)
from great_expectations.expectations.metrics.import_manager import sa
from great_expectations.expectations.metrics.map_metric_provider import (
    ColumnPairMapMetricProvider,
    column_pair_condition_partial,
)


class ColumnPairValuesAGreaterThanB(ColumnPairMapMetricProvider):
    condition_metric_name = "column_pair_values.a_greater_than_b"
    condition_domain_keys = (
        "batch_id",
        "table",
        "column_A",
        "column_B",
        "row_condition",
        "condition_parser",
        "ignore_row_if",
    )
    condition_value_keys = (
        "or_equal",
        "parse_strings_as_datetimes",
        "allow_cross_type_comparisons",
    )

    # noinspection PyPep8Naming
    @column_pair_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column_A, column_B, **kwargs):
        allow_cross_type_comparisons = kwargs.get("allow_cross_type_comparisons")
        if allow_cross_type_comparisons:
            raise NotImplementedError

        parse_strings_as_datetimes = kwargs.get("parse_strings_as_datetimes")
        if parse_strings_as_datetimes:
            temp_column_A = column_A.map(parse)
            temp_column_B = column_B.map(parse)
        else:
            temp_column_A = column_A
            temp_column_B = column_B

        or_equal = kwargs.get("or_equal")
        if or_equal:
            return temp_column_A >= temp_column_B
        else:
            return temp_column_A > temp_column_B

    # noinspection PyPep8Naming
    @column_pair_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column_A, column_B, **kwargs):
        allow_cross_type_comparisons = kwargs.get("allow_cross_type_comparisons")
        if allow_cross_type_comparisons:
            raise NotImplementedError

        parse_strings_as_datetimes = kwargs.get("parse_strings_as_datetimes")
        if parse_strings_as_datetimes:
            raise NotImplementedError

        or_equal = kwargs.get("or_equal")
        if or_equal:
            return sa.or_(
                column_A >= column_B, sa.and_(column_A == None, column_B == None)
            )
        else:
            return column_A > column_B

    # noinspection PyPep8Naming
    @column_pair_condition_partial(engine=SparkDFExecutionEngine)
    def _spark(cls, column_A, column_B, **kwargs):
        allow_cross_type_comparisons = kwargs.get("allow_cross_type_comparisons")
        if allow_cross_type_comparisons:
            raise NotImplementedError

        parse_strings_as_datetimes = kwargs.get("parse_strings_as_datetimes")
        if parse_strings_as_datetimes:
            raise NotImplementedError

        or_equal = kwargs.get("or_equal")
        if or_equal:
            return (column_A >= column_B) | (column_A.eqNullSafe(column_B))
        else:
            return column_A > column_B
