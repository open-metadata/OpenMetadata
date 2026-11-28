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
"""Usage and query lineage read main.duckdb_query_log, and only that table."""

from pathlib import Path
from unittest.mock import MagicMock

from ingestion.tests.unit.source.database.duckdb._fixtures import DUCKDB_TEST_CONFIG, LOGGED_QUERIES
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.duckdb.lineage import DuckDBLineageSource
from metadata.ingestion.source.database.duckdb.query_log import DuckDBQueryParserSource
from metadata.ingestion.source.database.duckdb.usage import DuckDBUsageSource


def create(
    source_class: type[DuckDBQueryParserSource], path: Path, pipeline: str, **connection
) -> DuckDBQueryParserSource:
    config = {
        "type": "duckdb",
        "serviceName": "local_duckdb",
        "serviceConnection": {
            "config": {
                "type": "DuckDB",
                "databaseFilePath": str(path),
                "connectionOptions": DUCKDB_TEST_CONFIG,
                **connection,
            }
        },
        "sourceConfig": {"config": {"type": pipeline}},
    }
    return source_class.create(config, MagicMock(spec=OpenMetadata))


def logged_queries(source: DuckDBQueryParserSource) -> list:
    return [query for batch in source.get_table_query() for query in batch.queries]


def test_usage_reads_every_logged_query(shop_db_with_query_log):
    queries = logged_queries(create(DuckDBUsageSource, shop_db_with_query_log, "DatabaseUsage"))

    by_text = {query.query: query for query in queries}

    assert sorted(by_text) == sorted(query for _, query, _, _ in LOGGED_QUERIES)
    for _, query, user, duration_ms in LOGGED_QUERIES:
        logged = by_text[query]
        assert (logged.databaseName, logged.databaseSchema) == ("shop", "main")
        assert (logged.userName, logged.duration) == (user, duration_ms), "unknown values stay unknown"


def test_queries_use_the_database_the_metadata_run_named(shop_db_with_query_log):
    source = create(DuckDBUsageSource, shop_db_with_query_log, "DatabaseUsage", databaseName="sales")

    assert {query.databaseName for query in logged_queries(source)} == {"sales"}


def test_lineage_reads_only_statements_that_move_data(shop_db_with_query_log):
    queries = list(create(DuckDBLineageSource, shop_db_with_query_log, "DatabaseLineage").yield_table_query())

    assert sorted(query.query for query in queries) == sorted(
        query for _, query, _, _ in LOGGED_QUERIES if not query.startswith("SELECT")
    )
    assert {(query.databaseName, query.databaseSchema) for query in queries} == {("shop", "main")}


def test_database_names_with_quotes_and_colons_reach_usage_and_lineage(shop_db_with_query_log):
    """The name is a SQL literal in a statement run through text(), where ' and : are both special."""
    name = "o'brien:2024"
    usage = logged_queries(create(DuckDBUsageSource, shop_db_with_query_log, "DatabaseUsage", databaseName=name))
    lineage = list(
        create(DuckDBLineageSource, shop_db_with_query_log, "DatabaseLineage", databaseName=name).yield_table_query()
    )

    assert len(usage) == len(LOGGED_QUERIES)
    assert {query.databaseName for query in usage + lineage} == {name}


def test_without_a_query_log_no_queries_are_read(shop_db):
    source = create(DuckDBUsageSource, shop_db, "DatabaseUsage")

    assert logged_queries(source) == []


def test_ingestion_does_not_read_its_own_queries(shop_db):
    """DuckDB's in-memory ``duckdb_logs`` only ever holds the ingestion's own statements."""
    source = create(DuckDBUsageSource, shop_db, "DatabaseUsage")
    with source.engine.connect() as conn:
        conn.exec_driver_sql("SELECT * FROM customers")

    assert logged_queries(source) == []
