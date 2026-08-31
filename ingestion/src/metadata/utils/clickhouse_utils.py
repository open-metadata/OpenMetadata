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
Utils module of Clickhouse

Holds the DDL helpers the generic view lineage path needs. They live here rather than
next to the connector so that `metadata.utils` keeps importing its own layer only, and
so that reading them does not require the `clickhouse_sqlalchemy` plugin dependencies.
"""

import re
from typing import NamedTuple, Optional

# Quoted (backtick / double quote) or bare identifier
_IDENTIFIER = r"(?:`[^`]+`|\"[^\"]+\"|[A-Za-z_$][\w$]*)"

# `CREATE MATERIALIZED VIEW <name> [modifiers] TO <target> [(columns)] AS SELECT ...`
#
# Everything between the view name and the `TO` keyword is optional and version
# dependent (`IF NOT EXISTS`, `ON CLUSTER x`, `REFRESH EVERY 3 HOUR`, ...), so instead
# of enumerating the modifiers we consume any run of characters that reaches neither
# the column list `(`, nor the `AS` that opens the SELECT body. This keeps a column or
# alias named `to` inside the SELECT from being mistaken for the target table.
MATERIALIZED_VIEW_TO_PATTERN = re.compile(
    r"^\s*CREATE\s+(?:OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW\s+"
    r"(?:(?!\bTO\b|\bAS\b)[^()])*"
    rf"\bTO\s+(?:(?P<schema>{_IDENTIFIER})\s*\.\s*)?(?P<table>{_IDENTIFIER})",
    re.IGNORECASE,
)

# `TO INNER UUID '<uuid>'` points at the implicit inner table of a replicated
# materialized view, which is not ingested as an entity.
INNER_TARGET = "INNER"


class MaterializedViewTarget(NamedTuple):
    """Table a materialized view writes its rows into"""

    schema_name: Optional[str]  # noqa: UP045
    table_name: str


def _unquote(identifier: Optional[str]) -> Optional[str]:  # noqa: UP045
    """Strip the backticks or double quotes Clickhouse wraps identifiers in"""
    if not identifier:
        return None
    return identifier.strip().strip("`").strip('"')


def get_materialized_view_target_table(
    view_definition: Optional[str],  # noqa: UP045
) -> Optional[MaterializedViewTarget]:  # noqa: UP045
    """
    Return the table named by the `TO <schema>.<table>` clause of a Clickhouse
    materialized view, if any.

    A materialized view created with `TO` is only a trigger: its rows are written into
    that target table. Since the SQL parsers report the view itself as the write target
    of any `CREATE ... VIEW`, the target table has to be read off the DDL to build the
    downstream edge.

    Returns None for regular views, for materialized views without a `TO` clause and
    for the implicit inner table of a replicated materialized view.
    """
    if not view_definition:
        return None

    match = MATERIALIZED_VIEW_TO_PATTERN.search(view_definition)
    if not match:
        return None

    table_name = _unquote(match.group("table"))
    if not table_name or table_name.upper() == INNER_TARGET:
        return None

    return MaterializedViewTarget(schema_name=_unquote(match.group("schema")), table_name=table_name)
