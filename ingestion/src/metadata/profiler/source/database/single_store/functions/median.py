"""Median function for single store"""

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.profiler.metrics.core import CACHE


class SingleStoreMedianFn(FunctionElement):
    inherit_cache = CACHE


@compiles(SingleStoreMedianFn)
def _(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    clauses = elements.clauses.clauses
    col = compiler.process(clauses[0])
    table = clauses[1].value
    percentile = clauses[2].value
    dimension_col = clauses[3].value if len(clauses) > 3 else None
    if dimension_col:
        return (
            f"(SELECT approx_percentile({col}, {percentile:.2f}) "
            f"FROM {table} AS median_inner "
            f"WHERE median_inner.{dimension_col} = {table}.{dimension_col})"
        )
    return f"approx_percentile({col}, {percentile:.2f})"
