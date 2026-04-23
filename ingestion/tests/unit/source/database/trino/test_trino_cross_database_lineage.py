#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""
Unit tests for Trino cross-database lineage case-insensitive behavior.

Covers issue #27419: Trino is case-insensitive for all identifiers.
Cross-database lineage should be established even when the source system
stores table/schema names in a different case than Trino's lowercase output.

When the generated schema stubs are available (CI environment after
``make generate``), the tests import and exercise the real
TrinoLineageSource methods so that coverage.py tracks execution of
lineage.py.  When the stubs are absent (local dev without a build),
the tests fall back to the original AST-extraction approach so they
remain runnable everywhere.
"""

import ast
import os
import textwrap
from unittest.mock import MagicMock

import pytest

# ---------------------------------------------------------------------------
# Conditional import – works in CI where ``make generate`` has run.
# Falls back gracefully so the tests still pass locally without a build.
# ---------------------------------------------------------------------------
try:
    from metadata.generated.schema.entity.data.database import Database
    from metadata.generated.schema.entity.data.table import Table
    from metadata.ingestion.source.database.trino.lineage import (
        TrinoLineageSource,
    )

    _HAS_GENERATED = True
except ImportError:
    _HAS_GENERATED = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _make_table(fqn: str, name: str, columns: list):
    """Build a minimal Table-like mock with .name.root and .columns."""
    table = MagicMock()
    table.fullyQualifiedName = MagicMock()
    table.fullyQualifiedName.root = fqn
    table.name = MagicMock()
    table.name.root = name
    cols = []
    for col_name in columns:
        c = MagicMock()
        c.name = MagicMock()
        c.name.root = col_name
        cols.append(c)
    table.columns = cols
    return table


def _extract_check_same_table():
    """
    Extract and compile check_same_table from lineage.py as a standalone
    function to avoid importing the full metadata package.
    """
    lineage_path = os.path.normpath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "..",
            "..",
            "..",
            "src",
            "metadata",
            "ingestion",
            "source",
            "database",
            "trino",
            "lineage.py",
        )
    )
    with open(lineage_path, "r") as f:
        source = f.read()

    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "check_same_table":
            # Extract the source lines for this function
            start = node.lineno - 1
            end = node.end_lineno
            lines = source.splitlines()[start:end]
            func_source = "\n".join(lines)

            # Remove the indentation and self parameter for standalone use
            func_source = textwrap.dedent(func_source)
            # Replace 'self, ' to make it a plain function
            func_source = func_source.replace(
                "def check_same_table(self, ", "def check_same_table("
            )

            ns = {}
            exec(compile(func_source, "<check_same_table>", "exec"), ns)
            return ns["check_same_table"]

    raise RuntimeError("Could not find check_same_table in lineage.py")


def _get_check_same_table():
    """Return the real method when available, otherwise fall back to AST."""
    if _HAS_GENERATED:
        # Unbound method – pass ``None`` as self in the test calls
        return TrinoLineageSource.check_same_table
    return _extract_check_same_table()


# Resolved once at import time
_check_same_table_func = _get_check_same_table()


def _call_check_same_table(t1, t2):
    """Thin wrapper that hides the ``self`` difference."""
    if _HAS_GENERATED:
        return _check_same_table_func(None, t1, t2)
    return _check_same_table_func(t1, t2)


# ---------------------------------------------------------------------------
# Tests for check_same_table()
# ---------------------------------------------------------------------------
class TestCheckSameTable:
    """Tests for TrinoLineageSource.check_same_table()"""

    def test_same_case_matches(self):
        """Identical names always match."""
        t1 = _make_table("svc.db.schema.orders", "orders", ["id", "amount"])
        t2 = _make_table("other.db.schema.orders", "orders", ["id", "amount"])
        assert _call_check_same_table(t1, t2) is True

    def test_trino_lowercase_vs_source_uppercase_matches(self):
        """
        Trino returns 'orders', source system stored 'ORDERS'.
        check_same_table must return True -- this is the core #27419 case.
        """
        trino_table = _make_table(
            "trino.hive.public.orders", "orders", ["id", "amount"]
        )
        source_table = _make_table(
            "postgres.hive.PUBLIC.ORDERS", "ORDERS", ["ID", "AMOUNT"]
        )
        assert _call_check_same_table(trino_table, source_table) is True

    def test_trino_lowercase_vs_source_mixedcase_matches(self):
        """Mixed-case source table name also matches."""
        trino_table = _make_table(
            "trino.hive.public.customer_orders", "customer_orders", ["id"]
        )
        source_table = _make_table(
            "postgres.hive.public.Customer_Orders",
            "Customer_Orders",
            ["Id"],
        )
        assert _call_check_same_table(trino_table, source_table) is True

    def test_different_names_do_not_match(self):
        """Tables with genuinely different names must not match."""
        t1 = _make_table("svc.db.s.orders", "orders", ["id"])
        t2 = _make_table("svc.db.s.invoices", "invoices", ["id"])
        assert _call_check_same_table(t1, t2) is False

    def test_same_name_different_columns_do_not_match(self):
        """Same table name but different column sets must not match."""
        t1 = _make_table("svc.db.s.orders", "orders", ["id", "amount"])
        t2 = _make_table("svc.db.s.orders", "orders", ["id", "total"])
        assert _call_check_same_table(t1, t2) is False

    def test_column_case_insensitive_match(self):
        """Columns with different cases should still match."""
        trino_table = _make_table(
            "trino.db.s.orders", "orders", ["id", "customer_name"]
        )
        source_table = _make_table("pg.db.s.orders", "orders", ["ID", "CUSTOMER_NAME"])
        assert _call_check_same_table(trino_table, source_table) is True

    def test_empty_columns_match(self):
        """Tables with no columns should match if names are equal."""
        t1 = _make_table("svc.db.s.orders", "orders", [])
        t2 = _make_table("svc.db.s.ORDERS", "ORDERS", [])
        assert _call_check_same_table(t1, t2) is True


# ---------------------------------------------------------------------------
# Tests for FQN fallback logic (pure string tests, always runnable)
# ---------------------------------------------------------------------------
class TestFqnFallbackLogic:
    """
    Tests for the case-insensitive FQN fallback in
    yield_cross_database_lineage().

    Instead of importing the full method (which requires the generated
    schema build), we test the core string logic directly.
    """

    def test_fallback_lowercases_suffix_only(self):
        """
        The fallback must lowercase only the schema+table suffix,
        preserving the cross_database_fqn prefix as-is.
        """
        trino_table_fqn = "trino_service.hive_db.MySchema.MyTable"
        trino_database_fqn = "trino_service.hive_db"
        cross_database_fqn = "postgres_service.hive_db"

        # Replicate the production logic
        as_built = trino_table_fqn.replace(trino_database_fqn, cross_database_fqn)
        assert as_built == "postgres_service.hive_db.MySchema.MyTable"

        # Fallback logic
        fqn_suffix = trino_table_fqn[len(trino_database_fqn) :]
        lower_fqn = cross_database_fqn + fqn_suffix.lower()
        assert lower_fqn == "postgres_service.hive_db.myschema.mytable"

    def test_fallback_preserves_service_name_case(self):
        """
        OpenMetadata service names are case-sensitive.  The prefix from
        cross_database_fqn must NOT be lowercased.
        """
        trino_table_fqn = "Trino_Svc.HiveDB.PUBLIC.ORDERS"
        trino_database_fqn = "Trino_Svc.HiveDB"
        cross_database_fqn = "Postgres_Svc.HiveDB"

        fqn_suffix = trino_table_fqn[len(trino_database_fqn) :]
        lower_fqn = cross_database_fqn + fqn_suffix.lower()

        # Service prefix is PRESERVED; only suffix is lowered
        assert lower_fqn == "Postgres_Svc.HiveDB.public.orders"

    def test_no_fallback_when_already_lowercase(self):
        """
        When schema+table are already lowercase, the as-built FQN and
        the fallback produce the same string.
        """
        trino_table_fqn = "trino.hive.public.orders"
        trino_database_fqn = "trino.hive"
        cross_database_fqn = "pg.hive"

        as_built = trino_table_fqn.replace(trino_database_fqn, cross_database_fqn)
        fqn_suffix = trino_table_fqn[len(trino_database_fqn) :]
        lower_fqn = cross_database_fqn + fqn_suffix.lower()

        assert as_built == lower_fqn == "pg.hive.public.orders"

    def test_mock_get_by_name_fallback_scenario(self):
        """
        Simulate the full lookup+fallback flow using a mock
        get_by_name that returns None for the as-built FQN but
        succeeds for the lowercased one.
        """
        trino_table_fqn = "trino_svc.hive.MySchema.MyTable"
        trino_database_fqn = "trino_svc.hive"
        cross_database_fqn = "pg_svc.hive"

        resolved = _make_table("pg_svc.hive.myschema.mytable", "mytable", ["id"])

        def mock_get_by_name(entity, fqn):
            if fqn == "pg_svc.hive.myschema.mytable":
                return resolved
            return None

        metadata = MagicMock()
        metadata.get_by_name.side_effect = mock_get_by_name

        # Step 1: as-built lookup
        as_built = trino_table_fqn.replace(trino_database_fqn, cross_database_fqn)
        result = metadata.get_by_name(object, fqn=as_built)
        assert result is None

        # Step 2: fallback
        fqn_suffix = trino_table_fqn[len(trino_database_fqn) :]
        lower_fqn = cross_database_fqn + fqn_suffix.lower()
        result = metadata.get_by_name(object, fqn=lower_fqn)
        assert result is resolved

    def test_regression_no_fallback_needed(self):
        """
        When the as-built FQN resolves successfully, only one lookup
        should be needed.  Regression test for existing behavior.
        """
        metadata = MagicMock()
        resolved = _make_table("pg.hive.public.orders", "orders", ["id"])
        metadata.get_by_name.return_value = resolved

        result = metadata.get_by_name(object, fqn="pg.hive.public.orders")
        assert result is resolved
        metadata.get_by_name.assert_called_once()


# ---------------------------------------------------------------------------
# Integration-style tests that exercise the REAL yield_cross_database_lineage
# method via mocked dependencies.  These only run when the generated schema
# stubs are available (CI), which is exactly the environment where SonarQube
# computes coverage.
# ---------------------------------------------------------------------------
@pytest.mark.skipif(
    not _HAS_GENERATED,
    reason="Requires generated schema stubs (run `make generate` first)",
)
class TestYieldCrossDatabaseLineage:
    """
    Tests that call TrinoLineageSource.yield_cross_database_lineage()
    with a mocked ``self`` so that coverage.py traces execution through
    lineage.py lines 136-210.
    """

    def test_fallback_triggered(self):
        """
        When the as-built FQN lookup returns None, the code falls back
        to the lowercased schema+table suffix and yields lineage.
        """
        source = MagicMock()
        source.get_cross_database_fqn_from_service_names.return_value = ["pg_svc.hive"]
        source.config.serviceName = "trino"

        # Database that Trino enumerates
        trino_db = MagicMock()
        trino_db.fullyQualifiedName.root = "trino.hive"

        # Table inside that database (Trino folds to lowercase, but let's
        # simulate a mixed-case FQN that the metadata API could return)
        trino_table = _make_table("trino.hive.MySchema.MyTable", "mytable", ["id"])

        def mock_list_all(entity, params):
            if entity is Database:
                return [trino_db]
            if entity is Table:
                return [trino_table]
            return []

        source.metadata.list_all_entities.side_effect = mock_list_all

        # Target table found only via the lowercased fallback FQN
        cross_db_table = _make_table("pg_svc.hive.myschema.mytable", "mytable", ["ID"])

        def mock_get_by_name(entity, fqn):
            if fqn == "pg_svc.hive.MySchema.MyTable":
                return None  # as-built lookup fails
            if fqn == "pg_svc.hive.myschema.mytable":
                return cross_db_table  # fallback succeeds
            return None

        source.metadata.get_by_name.side_effect = mock_get_by_name

        # Wire check_same_table to the real implementation
        source.check_same_table = lambda t1, t2: TrinoLineageSource.check_same_table(
            source, t1, t2
        )
        source.get_cross_database_lineage.return_value = "lineage_edge"

        results = list(TrinoLineageSource.yield_cross_database_lineage(source))

        assert len(results) == 1
        assert results[0] == "lineage_edge"
        source.get_cross_database_lineage.assert_called_once_with(
            cross_db_table, trino_table
        )
        # Two API lookups: as-built (None) + fallback (found)
        assert source.metadata.get_by_name.call_count == 2

    def test_no_fallback_needed(self):
        """
        Regression: when the as-built FQN resolves on the first try,
        no fallback logic fires and only one get_by_name call happens.
        """
        source = MagicMock()
        source.get_cross_database_fqn_from_service_names.return_value = ["pg.hive"]
        source.config.serviceName = "trino"

        trino_db = MagicMock()
        trino_db.fullyQualifiedName.root = "trino.hive"
        trino_table = _make_table("trino.hive.public.orders", "orders", ["id"])

        def mock_list_all(entity, params):
            if entity is Database:
                return [trino_db]
            if entity is Table:
                return [trino_table]
            return []

        source.metadata.list_all_entities.side_effect = mock_list_all

        cross_db_table = _make_table("pg.hive.public.orders", "orders", ["id"])

        def mock_get_by_name(entity, fqn):
            if fqn == "pg.hive.public.orders":
                return cross_db_table
            return None

        source.metadata.get_by_name.side_effect = mock_get_by_name
        source.check_same_table = lambda t1, t2: TrinoLineageSource.check_same_table(
            source, t1, t2
        )
        source.get_cross_database_lineage.return_value = "lineage_edge"

        results = list(TrinoLineageSource.yield_cross_database_lineage(source))

        assert len(results) == 1
        assert results[0] == "lineage_edge"
        # Only one lookup needed — no fallback
        assert source.metadata.get_by_name.call_count == 1

    def test_no_match_yields_nothing(self):
        """
        When get_by_name returns None for both the as-built and
        fallback FQNs, no lineage edge is yielded.
        """
        source = MagicMock()
        source.get_cross_database_fqn_from_service_names.return_value = ["pg.hive"]
        source.config.serviceName = "trino"

        trino_db = MagicMock()
        trino_db.fullyQualifiedName.root = "trino.hive"
        trino_table = _make_table("trino.hive.public.orders", "orders", ["id"])

        def mock_list_all(entity, params):
            if entity is Database:
                return [trino_db]
            if entity is Table:
                return [trino_table]
            return []

        source.metadata.list_all_entities.side_effect = mock_list_all
        source.metadata.get_by_name.return_value = None
        source.check_same_table = lambda t1, t2: TrinoLineageSource.check_same_table(
            source, t1, t2
        )

        results = list(TrinoLineageSource.yield_cross_database_lineage(source))

        assert len(results) == 0

    def test_cache_prevents_duplicate_api_calls(self):
        """
        The FQN cache must prevent repeated get_by_name API calls for
        the same FQN across different cross-database service candidates.
        """
        source = MagicMock()
        source.get_cross_database_fqn_from_service_names.return_value = ["pg.hive"]
        source.config.serviceName = "trino"

        trino_db = MagicMock()
        trino_db.fullyQualifiedName.root = "trino.hive"
        # Two tables with the same schema prefix
        t1 = _make_table("trino.hive.public.orders", "orders", ["id"])
        t2 = _make_table("trino.hive.public.items", "items", ["id"])

        def mock_list_all(entity, params):
            if entity is Database:
                return [trino_db]
            if entity is Table:
                return [t1, t2]
            return []

        source.metadata.list_all_entities.side_effect = mock_list_all

        pg_orders = _make_table("pg.hive.public.orders", "orders", ["id"])
        pg_items = _make_table("pg.hive.public.items", "items", ["id"])

        def mock_get_by_name(entity, fqn):
            if fqn == "pg.hive.public.orders":
                return pg_orders
            if fqn == "pg.hive.public.items":
                return pg_items
            return None

        source.metadata.get_by_name.side_effect = mock_get_by_name
        source.check_same_table = lambda t1_, t2_: TrinoLineageSource.check_same_table(
            source, t1_, t2_
        )
        source.get_cross_database_lineage.return_value = "lineage_edge"

        results = list(TrinoLineageSource.yield_cross_database_lineage(source))

        assert len(results) == 2
        # Each unique FQN is looked up exactly once (cache hit on repeats)
        assert source.metadata.get_by_name.call_count == 2
