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
Define Random Number function

Returns a column with random values
between 0 and 100 to help us draw sample
data.
"""

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import GenericFunction, sum

from metadata.orm_profiler.metrics.core import CACHE
from metadata.orm_profiler.orm.registry import Dialects


class SumFn(GenericFunction):
    name = "sum"
    inherit_cache = CACHE


@compiles(SumFn, Dialects.BigQuery)
def _(element, compiler, **kw):
    """Handle case for empty table. If empty, clickhouse returns NaN"""
    proc = compiler.process(element.clauses, **kw)
    return "SUM(CAST(%s AS NUMERIC))" % proc
