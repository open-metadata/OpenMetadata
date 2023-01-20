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

from metadata.orm_profiler.metrics.core import CACHE
from metadata.orm_profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class RandomNumFn(FunctionElement):
    def params(self, *optionaldict, **kwargs):
        return None

    def unique_params(self, *optionaldict, **kwargs):
        return None

    inherit_cache = CACHE


@compiles(RandomNumFn)
def _(*_, **__):
    return "ABS(RANDOM()) * 100"


@compiles(RandomNumFn, Dialects.Hive)
@compiles(RandomNumFn, Dialects.MySQL)
def _(*_, **__):
    return "ABS(RAND()) * 100"


@compiles(RandomNumFn, Dialects.BigQuery)
def _(*_, **__):
    return "CAST(100*RAND() AS INT64)"


@compiles(RandomNumFn, Dialects.SQLite)
def _(*_, **__):
    """
    SQLite random returns a number between -9223372036854775808
    and +9223372036854775807, so no need to multiply by 100.
    """
    return "ABS(RANDOM()) % 100"


@compiles(RandomNumFn, Dialects.MSSQL)
def _(*_, **__):
    """
    MSSQL RANDOM() function returns the same single
    value for all the columns. Therefore, we cannot
    use it for a random sample.
    """
    return "ABS(CHECKSUM(NewId()))"


@compiles(RandomNumFn, Dialects.ClickHouse)
def _(*_, **__):
    """
    ClickHouse random returns a number between 0 and 4,294,967,295.
    We need to divide it by 4294967295 to get a number between 0 and 1.
    """
    return "toInt8(RAND(10)/4294967295*100)"


@compiles(RandomNumFn, Dialects.Postgres)
def _(*_, **__):
    """Postgres random logic"""
    return "ABS((RANDOM() * 100)::INTEGER)"


@compiles(RandomNumFn, Dialects.Oracle)
def _(*_, **__):
    """Oracle random logic"""
    return "ABS(DBMS_RANDOM.VALUE) * 100"


@compiles(RandomNumFn, Dialects.Snowflake)
def _(*_, **__):
    """We use FROM <table> SAMPLE BERNOULLI (n) for sampling
    in snowflake. We'll return 0 to make sure we get all the rows
    from the already sampled results when executing row::MOD(0, 100) < profile_sample.
    """
    return "0"


@compiles(RandomNumFn, Dialects.Vertica)
def _(*_, **__):
    """
    Vertica RANDOM() returns a number 0 < n < 1 as a float.
    We need to cast it to integer to perform the modulo
    """
    return "(RANDOM() * 100)::INTEGER"
