"""
Define match regular expression fucntion
Given a value(usually a stirng or column neame) and a regex
Return true if the value contains part that matches the regex
"""

from shutil import copyfile
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.expression import FunctionElement
from metadata.orm_profiler.metrics.core import CACHE
from metadata.orm_profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()

class MatchRegexFn(FunctionElement):
    inherit_cache = CACHE
    def __init__(self, value, regex):
        self.value = value
        self.regex = regex

"""
return true if value matches regex
return error if the regex is invalid
"""
@compiles(MatchRegexFn, Dialects.BigQuery)
def _(element, compiler, **kw):
    return "REGEXP_CONTAINS(%s, r'%s')" %(
        compiler.process(element.value, **kw),
        compiler.process(element.regex, **kw)
        )

@compiles(MatchRegexFn,Dialects.Redshift)
def _(element, compiler, **kw):
    return "%s SIMILAR TO %s )"%(
        compiler.process(element.value, **kw),
        compiler.process(element.regex, **kw)
    )


@copyfile(MatchRegexFn,Dialects.Snowflake)
def _(element, compiler, **kw):
    return "%s REGEXP '%s'"%(
        compiler.process(element.value, **kw),
        compiler.process(element.regex, **kw)
    )
