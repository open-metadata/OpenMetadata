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
Databend profiler SQL generation.

Databend does not register `RANDOM` (only `rand`) or `percentile_cont` (it uses the
ClickHouse-style parametric `quantile_cont(<p>)(<col>)`), so the generic compilations
of these two functions would fail to resolve the function name.
"""

import pytest
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase

from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.functions.median import MedianFn
from metadata.profiler.orm.functions.random_num import RandomNumFn
from metadata.profiler.orm.registry import Dialects


class Base(DeclarativeBase):
    pass


class Customers(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    value = Column(Integer)


@pytest.fixture(name="databend_dialect")
def databend_dialect_fixture():
    """Compile-only engine; no connection is established."""
    return create_engine("databend://").dialect


def test_databend_is_a_registered_dialect():
    """Without this entry the @compiles(..., Dialects.Databend) hooks cannot register."""
    assert Dialects.Databend == "databend"


def test_dialect_name_matches_the_registered_dialect(databend_dialect):
    """The override only applies if the driver's dialect name equals the enum value."""
    assert databend_dialect.name == Dialects.Databend


def test_length_uses_length_not_len(databend_dialect):
    sql = str(
        LenFn(Customers.name).compile(
            dialect=databend_dialect,
            compile_kwargs={"literal_binds": True},
        )
    )

    assert sql == "LENGTH(customers.name)"
    assert "LEN(" not in sql


def test_random_num_uses_rand_not_random(databend_dialect):
    sql = str(RandomNumFn().compile(dialect=databend_dialect, compile_kwargs={"literal_binds": True}))

    assert sql == "CAST(RAND() * 100 AS INT)"
    assert "RANDOM()" not in sql


@pytest.mark.parametrize("percentile", [0.25, 0.5, 0.75])
def test_median_uses_parametric_quantile_cont(databend_dialect, percentile):
    median = MedianFn(Customers.value, Customers.__tablename__, percentile)

    sql = str(median.compile(dialect=databend_dialect, compile_kwargs={"literal_binds": True}))

    assert sql == f"quantile_cont({percentile})(customers.value)"
    assert "percentile_cont" not in sql
    assert "WITHIN GROUP" not in sql
