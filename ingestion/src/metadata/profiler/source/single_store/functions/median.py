"""Median function for single store"""

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.profiler.metrics.core import CACHE


class SingleStoreMedianFn(FunctionElement):
    inherit_cache = CACHE


@compiles(SingleStoreMedianFn)
def _(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    col = compiler.process(elements.clauses.clauses[0])
    percentile = elements.clauses.clauses[2].value
    return f"approx_percentile({col}, {percentile:.2f})"
