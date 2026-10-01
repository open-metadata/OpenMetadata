#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Postgres source declarations, including the native types covered by v1."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CHAR, BigInteger, Boolean, Column, Date, Integer, Numeric, SmallInteger, String, Table, Text
from sqlalchemy.dialects import postgresql

from ..features.database.common_baseline import (
    COMMON_CUSTOMER_ROWS,
    COMMON_TRANSACTION_ROWS,
    build_common_metadata,
)
from ..features.database.source import SqlSourceBaseline, TableSeed


def build_postgres_baseline(schema: str) -> SqlSourceBaseline:
    metadata = build_common_metadata(schema)
    metadata.tables[f"{schema}.customers"].comment = "Customer master table used by Postgres CLI E2E."
    Table(
        "all_datatypes",
        metadata,
        Column("column1", BigInteger),
        Column("column2", BigInteger, nullable=False),
        Column("column5", Boolean),
        Column("column6", CHAR(10)),
        Column("column7", String(10)),
        Column("column8", Date),
        Column("column9", postgresql.DOUBLE_PRECISION),
        Column("column10", Integer),
        Column("column11", postgresql.INTERVAL),
        Column("column12", postgresql.JSON),
        Column("column13", postgresql.JSONB),
        Column("column14", Numeric(10, 2)),
        Column("column15", postgresql.REAL),
        Column("column16", SmallInteger),
        Column("column17", SmallInteger, nullable=False),
        Column("column28", Integer, nullable=False),
        Column("column29", Text),
        Column("column20", postgresql.TIME),
        Column("column21", postgresql.TIME(timezone=True)),
        Column("column22", postgresql.TIMESTAMP),
        Column("column23", postgresql.TIMESTAMP(timezone=True)),
        Column("column24", postgresql.UUID(as_uuid=True)),
    )
    quote = postgresql.dialect().identifier_preparer.quote_identifier
    owned = quote(schema)
    columns = (
        "column1 bigint, column2 bigserial, column5 boolean, column6 character(10), "
        "column7 character varying(10), column8 date, column9 double precision, "
        "column10 integer, column11 interval, column12 json, column13 jsonb, "
        "column14 numeric(10,2), column15 real, column16 smallint, "
        "column17 smallserial, column28 serial, column29 text, "
        "column20 time without time zone, column21 time with time zone, "
        "column22 timestamp without time zone, column23 timestamp with time zone, column24 uuid"
    )
    row = {
        "column1": 1,
        "column2": 2,
        "column5": True,
        "column6": "abcdefghij",
        "column7": "abcdefghij",
        "column8": date(2022, 8, 8),
        "column9": 1234.5678,
        "column10": 1234567890,
        "column11": timedelta(days=1, hours=2, minutes=3, seconds=4),
        "column12": {"a": 1, "b": 2},
        "column13": {"a": 1, "b": 2},
        "column14": Decimal("1234.56"),
        "column15": 1234.5678,
        "column16": 32767,
        "column17": 32767,
        "column28": 2147483647,
        "column29": "abcdefghij",
        "column20": time(12, 34, 56),
        "column21": time(12, 34, 56, tzinfo=timezone(timedelta(hours=2))),
        "column22": datetime(2022, 8, 8, 12, 34, 56),
        "column23": datetime(2022, 8, 8, 12, 34, 56, tzinfo=timezone(timedelta(hours=2))),
        "column24": UUID("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"),
    }
    return SqlSourceBaseline(
        metadata=metadata,
        seeds=[
            TableSeed("customers", COMMON_CUSTOMER_ROWS),
            TableSeed("transactions", COMMON_TRANSACTION_ROWS),
            TableSeed("all_datatypes", [row]),
        ],
        ddl=[
            f"CREATE TABLE {owned}.all_datatypes ({columns})",
            f"CREATE VIEW {owned}.view_all_datatypes AS SELECT * FROM {owned}.all_datatypes",
        ],
    )
