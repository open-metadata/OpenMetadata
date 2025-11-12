"""
Unit tests for GitHub issue #7427 - SQL queries that failed with collate-sqlfluff

Tests all queries reported in GitHub issue #7427 to ensure SQLGlot parser
handles them correctly.

https://github.com/open-metadata/OpenMetadata/issues/7427
"""
import json
from pathlib import Path
from typing import Dict, List

import pytest

from metadata.ingestion.lineage.sqlglot_parser import SQLGlotLineageRunner


def load_github_issue_queries() -> List[Dict]:
    """Load queries from github_issue_7427_queries.json"""
    # Path relative to project root
    project_root = Path(__file__).parent.parent.parent.parent.parent
    queries_file = project_root / "github_issue_7427_queries.json"

    if not queries_file.exists():
        pytest.skip(f"Query file not found: {queries_file}")

    with open(queries_file, "r") as f:
        return json.load(f)


# Load queries for parametrization
GITHUB_QUERIES = load_github_issue_queries()


@pytest.mark.parametrize(
    "query_data",
    GITHUB_QUERIES,
    ids=[f"query_{q['id']}_{q['name'].replace(' ', '_')}" for q in GITHUB_QUERIES],
)
def test_github_issue_7427_query_parsing(query_data: Dict):
    """
    Test that SQLGlot can successfully parse queries from GitHub issue #7427.

    This test ensures that all queries reported as problematic with collate-sqlfluff
    can be parsed with SQLGlot without errors.
    """
    query = query_data["query"]
    dialect = query_data["dialect"]
    query_name = query_data["name"]

    # Initialize SQLGlot parser
    runner = SQLGlotLineageRunner(query, dialect=dialect)

    # Parser should initialize without raising exceptions
    assert runner is not None, f"Failed to initialize parser for query: {query_name}"

    # Should be able to get source tables without exceptions
    source_tables = runner.source_tables
    assert (
        source_tables is not None
    ), f"Failed to get source tables for query: {query_name}"

    # Should be able to get target tables without exceptions
    target_tables = runner.target_tables
    assert (
        target_tables is not None
    ), f"Failed to get target tables for query: {query_name}"

    # Should be able to get column lineage without exceptions
    column_lineage = runner.get_column_lineage()
    assert (
        column_lineage is not None
    ), f"Failed to get column lineage for query: {query_name}"


@pytest.mark.parametrize(
    "query_data",
    [q for q in GITHUB_QUERIES if q["dialect"] == "snowflake"],
    ids=[
        f"snowflake_query_{q['id']}"
        for q in GITHUB_QUERIES
        if q["dialect"] == "snowflake"
    ],
)
def test_snowflake_specific_features(query_data: Dict):
    """
    Test Snowflake-specific SQL features that were problematic with collate-sqlfluff.

    Includes: PIVOT, MERGE with stage paths, INSERT with CTEs and stages
    """
    query = query_data["query"]
    runner = SQLGlotLineageRunner(query, dialect="snowflake")

    # Snowflake queries should initialize without raising exceptions
    assert (
        runner is not None
    ), f"Failed to initialize parser for Snowflake query: {query_data['name']}"

    # Should be able to get tables without exceptions (even if empty for complex queries)
    source_tables = runner.source_tables
    target_tables = runner.target_tables

    # Should return valid sets (not None)
    assert source_tables is not None, "source_tables should not be None"
    assert target_tables is not None, "target_tables should not be None"


@pytest.mark.parametrize(
    "query_data",
    [q for q in GITHUB_QUERIES if q["dialect"] in ["mssql", "tsql"]],
    ids=[
        f"mssql_query_{q['id']}"
        for q in GITHUB_QUERIES
        if q["dialect"] in ["mssql", "tsql"]
    ],
)
def test_mssql_function_parsing(query_data: Dict):
    """
    Test MSSQL/T-SQL function definitions that failed with collate-sqlfluff.

    collate-sqlfluff reported "Unknown dialect" for MSSQL queries.
    SQLGlot should handle these successfully.
    """
    query = query_data["query"]
    runner = SQLGlotLineageRunner(query, dialect="tsql")

    # MSSQL functions should initialize without raising exceptions
    assert (
        runner is not None
    ), f"Failed to initialize parser for MSSQL query: {query_data['name']}"

    # Parser should not raise exceptions when accessing properties
    column_lineage = runner.get_column_lineage()
    assert isinstance(column_lineage, list), "Column lineage should return a list"


@pytest.mark.parametrize(
    "query_data",
    [q for q in GITHUB_QUERIES if q["dialect"] == "oracle"],
    ids=[f"oracle_query_{q['id']}" for q in GITHUB_QUERIES if q["dialect"] == "oracle"],
)
def test_oracle_plsql_parsing(query_data: Dict):
    """
    Test Oracle PL/SQL blocks that failed with collate-sqlfluff.

    Includes: UPDATE with NVL(), dynamic INSERT with execute immediate
    """
    query = query_data["query"]
    runner = SQLGlotLineageRunner(query, dialect="oracle")

    # Oracle queries should initialize without raising exceptions
    assert (
        runner is not None
    ), f"Failed to initialize parser for Oracle query: {query_data['name']}"

    # Should be able to extract tables without exceptions (even if empty for PL/SQL blocks)
    source_tables = runner.source_tables
    target_tables = runner.target_tables

    # Should return valid sets (not None)
    assert source_tables is not None, "source_tables should not be None"
    assert target_tables is not None, "target_tables should not be None"


@pytest.mark.parametrize(
    "query_data",
    [q for q in GITHUB_QUERIES if q["dialect"] == "postgres"],
    ids=[
        f"postgres_query_{q['id']}"
        for q in GITHUB_QUERIES
        if q["dialect"] == "postgres"
    ],
)
def test_postgres_ddl_and_views(query_data: Dict):
    """
    Test Postgres DDL statements and complex views.

    Includes: SET, ALTER SEQUENCE, CREATE VIEW from pg_stat_statements
    """
    query = query_data["query"]
    runner = SQLGlotLineageRunner(query, dialect="postgres")

    # Postgres queries should parse without errors
    assert (
        runner._parsed is not None
    ), f"Failed to parse Postgres query: {query_data['name']}"

    # DDL statements should parse even if they don't produce lineage
    column_lineage = runner.get_column_lineage()
    assert isinstance(column_lineage, list), "Should return list even for DDL"


def test_overall_success_rate():
    """
    Test that SQLGlot achieves 100% success rate on GitHub issue #7427 queries.

    This is a meta-test that validates SQLGlot's overall performance compared
    to collate-sqlfluff's 33.3% success rate.
    """
    total_queries = len(GITHUB_QUERIES)
    successful_parses = 0

    for query_data in GITHUB_QUERIES:
        try:
            runner = SQLGlotLineageRunner(
                query_data["query"], dialect=query_data["dialect"]
            )

            # If we can get column lineage without exception, it's a success
            runner.get_column_lineage()
            successful_parses += 1
        except Exception:
            pass

    success_rate = (successful_parses / total_queries) * 100

    # SQLGlot should achieve 100% success rate
    assert (
        success_rate == 100.0
    ), f"Expected 100% success rate, got {success_rate:.1f}% ({successful_parses}/{total_queries})"


def test_column_lineage_extraction_quality():
    """
    Test that SQLGlot extracts meaningful column lineage where possible.

    Some queries should produce column lineage edges (SELECT, INSERT, UPDATE).
    DDL statements may not produce column lineage.
    """
    queries_with_lineage = 0
    total_dml_queries = 0

    for query_data in GITHUB_QUERIES:
        query = query_data["query"].upper()

        # Count DML statements that should have column lineage
        if any(stmt in query for stmt in ["SELECT", "INSERT", "UPDATE", "MERGE"]):
            total_dml_queries += 1

            runner = SQLGlotLineageRunner(
                query_data["query"], dialect=query_data["dialect"]
            )

            column_lineage = runner.get_column_lineage()
            if len(column_lineage) > 0:
                queries_with_lineage += 1

    # At least some DML queries should produce column lineage
    assert (
        queries_with_lineage > 0
    ), "Expected at least some queries to produce column lineage"

    coverage = (
        (queries_with_lineage / total_dml_queries * 100) if total_dml_queries > 0 else 0
    )

    # We expect at least 25% of DML queries to have column lineage
    # (some may legitimately have none, like incomplete queries or complex PL/SQL)
    assert (
        coverage >= 25.0
    ), f"Column lineage coverage too low: {coverage:.1f}% ({queries_with_lineage}/{total_dml_queries})"


def test_table_extraction_quality():
    """
    Test that SQLGlot correctly identifies source and target tables.

    This is a critical feature for lineage generation.
    """
    queries_with_tables = 0

    for query_data in GITHUB_QUERIES:
        runner = SQLGlotLineageRunner(
            query_data["query"], dialect=query_data["dialect"]
        )

        source_tables = runner.source_tables
        target_tables = runner.target_tables

        # Most queries should identify at least source or target tables
        # (except pure DDL like SET, ALTER)
        query_upper = query_data["query"].upper()
        is_dml_or_query = any(
            stmt in query_upper
            for stmt in [
                "SELECT",
                "INSERT",
                "UPDATE",
                "DELETE",
                "MERGE",
                "CREATE VIEW",
                "CREATE TABLE",
            ]
        )

        if is_dml_or_query:
            if len(source_tables) > 0 or len(target_tables) > 0:
                queries_with_tables += 1

    # Most DML/query statements should extract tables
    # Note: Some complex queries like PL/SQL blocks may not extract tables reliably
    assert (
        queries_with_tables >= 6
    ), f"Expected at least 6 queries to extract tables, got {queries_with_tables}"


@pytest.mark.parametrize(
    "dialect", ["snowflake", "oracle", "postgres", "redshift", "clickhouse", "mssql"]
)
def test_dialect_support(dialect: str):
    """
    Test that SQLGlot supports all dialects mentioned in GitHub issue #7427.

    This ensures we have broad dialect coverage.
    """
    dialect_queries = [q for q in GITHUB_QUERIES if q["dialect"] == dialect]

    if not dialect_queries:
        pytest.skip(f"No queries for dialect: {dialect}")

    for query_data in dialect_queries:
        runner = SQLGlotLineageRunner(query_data["query"], dialect=dialect)

        # Should initialize without errors
        assert runner is not None

        # Should be able to get column lineage without exceptions
        column_lineage = runner.get_column_lineage()
        assert isinstance(column_lineage, list)
