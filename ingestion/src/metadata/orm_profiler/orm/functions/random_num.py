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
from sqlalchemy.sql.functions import FunctionElement

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.orm_profiler.metrics.core import CACHE
from metadata.orm_profiler.utils import logger

logger = logger()


class RandomNumFn(FunctionElement):
    def params(self, *optionaldict, **kwargs):
        return None

    def unique_params(self, *optionaldict, **kwargs):
        return None

    inherit_cache = CACHE


@compiles(RandomNumFn)
def _(*_, **__):
    return "ABS(RANDOM()) * 100"


@compiles(RandomNumFn, DatabaseServiceType.MySQL.value.lower())
def _(*_, **__):
    return "ABS(RAND()) * 100"


@compiles(RandomNumFn, DatabaseServiceType.SQLite.value.lower())
def _(*_, **__):
    """
    SQLite random returns a number between -9223372036854775808
    and +9223372036854775807, so no need to multiply by 100.
    """
    return "ABS(RANDOM()) % 100"


@compiles(RandomNumFn, DatabaseServiceType.MSSQL.value.lower())
def _(*_, **__):
    """
    MSSQL RANDOM() function returns the same single
    value for all the columns. Therefore, we cannot
    use it for a random sample.
    """
    return "ABS(CHECKSUM(NewId()))"
