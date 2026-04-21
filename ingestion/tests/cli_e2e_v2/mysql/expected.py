#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Expected OM-side catalog for the MySQL baseline.

Declarative mirror of what MYSQL_BASELINE should produce after ingestion.
Used by assert_service_matches() in the pilot tests.

Single factory with one optional filter argument:
    mysql_expected(service_name)                        -> full catalog
    mysql_expected(service_name, tables=["customers"])  -> only named tables

Stored procedures always remain in the returned schema — the baseline
declares one SP and no current filter scenario disables SPs.

TYPE MAPPING CAVEAT: Several MySQL→OM DataType mappings (MEDIUMINT, the
TINYTEXT/LONGTEXT/TINYBLOB/MEDIUMBLOB/LONGBLOB variants) are best-guess
values here. Task 25's first live run against a real MySQL surfaces the
actual enum values the connector emits; we'll refine this file then.

ENUM FALLBACK: DataType.LONGTEXT does not exist in this version of the
generated schema. longtext_col maps to DataType.TEXT as the closest
available equivalent. Revise to DataType.LONGTEXT if a future schema
update adds it.
"""

from __future__ import annotations

from metadata.generated.schema.entity.data.table import Constraint, DataType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)

from ..core.expected.types import (
    ExpectedColumn,
    ExpectedDatabase,
    ExpectedSchema,
    ExpectedService,
    ExpectedStoredProcedure,
    ExpectedTable,
)


def mysql_expected(
    service_name: str,
    *,
    tables: list[str] | None = None,
) -> ExpectedService:
    """Build the expected MySQL catalog for a given service name.

    tables=None   -> full baseline (customers, transactions, all_types,
                     customer_txn_summary view).
    tables=[...]  -> only the named tables (names match baseline table names).

    The caller supplies the post-filter table list explicitly; this factory
    doesn't mirror the ingest-side filter regex. Tests compute the expected
    set at the call site, which keeps the mapping between filter config and
    expected catalog obvious at each test call site.
    """
    all_tables = [
        _expected_customers(),
        _expected_transactions(),
        _expected_all_types(),
        _expected_customer_txn_summary_view(),
    ]
    if tables is not None:
        kept = set(tables)
        all_tables = [t for t in all_tables if t.name in kept]

    return ExpectedService(
        name=service_name,
        service_type=DatabaseServiceType.Mysql,
        databases=[
            ExpectedDatabase(
                name="default",
                schemas=[
                    ExpectedSchema(
                        name="e2e",
                        tables=all_tables,
                        stored_procedures=[
                            ExpectedStoredProcedure(
                                name="sp_active_customer_count",
                            ),
                        ],
                    ),
                ],
            ),
        ],
    )


# -----------------------------------------------------------------------------
# Table definitions
# -----------------------------------------------------------------------------


def _expected_customers() -> ExpectedTable:
    return ExpectedTable(
        name="customers",
        description="Customer master table",
        columns=[
            ExpectedColumn(
                "id", DataType.INT, primary_key=True,
                constraint=Constraint.PRIMARY_KEY,
                description="Primary key",
            ),
            ExpectedColumn(
                "first_name", DataType.VARCHAR, constraint=Constraint.NOT_NULL,
                description="first name",
            ),
            ExpectedColumn("last_name", DataType.VARCHAR, constraint=Constraint.NOT_NULL),
            ExpectedColumn("full_name", DataType.VARCHAR, constraint=Constraint.NOT_NULL),
            ExpectedColumn(
                "email", DataType.VARCHAR, constraint=Constraint.NOT_NULL,
                description="email address",
            ),
            ExpectedColumn("phone", DataType.VARCHAR),
            ExpectedColumn("ssn", DataType.VARCHAR),
            ExpectedColumn("address", DataType.VARCHAR),
            ExpectedColumn("city", DataType.VARCHAR),
            ExpectedColumn("country", DataType.VARCHAR),
            ExpectedColumn("zipcode", DataType.VARCHAR),
            ExpectedColumn("date_of_birth", DataType.DATE),
            ExpectedColumn("age", DataType.INT),
            ExpectedColumn("credit_score", DataType.INT),
            ExpectedColumn("status", DataType.VARCHAR, constraint=Constraint.NOT_NULL),
            ExpectedColumn("is_active", DataType.TINYINT, constraint=Constraint.NOT_NULL),
            ExpectedColumn("bio", DataType.TEXT),
            ExpectedColumn("joined_date", DataType.DATE, constraint=Constraint.NOT_NULL),
        ],
    )


def _expected_transactions() -> ExpectedTable:
    return ExpectedTable(
        name="transactions",
        description="Customer transaction events",
        columns=[
            ExpectedColumn("id", DataType.BIGINT, primary_key=True, constraint=Constraint.PRIMARY_KEY),
            ExpectedColumn(
                "customer_id", DataType.INT, constraint=Constraint.NOT_NULL,
                description="FK referencing",
            ),
            ExpectedColumn(
                "amount", DataType.DECIMAL, constraint=Constraint.NOT_NULL,
                description="Transaction amount",
            ),
            ExpectedColumn("currency", DataType.CHAR, constraint=Constraint.NOT_NULL),
            ExpectedColumn("exchange_rate", DataType.DOUBLE),
            ExpectedColumn("status", DataType.VARCHAR, constraint=Constraint.NOT_NULL),
            ExpectedColumn("txn_at", DataType.DATETIME, constraint=Constraint.NOT_NULL),
            ExpectedColumn("reference_number", DataType.CHAR, constraint=Constraint.NOT_NULL),
            ExpectedColumn("ip_address", DataType.VARCHAR),
            ExpectedColumn("notes", DataType.TEXT),
        ],
    )


def _expected_all_types() -> ExpectedTable:
    """Every MySQL type the connector maps, in one table.

    Best-guess DataType enum values for the variants the OM connector's
    column_type_parser doesn't document explicitly (MEDIUMINT, TINYTEXT,
    LONGTEXT, TINYBLOB, MEDIUMBLOB, LONGBLOB). Task 25's live run is the
    authoritative validator.

    MEDIUMINT -> DataType.INT (no MEDIUMINT enum member exists)
    TINYTEXT  -> DataType.TEXT (no TINYTEXT enum member exists)
    LONGTEXT  -> DataType.TEXT (DataType.LONGTEXT absent from this schema version)
    TINYBLOB  -> DataType.BLOB (no TINYBLOB enum member exists)
    MEDIUMBLOB -> DataType.MEDIUMBLOB (present)
    LONGBLOB   -> DataType.LONGBLOB (present)
    """
    return ExpectedTable(
        name="all_types",
        columns=[
            ExpectedColumn("id", DataType.INT, primary_key=True, constraint=Constraint.PRIMARY_KEY),
            # integer variants
            ExpectedColumn("tiny_int_col", DataType.TINYINT),
            ExpectedColumn("small_int_col", DataType.SMALLINT),
            ExpectedColumn("medium_int_col", DataType.INT),  # MEDIUMINT -> INT (no enum member)
            ExpectedColumn("int_col", DataType.INT),
            ExpectedColumn("big_int_col", DataType.BIGINT),
            # floating / fixed-point
            ExpectedColumn("float_col", DataType.FLOAT),
            ExpectedColumn("double_col", DataType.DOUBLE),
            ExpectedColumn("decimal_col", DataType.DECIMAL),
            # string
            ExpectedColumn("char_col", DataType.CHAR),
            ExpectedColumn("varchar_col", DataType.VARCHAR),
            ExpectedColumn("tinytext_col", DataType.TEXT),    # TINYTEXT -> TEXT (no enum member)
            ExpectedColumn("text_col", DataType.TEXT),
            ExpectedColumn("mediumtext_col", DataType.MEDIUMTEXT),
            ExpectedColumn("longtext_col", DataType.TEXT),    # LONGTEXT -> TEXT (no LONGTEXT enum member)
            # binary
            ExpectedColumn("binary_col", DataType.BINARY),
            ExpectedColumn("varbinary_col", DataType.VARBINARY),
            ExpectedColumn("tinyblob_col", DataType.BLOB),    # TINYBLOB -> BLOB (no enum member)
            ExpectedColumn("blob_col", DataType.BLOB),
            ExpectedColumn("mediumblob_col", DataType.MEDIUMBLOB),
            ExpectedColumn("longblob_col", DataType.LONGBLOB),
            # date/time
            ExpectedColumn("date_col", DataType.DATE),
            ExpectedColumn("time_col", DataType.TIME),
            ExpectedColumn("datetime_col", DataType.DATETIME),
            ExpectedColumn("timestamp_col", DataType.TIMESTAMP),
            ExpectedColumn("year_col", DataType.YEAR),
            # bit / json / enum / set
            ExpectedColumn("bit_col", DataType.BIT),
            ExpectedColumn("json_col", DataType.JSON),
            ExpectedColumn("enum_col", DataType.ENUM),
            ExpectedColumn("set_col", DataType.SET),
        ],
    )


def _expected_customer_txn_summary_view() -> ExpectedTable:
    """View treated as a Table entity (OM uses tableType=View)."""
    return ExpectedTable(
        name="customer_txn_summary",
        columns=[
            ExpectedColumn("customer_id", DataType.INT),
            ExpectedColumn("full_name", DataType.VARCHAR),
            ExpectedColumn("customer_status", DataType.VARCHAR),
            # MySQL COUNT(*) -> BIGINT
            ExpectedColumn("txn_count", DataType.BIGINT),
            # COALESCE(SUM(DECIMAL(10,2)), 0) -> DECIMAL
            ExpectedColumn("total_amount", DataType.DECIMAL),
        ],
    )
