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
import math
from enum import Enum

import sqlalchemy
from sqlalchemy import Date, DateTime, Integer, Numeric, Time
from sqlalchemy.sql.sqltypes import Concatenable

from metadata.generated.schema.entity.data.table import DataType
from metadata.ingestion.source import sqa_types
from metadata.profiler.orm.types.bytea_to_string import ByteaToHex
from metadata.profiler.orm.types.custom_array import CustomArray
from metadata.profiler.orm.types.custom_datetimerange import CustomDateTimeRange
from metadata.profiler.orm.types.custom_hex_byte_string import HexByteString
from metadata.profiler.orm.types.custom_image import CustomImage
from metadata.profiler.orm.types.custom_ip import CustomIP
from metadata.profiler.orm.types.custom_time import CustomTime
from metadata.profiler.orm.types.custom_timestamp import CustomTimestamp
from metadata.profiler.orm.types.undetermined_type import UndeterminedType
from metadata.profiler.orm.types.uuid import UUIDString
from metadata.profiler.registry import TypeRegistry


class CustomTypes(TypeRegistry):
    BYTES = HexByteString
    UUID = UUIDString
    BYTEA = ByteaToHex
    ARRAY = CustomArray
    TIMESTAMP = CustomTimestamp
    IMAGE = CustomImage
    IP = CustomIP
    SQADATETIMERANGE = CustomDateTimeRange
    UNDETERMINED = UndeterminedType
    TIME = CustomTime


class PythonDialects(Enum):
    """
    Map the service types from DatabaseServiceType
    to the dialect scheme name used for ingesting
    and profiling data.

    Keep this alphabetically ordered
    """

    # pylint: disable=invalid-name

    Athena = "awsathena"
    AzureSQL = "azuresql"
    BigQuery = "bigquery"
    ClickHouse = "clickhouse"
    Databricks = "databricks"
    Db2 = "db2"
    Doris = "pydoris"
    Druid = "druid"
    DynamoDB = "dynamoDB"
    Glue = "glue"
    Hana = "hana"
    Hive = "hive"
    Impala = "impala"
    IbmDbSa = "ibm_db_sa"
    Ibmi = "ibmi"
    MariaDB = "mariadb"
    MSSQL = "mssql"
    MySQL = "mysql"
    Oracle = "oracle"
    Postgres = "postgresql"
    Presto = "presto"
    Redshift = "redshift"
    SingleStore = "singlestore"
    SQLite = "sqlite"
    Snowflake = "snowflake"
    Trino = "trino"
    Vertica = "vertica"


class EnumAdapter(type):
    """A hack to use the Dialects string values can be accesses
    without using the value attribute.

    Example:
        Dialets.MySQL == "mysql"

    Instead of:
        Dialects.MySQL.value == "mysql"

    We use this functionality when registring sqlalchemy custom functions. But we should
    avoid using this pattern as it can be confusing.
    """

    def __getattr__(cls, item):
        return PythonDialects[item].value


class Dialects(metaclass=EnumAdapter):
    pass


# Sometimes we want to skip certain types for computing metrics.
# If the type is NULL, then we won't run the metric execution
# in the profiler.
# Note that not mapped types are set to NULL by default.
NOT_COMPUTE = {
    sqlalchemy.types.NullType.__name__,
    sqlalchemy.ARRAY.__name__,
    sqlalchemy.JSON.__name__,
    sqa_types.SQAMap.__name__,
    sqa_types.SQAStruct.__name__,
    sqa_types.SQASet.__name__,
    sqa_types.SQAUnion.__name__,
    sqa_types.SQASGeography.__name__,
    DataType.GEOMETRY.value,
    DataType.ARRAY.value,
    DataType.JSON.value,
    CustomTypes.ARRAY.value.__name__,
    CustomTypes.SQADATETIMERANGE.value.__name__,
    DataType.XML.value,
    CustomTypes.UNDETERMINED.value.__name__,
}
FLOAT_SET = {sqlalchemy.types.DECIMAL, sqlalchemy.types.FLOAT}

QUANTIFIABLE_SET = {
    DataType.INT.value,
    DataType.BIGINT.value,
    DataType.SMALLINT.value,
    DataType.NUMERIC.value,
    DataType.NUMBER.value,
    DataType.DECIMAL.value,
    DataType.FLOAT.value,
    DataType.TINYINT.value,
    DataType.DOUBLE.value,
    DataType.LONG.value,
}

CONCATENABLE_SET = {DataType.STRING.value, DataType.TEXT.value}


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


def is_date_time(_type) -> bool:
    """
    Check if sqlalchemy _type is derived from Date, Time or DateTime Type
    """
    if isinstance(_type, DataType):
        return _type.value in {
            DataType.DATETIME.value,
            DataType.TIME.value,
            DataType.DATE.value,
        }
    return (
        issubclass(_type.__class__, Date)
        or issubclass(_type.__class__, Time)
        or issubclass(_type.__class__, DateTime)
        or issubclass(_type.__class__, CustomTimestamp)
    )


def is_quantifiable(_type) -> bool:
    """
    Check if sqlalchemy _type is either integer or numeric
    """
    if isinstance(_type, DataType):
        return _type.value in QUANTIFIABLE_SET
    return (
        is_numeric(_type) or is_integer(_type) or getattr(_type, "quantifiable", False)
    )


def is_concatenable(_type) -> bool:
    """
    Check if sqlalchemy _type is derived from Concatenable
    e.g., strings or text
    """
    if isinstance(_type, DataType):
        return _type.value in CONCATENABLE_SET
    return issubclass(_type.__class__, Concatenable)


def is_value_non_numeric(value) -> bool:
    try:
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return True
        return False
    except Exception:
        return False
