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
Define Cast function
"""
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.elements import ClauseElement
from sqlalchemy.sql.functions import FunctionElement
from sqlalchemy.sql.type_api import TypeEngine

from metadata.profiler.metrics.core import CACHE
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class CastFn(FunctionElement):
    inherit_cache = CACHE
    name = "CAST"

    def __init__(self, expr: ClauseElement, target_type: TypeEngine, **kwargs):
        self._target_type = target_type
        super().__init__(expr, **kwargs)


@compiles(CastFn)
def _(element, compiler, **kw):
    expr = compiler.process(element.clauses.clauses[0], **kw)
    type_name = compiler.dialect.type_compiler.process(element._target_type, **kw)

    return f"CAST({expr} AS {type_name})"
