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

import sqlparse
from sqlfluff.core import Linter
from sqlparse.sql import Comparison
from sqlparse.tokens import Literal, Number, String

from metadata.ingestion.lineage.models import Dialect

MASK_TOKEN = "?"


def get_logger():
    # pylint: disable=import-outside-toplevel
    from metadata.utils.logger import utils_logger

    return utils_logger()


def mask_literals_with_sqlparse(query: str):
    """
    Mask literals in a query using sqlparse.
    """
    logger = get_logger()

    try:
        parsed = sqlparse.parse(query)  # Parse the query

        if not parsed:
            return query
        parsed = parsed[0]

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


def mask_literals_with_sqlfluff(query: str, dialect: str = Dialect.ANSI.value) -> str:
    """
    Mask literals in a query using SQLFluff.
    """
    logger = get_logger()
    try:
        # Initialize SQLFluff linter
        linter = Linter(dialect=dialect)

        # Parse the query
        parsed = linter.parse_string(query)

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


def mask_query(query: str, dialect: str = Dialect.ANSI.value) -> str:
    logger = get_logger()
    try:
        sqlfluff_masked_query = mask_literals_with_sqlfluff(query, dialect)
        sqlparse_masked_query = mask_literals_with_sqlparse(query)
        # compare both masked queries and return the one with more masked tokens
        if sqlfluff_masked_query.count(MASK_TOKEN) >= sqlparse_masked_query.count(
            MASK_TOKEN
        ):
            return sqlfluff_masked_query
        return sqlparse_masked_query
    except Exception as exc:
        logger.debug(f"Failed to mask query with sqlfluff: {exc}")
        logger.debug(traceback.format_exc())
    return query
