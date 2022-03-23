#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Define Concat function
"""
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.orm_profiler.metrics.core import CACHE
from metadata.orm_profiler.orm.registry import Dialects
from metadata.orm_profiler.utils import logger

logger = logger()


class ConcatFn(FunctionElement):
    inherit_cache = CACHE


@compiles(ConcatFn)
def _(element, compiler, **kw):
    return "CONCAT(%s)" % compiler.process(element.clauses, **kw)


@compiles(ConcatFn, Dialects.Redshift)
@compiles(ConcatFn, Dialects.SQLite)
@compiles(ConcatFn, Dialects.Vertica)
def _(element, compiler, **kw):
    """
    This actually returns the squared STD, but as
    it is only required for tests we can live with it.
    """

    if len(element.clauses) < 2:
        raise ValueError("We need to concat at least two elements")

    concat = "||".join([compiler.process(elem, **kw) for elem in element.clauses])

    return concat
