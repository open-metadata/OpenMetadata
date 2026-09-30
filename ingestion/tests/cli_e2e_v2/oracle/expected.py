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
"""Expected OM catalog derived from authored Oracle declarations and an independent type map."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, DateTime, Numeric, Text
from sqlalchemy.dialects import oracle

from metadata.generated.schema.entity.data.table import DataType, TableType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)

from ..features.database.catalog.derive import derive_expected_service
from ..features.database.catalog.type_map import CORE_TYPE_MAP, TypeMap
from ..features.database.catalog.types import (
    ExpectedColumn,
    ExpectedService,
    ExpectedStoredProcedure,
    ExpectedTable,
)
from .baseline import build_oracle_baseline

if TYPE_CHECKING:
    from collections.abc import Collection

ORACLE_TYPE_MAP: TypeMap = {
    **CORE_TYPE_MAP,
    # Oracle has one numeric type, and the connector reports every NUMBER-backed column
    # as NUMBER regardless of the precision/scale the portable type asked for.
    oracle.NUMBER: DataType.NUMBER,
    Numeric: DataType.NUMBER,  # rendered NUMBER(p,s); CORE's DECIMAL does not apply
    BigInteger: DataType.NUMBER,  # rendered NUMBER(19); CORE's BIGINT does not apply
    # Portable types Oracle renders as something else at DDL time.
    Boolean: DataType.INT,  # rendered SMALLINT, reported as INT
    Text: DataType.CLOB,  # rendered CLOB
    DateTime: DataType.DATE,  # rendered DATE; Oracle DATE carries a time component but reports as DATE
    # Character types. VARCHAR2/NVARCHAR2 extend String; CHAR/NCHAR extend CORE's CHAR.
    # OM's DataType enum has no national-character or RAW members, so the
    # N-prefixed types collapse onto their non-national equivalents.
    oracle.VARCHAR2: DataType.VARCHAR,
    oracle.NVARCHAR2: DataType.VARCHAR,
    oracle.NCHAR: DataType.CHAR,
    oracle.CLOB: DataType.CLOB,
    oracle.NCLOB: DataType.CLOB,
    # Binary.
    oracle.RAW: DataType.BINARY,
    oracle.BLOB: DataType.BLOB,
    # Floating point. BINARY_FLOAT/BINARY_DOUBLE extend Float; NUMBER-backed FLOAT does not.
    oracle.BINARY_FLOAT: DataType.FLOAT,
    oracle.BINARY_DOUBLE: DataType.DOUBLE,
    oracle.FLOAT: DataType.FLOAT,
    # Temporal. Oracle DATE carries a time component but is still reported as DATE;
    # only an explicit TIMESTAMP column becomes TIMESTAMP.
    oracle.DATE: DataType.DATE,
    oracle.TIMESTAMP: DataType.TIMESTAMP,
}


def oracle_expected(
    service_name: str,
    *,
    schema: str,
    tables: Collection[str] | None = None,
) -> ExpectedService:
    """Return the expected Oracle catalog for ``service_name``.

    Observed naming:

    - database   ``default`` — the Oracle service name is *not* used here
    - schema     lowercase
    - tables     lowercase
    - views      lowercase
    - columns    lowercase
    - procedures UPPERCASE — the stored-procedure path reads the dictionary directly
      and does not normalise, unlike every other object

    ``tables=None`` returns the full catalog; ``tables=[...]`` filters to
    named tables only for complete-inventory filter checks.
    """
    expected = derive_expected_service(
        service_name=service_name,
        service_type=DatabaseServiceType.Oracle,
        metadata=build_oracle_baseline(schema).metadata,
        type_map=ORACLE_TYPE_MAP,
        database="default",
        views=[_expected_customer_txn_summary_view()],
        stored_procedures=[
            ExpectedStoredProcedure(name="SP_ACTIVE_CUSTOMER_COUNT"),
            ExpectedStoredProcedure(name="SP_UPDATE_CUSTOMER_STATUS"),
        ],
    )

    if tables is not None:
        kept = set(tables)
        schema_entity = expected.databases[0].schemas[0]
        schema_entity.tables[:] = [t for t in schema_entity.tables if t.name in kept]

    return expected


def _expected_customer_txn_summary_view() -> ExpectedTable:
    """Return the hand-authored ExpectedTable for the view (tableType=View).

    Columns declared manually; not in SQLAlchemy MetaData. Oracle reports every
    unscaled aggregate as NUMBER: ``COUNT(*)`` and ``COALESCE(SUM(NUMBER), 0)``
    both land as NUMBER rather than BIGINT/DECIMAL.
    """
    return ExpectedTable(
        name="customer_txn_summary",
        table_type=TableType.View,
        columns=[
            ExpectedColumn("customer_id", DataType.INT),
            ExpectedColumn("full_name", DataType.VARCHAR),
            ExpectedColumn("customer_status", DataType.VARCHAR),
            ExpectedColumn("txn_count", DataType.NUMBER),
            ExpectedColumn("total_amount", DataType.NUMBER),
        ],
    )
