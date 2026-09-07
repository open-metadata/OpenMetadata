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

# Bounded so the span cannot run to the next paren anywhere in the statement, which would let
# `UPDATE call_log SET x = pkg.refresh_stats(1)` resolve to a real procedure. `\s` crosses
# newlines, so multi-line calls match without re.DOTALL. Unquoted covers Oracle's
# `[schema.][package|type][@dblink] name` and the `$` / `#` its identifiers allow. A quoted
# segment is taken whole, since a delimited identifier may hold any character, which is how
# BigQuery spells a hyphenated project id.
# https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CALL.html
# https://cloud.google.com/bigquery/docs/reference/standard-sql/lexical
# https://docs.snowflake.com/en/sql-reference/identifiers-syntax
_NAME_SPAN = r"(?:[\s\w.@$#]|`[^`]*`|\"[^\"]*\")*?"
NAME_PATTERN = (
    rf"(?<=\bcall){_NAME_SPAN}(?=\()"
    rf"|(?<=\bbegin){_NAME_SPAN}(?=\()"
    rf"|(?<=\bbegin){_NAME_SPAN}(?=;\s*end)"
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
            .replace("`", "")  # Clean weird characters from escaping the SQL
            .split(".")[-1]
        )
    except Exception as exc:
        logger.warning(f"Error trying to get the procedure name in [{query_text}] due to [{exc}]")
        return None
