#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Expected OM-side catalog for the MySQL baseline.

Derived from `MYSQL_BASELINE.metadata` via `MYSQL_TYPE_MAP`. The hand-authored
column lists disappear — column types, descriptions, constraints, and
primary keys all come off the SQLAlchemy Column declarations in
`core/source/common_baseline.py` + `mysql/baseline.py`.

Views aren't in MetaData (they're raw SQL), so the view's ExpectedTable is
appended manually. Stored procedures are passed in as a hand-authored list
to `derive_expected_service`.

Entries in `MYSQL_TYPE_MAP` that may need adjustment after Task 25's live
run are marked inline.
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

# -----------------------------------------------------------------------------
# MYSQL_TYPE_MAP — extends CORE with MySQL dialect classes + Boolean override.
# Entries flagged TASK25 may need correction after the first live ingest.
# -----------------------------------------------------------------------------

MYSQL_TYPE_MAP: TypeMap = {
    **CORE_TYPE_MAP,
    # Core overrides (dialect behaves differently than the generic mapping).
    Boolean: DataType.TINYINT,  # MySQL stores BOOL as TINYINT(1); TASK25
    # Integer variants — MRO walks through Integer first, so we must
    # override before it resolves to DataType.INT.
    mysql.TINYINT: DataType.TINYINT,
    mysql.MEDIUMINT: DataType.INT,  # no MEDIUMINT in OM DataType
    # Float variants — same reasoning; mysql.DOUBLE extends Float.
    mysql.DOUBLE: DataType.DOUBLE,
    # String-family size variants — mysql.MEDIUMTEXT / LONGTEXT / TINYTEXT
    # extend `_StringType`, which MRO-walks to String (not Text), so CORE's
    # `String → VARCHAR` would give the wrong answer without these entries.
    mysql.TINYTEXT: DataType.TEXT,  # no TINYTEXT in OM DataType
    mysql.MEDIUMTEXT: DataType.MEDIUMTEXT,
    mysql.LONGTEXT: DataType.TEXT,  # LONGTEXT absent from enum; TASK25
    # Binary-family — mysql.BINARY / VARBINARY / *BLOB extend `_Binary`,
    # which MRO skips past `LargeBinary`, so CORE's `LargeBinary → BLOB`
    # doesn't help the binary/varbinary/tiny/medium/long variants.
    mysql.BINARY: DataType.BINARY,
    mysql.VARBINARY: DataType.VARBINARY,
    mysql.TINYBLOB: DataType.BLOB,  # no TINYBLOB in OM DataType
    mysql.MEDIUMBLOB: DataType.MEDIUMBLOB,
    mysql.LONGBLOB: DataType.LONGBLOB,
    # Dialect-only types with no generic SQLAlchemy parent in CORE.
    mysql.YEAR: DataType.YEAR,
    mysql.BIT: DataType.BIT,
    mysql.SET: DataType.SET,
    # NOTE: mysql.JSON / mysql.ENUM / mysql.BLOB / mysql.TIMESTAMP are
    # resolved via CORE_TYPE_MAP through the MRO walk (see type_map.py).
    # mysql.VARCHAR / mysql.CHAR / mysql.TEXT likewise — no entries needed.
}


def mysql_expected(
    service_name: str,
    *,
    tables: list[str] | None = None,
) -> ExpectedService:
    """Build the expected MySQL catalog for a given service name.

    Structural portion (tables + columns + types + PKs + comments) is
    derived from `MYSQL_BASELINE.metadata`. The view and stored procedure
    are appended since neither lives in MetaData.

    `tables=None` -> full catalog. `tables=[...]` -> only the named tables
    survive (used by filter tests with MatchMode.STRICT).
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
    """View treated as Table entity (OM uses tableType=View).

    View columns are declared manually since the view body is raw SQL and
    not in our SQLAlchemy MetaData. MySQL's `COUNT(*)` returns BIGINT;
    `COALESCE(SUM(DECIMAL), 0)` returns DECIMAL.
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
