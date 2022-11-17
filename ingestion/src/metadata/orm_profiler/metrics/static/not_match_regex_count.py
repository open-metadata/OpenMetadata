"""
NOT Match Regex Metric definition
"""
# pylint: disable=duplicate-code

from sqlalchemy import case, column, text

from metadata.orm_profiler.metrics.core import StaticMetric, _label
from metadata.orm_profiler.orm.functions.regex_match import MatchRegexFn
from metadata.orm_profiler.orm.functions.sum import SumFn


class NotMatchRegexCount(StaticMetric):
    """
    NOT_MATCH_REGEX_COUNT Metric

    Given a column, and an expression, return the number of
    rows that match the forbidden regex pattern

    This Metric needs to be initialised passing the expression to check
    add_props(expression="j%")(Metrics.NOT_MATCH_REGEX_COUNT.value)
    """

    expression: str

    @classmethod
    def name(cls):
        return "notMatchRegexCount"

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        if not hasattr(self, "expression"):
            raise AttributeError(
                "Not Match Regex Count requires an expression to be set: add_props(expression=...)(Metrics.NOT_MATCH_REGEX_COUNT)"
            )
        return SumFn(case([(MatchRegexFn(column(self.col.name),text(self.expression), 0)], else_=1))
