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

A Distributed table holds no data either: it reads from and writes into a local table on
each shard, named by its engine arguments. No query against it says so, so that edge is
read off `system.tables` as well. The edge is only built when this server holds a replica
of the cluster the Distributed table spreads over: a local table of the same name on a
server outside that cluster is a different table.

The materialized view edge is plugged into the generic view lineage through
`LineageSource.get_view_lineage_extension`; the Distributed table edges follow the view
lineage in `ClickhouseLineageSource.yield_view_lineage`.
Kept free of any `clickhouse_sqlalchemy` import so that it costs nothing to load.
"""

import re
import traceback
from collections.abc import Iterable
from typing import NamedTuple

import sqlglot
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlglot import expressions as exp

from metadata.entity_resolution.table_search import search_table_entities
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import QueryParserType
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LINEAGE_PARSING_TIMEOUT, LineageParser
from metadata.ingestion.lineage.sql_lineage import (
    _build_table_lineage,
    get_table_entities_from_query,
)
from metadata.ingestion.models.ometa_lineage import LineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_DISTRIBUTED_TABLES,
    CLICKHOUSE_LOCAL_CLUSTERS,
    CLICKHOUSE_MACROS,
)
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger
from metadata.utils.timeout import timeout

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

DISTRIBUTED_ENGINE_PATTERN = re.compile(r"^\s*Distributed\s*\(")

# `{name}` in a cluster name stands for the `name` macro of the server config. Clickhouse
# expands a substitution that holds macros again, and gives up after ten levels.
MACRO_PATTERN = re.compile(r"\{([^{}]*)\}")
MAX_MACRO_EXPANSION_DEPTH = 10

# `TO INNER UUID '<uuid>'` points at the implicit inner table of a replicated
# materialized view, which is not ingested as an entity.
INNER_TARGET = "INNER"

_QUOTES = ("`", '"', "'")


class MaterializedViewTarget(NamedTuple):
    """Table a materialized view writes its rows into"""

    schema_name: str | None
    table_name: str


class DistributedLocalTable(NamedTuple):
    """Table a Distributed table reads from and writes into on each shard of its cluster"""

    cluster_name: str
    schema_name: str
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


def _input_view_query(query: str) -> str | None:
    statement = sqlglot.parse_one(query, read="clickhouse")
    if not isinstance(statement, exp.Create) or statement.args.get("kind") != "VIEW":
        return None
    properties = statement.args.get("properties")
    if not isinstance(properties, exp.Properties) or not isinstance(statement.expression, exp.Query):
        return None
    if not any(isinstance(prop, exp.MaterializedProperty) for prop in properties.expressions):
        return None
    if not any(isinstance(prop, exp.ToTableProperty) for prop in properties.expressions):
        return None
    properties.set(
        "expressions", [prop for prop in properties.expressions if not isinstance(prop, exp.ToTableProperty)]
    )
    return statement.sql(dialect="clickhouse")


def get_view_lineage_parser(
    query: str,
    dialect: Dialect = Dialect.CLICKHOUSE,
    timeout_seconds: int = LINEAGE_PARSING_TIMEOUT,
    parser_type: QueryParserType = QueryParserType.Auto,
) -> LineageParser:
    """Parse materialized-view inputs separately from the explicit TO output edge."""
    original = LineageParser(query, dialect, timeout_seconds=timeout_seconds, parser_type=parser_type)
    try:
        input_query = timeout(timeout_seconds)(_input_view_query)(query)
        if input_query is None:
            return original
        parser = LineageParser(input_query, dialect, timeout_seconds=timeout_seconds, parser_type=parser_type)
        if parser.parser is None:
            return original
    except Exception:
        logger.debug("[%s] Cannot normalize ClickHouse view DDL; retaining native parsing", original.query_hash)
        return original
    # The graph uses normalized DDL; lineage consumers must retain the original masked definition.
    parser.query = original.query
    parser.query_hash = original.query_hash
    parser.masked_query = original.masked_query
    return parser


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


def get_distributed_local_table(engine_full: str | None) -> DistributedLocalTable | None:
    """
    Return the cluster and local table named by
    `Distributed(cluster, database, table[, sharding_key[, policy]])`.

    Clickhouse evaluates the database and table arguments when the table is created and stores
    them as string literals, so `currentDatabase()` or a bare identifier is read back as a quoted
    name. An empty database stands for the default database of each shard, which the Distributed
    table does not record, so no local table is returned for it. The cluster name is returned as
    stored, with macros such as `{cluster}` unexpanded: Clickhouse expands them when it loads the
    table.
    """
    if not engine_full:
        return None

    header = DISTRIBUTED_ENGINE_PATTERN.match(engine_full)
    if not header:
        return None

    tokens = TOKEN_PATTERN.findall(engine_full[header.end() :])
    if len(tokens) < 6 or tokens[1] != "," or tokens[3] != "," or tokens[5] not in (",", ")"):
        return None

    cluster_name = _identifier(tokens[0])
    schema_name = _identifier(tokens[2])
    table_name = _identifier(tokens[4])
    if not cluster_name or not schema_name or not table_name:
        return None

    return DistributedLocalTable(cluster_name=cluster_name, schema_name=schema_name, table_name=table_name)


def expand_macros(name: str, macros: dict[str, str]) -> str | None:
    """
    Expand the `{macro}` placeholders of a cluster name the way Clickhouse does.

    Returns None when a macro is not defined on this server or the expansion does not settle.
    """
    for _ in range(MAX_MACRO_EXPANSION_DEPTH):
        macro_names = MACRO_PATTERN.findall(name)
        if not macro_names:
            return name
        if any(macro_name not in macros for macro_name in macro_names):
            return None
        name = MACRO_PATTERN.sub(lambda match: macros[match.group(1)], name)
    return None


def _get_single_table(metadata: OpenMetadata, service_name: str, schema_name: str, table_name: str) -> Table | None:
    tables = search_table_entities(
        metadata=metadata,
        service_names=service_name,
        database=None,
        database_schema=schema_name,
        table=table_name,
    )
    if tables and len(tables) > 1:
        logger.warning(
            "Table [%s.%s] matches %d tables in service [%s], skipping Distributed table lineage",
            schema_name,
            table_name,
            len(tables),
            service_name,
        )
        return None
    return tables[0] if tables else None


class LocalClusters(NamedTuple):
    """Clusters this server holds a replica of, and the macros a cluster name may use"""

    names: frozenset[str]
    macros: dict[str, str]


def _find_local_entity(
    metadata: OpenMetadata,
    service_name: str,
    distributed_name: str,
    distributed_entity: Table,
    engine_full: str | None,
    local_clusters: LocalClusters,
) -> Table | None:
    """The local table of a Distributed table, or None, with a warning, when it cannot be told"""
    local_table = get_distributed_local_table(engine_full)
    if local_table is None:
        logger.warning(
            "Cannot read the local table of Distributed table [%s] from [%s], skipping its lineage",
            distributed_name,
            engine_full,
        )
        return None

    cluster_name = expand_macros(local_table.cluster_name, local_clusters.macros)
    if cluster_name is None:
        logger.warning(
            "Cannot expand the macros of cluster [%s] of Distributed table [%s], skipping its lineage",
            local_table.cluster_name,
            distributed_name,
        )
        return None
    # On a server outside the cluster, a table of the same name is not one of its shards
    if cluster_name not in local_clusters.names:
        logger.warning(
            "This server holds no replica of cluster [%s] of Distributed table [%s], skipping its lineage",
            cluster_name,
            distributed_name,
        )
        return None

    local_entity = _get_single_table(metadata, service_name, local_table.schema_name, local_table.table_name)
    # A Distributed table may name itself when its local tables live only on the other servers
    if local_entity is None or local_entity.id == distributed_entity.id:
        logger.warning(
            "Local table [%s.%s] of Distributed table [%s] not found, skipping its lineage",
            local_table.schema_name,
            local_table.table_name,
            distributed_name,
        )
        return None
    return local_entity


def _remove_replaced_edges(
    metadata: OpenMetadata,
    service_name: str,
    distributed_entity: Table,
    local_entity: Table | None,
) -> None:
    """
    Delete the view lineage edges into a Distributed table that its definition no longer gives.

    Only the edges this module builds are deleted: view lineage edges from another table of the
    service. A materialized view writing `TO` the Distributed table leaves a view lineage edge
    into it as well, which is kept, as are the edges of every other source, manual ones included.
    """
    distributed_id = model_str(distributed_entity.id)
    current_id = model_str(local_entity.id) if local_entity else None
    lineage = metadata.get_lineage_by_id(Table, distributed_id, up_depth=1, down_depth=0) or {}
    for edge in lineage.get("upstreamEdges") or []:
        upstream_id = edge.get("fromEntity")
        if not upstream_id or upstream_id == current_id or edge.get("toEntity") != distributed_id:
            continue
        if (edge.get("lineageDetails") or {}).get("source") != LineageSource.ViewLineage.value:
            continue
        upstream = metadata.get_by_id(Table, upstream_id)
        if upstream is None or upstream.tableType == TableType.MaterializedView:
            continue
        upstream_fqn = model_str(upstream.fullyQualifiedName)
        if fqn.unquote_name(fqn.split(upstream_fqn)[0]) != service_name:
            continue
        logger.info(
            "Removing lineage edge [%s] -> [%s]: the Distributed table no longer reads from it",
            upstream_fqn,
            model_str(distributed_entity.fullyQualifiedName),
        )
        metadata.delete_lineage_edge(
            EntitiesEdge(
                fromEntity=EntityReference(id=upstream.id, type="table"),
                toEntity=EntityReference(id=distributed_entity.id, type="table"),
            )
        )


def get_distributed_table_lineage(
    metadata: OpenMetadata,
    engine: Engine,
    service_name: str,
    source_config: DatabaseServiceQueryLineagePipeline,
) -> Iterable[Either[AddLineageRequest]]:
    """
    Build the local table -> Distributed table edge of every Distributed table of the service.

    The local table is looked up in the same service by its database and name, once the cluster
    of the Distributed table is known to have a replica on this server. The filter patterns apply
    to the Distributed table, as they apply to the view in the view lineage.

    With `overrideViewLineage`, the edges that a previous definition of the Distributed table gave
    are removed, including when its current local table cannot be told.
    """
    try:
        with engine.connect() as conn:
            rows = conn.execute(text(CLICKHOUSE_DISTRIBUTED_TABLES)).fetchall()
            local_clusters = LocalClusters(
                names=frozenset(row.cluster for row in conn.execute(text(CLICKHOUSE_LOCAL_CLUSTERS))),
                macros={row.macro: row.substitution for row in conn.execute(text(CLICKHOUSE_MACROS))},
            )
    # Broad on purpose: the default `clickhouse+http` driver raises its own `DatabaseException`
    # for any server-side error, and SQLAlchemy does not wrap it
    except Exception as exc:
        yield Either(
            left=StackTraceError(
                name="Distributed table lineage",
                error=f"Failed to fetch the Clickhouse Distributed tables and clusters, skipping their lineage: {exc}",
                stackTrace=traceback.format_exc(),
            ),
            right=None,
        )
        return

    for schema_name, table_name, engine_full in rows:
        if filter_by_schema(source_config.schemaFilterPattern, schema_name) or filter_by_table(
            source_config.tableFilterPattern, table_name
        ):
            continue

        distributed_entity = _get_single_table(metadata, service_name, schema_name, table_name)
        if distributed_entity is None:
            logger.debug("Distributed table [%s.%s] not found, skipping its lineage", schema_name, table_name)
            continue
        database_name = fqn.unquote_name(fqn.split(model_str(distributed_entity.fullyQualifiedName))[1])
        if filter_by_database(source_config.databaseFilterPattern, database_name):
            continue

        local_entity = _find_local_entity(
            metadata, service_name, f"{schema_name}.{table_name}", distributed_entity, engine_full, local_clusters
        )

        # Not done by marking the edge to override: that deletes every view lineage edge into the
        # Distributed table, the one of a materialized view writing `TO` it included
        if source_config.overrideViewLineage:
            try:
                _remove_replaced_edges(metadata, service_name, distributed_entity, local_entity)
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Distributed table lineage",
                        error=f"Failed to remove the replaced lineage of Distributed table "
                        f"[{schema_name}.{table_name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    ),
                    right=None,
                )

        if local_entity is None:
            continue

        yield Either(
            left=None,
            right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=local_entity.id, type="table"),
                    toEntity=EntityReference(id=distributed_entity.id, type="table"),
                    lineageDetails=LineageDetails(source=LineageSource.ViewLineage),
                )
            ),
        )
