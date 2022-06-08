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
Custom types' registry for easy access
without having an import mess
"""
import sqlalchemy
from sqlalchemy import Integer, Numeric
from sqlalchemy.sql.sqltypes import Concatenable, Enum

from metadata.ingestion.source import sqa_types
from metadata.orm_profiler.orm.types.hex_byte_string import HexByteString
from metadata.orm_profiler.orm.types.uuid import UUIDString
from metadata.orm_profiler.registry import TypeRegistry


class CustomTypes(TypeRegistry):
    BYTES = HexByteString
    UUID = UUIDString


class Dialects(Enum):
    """
    Map the service types from DatabaseServiceType
    to the dialect scheme name used for ingesting
    and profiling data.
    """

    Hive = b"hive"  # Hive requires bytes
    Postgres = "postgresql"
    BigQuery = "bigquery"
    MySQL = "mysql"
    Redshift = "redshift"
    Snowflake = "snowflake"
    MSSQL = "mssql"
    Oracle = "oracle"
    Athena = "awsathena"
    Presto = "presto"
    Trino = "trino"
    Vertica = "vertica"
    Glue = "glue"
    MariaDB = "mariadb"
    Druid = "druid"
    Db2 = "db2"
    ClickHouse = "clickhouse"
    Databricks = "databricks"
    DynamoDB = "dynamoDB"
    AzureSQL = "azuresql"
    SingleStore = "singlestore"
    SQLite = "sqlite"


# Sometimes we want to skip certain types for computing metrics.
# If the type is NULL, then we won't run the metric execution
# in the profiler.
# Note that not mapped types are set to NULL by default.
NOT_COMPUTE = {
    sqlalchemy.types.NullType,
    sqlalchemy.ARRAY,
    sqlalchemy.JSON,
    sqa_types.SQAMap,
    sqa_types.SQAStruct,
    sqa_types.SQASet,
    sqa_types.SQAUnion,
    sqa_types.SQASGeography,
}


# Now, let's define some helper methods to identify
# the nature of an SQLAlchemy type
def is_integer(_type) -> bool:
    """
    Check if sqlalchemy _type is derived from Integer
    """
    return issubclass(_type.__class__, Integer)


def is_numeric(_type) -> bool:
    """
    Check if sqlalchemy _type is derived from Numeric
    """
    return issubclass(_type.__class__, Numeric)


def is_quantifiable(_type) -> bool:
    """
    Check if sqlalchemy _type is either integer or numeric
    """
    return is_numeric(_type) or is_integer(_type)


def is_concatenable(_type) -> bool:
    """
    Check if sqlalchemy _type is derived from Concatenable
    e.g., strings or text
    """
    return issubclass(_type.__class__, Concatenable)
