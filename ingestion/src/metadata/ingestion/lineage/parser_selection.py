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
Parser Selection for Lineage Extraction
"""
import warnings
from enum import Enum
from typing import Optional, Union

from metadata.ingestion.lineage.models import Dialect
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class LineageParserType(str, Enum):
    """
    Enum for supported lineage parsers.

    - SQLGLOT: Uses SQLGlot parser (recommended, 100% parse success, schema-aware)
    - SQLFLUFF: Uses SQLFluff parser (collate-sqllineage with SQLFluff backend)
    - SQLPARSE: Uses sqlparse parser (generic ANSI SQL parser)
    - AUTO: Automatically selects best parser (tries SQLGlot first, falls back to sqlparse)
    """

    SQLGLOT = "sqlglot"  # Default - recommended
    SQLFLUFF = "sqlfluff"  # Available as fallback option
    SQLPARSE = "sqlparse"  # Generic fallback
    AUTO = "auto"  # SQLGlot -> sqlparse fallback


def create_lineage_parser(
    query: str,
    dialect: Optional[Union[str, Dialect]] = None,
    parser_type: Optional[Union[str, LineageParserType]] = None,
    timeout_seconds: int = 10,
    schema: Optional[dict] = None,
):
    """
    Factory function to create the appropriate lineage parser based on configuration.

    Args:
        query: SQL query to parse
        dialect: SQL dialect (snowflake, postgres, mysql, etc.)
        parser_type: Type of parser to use (sqlglot, sqlfluff, sqlparse, auto)
        timeout_seconds: Timeout for parsing in seconds
        schema: Optional schema dictionary for SQLGlot

    Returns:
        Parser instance (SQLGlotLineageRunner or LineageParser)
    """
    # Keep original dialect for legacy parsers (they expect Dialect enum)
    original_dialect = dialect

    # Convert dialect to string if it's an enum (for SQLGlot)
    if isinstance(dialect, Dialect):
        dialect = dialect.value

    # Convert parser_type to enum if it's a string
    if isinstance(parser_type, str):
        try:
            parser_type = LineageParserType(parser_type.lower())
        except ValueError:
            logger.warning(
                f"Unknown parser type '{parser_type}', defaulting to sqlglot"
            )
            parser_type = LineageParserType.SQLGLOT

    # Default to SQLGlot if not specified
    if parser_type is None:
        parser_type = LineageParserType.SQLGLOT

    # Handle AUTO mode - try SQLGlot first
    if parser_type == LineageParserType.AUTO:
        try:
            from metadata.ingestion.lineage.sqlglot_parser import SQLGlotLineageRunner

            parser = SQLGlotLineageRunner(query, dialect=dialect, schema=schema)
            if parser.query_parsing_success:
                return parser
            logger.debug(
                f"SQLGlot parser failed, falling back to sqlparse: {parser.query_parsing_failure_reason}"
            )
            parser_type = LineageParserType.SQLPARSE
        except Exception as e:
            logger.debug(f"SQLGlot not available, falling back to sqlparse: {e}")
            parser_type = LineageParserType.SQLPARSE

    # SQLGlot parser (recommended)
    if parser_type == LineageParserType.SQLGLOT:
        try:
            from metadata.ingestion.lineage.sqlglot_parser import SQLGlotLineageRunner

            return SQLGlotLineageRunner(query, dialect=dialect, schema=schema)
        except ImportError:
            logger.warning(
                "SQLGlot not installed, falling back to sqlfluff. "
                "Install with: pip install sqlglot"
            )
            parser_type = LineageParserType.SQLFLUFF

    # SQLFluff parser (legacy - deprecated)
    if parser_type == LineageParserType.SQLFLUFF:
        warnings.warn(
            "SQLFluff parser (collate-sqllineage) is deprecated and has a 42% success rate. "
            "SQLGlot parser is recommended with 100% success rate. "
            "Consider switching to parser_type='sqlglot'.",
            DeprecationWarning,
            stacklevel=2,
        )
        from metadata.ingestion.lineage.parser import LineageParser

        return LineageParser(
            query, dialect=original_dialect, timeout_seconds=timeout_seconds
        )

    # SQLParse parser (generic fallback)
    if parser_type == LineageParserType.SQLPARSE:
        from metadata.ingestion.lineage.parser import LineageParser

        # Use ANSI dialect for sqlparse
        return LineageParser(
            query, dialect=Dialect.ANSI, timeout_seconds=timeout_seconds
        )

    # Should never reach here, but fallback to SQLGlot
    logger.warning(f"Unexpected parser type {parser_type}, defaulting to SQLGlot")
    from metadata.ingestion.lineage.sqlglot_parser import SQLGlotLineageRunner

    return SQLGlotLineageRunner(query, dialect=dialect, schema=schema)
