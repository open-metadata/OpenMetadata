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
Query masking utilities

Masking functions (SqlParse, SqlFluff) reuse the already-parsed AST
from the LineageRunner to avoid duplicate parsing and improve performance.
"""

import time
import traceback
from typing import Optional

from cachetools import LRUCache
from collate_sqllineage.core.parser.sqlfluff.analyzer import SqlFluffLineageAnalyzer
from collate_sqllineage.core.parser.sqlparse.analyzer import SqlParseLineageAnalyzer
from collate_sqllineage.runner import LineageRunner
from sqlparse.sql import Comparison
from sqlparse.tokens import Literal, Number, String

from metadata.ingestion.lineage.models import Dialect
from metadata.utils.execution_time_tracker import (
    calculate_execution_time,
    pretty_print_time_duration,
)
from metadata.utils.logger import utils_logger

logger = utils_logger()

MASK_TOKEN = "?"

# Cache size is 128 to avoid memory issues
masked_query_cache = LRUCache(maxsize=128)


@calculate_execution_time(context="MaskLiteralsSqlParse")
def mask_literals_with_sqlparse(
    query: str, parser: LineageRunner, query_hash: Optional[str] = None
):
    """
    Mask literals in a query using SqlParse.
    """
    try:
        parsed = parser._parsed_result

        def mask_token(token):
            # Mask all literals: strings, numbers, or other literal values
            if token.ttype in (
                String,
                Number,
                Literal.String.Single,
                Literal.Number.Integer,
                Literal.Number.Float,
            ):
                token.value = MASK_TOKEN
            elif token.is_group:
                # Recursively process grouped tokens
                for t in token.tokens:
                    mask_token(t)

        # Process all tokens
        for token in parsed.tokens:
            if isinstance(token, Comparison):
                # In comparisons, mask both sides if literals
                for t in token.tokens:
                    mask_token(t)
            else:
                mask_token(token)

        # Return the formatted masked query
        return str(parsed)
    except Exception as exc:
        hash_prefix = f"[{query_hash}] " if query_hash else ""
        logger.debug(f"{hash_prefix}Failed to mask query with SqlParse: {exc}")
        logger.debug(traceback.format_exc())

    return query


@calculate_execution_time(context="MaskLiteralsSqlFluff")
def mask_literals_with_sqlfluff(
    query: str, parser: LineageRunner, query_hash: Optional[str] = None
) -> str:
    """
    Mask literals in a query using SqlFluff.
    """
    try:
        if not parser._evaluated:
            parser._eval()

        parsed = parser._parsed_result

        if parsed is None:
            hash_prefix = f"[{query_hash}] " if query_hash else ""
            logger.debug(
                f"{hash_prefix}Skipping SqlFluff query masking as parsed result is None"
            )
            return query

        def replace_literals(segment):
            """Recursively replace literals with placeholders."""
            if segment.is_type("literal", "quoted_literal", "numeric_literal"):
                return MASK_TOKEN
            if segment.segments:
                # Recursively process sub-segments
                return "".join(
                    replace_literals(sub_seg) for sub_seg in segment.segments
                )
            return segment.raw

        # Reconstruct the query with masked literals
        masked_query = "".join(
            replace_literals(segment) for segment in parsed.tree.segments
        )
        return masked_query
    except Exception as exc:
        hash_prefix = f"[{query_hash}] " if query_hash else ""
        logger.debug(f"{hash_prefix}Failed to mask query with SqlFluff: {exc}")
        logger.debug(traceback.format_exc())

    return query


@calculate_execution_time(context="GetSqlParseLineageRunner")
def get_sqlparse_lineage_runner(query: str) -> LineageRunner:
    lr_sqlparse = LineageRunner(query, analyzer=SqlParseLineageAnalyzer)
    len(lr_sqlparse.source_tables)
    return lr_sqlparse


@calculate_execution_time(context="GetSqlFluffLineageRunner")
def get_sqlfluff_lineage_runner(query: str, dialect: str) -> LineageRunner:
    lr_sqlfluff = LineageRunner(
        query, dialect=dialect, analyzer=SqlFluffLineageAnalyzer
    )
    len(lr_sqlfluff.source_tables)
    return lr_sqlfluff


@calculate_execution_time(context="MaskQuery")
def mask_query(
    query: str,
    dialect: str = Dialect.ANSI.value,
    parser: Optional[LineageRunner] = None,
    parser_required: bool = False,
    query_hash: Optional[str] = None,
) -> Optional[str]:
    """Evaluate and return the best available parser for the query."""
    hash_prefix = f"[{query_hash}] " if query_hash else ""

    start_time = time.time()
    masked_query = mask_query_impl(query, dialect, parser, parser_required, query_hash)
    elapsed = time.time() - start_time

    elapsed_str = pretty_print_time_duration(elapsed)
    logger.debug(f"{hash_prefix}Query masking completed in {elapsed_str}")

    return masked_query


def mask_query_impl(
    query: str,
    dialect: str = Dialect.ANSI.value,
    parser: Optional[LineageRunner] = None,
    parser_required: bool = False,
    query_hash: Optional[str] = None,
) -> Optional[str]:
    """
    Mask a query using SqlParse or SqlFluff.
    Only these two analyzers support literal masking (SqlGlot is excluded).
    """
    hash_prefix = f"[{query_hash}] " if query_hash else ""

    try:
        if masked_query_cache.get((query, dialect)):
            return masked_query_cache.get((query, dialect))
        if parser_required and not parser:
            logger.debug(f"{hash_prefix}Query masking skipped as no parser available.")
            return None

        masking_parser = None

        # Only reuse parser if it's already SqlParse or SqlFluff
        if parser and isinstance(
            parser._analyzer, (SqlParseLineageAnalyzer, SqlFluffLineageAnalyzer)
        ):
            masking_parser = parser

        # If no suitable parser, create one with fallback: SqlParse → SqlFluff
        if not masking_parser:
            try:
                masking_parser = get_sqlparse_lineage_runner(query)
            except Exception:
                masking_parser = get_sqlfluff_lineage_runner(query, dialect=dialect)

        logger.debug(
            f"{hash_prefix}Query masking started using [{masking_parser._analyzer.__class__.__name__}]"
            f" for parser [{parser and parser._analyzer.__class__.__name__}]"
        )

        # Dispatch to appropriate masking function
        if isinstance(masking_parser._analyzer, SqlFluffLineageAnalyzer):
            masked_query = mask_literals_with_sqlfluff(
                query, masking_parser, query_hash
            )
        elif isinstance(masking_parser._analyzer, SqlParseLineageAnalyzer):
            masked_query = mask_literals_with_sqlparse(
                query, masking_parser, query_hash
            )
        else:
            logger.debug(
                f"{hash_prefix}Query masking skipped as no supported analyzer available."
                f" Analyzer: {masking_parser._analyzer}"
            )
            return None

        masked_query_cache[(query, dialect)] = masked_query
        return masked_query
    except Exception as exc:
        logger.debug(f"{hash_prefix}Failed to mask query: {exc}")
        logger.debug(traceback.format_exc())
    return None
