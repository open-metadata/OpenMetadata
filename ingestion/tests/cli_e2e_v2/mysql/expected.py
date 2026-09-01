#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Expected OM-side catalog for the MySQL baseline.

Tables and columns are derived from ``MYSQL_BASELINE.metadata`` via ``MYSQL_TYPE_MAP``.
The view's ``ExpectedTable`` and stored procedures are appended manually since
they are not in SQLAlchemy MetaData. ``TASK25``-flagged entries may need
correction after a first live ingest.
"""

from __future__ import annotations

from sqlalchemy import Boolean
from sqlalchemy.dialects import mysql

from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)

from ..core.expected.derive import derive_expected_service
from ..core.expected.type_map import CORE_TYPE_MAP, TypeMap
from ..core.expected.types import (
    ExpectedColumn,
    ExpectedService,
    ExpectedStoredProcedure,
    ExpectedTable,
)
from .baseline import MYSQL_BASELINE

# Extends CORE_TYPE_MAP with MySQL dialect classes + Boolean override.
# Entries marked TASK25 may need correction after the first live ingest.

MYSQL_TYPE_MAP: TypeMap = {
    **CORE_TYPE_MAP,
    Boolean: DataType.TINYINT,  # MySQL stores BOOL as TINYINT(1); TASK25
    # Integer variants — explicit entries so MRO doesn't resolve through Integer → INT.
    mysql.TINYINT: DataType.TINYINT,
    mysql.MEDIUMINT: DataType.INT,  # no MEDIUMINT in OM DataType
    mysql.DOUBLE: DataType.DOUBLE,  # mysql.DOUBLE extends Float; needs override
    # String-size variants — extend _StringType, not Text; without these CORE resolves to VARCHAR.
    mysql.TINYTEXT: DataType.TEXT,  # no TINYTEXT in OM DataType
    mysql.MEDIUMTEXT: DataType.MEDIUMTEXT,
    mysql.LONGTEXT: DataType.TEXT,  # LONGTEXT absent from enum; TASK25
    # Binary-family — extend _Binary; CORE's LargeBinary → BLOB doesn't cover these.
    mysql.BINARY: DataType.BINARY,
    mysql.VARBINARY: DataType.VARBINARY,
    mysql.TINYBLOB: DataType.BLOB,  # no TINYBLOB in OM DataType
    mysql.MEDIUMBLOB: DataType.MEDIUMBLOB,
    mysql.LONGBLOB: DataType.LONGBLOB,
    # Dialect-only types absent from CORE.
    mysql.YEAR: DataType.YEAR,
    mysql.BIT: DataType.BIT,
    mysql.SET: DataType.SET,
    # mysql.JSON / ENUM / BLOB / TIMESTAMP / VARCHAR / CHAR / TEXT: resolved via CORE MRO.
}


def mysql_expected(
    service_name: str,
    *,
    tables: list[str] | None = None,
) -> ExpectedService:
    """Return the expected MySQL catalog for ``service_name``.

    ``tables=None`` returns the full catalog; ``tables=[...]`` filters to
    named tables only (used by filter tests with ``MatchMode.STRICT``).
    """
    expected = derive_expected_service(
        service_name=service_name,
        service_type=DatabaseServiceType.Mysql,
        metadata=MYSQL_BASELINE.metadata,
        type_map=MYSQL_TYPE_MAP,
        database="default",
        views=[_expected_customer_txn_summary_view()],
        stored_procedures=[
            ExpectedStoredProcedure(name="sp_active_customer_count"),
            ExpectedStoredProcedure(name="sp_update_customer_status"),
        ],
    )

    if tables is not None:
        kept = set(tables)
        schema = expected.databases[0].schemas[0]
        schema.tables[:] = [t for t in schema.tables if t.name in kept]

    return expected


def _expected_customer_txn_summary_view() -> ExpectedTable:
    """Return the hand-authored ExpectedTable for the view (tableType=View).

    Columns declared manually; not in SQLAlchemy MetaData. ``COUNT(*)``
    → BIGINT; ``COALESCE(SUM(DECIMAL), 0)`` → DECIMAL.
    """
    return ExpectedTable(
        name="customer_txn_summary",
        columns=[
            ExpectedColumn("customer_id", DataType.INT),
            ExpectedColumn("full_name", DataType.VARCHAR),
            ExpectedColumn("customer_status", DataType.VARCHAR),
            ExpectedColumn("txn_count", DataType.BIGINT),
            ExpectedColumn("total_amount", DataType.DECIMAL),
        ],
    )
