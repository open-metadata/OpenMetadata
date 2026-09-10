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
Clickhouse view lineage

A materialized view created with `TO <schema>.<table>` holds no data of its own: every
row it computes is written into that target table. The SQL parsers report the view
itself as the only write target of a `CREATE ... VIEW`, so the target has to be read off
the DDL to build the downstream edge.

Plugged into the generic view lineage through `LineageSource.get_view_lineage_extension`.
Kept free of any `clickhouse_sqlalchemy` import so that it costs nothing to load.
"""

import re
from collections.abc import Iterable
from typing import NamedTuple

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.sql_lineage import (
    _build_table_lineage,
    get_table_entities_from_query,
)
from metadata.ingestion.models.ometa_lineage import LineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.models import TableView
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# One SQL token: a quoted identifier, a string literal, a bare word, or a single
# character of punctuation. Whitespace matches nothing and is skipped by `findall`.
# A quoted token honours both ways Clickhouse escapes its delimiter -- a backslash and
# a doubled delimiter -- so that a token never ends inside a quoted name.
TOKEN_PATTERN = re.compile(
    r"`(?:\\.|``|[^`\\])*`"
    r"|\"(?:\\.|\"\"|[^\"\\])*\""
    r"|'(?:\\.|''|[^'\\])*'"
    r"|[A-Za-z_$][\w$]*"
    r"|\S",
    re.DOTALL,
)

MATERIALIZED_VIEW_HEADER_PATTERN = re.compile(r"^\s*CREATE\s+(?:OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW\b", re.IGNORECASE)

# `TO INNER UUID '<uuid>'` points at the implicit inner table of a replicated
# materialized view, which is not ingested as an entity.
INNER_TARGET = "INNER"

_QUOTES = ("`", '"', "'")


class MaterializedViewTarget(NamedTuple):
    """Table a materialized view writes its rows into"""

    schema_name: str | None
    table_name: str


def _is_keyword(token: str, keyword: str) -> bool:
    """A bare word, so that a quoted `to` or `as` never reads as the clause keyword"""
    return not token.startswith(_QUOTES) and token.upper() == keyword


def _identifier(token: str | None) -> str | None:
    """The token's name, unquoted and unescaped, or None when it is not an identifier"""
    if not token:
        return None
    if token.startswith(_QUOTES):
        quote = token[0]
        name = token[1:-1].replace(quote * 2, quote)
        return re.sub(r"\\(.)", r"\1", name) or None
    return token if token[0].isalpha() or token[0] in "_$" else None


def get_materialized_view_target_table(
    view_definition: str | None,
) -> MaterializedViewTarget | None:
    """
    Return the table named by the `TO <schema>.<table>` clause of a materialized view.

    Everything between the view name and the `TO` keyword is optional and version
    dependent (`IF NOT EXISTS`, `ON CLUSTER x`, `REFRESH EVERY 3 HOUR`, ...), so rather
    than enumerating the modifiers we walk the tokens up to the column list or to the
    `AS` that opens the SELECT body. Walking tokens keeps a quoted identifier opaque: a
    view named `orders to ship` carries no `TO` clause.

    Returns None for regular views, for materialized views without a `TO` clause and for
    the implicit inner table of a replicated materialized view.
    """
    if not view_definition:
        return None

    header = MATERIALIZED_VIEW_HEADER_PATTERN.match(view_definition)
    if not header:
        return None

    tokens = TOKEN_PATTERN.findall(view_definition[header.end() :])
    target = None
    for index, token in enumerate(tokens):
        if token == "(" or _is_keyword(token, "AS"):
            break
        if _is_keyword(token, "TO"):
            target = tokens[index + 1 : index + 4]
            break

    if not target:
        return None

    table_name = _identifier(target[0])
    schema_name = None
    if len(target) == 3 and target[1] == "." and _identifier(target[2]):
        schema_name, table_name = table_name, _identifier(target[2])

    if not table_name or table_name.upper() == INNER_TARGET:
        return None

    return MaterializedViewTarget(schema_name=schema_name, table_name=table_name)


def get_mv_target_lineage(
    metadata: OpenMetadata,
    view: TableView,
    view_entity: Table,
    service_names: list[str],
    masked_query: str,
) -> Iterable[Either[LineageRequest]]:
    """
    Build the view -> target table edge of a materialized view created with a `TO` clause.

    A Clickhouse database maps to an OpenMetadata schema, so an unqualified target
    resolves against the schema of the view itself.
    """
    target = get_materialized_view_target_table(view.view_definition)
    if target is None:
        return

    target_schema = target.schema_name or view.schema_name
    target_entities = get_table_entities_from_query(
        metadata=metadata,
        service_names=service_names,
        database_name=view.db_name,
        database_schema=target_schema,
        table_name=target.table_name,
    )
    if not target_entities:
        logger.debug(
            "Target table [%s.%s] of materialized view [%s.%s] not found, skipping downstream lineage",
            target_schema,
            target.table_name,
            view.schema_name,
            view.table_name,
        )
        return

    for target_entity in target_entities:
        yield _build_table_lineage(
            from_entity=view_entity,
            to_entity=target_entity,
            from_table_raw_name=f"{view.schema_name}.{view.table_name}",
            to_table_raw_name=f"{target_schema}.{target.table_name}",
            masked_query=masked_query,
            column_lineage_map={},
            lineage_source=LineageSource.ViewLineage,
        )
