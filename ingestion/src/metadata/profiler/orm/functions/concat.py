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
Define Concat function
"""
from typing import List

from sqlalchemy import literal
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

# Keep SQA docs style defining custom constructs
# pylint: disable=consider-using-f-string,duplicate-code


logger = profiler_logger()


class ConcatFn(FunctionElement):
    inherit_cache = CACHE


@compiles(ConcatFn)
def _(element, compiler, **kw):
    return "CONCAT(%s)" % compiler.process(element.clauses, **kw)


@compiles(ConcatFn, Dialects.Redshift)
@compiles(ConcatFn, Dialects.SQLite)
@compiles(ConcatFn, Dialects.Vertica)
def _(element, compiler, **kw):
    if len(element.clauses) < 2:
        raise ValueError("We need to concat at least two elements")

    concat = "||".join([compiler.process(elem, **kw) for elem in element.clauses])

    return concat


@compiles(ConcatFn, Dialects.PinotDB)
def _(element, compiler, **kw):
    """Concatenate list of values.

    PinotDB's string concatenation function's signature looks like this:

    CONCAT(first_value: VARCHAR, second_value: VARCHAR, seperator: VARCHAR) -> VARCHAR.

    Examples:

    > CONCAT('Foo', 'Bar', ' ') -> 'Foo Bar'
    > CONCAT('Foo', ' - ', 'Bar') -> 'FooBar - '

    This function turns a sequence into the correct nested sequence of CONCAT calls
    to achieve the expected concatenation of other languages
    """

    if len(element.clauses) < 2:
        raise ValueError("We need to concat at least two elements")

    def _concat(values: List[str]) -> str:
        if len(values) == 1:
            return values[0]
        elif len(values) == 2:
            return _concat([values[0], compiler.process(literal(""), **kw), values[1]])
        elif len(values) == 3:
            first_value, second_value, third_value = values
            return f"CONCAT({first_value}, {third_value}, {second_value})"
        else:
            first_value, second_value, *rest = values
            return f"CONCAT({first_value}, {_concat(rest)}, {second_value})"

    elements = [compiler.process(el, **kw) for el in element.clauses]

    return _concat(elements)
