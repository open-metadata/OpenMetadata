"""
Define match regular expression fucntion
Given a value(usually a stirng or column neame) and a regex
Return true if the value contains part that matches the regex
"""

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.expression import FunctionElement

from metadata.orm_profiler.metrics.core import CACHE
from metadata.orm_profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class MatchRegexFn(FunctionElement):
    inherit_cache = CACHE

def validate_and_compile(element,compiler,**kw):
        if len(element.clauses) != 2:
            raise ValueError("We need two elements to do regex")
        return [compiler.process(elem,**kw) for elem in element.clauses]
"""
return true if value matches regex
return error if the regex is invalid
"""


@compiles(MatchRegexFn, Dialects.BigQuery)
def _(element, compiler, **kw):
    column, regex = validate_and_compile(element, compiler, **kw)
    return "REGEXP_CONTAINS(%s, r'%s')" % (
        column,
        regex
    )


@compiles(MatchRegexFn, Dialects.Redshift)
def _(element, compiler, **kw):
    column, regex = validate_and_compile(element, compiler, **kw)
    return "%s SIMILAR TO %s )" % (
        column,
        regex
    )

@compiles(MatchRegexFn, Dialects.Snowflake)
def _(element, compiler, **kw):
    column, regex = validate_and_compile(element, compiler, **kw)
    return "%s REGEXP '%s'" % (
        column,
        regex
    )
