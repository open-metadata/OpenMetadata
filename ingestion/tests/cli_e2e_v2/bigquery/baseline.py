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
"""BigQuery-native tables, seeds, constraints, view and procedure in one owned dataset."""

from __future__ import annotations

import sqlalchemy_bigquery as bq
from sqlalchemy import JSON, Column, MetaData, Table

from ..features.database.common_baseline import (
    COMMON_CUSTOMER_ROWS,
    COMMON_TRANSACTION_ROWS,
    build_common_metadata,
)
from ..features.database.source import SqlSourceBaseline, TableSeed


def qualified_dataset(project: str, dataset: str) -> str:
    preparer = bq.BigQueryDialect().identifier_preparer
    return f"{preparer.quote_identifier(project)}.{preparer.quote_identifier(dataset)}"


# -----------------------------------------------------------------------------
# all_types — BigQuery-native types (exercises connector type mapping)
# -----------------------------------------------------------------------------


def _declare_all_types(md: MetaData) -> Table:
    return Table(
        "all_types",
        md,
        Column("id", bq.INT64, primary_key=True, nullable=False),
        Column("int_col", bq.INT64, nullable=True),
        Column("float_col", bq.FLOAT64, nullable=True),
        Column("numeric_col", bq.NUMERIC(10, 2), nullable=True),
        Column("bignumeric_col", bq.BIGNUMERIC(40, 10), nullable=True),
        Column("bool_col", bq.BOOL, nullable=True),
        Column("string_col", bq.STRING, nullable=True),
        Column("bytes_col", bq.BYTES, nullable=True),
        Column("date_col", bq.DATE, nullable=True),
        Column("datetime_col", bq.DATETIME, nullable=True),
        Column("time_col", bq.TIME, nullable=True),
        Column("timestamp_col", bq.TIMESTAMP, nullable=True),
        Column("json_col", JSON, nullable=True),
        Column("geography_col", bq.GEOGRAPHY, nullable=True),
        # REPEATED fields cannot hold NULL; BigQuery stores an absent array as [].
        Column("array_col", bq.ARRAY(bq.STRING), nullable=True),
        Column("struct_col", bq.STRUCT(x=bq.INT64, y=bq.STRING), nullable=True),
    )


# JSON, GEOGRAPHY, ARRAY and STRUCT values cannot be bound as typed DB-API parameters,
# so the native row is inserted as one literal DML statement.
_NATIVE_ROW = (
    "(1, 123456, 1.5, NUMERIC '1234.56', BIGNUMERIC '12345.6789', TRUE, 'text value', b'bytes value', "
    "DATE '2026-01-02', DATETIME '2026-01-02 12:34:56', TIME '12:34:56', TIMESTAMP '2026-01-02 12:34:56+00', "
    """JSON '{"kind": "fixture", "count": 2}', ST_GEOGPOINT(1, 2), ['a', 'b'], STRUCT(7 AS x, 'seven' AS y))"""
)
_NULL_ROW = "({id}, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, [], NULL)"


def build_bigquery_baseline(project: str, dataset: str) -> SqlSourceBaseline:
    """Declare a fresh baseline for exactly one BigQuery dataset."""
    quoted = qualified_dataset(project, dataset)
    metadata = build_common_metadata(dataset)
    _declare_all_types(metadata)
    seeds = [TableSeed("customers", COMMON_CUSTOMER_ROWS), TableSeed("transactions", COMMON_TRANSACTION_ROWS)]

    # The dialect drops PK/FK clauses from CREATE TABLE; BigQuery accepts them only as NOT ENFORCED.
    ddl = [
        f"ALTER TABLE {quoted}.customers ADD PRIMARY KEY (id) NOT ENFORCED",
        f"ALTER TABLE {quoted}.transactions ADD PRIMARY KEY (id) NOT ENFORCED",
        f"""
        ALTER TABLE {quoted}.transactions
        ADD CONSTRAINT fk_transactions_customer FOREIGN KEY (customer_id)
        REFERENCES {quoted}.customers(id) NOT ENFORCED
    """,
        f"ALTER TABLE {quoted}.all_types ADD PRIMARY KEY (id) NOT ENFORCED",
        f"""
        INSERT INTO {quoted}.all_types VALUES
        {_NATIVE_ROW},
        {_NULL_ROW.format(id=2)},
        {_NULL_ROW.format(id=3)}
    """,
        f"""
        CREATE VIEW {quoted}.customer_txn_summary AS
        SELECT
            c.id AS customer_id,
            c.full_name,
            c.status AS customer_status,
            COUNT(t.id) AS txn_count,
            COALESCE(SUM(t.amount), 0) AS total_amount
        FROM {quoted}.customers c
        LEFT JOIN {quoted}.transactions t ON c.id = t.customer_id
        GROUP BY c.id, c.full_name, c.status
    """,
        f"""
        CREATE PROCEDURE {quoted}.sp_active_customer_count()
        BEGIN
            SELECT COUNT(*) AS active_count
            FROM {quoted}.customers
            WHERE status = 'active';
        END
    """,
    ]
    return SqlSourceBaseline(metadata=metadata, seeds=seeds, ddl=ddl)
