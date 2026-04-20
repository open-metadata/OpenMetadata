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

"""
Test helpers for SQL query masking tests.
"""

from collate_sqllineage.core.parser.sqlfluff.analyzer import SqlFluffLineageAnalyzer
from collate_sqllineage.core.parser.sqlglot.analyzer import SqlGlotLineageAnalyzer
from collate_sqllineage.core.parser.sqlparse.analyzer import SqlParseLineageAnalyzer
from collate_sqllineage.runner import LineageRunner

from metadata.ingestion.lineage.masker import mask_query, masked_query_cache

PARSER_MAP = {
    "SqlGlot": SqlGlotLineageAnalyzer,
    "SqlFluff": SqlFluffLineageAnalyzer,
    "SqlParse": SqlParseLineageAnalyzer,
}


def assert_masked_query(sql: str, masked_query: str, dialect: str, parser_name: str):
    """
    Helper function to test query masking with a specific parser and assert the result.

    :param sql: SQL statement to test
    :param masked_query: Expected masked query
    :param dialect: SQL dialect to use (for SqlGlot and SqlFluff)
    :param parser_name: Name of parser being tested (for error messages)
    """
    analyzer_class = PARSER_MAP[parser_name]

    parser_prefix = f"[{parser_name}] " if parser_name else ""

    # clear cache before each test
    masked_query_cache.clear()

    parser = LineageRunner(sql, dialect=dialect, analyzer=analyzer_class)
    len(parser.source_tables)  # Force parsing

    actual = mask_query(sql, dialect=dialect, parser=parser)
    expected = masked_query

    assert actual == expected, (
        f"\n\t{parser_prefix}Expected Masked Query: {expected}"
        f"\n\t{parser_prefix}Actual Masked Query:   {actual}"
    )
