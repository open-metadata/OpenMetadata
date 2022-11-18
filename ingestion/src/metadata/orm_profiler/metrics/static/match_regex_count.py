"""
Match Regex Metric definition
"""
# pylint: disable=duplicate-code

from sqlalchemy import case, column, text

from metadata.orm_profiler.metrics.core import StaticMetric, _label
from metadata.orm_profiler.orm.functions.regex_match import MatchRegexFn
from metadata.orm_profiler.orm.functions.sum import SumFn


class MatchRegexCount(StaticMetric):
    """
    MATCH_REGEX_COUNT Metric

    Given a column, and an expression, return the number of
    rows that match it

    This Metric needs to be initialised passing the expression to check
    add_props(expression="j%")(Metrics.MATCH_REGEX_COUNT.value)
    """

    expression: str

    @classmethod
    def name(cls):
        return "matchRegexCount"

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        if not hasattr(self, "expression"):
            raise AttributeError(
                "Match Regex Count requires an expression to be set: add_props(expression=...)(Metrics.MATCH_REGEX_COUNT)"
            )
        return SumFn(case([(MatchRegexFn(column(self.col.name), text(self.expression)), 1)], else_=0))
