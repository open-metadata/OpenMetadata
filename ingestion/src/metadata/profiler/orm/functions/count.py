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
Define Count function
"""
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement
from sqlalchemy.sql.sqltypes import NVARCHAR, TEXT

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.orm.types.custom_hex_byte_string import HexByteString

# Keep SQA docs style defining custom constructs
# pylint: disable=consider-using-f-string,duplicate-code
from metadata.profiler.orm.types.custom_image import CustomImage
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class CountFn(FunctionElement):
    inherit_cache = CACHE


@compiles(CountFn)
def _(element, compiler, **kw):
    return compiler.process(element.clauses, **kw)


@compiles(CountFn, Dialects.Oracle)
def _(element, compiler, **kw):
    col_type = element.clauses.clauses[0].type
    if isinstance(col_type, HexByteString):
        return f"DBMS_LOB.GETLENGTH({compiler.process(element.clauses, **kw)})"
    return compiler.process(element.clauses, **kw)


@compiles(CountFn, Dialects.MSSQL)
def _(element, compiler, **kw):
    col_type = element.clauses.clauses[0].type
    if isinstance(col_type, (NVARCHAR, TEXT)):
        return "cast(%s as [nvarchar])" % compiler.process(element.clauses, **kw)
    if isinstance(col_type, CustomImage):
        return "cast(%s as [varbinary])" % compiler.process(element.clauses, **kw)
    return compiler.process(element.clauses, **kw)
