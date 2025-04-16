#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Query masking utilities
"""

import traceback

from collate_sqllineage.runner import SQLPARSE_DIALECT, LineageRunner
from sqlparse.sql import Comparison
from sqlparse.tokens import Literal, Number, String

from metadata.ingestion.lineage.models import Dialect
from metadata.utils.execution_time_tracker import calculate_execution_time

MASK_TOKEN = "?"


# pylint: disable=protected-access
def get_logger():
    # pylint: disable=import-outside-toplevel
    from metadata.utils.logger import utils_logger

    return utils_logger()


def mask_literals_with_sqlparse(query: str, parser: LineageRunner):
    """
    Mask literals in a query using sqlparse.
    """
    logger = get_logger()

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
                Literal.String.Single,
                Literal.String.Symbol,
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
        logger.debug(f"Failed to mask query with sqlparse: {exc}")
        logger.debug(traceback.format_exc())

    return query


def mask_literals_with_sqlfluff(query: str, parser: LineageRunner) -> str:
    """
    Mask literals in a query using SQLFluff.
    """
    logger = get_logger()
    try:
        if not parser._evaluated:
            parser._eval()

        parsed = parser._parsed_result

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
        logger.debug(f"Failed to mask query with sqlfluff: {exc}")
        logger.debug(traceback.format_exc())

    return query


@calculate_execution_time(context="MaskQuery")
def mask_query(
    query: str,
    dialect: str = Dialect.ANSI.value,
    parser: LineageRunner = None,
    parser_required: bool = False,
) -> str:
    logger = get_logger()
    try:
        if parser_required and not parser:
            return None
        if not parser:
            try:
                parser = LineageRunner(query, dialect=dialect)
                len(parser.source_tables)
            except Exception:
                parser = LineageRunner(query)
                len(parser.source_tables)
        if parser._dialect == SQLPARSE_DIALECT:
            return mask_literals_with_sqlparse(query, parser)
        return mask_literals_with_sqlfluff(query, parser)
    except Exception as exc:
        logger.debug(f"Failed to mask query with sqlfluff: {exc}")
        logger.debug(traceback.format_exc())
    return None
