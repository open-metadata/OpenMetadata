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
Test that the NullMissingCount metric only compares a column against the empty
string when the column can actually hold one.

Comparing a numeric/temporal/boolean/uuid/enum/interval/ip column with '' is a
runtime error on strict engines (Postgres, ClickHouse) and silently coerces on
MySQL and MariaDB, counting real values as missing. Container types (JSON, ARRAY)
are covered here too: they are declared supported by columnValuesMissingCount, and
an array compares against the *empty array* rather than raising, which no
"'' does not appear in the SQL" assertion can catch — hence the branch count.
"""

import pytest
from sqlalchemy import (
    ARRAY,
    BIGINT,
    CHAR,
    DECIMAL,
    JSON,
    NVARCHAR,
    TEXT,
    VARCHAR,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    Integer,
    Interval,
    MetaData,
    Numeric,
    SmallInteger,
    String,
    Table,
    Time,
    select,
)
from sqlalchemy.dialects import mysql, postgresql
from sqlalchemy.dialects.postgresql import JSONB

from metadata.generated.schema.entity.data.table import DataType
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.converter.common import CommonMapTypes
from metadata.profiler.orm.types.custom_array import CustomArray
from metadata.profiler.orm.types.custom_ip import CustomIP
from metadata.profiler.orm.types.custom_time import CustomTime
from metadata.profiler.orm.types.custom_timestamp import CustomTimestamp
from metadata.profiler.orm.types.undetermined_type import UndeterminedType
from metadata.profiler.orm.types.uuid import UUIDString

EMPTY_STRING_COMPARISON = "= ''"

DIALECTS = [postgresql.dialect(), mysql.dialect()]

# OM types listed as supported by columnValuesMissingCount that no engine can
# store an empty string in. Kept as DataType so the mapping in CommonMapTypes is
# exercised too: a converter change that reintroduces the bug fails here.
NON_EMPTY_STRING_DATA_TYPES = [
    DataType.NUMBER,
    DataType.TINYINT,
    DataType.SMALLINT,
    DataType.INT,
    DataType.BIGINT,
    DataType.BYTEINT,
    DataType.FLOAT,
    DataType.DOUBLE,
    DataType.DECIMAL,
    DataType.NUMERIC,
    DataType.TIMESTAMP,
    DataType.TIME,
    DataType.DATE,
    DataType.DATETIME,
    DataType.INTERVAL,
    DataType.BOOLEAN,
    DataType.ENUM,
    DataType.UUID,
    DataType.JSON,
    DataType.ARRAY,
]


def compile_null_missing_count(sqa_type, dialect) -> str:
    """Compile the nullMissingCount expression for a column of the given type"""
    table = Table("a_table", MetaData(), Column("a_column", sqa_type))
    metric_fn = Metrics.nullMissingCount(table.c.a_column).fn()
    return str(
        select(metric_fn).compile(
            dialect=dialect,
            compile_kwargs={"literal_binds": True},
        )
    )


def count_when_branches(query: str) -> int:
    """Number of CASE branches in the compiled metric.

    One branch means the column is only checked for NULL. Asserting on the branch
    count instead of on the literal "= ''" is what catches an array column: its
    empty-string comparison compiles to `= ARRAY[]`, so the literal never appears.
    """
    return query.count("WHEN")


def instantiate(sqa_type):
    """Array types need an item type; every other mapped type takes no arguments"""
    if issubclass(sqa_type, (ARRAY, CustomArray)):
        return sqa_type(String())
    return sqa_type()


@pytest.mark.parametrize("dialect", DIALECTS, ids=lambda d: d.name)
@pytest.mark.parametrize(
    "sqa_type",
    [
        Integer(),
        SmallInteger(),
        BIGINT(),
        Numeric(),
        DECIMAL(),
        Float(),
        Date(),
        DateTime(),
        Time(),
        CustomTimestamp(),
        CustomTime(),
        Boolean(),
        UUIDString(),
        Interval(),
        Enum("a", "b", name="an_enum"),
        CustomIP(),
        JSON(),
        JSONB(),
        ARRAY(String()),
        CustomArray(String()),
    ],
    ids=lambda t: type(t).__name__,
)
def test_no_empty_string_comparison_for_non_string_types(sqa_type, dialect):
    """A column that cannot hold '' is only checked for NULL"""
    query = compile_null_missing_count(sqa_type, dialect)

    assert "IS NULL" in query
    assert EMPTY_STRING_COMPARISON not in query
    assert count_when_branches(query) == 1


@pytest.mark.parametrize("dialect", DIALECTS, ids=lambda d: d.name)
@pytest.mark.parametrize(
    "sqa_type",
    [
        String(),
        VARCHAR(256),
        TEXT(),
        CHAR(8),
        NVARCHAR(256),
        # Fail-open contract: a type we don't recognize keeps the comparison
        UndeterminedType(),
    ],
    ids=lambda t: type(t).__name__,
)
def test_empty_string_comparison_for_string_types(sqa_type, dialect):
    """String-like and unrecognized types keep counting '' as missing"""
    query = compile_null_missing_count(sqa_type, dialect)

    assert "IS NULL" in query
    assert EMPTY_STRING_COMPARISON in query
    assert count_when_branches(query) == 2


@pytest.mark.parametrize("dialect", DIALECTS, ids=lambda d: d.name)
@pytest.mark.parametrize("data_type", NON_EMPTY_STRING_DATA_TYPES, ids=lambda dt: dt.value)
def test_supported_om_types_that_cannot_hold_empty_string(data_type, dialect):
    """Guard the OM DataType -> ORM type mapping, not just the ORM types"""
    # Reaching into _TYPE_MAP on purpose: the mapping itself is what we're pinning
    sqa_type = CommonMapTypes._TYPE_MAP[data_type]
    query = compile_null_missing_count(instantiate(sqa_type), dialect)

    assert EMPTY_STRING_COMPARISON not in query
    assert count_when_branches(query) == 1
