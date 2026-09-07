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

# The span between the keyword and the opening paren (or the statement-terminating `end`) is
# limited to identifier, qualifier and whitespace characters. `\s` already crosses newlines, so a
# CALL or BEGIN block split over several lines still matches without re.DOTALL, while the walk
# stops at the first operator or separator. An unbounded `.*?` under re.DOTALL would instead run
# to the next paren anywhere in the statement, so ordinary SQL that merely contains the substring
# `call` or `begin` (`call_center`, `begin_date`) would yield a bogus name, and a statement like
# `UPDATE call_log SET x = pkg.refresh_stats(1)` would resolve to a real procedure and fabricate
# lineage. The `\b` before each keyword keeps `recall` and similar from matching at all.
_NAME_SPAN = r"[\s\w.`\"]*?"
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
