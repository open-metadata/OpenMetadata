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
"""Expected OM catalog derived from authored BigQuery declarations and an independent type map."""

from __future__ import annotations

from typing import TYPE_CHECKING

import sqlalchemy_bigquery as bq
from sqlalchemy import (
    ARRAY,
    BINARY,
    CHAR,
    JSON,
    BigInteger,
    Boolean,
    Float,
    Integer,
    LargeBinary,
    Numeric,
    SmallInteger,
    String,
    Text,
)

from metadata.generated.schema.entity.data.table import DataType, TableType
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType

from ..features.database.catalog.derive import derive_expected_tables
from ..features.database.catalog.type_map import CORE_TYPE_MAP, TypeMap
from ..features.database.catalog.types import (
    ExpectedColumn,
    ExpectedDatabase,
    ExpectedSchema,
    ExpectedService,
    ExpectedStoredProcedure,
    ExpectedTable,
)
from .baseline import build_bigquery_baseline

if TYPE_CHECKING:
    from collections.abc import Collection

BIGQUERY_TYPE_MAP: TypeMap = {
    **CORE_TYPE_MAP,
    # INT64 is BigQuery's only integer type and OM has always ingested it as INT.
    Integer: DataType.INT,
    BigInteger: DataType.INT,
    SmallInteger: DataType.INT,
    # FLOAT64 is ingested as FLOAT; BOOL as BOOLEAN; BYTES as BINARY.
    Float: DataType.FLOAT,
    Boolean: DataType.BOOLEAN,
    BINARY: DataType.BINARY,
    LargeBinary: DataType.BINARY,
    # Every character type becomes STRING, including length-bounded STRING(n).
    String: DataType.STRING,
    Text: DataType.STRING,
    CHAR: DataType.STRING,
    # Deliberately strict: NUMERIC/BIGNUMERIC carry decimals and JSON is JSON. OM has no BIGNUMERIC.
    Numeric: DataType.NUMERIC,
    JSON: DataType.JSON,
    bq.GEOGRAPHY: DataType.GEOGRAPHY,
    ARRAY: DataType.ARRAY,
    bq.STRUCT: DataType.STRUCT,
}


def bigquery_database(project: str, dataset: str, *, tables: Collection[str] | None = None) -> ExpectedDatabase:
    """Return one expected project/dataset subtree; ``tables`` narrows it for complete-inventory filters."""
    expected = derive_expected_tables(build_bigquery_baseline(project, dataset).metadata, BIGQUERY_TYPE_MAP)
    expected.append(_expected_customer_txn_summary_view())
    if tables is not None:
        kept = set(tables)
        expected = [table for table in expected if table.name in kept]
    return ExpectedDatabase(
        project,
        [
            ExpectedSchema(
                dataset,
                expected,
                stored_procedures=[ExpectedStoredProcedure(name="sp_active_customer_count")],
            )
        ],
    )


def bigquery_expected(service_name: str, *databases: ExpectedDatabase) -> ExpectedService:
    """Combine owned subtrees; projects sharing a database name merge their schemas."""
    merged: dict[str, ExpectedDatabase] = {}
    for database in databases:
        if database.name in merged:
            merged[database.name].schemas.extend(database.schemas)
        else:
            merged[database.name] = ExpectedDatabase(database.name, list(database.schemas))
    return ExpectedService(
        name=service_name, service_type=DatabaseServiceType.BigQuery, databases=list(merged.values())
    )


def _expected_customer_txn_summary_view() -> ExpectedTable:
    """Hand-authored view columns: ``COUNT`` → INT64 and ``COALESCE(SUM(NUMERIC), 0)`` → NUMERIC."""
    return ExpectedTable(
        name="customer_txn_summary",
        table_type=TableType.View,
        columns=[
            ExpectedColumn("customer_id", DataType.INT),
            ExpectedColumn("full_name", DataType.STRING),
            ExpectedColumn("customer_status", DataType.STRING),
            ExpectedColumn("txn_count", DataType.INT),
            ExpectedColumn("total_amount", DataType.NUMERIC),
        ],
    )
