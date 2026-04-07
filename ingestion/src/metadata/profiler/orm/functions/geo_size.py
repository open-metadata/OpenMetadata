#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Defines the SQL function to compute the number of points in a geometry/geography column.
"""

# Keep SQA docs style defining custom constructs
# pylint: disable=consider-using-f-string

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects


class GeoSizeFn(FunctionElement):
    """Returns the number of points in a geometry/geography column using ST_NPoints."""

    inherit_cache = CACHE


@compiles(GeoSizeFn)
@compiles(GeoSizeFn, Dialects.SQLite)
def _(element, compiler, **kw):
    return "NULL"


@compiles(GeoSizeFn, Dialects.Postgres)
@compiles(GeoSizeFn, Dialects.Cockroach)
def _(element, compiler, **kw):
    return "ST_NPoints(%s)" % compiler.process(element.clauses, **kw)


@compiles(GeoSizeFn, Dialects.BigQuery)
def _(element, compiler, **kw):
    return "ST_NumPoints(%s)" % compiler.process(element.clauses, **kw)


@compiles(GeoSizeFn, Dialects.MySQL)
@compiles(GeoSizeFn, Dialects.MariaDB)
def _(element, compiler, **kw):
    return "ST_NumPoints(%s)" % compiler.process(element.clauses, **kw)
