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
Define ValueRank function
"""
# Keep SQA docs style defining custom constructs
# pylint: disable=consider-using-f-string,duplicate-code
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.profiler.metrics.core import CACHE
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class ValueRankFn(FunctionElement):
    inherit_cache = CACHE


@compiles(ValueRankFn)
def _(element, compiler, **kw):
    """Generic SQL compiler"""
    proc = compiler.process(element.clauses, **kw)
    return f"ROW_NUMBER() OVER (ORDER BY COUNT({proc}) DESC)"
