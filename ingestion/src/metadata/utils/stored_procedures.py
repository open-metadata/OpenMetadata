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
Stored Procedures Utilities
"""

import re

from metadata.utils.logger import utils_logger

logger = utils_logger()

# The optionally qualified procedure name, plus the whitespace before it. Bounded on purpose:
# an unbounded `.*?` runs to the next paren anywhere in the statement, which would let
# `UPDATE call_log SET x = pkg.refresh_stats(1)` resolve to a real procedure. `\s` matches
# newlines, so a multi-line call parses without re.DOTALL.
#
# Unquoted covers Oracle's `[schema.][package|type][@dblink] name` and the `$` / `#` its
# identifiers allow. A quoted segment is taken whole, since a delimited identifier may hold any
# character, which is how BigQuery spells a hyphenated project id.
# https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CALL.html
# https://cloud.google.com/bigquery/docs/reference/standard-sql/lexical
# https://docs.snowflake.com/en/sql-reference/identifiers-syntax
_QUALIFIED_NAME = r"(?:[\s\w.@$#]|`[^`]*`|\"[^\"]*\")*?"

# Where the name ends. A `CALL` runs up to the argument list. A parameterless PL/SQL call inside
# a block has no argument list, so it runs up to the statement terminator instead.
_BEFORE_ARG_LIST = r"(?=\()"
_BEFORE_BLOCK_END = r"(?=;\s*end)"


def _invocation(keyword: str, ends_at: str) -> str:
    """Build one `<keyword> <qualified name>` alternation.

    The keyword needs a boundary on both sides. `\\b` before it rejects `recall`, and `(?!\\w)`
    after it rejects an identifier that merely starts with the keyword, so `SELECT call_center(1)`
    is not read as an invocation of a procedure named `_center`.
    """
    return rf"(?<=\b{keyword})(?!\w){_QUALIFIED_NAME}{ends_at}"


NAME_PATTERN = "|".join(
    (
        _invocation("call", _BEFORE_ARG_LIST),
        _invocation("begin", _BEFORE_ARG_LIST),
        _invocation("begin", _BEFORE_BLOCK_END),
    )
)


def get_procedure_name_from_call(query_text: str, sensitive_match: bool = False) -> str | None:
    """
    In the query text we'll have:
    - `CALL db.schema.procedure_name(...)`,
    - `CALL schema.procedure_name(...)`
    - `CALL procedure_name(...)`.

    We need to get the procedure name in these 3 cases.

    We'll return the lowered procedure name
    """

    res = re.search(NAME_PATTERN, query_text, re.IGNORECASE if not sensitive_match else 0)
    if not res:
        return None

    try:
        return (
            res.group(0)  # Get the first match
            .strip()  # Remove whitespace
            .lower()  # Replace all the lowercase variants of the procedure name prefixes
            # Drop the identifier delimiters. StoredProcedure entity names are stored
            # undelimited, and the caller matches on `procedure.name.root.lower()`, so a name
            # kept as `"my proc"` would never match the entity it names.
            .replace("`", "")
            .replace('"', "")
            .split(".")[-1]
        )
    except Exception as exc:
        logger.warning(f"Error trying to get the procedure name in [{query_text}] due to [{exc}]")
        return None
