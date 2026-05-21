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
Shared helpers for the YDB connector.

YDB has no schemas — every object lives at a path like ``raw/events``.
In OpenMetadata we project the directory prefix as a ``schema`` and the last
segment as the ``table``, so ``raw/events`` becomes
``schema=raw, table=events``. These helpers encapsulate that rule and are
used by both metadata reflection (`metadata.py`) and view-lineage rewriting
(`lineage.py`).
"""

import re

# Schema name assigned to objects that live at the database root (no '/').
ROOT_SCHEMA = "default"

# Backtick-quoted identifier in YQL. YDB paths cannot contain a backtick,
# so a non-greedy match between two backticks is unambiguous.
_QUOTED_IDENTIFIER = re.compile(r"`([^`\n]+)`")


def schema_of(full_name: str) -> str:
    """Return the directory part (everything before the last '/'), or ROOT_SCHEMA."""
    if "/" in full_name:
        return full_name.rsplit("/", 1)[0]
    return ROOT_SCHEMA


def table_of(full_name: str) -> str:
    """Return the table part (everything after the last '/')."""
    return full_name.rsplit("/", 1)[-1]


def full_name(schema_name: str, table_name: str) -> str:
    """Reconstruct the YDB path from a (schema, table) pair."""
    if schema_name == ROOT_SCHEMA:
        return table_name
    return f"{schema_name}/{table_name}"


def rewrite_yql_paths_to_dotted(sql: str) -> str:
    """
    Rewrite YQL path identifiers so sqlglot parses them as ``schema.table``
    rather than a single quoted name.

    ``CREATE VIEW `marts/analytics/session_stats` AS SELECT ... FROM `staging/events``` →
    ``CREATE VIEW `marts/analytics`.`session_stats` AS SELECT ... FROM `staging`.`events```

    Identifiers without a '/' are left untouched. This is an intermediate
    representation used only inside the lineage parser — it is never stored
    or sent back to YDB.
    """

    def repl(match: "re.Match[str]") -> str:
        name = match.group(1)
        if "/" not in name:
            return match.group(0)
        return f"`{schema_of(name)}`.`{table_of(name)}`"

    return _QUOTED_IDENTIFIER.sub(repl, sql)
