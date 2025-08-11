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
Define a vanilla connection testing function.
This will be executed as a way to make sure
that the Engine can reach and execute in the
source.
"""
# pylint: disable=duplicate-code

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.expression import ClauseElement, Executable

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class ConnTestFn(Executable, ClauseElement):
    inherit_cache = CACHE


@compiles(ConnTestFn)
def _(*_, **__):
    return "SELECT 42"


@compiles(ConnTestFn, Dialects.Oracle)
def _(*_, **__):
    return "SELECT 42 FROM DUAL"


@compiles(ConnTestFn, Dialects.BigQuery)
def _(*_, **__):
    return "SELECT SESSION_USER()"


@compiles(ConnTestFn, Dialects.Db2)
@compiles(ConnTestFn, Dialects.IbmDbSa)
@compiles(ConnTestFn, Dialects.Ibmi)
def _(*_, **__):
    return "SELECT 42 FROM SYSIBM.SYSDUMMY1"


@compiles(ConnTestFn, Dialects.Hana)
def _(*_, **__):
    return "SELECT 42 FROM DUMMY"
