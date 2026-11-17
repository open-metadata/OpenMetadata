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
Helper functions to handle SQL lineage operations
"""

import functools
import itertools
import re
import traceback
from collections import defaultdict
from collections.abc import Iterable
from copy import deepcopy
from typing import Any, cast

import networkx as nx
from collate_sqllineage.core.holders import SQLLineageHolder
from collate_sqllineage.core.models import Column, DataFunction
from collate_sqllineage.core.models import Table as LineageTable
from networkx import DiGraph

from metadata.entity_resolution.table_search import (
    DEFAULT_SCHEMA_NAME,
    database_service_type_cache,  # noqa: F401 - compatibility import of the shared cache
    get_database_service_type,  # noqa: F401 - compatibility import
    get_table_fqn_from_query_name,
    search_cache,  # noqa: F401 - compatibility import of the shared cache
    search_table_entities,
)
from metadata.generated.schema.entity.data.storedProcedure import (
    Language,
    StoredProcedure,
    StoredProcedureType,
)
from metadata.generated.schema.entity.data.table import Column as TableColumn
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import (
    QueryParserType,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import (
    LINEAGE_PARSING_TIMEOUT,
    NOTHING_COPIED,
    CopiedColumns,
    LineageParser,
)
from metadata.ingestion.models.ometa_lineage import (
    LineageRequest,
    OMetaFQNLineageRequest,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils import fqn
from metadata.utils.elasticsearch import get_entity_from_es_result
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.logger import utils_logger
from metadata.utils.timeout import timeout

logger = utils_logger()
CUTOFF_NODES = 20
NODE_PROCESSING_TIMEOUT = 30  # seconds
# Column lineage map key for fields read through a STRUCT path (`customer.email`,
# `customer.*`): the parser reports `customer` as a table the query never reads.
STRUCT_FIELD_PARENT = "<struct>"


# pylint: disable=too-many-function-args,protected-access
def get_column_fqn(
    table_entity: Table,
    column: str,
    table: str | None = None,
    schema: str | None = None,
    database: str | None = None,
) -> str | None:
    """
    Get fqn of column if exist in table entity
    """
    if (
        (not table_entity)
        or (table and table != table_entity.name.root)
        or (schema and schema != table_entity.databaseSchema.name)
        or (database and database != table_entity.database.name)
    ):
        return None

    for tbl_column in table_entity.columns or []:
        try:
            if column.lower() == tbl_column.name.root.lower():
                return tbl_column.fullyQualifiedName.root
        except Exception as e:
            logger.debug(traceback.format_exc())
            logger.debug(
                f"Error getting column FQN for column [{column}] in"
                f"table [{table_entity.fullyQualifiedName}] for column [{tbl_column}]: {e}"
            )

    return None


def __process_intermediate_column_lineage(
    intermediate_column_lineage: dict,
    result: dict,
    source_table: str,
    intermediate_table: str,
    intermediate_column: str,
    source_column: str,
):
    # Check intermediate dictionary for mappings
    for (
        target_table,
        target_mappings,
    ) in intermediate_column_lineage[intermediate_table].items():
        for inter_col, target_col in target_mappings:
            if intermediate_column == inter_col:
                # Append to the result dictionary
                if target_table not in result[source_table]:
                    result[source_table][target_table] = []
                result[source_table][target_table].append((source_column, target_col))


def __process_column_mappings(mappings: dict, result: dict, source_table: str, intermediate_column_lineage: dict):
    for intermediate_table, column_pairs in mappings.items():
        # Iterate through each column mapping in the original dictionary
        for source_column, intermediate_column in column_pairs:
            if intermediate_table in intermediate_column_lineage:
                __process_intermediate_column_lineage(
                    intermediate_column_lineage,
                    result,
                    source_table,
                    intermediate_table,
                    intermediate_column,
                    source_column,
                )


def handle_udf_column_lineage(
    column_lineage_original: dict,
    column_lineage_generated: list[tuple[Column, Column]],
):
    """
    Handle UDF column lineage
    """
    try:
        result = defaultdict(dict)
        intermediate_column_lineage = populate_column_lineage_map(column_lineage_generated)
        # Iterate through the original dictionary
        for source_table, mappings in column_lineage_original.items():
            __process_column_mappings(mappings, result, source_table, intermediate_column_lineage)
        column_lineage_original.update(result)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Error handling UDF column lineage: {exc}")


@functools.lru_cache(maxsize=1000)
def _get_udf_parser(
    code: str,
    dialect: Dialect,
    timeout_seconds: int,
    parser_type: QueryParserType = QueryParserType.Auto,
) -> LineageParser | None:
    if code:
        return LineageParser(
            f"create table dummy_table_name as {code}",
            dialect=dialect,
            timeout_seconds=timeout_seconds,
            parser_type=parser_type,
        )
    return None


def _replace_target_table(parser: LineageParser, expected_table_name: str) -> LineageParser:
    try:
        # Create a new target table instead of modifying the existing one
        # Replace "<default>." with empty string to handle schema prefix correctly
        clean_table_name = expected_table_name.replace(f"{DEFAULT_SCHEMA_NAME}.", "")
        new_table = LineageTable(clean_table_name)

        # Create a new statement holder with the updated target table
        stmt_holder = parser.parser._stmt_holders[0]
        old_write = list(stmt_holder.write)[0]  # Get the original target table  # noqa: RUF015

        # Remove old target table and add new one
        stmt_holder.graph.remove_node(old_write)
        stmt_holder.add_write(new_table)

        # Rebuild column lineage
        for col_lineage in parser.parser.get_column_lineage():
            if col_lineage[-1].parent == old_write:
                # Create new column with same name but parent is new table
                tgt_col = col_lineage[-1]
                new_tgt_col = Column(tgt_col.raw_name)
                new_tgt_col.parent = new_table

                # Add the column lineage from source to new target
                stmt_holder.add_column_lineage(col_lineage[-2], new_tgt_col)
                try:  # noqa: SIM105
                    # remove the old edge
                    stmt_holder.graph.remove_edge(col_lineage[-2], tgt_col)
                except Exception:
                    # if the edge is not present, pass
                    pass

        # Rebuild the SQL holder
        parser.parser._sql_holder = SQLLineageHolder.of(*parser.parser._stmt_holders)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.debug(f"Error replacing target table: {exc}")


# pylint: disable=too-many-arguments
def __process_udf_es_results(
    metadata: OpenMetadata,
    dialect: Dialect,
    source_table: DataFunction | LineageTable,
    database_name: str | None,
    schema_name: str | None,
    service_names: str | list[str],
    timeout_seconds: int,
    column_lineage: dict,
    es_result_entities: list[StoredProcedure],
    procedure: StoredProcedure | None = None,
):
    if isinstance(service_names, str):
        service_names = [service_names]

    for entity in es_result_entities:
        if (
            entity.storedProcedureType == StoredProcedureType.UDF
            and entity.storedProcedureCode
            and entity.storedProcedureCode.language == Language.SQL
        ):
            lineage_parser = _get_udf_parser(entity.storedProcedureCode.code, dialect, timeout_seconds)
            if lineage_parser and lineage_parser.parser:
                expected_table_name = str(source_table).replace(f"{DEFAULT_SCHEMA_NAME}.", "")
                lineage_parser_copy = deepcopy(lineage_parser)
                _replace_target_table(lineage_parser_copy, expected_table_name)

                handle_udf_column_lineage(column_lineage, lineage_parser_copy.column_lineage)
                for source in lineage_parser_copy.source_tables or []:
                    yield from get_source_table_names(
                        metadata,
                        dialect,
                        source,
                        database_name,
                        schema_name,
                        service_names,
                        timeout_seconds,
                        column_lineage,
                        procedure or entity,
                    )


def __process_udf_table_names(
    metadata: OpenMetadata,
    dialect: Dialect,
    source_table: DataFunction | LineageTable,
    database_name: str | None,
    schema_name: str | None,
    service_names: str | list[str],
    timeout_seconds: int,
    column_lineage: dict,
    procedure: StoredProcedure | None = None,
):
    if isinstance(service_names, str):
        service_names = [service_names]

    database_query, schema_query, table = get_table_fqn_from_query_name(str(source_table))
    function_fqn_string = build_es_fqn_search_string(
        database_name=database_query or database_name,
        schema_name=schema_query or schema_name,
        service_name=service_names[0],  # Use first service for table entity lookup
        table_name=table,
    )
    es_result_entities: list[StoredProcedure] | None = metadata.es_search_from_fqn(
        entity_type=StoredProcedure,
        fqn_search_string=function_fqn_string,
    )
    if es_result_entities:
        yield from __process_udf_es_results(
            metadata,
            dialect,
            source_table,
            database_name,
            schema_name,
            service_names,
            timeout_seconds,
            column_lineage,
            es_result_entities,
            procedure,
        )


def get_source_table_names(
    metadata: OpenMetadata,
    dialect: Dialect,
    source_table: DataFunction | LineageTable,
    database_name: str | None,
    schema_name: str | None,
    service_names: str | list[str],
    timeout_seconds: int,
    column_lineage: dict,
    procedure: StoredProcedure | None = None,
) -> Iterable[tuple[EntityReference | None, str]]:
    """
    Get source table names from DataFunction
    """
    if isinstance(service_names, str):
        service_names = [service_names]

    try:
        if not isinstance(source_table, DataFunction):
            yield (
                (EntityReference(id=procedure.id.root, type="storedProcedure") if procedure else None),
                str(source_table),
            )
        else:
            yield from __process_udf_table_names(
                metadata,
                dialect,
                source_table,
                database_name,
                schema_name,
                service_names,
                timeout_seconds,
                column_lineage,
                procedure,
            )

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Error getting source table names for table [{source_table}]: {exc}")


def get_table_entities_from_query(
    metadata: OpenMetadata,
    service_names: str | list[str],
    database_name: str,
    database_schema: str,
    table_name: str,
    schema_fallback: bool = False,
) -> list[Table] | None:
    """
    Fetch data from API and ES with a fallback strategy.

    If the sys data is incorrect, use the table name ingredients.

    :param service_names: Service(s) being ingested (current + cross db)
    :param database_name: Name of the database informed on db sys results
    :param database_schema: Name of the schema informed on db sys results
    :param table_name: Table name extracted from query. Can be `table`, `schema.table` or `db.schema.table`
    :return: List of tables matching the criteria
    """

    # First try to find the data from the given db and schema (with table name as given or uppercase)
    # Otherwise, pick it up from the table_name str (with table name as given or uppercase)

    database_query, schema_query, table = get_table_fqn_from_query_name(table_name)

    table_entities = search_table_entities(
        metadata=metadata,
        service_names=service_names,
        database=database_query if database_query else database_name,
        database_schema=schema_query if schema_query else database_schema,
        table=table,
    )

    if table_entities:
        return table_entities

    if schema_fallback:
        table_entities = search_table_entities(
            metadata=metadata,
            service_names=service_names,
            database=database_query if database_query else database_name,
            database_schema=None,
            table=table,
        )
        if table_entities:
            return table_entities

    return None


def get_column_lineage(
    to_entity: Table,
    from_entity: Table,
    to_table_raw_name: str,
    from_table_raw_name: str,
    column_lineage_map: dict,
    copied_columns: CopiedColumns = NOTHING_COPIED,
) -> list[ColumnLineage]:
    """Get column lineage

    Args:
        to_entity (Table): entity to link to
        from_entity (Table): entity link comes from
        to_table_raw_name (str): table entity raw name we link to
        from_table_raw_name (str): table entity raw name we link from
        column_lineage_map (dict): map of the column lineage
        copied_columns (CopiedColumns): the columns the query copies unchanged
            (`LineageParser.copied_columns`); only those carry nested fields by name

    Returns:
        List[ColumnLineage]
    """
    if "*" in to_table_raw_name:
        return []
    column_lineage = []
    sources = column_lineage_map.get(to_table_raw_name, {})
    pairs = sources.get(from_table_raw_name, [])
    if "*" in from_table_raw_name:
        pairs = [(to_col, from_col) for to_col, from_col in pairs if "*" not in to_col and "*" not in from_col]
    if pairs:
        # COUNT(*) yields ("alias", "*"), which must not expand source columns.
        if ("*", "*") in pairs:
            explicit = [p for p in pairs if p != ("*", "*")]
            expanded = [(c.name.root, c.name.root) for c in from_entity.columns]
            pairs = list(dict.fromkeys(explicit + expanded))
            column_lineage_map[to_table_raw_name][from_table_raw_name] = pairs

        for to_col, from_col in pairs:
            from_column = _find_column(from_entity.columns, from_col)
            to_column = _find_column(to_entity.columns, to_col)
            if from_column and to_column:
                copied = copied_columns.copies(to_col, from_col)
                column_lineage.extend(_nested_column_lineage(from_column, to_column, copied))
    for key, struct_pairs in sources.items():
        if key.startswith(f"{STRUCT_FIELD_PARENT}."):
            struct_name = key.removeprefix(f"{STRUCT_FIELD_PARENT}.")
            column_lineage.extend(
                _struct_field_lineage(from_entity, to_entity, struct_name, struct_pairs, copied_columns)
            )
    return column_lineage


def _find_column(columns: list[TableColumn] | None, name: str) -> TableColumn | None:
    """Column of that name among `columns`, ignoring case"""
    return next((column for column in columns or [] if column.name.root.lower() == name.lower()), None)


def _nested_column_lineage(from_column: TableColumn, to_column: TableColumn, copied: bool) -> list[ColumnLineage]:
    """
    Lineage from one column to another and, when the query copies the column unchanged, one
    edge per nested field the two share by name, at any depth: selecting a STRUCT or
    ARRAY<STRUCT> as-is carries every field with it. A column built by an expression
    (`STRUCT(billing AS address)`) keeps only the column edge: its fields may sit anywhere.
    """
    if not from_column.fullyQualifiedName or not to_column.fullyQualifiedName:
        return []
    edges = [
        ColumnLineage(
            fromColumns=[from_column.fullyQualifiedName],
            toColumn=to_column.fullyQualifiedName,
        )
    ]
    for from_child in from_column.children or [] if copied else []:
        if to_child := _find_column(to_column.children, from_child.name.root):
            edges.extend(_nested_column_lineage(from_child, to_child, copied))
    return edges


def _find_struct(columns: list[TableColumn], name: str) -> TableColumn | None:
    """
    The STRUCT a field path runs through. The parser keeps only the path segment above the
    field, so `address.zip` and `customer.address.zip` both arrive as `address`: the path is
    resolved only when exactly one STRUCT, at any depth, has that name.
    """
    found = []
    pending = list(columns or [])
    while pending:
        column = pending.pop()
        if column.children:
            pending.extend(column.children)
            if column.name.root.lower() == name.lower():
                found.append(column)
    return found[0] if len(found) == 1 else None


def _struct_field_lineage(
    from_entity: Table,
    to_entity: Table,
    struct_name: str,
    pairs: list[tuple[str, str]],
    copied_columns: CopiedColumns,
) -> list[ColumnLineage]:
    """Lineage for fields read through a STRUCT path: `struct.field AS alias` or `struct.*`"""
    struct = _find_struct(from_entity.columns, struct_name)
    if struct is None:
        return []
    edges = []
    for to_col, from_col in pairs:
        if from_col == "*":
            # A plain `struct.*` copies each field under its own name, except one another item produces.
            fields = [
                (field, field.name.root, True)
                for field in struct.children or []
                if copied_columns.star_copies(field.name.root)
            ]
        else:
            field = _find_column(struct.children, from_col)
            fields = [(field, to_col, copied_columns.copies(to_col, from_col, struct_field=True))] if field else []
        for field, target_name, copied in fields:
            if target := _find_column(to_entity.columns, target_name):
                edges.extend(_nested_column_lineage(field, target, copied))
    return edges


def _key_struct_field_parents(column_lineage_map: dict, lineage_parser: LineageParser) -> None:
    """
    Move the column lineage the parser attributes to a table the query never reads under
    STRUCT_FIELD_PARENT. The parser reads `customer.email` and `customer.*` as columns of a
    table `customer`; only an unqualified name can be such a STRUCT, and a name the query
    does read as a table keeps its key.

    The parser drops the qualifier of such a path, so it is resolved only when nothing else
    in the query can own that name: one source, which is a table (a table-valued function or a
    stage can read several), no intermediate table, and no subquery or CTE that could rename a
    column to it. Otherwise the path keeps its key and gets no lineage rather than lineage from
    the wrong column. ADR:2026-11-06-sql-column-lineage-follows-nested-fields
    """
    source_tables = cast("list", lineage_parser.source_tables)
    intermediate_tables = cast("list", lineage_parser.intermediate_tables)
    target_tables = cast("list", lineage_parser.target_tables)
    single_table_source = len(source_tables) == 1 and isinstance(source_tables[0], LineageTable)
    if not single_table_source or intermediate_tables or lineage_parser.has_subqueries:
        return
    read_tables = {str(table) for table in (*source_tables, *intermediate_tables, *target_tables)}
    default_prefix = f"{DEFAULT_SCHEMA_NAME}."
    for sources in column_lineage_map.values():
        struct_keys = [
            key
            for key in sources
            if key.startswith(default_prefix) and "." not in key.removeprefix(default_prefix) and key not in read_tables
        ]
        for key in struct_keys:
            name = key.removeprefix(default_prefix)
            sources.setdefault(f"{STRUCT_FIELD_PARENT}.{name}", []).extend(sources.pop(key))


# pylint: disable=too-many-arguments
def _build_table_lineage(
    from_entity: Table,
    to_entity: Table,
    from_table_raw_name: str,
    to_table_raw_name: str,
    masked_query: str,
    column_lineage_map: dict,
    lineage_source: LineageSource = LineageSource.QueryLineage,
    procedure: EntityReference | None = None,
    temp_lineage_tables: list | None = None,
    copied_columns: CopiedColumns = NOTHING_COPIED,
) -> Either[LineageRequest]:
    """
    Prepare the lineage request generator

    Args:
        from_entity (Table): entity link comes from
        to_entity (Table): entity to link to
        from_table_raw_name (str): table entity raw name we link from
        to_table_raw_name (str): table entity raw name we link to
        query (str): query
        column_lineage_map (dict): map of the column lineage
        lineage_source (LineageSource): lineage source
        temp_lineage_tables (List[TempLineageTable]): lineage path through temporary tables

    Returns:
        Either[LineageRequest] with the lineage request or an error
    """
    try:
        from_entity_fqn = from_entity.fullyQualifiedName
        to_entity_fqn = to_entity.fullyQualifiedName
        if from_entity_fqn is None or to_entity_fqn is None:
            return Either(
                left=StackTraceError(
                    name="Lineage",
                    error=(
                        f"Error creating lineage for tables [{from_table_raw_name}] and [{to_table_raw_name}]: "
                        "Lineage table entities must include fullyQualifiedName"
                    ),
                    stackTrace="",
                ),
                right=None,
            )

        col_lineage = get_column_lineage(
            to_entity=to_entity,
            to_table_raw_name=str(to_table_raw_name),
            from_entity=from_entity,
            from_table_raw_name=str(from_table_raw_name),
            column_lineage_map=column_lineage_map,
            copied_columns=copied_columns,
        )
        lineage_details = LineageDetails(sqlQuery=masked_query, source=lineage_source, pipeline=procedure)
        if temp_lineage_tables:
            lineage_details.tempLineageTables = temp_lineage_tables
        if col_lineage:
            lineage_details.columnsLineage = col_lineage
        lineage = OMetaFQNLineageRequest(
            from_entity_fqn=model_str(from_entity_fqn),
            from_entity_type="table",
            to_entity_fqn=model_str(to_entity_fqn),
            to_entity_type="table",
            lineage_details=lineage_details,
            from_entity_id=from_entity.id,
            to_entity_id=to_entity.id,
        )
        return Either(right=lineage)
    except Exception as e:
        return Either(
            left=StackTraceError(
                name="Lineage",
                error=f"Error creating lineage for tables [{from_table_raw_name}] and [{to_table_raw_name}]: {e}",
                stackTrace=traceback.format_exc(),
            )
        )


# pylint: disable=too-many-arguments,too-many-locals
def _create_lineage_by_table_name(
    metadata: OpenMetadata,
    from_table: str,
    to_table: str,
    service_names: str | list[str],
    database_name: str | None,
    schema_name: str | None,
    masked_query: str,
    column_lineage_map: dict,
    lineage_source: LineageSource = LineageSource.QueryLineage,
    procedure: EntityReference | None = None,
    graph: DiGraph | None = None,
    schema_fallback: bool = False,
    to_table_entities: list[Table] | None = None,
    copied_columns: CopiedColumns = NOTHING_COPIED,
) -> Iterable[Either[LineageRequest]]:
    """
    This method is to create a lineage between two tables

    `to_table_entities` are the target entities when the caller already has them, so
    `to_table` is not resolved again by name.
    """
    if isinstance(service_names, str):
        service_names = [service_names]

    try:
        from_table_entities = get_table_entities_from_query(
            metadata=metadata,
            service_names=service_names,
            database_name=database_name,
            database_schema=schema_name,
            table_name=from_table,
            schema_fallback=schema_fallback,
        )

        to_table_entities = to_table_entities or get_table_entities_from_query(
            metadata=metadata,
            service_names=service_names,
            database_name=database_name,
            database_schema=schema_name,
            table_name=to_table,
            schema_fallback=schema_fallback,
        )

        for table_name, entity in (
            (from_table, from_table_entities),
            (to_table, to_table_entities),
        ):
            if entity is None:
                logger.debug(f"WARNING: Table entity [{table_name}] not found in OpenMetadata")
        if graph is not None and (not from_table_entities or not to_table_entities):
            # Add nodes and edges with minimal data
            graph.add_node(
                from_table,
                fqns=([table.fullyQualifiedName.root for table in from_table_entities] if from_table_entities else []),
            )
            graph.add_node(
                to_table,
                fqns=([table.fullyQualifiedName.root for table in to_table_entities] if to_table_entities else []),
            )
            graph.add_edge(from_table, to_table)
            return

        for from_entity, to_entity in itertools.product(from_table_entities or [], to_table_entities or []):
            if to_entity and from_entity:
                yield _build_table_lineage(
                    to_entity=to_entity,
                    from_entity=from_entity,
                    to_table_raw_name=to_table,
                    from_table_raw_name=from_table,
                    masked_query=masked_query,
                    column_lineage_map=column_lineage_map,
                    lineage_source=lineage_source,
                    procedure=procedure,
                    copied_columns=copied_columns,
                )

    except Exception as exc:
        yield Either(
            left=StackTraceError(
                name="Lineage",
                error=f"Error creating lineage for service [{service_names}] from table [{from_table}]: {exc}",
                stackTrace=traceback.format_exc(),
            )
        )


def populate_column_lineage_map(raw_column_lineage):
    """populate column lineage map

    Args:
        raw_column_lineage (_type_): raw column lineage
    """
    lineage_map = {}
    if not raw_column_lineage:
        return lineage_map
    for column_lineage in raw_column_lineage:
        source = column_lineage[0]
        target = column_lineage[-1]
        for parent in source._parent:  # pylint: disable=protected-access
            if lineage_map.get(str(target.parent)):
                ele = lineage_map.get(str(target.parent))
                if ele.get(str(parent)):
                    ele[str(parent)].append(
                        (
                            target.raw_name,
                            source.raw_name,
                        )
                    )
                else:
                    ele[str(parent)] = [(target.raw_name, source.raw_name)]
            else:
                lineage_map[str(target.parent)] = {str(parent): [(target.raw_name, source.raw_name)]}
    return lineage_map


def _view_target(view_entity: Table | None, target_table: object) -> list[Table] | None:
    """Bind only the view's own SQL name, preserving its catalog qualifications."""
    if view_entity is None:
        return None
    target_name = re.sub(r'[\[\]"`]', "", str(target_table)).lower()
    # An unqualified target prints with the parser's placeholder schema.
    target_name = target_name.removeprefix(f"{DEFAULT_SCHEMA_NAME}.")
    # Some parsers drop the qualifiers around a dotted leaf name entirely.
    if target_name == model_str(view_entity.name).lower():
        return [view_entity]
    if view_entity.fullyQualifiedName is None:
        return None
    view_parts = [fqn.unquote_name(part).lower() for part in fqn.split(model_str(view_entity.fullyQualifiedName))[1:]]
    if any(target_name == ".".join(view_parts[index:]) for index in range(len(view_parts))):
        return [view_entity]
    return None


# pylint: disable=too-many-locals
def get_lineage_by_query(
    metadata: OpenMetadata,
    service_names: str | list[str],
    database_name: str | None,
    schema_name: str | None,
    query: str,
    dialect: Dialect,
    timeout_seconds: int = LINEAGE_PARSING_TIMEOUT,
    lineage_source: LineageSource = LineageSource.QueryLineage,
    graph: DiGraph | None = None,
    lineage_parser: LineageParser | None = None,
    schema_fallback: bool = False,
    service_name: str | None = None,  # backward compatibility for python sdk
    parser_type: QueryParserType = QueryParserType.Auto,
    view_entity: Table | None = None,
) -> Iterable[Either[LineageRequest]]:
    """
    This method parses the query to get source, target and intermediate table names to create lineage,
    and returns True if target table is found to create lineage otherwise returns False.

    Now supports cross-database lineage by accepting a list of service names.

    `view_entity` is the view whose definition is `query`. A target that names it uses
    the entity as is instead of being resolved again by its dotted name.
    """
    column_lineage = {}

    if service_name and isinstance(service_name, str):
        service_names = [service_name]
        logger.warning("Deprecated: service_name is deprecated, use service_names instead")
    if isinstance(service_names, str):
        service_names = [service_names]
    try:
        if not lineage_parser:
            lineage_parser = LineageParser(query, dialect, timeout_seconds=timeout_seconds, parser_type=parser_type)
        masked_query = lineage_parser.masked_query
        query_hash = lineage_parser.query_hash
        logger.debug(f"[{query_hash}] Running lineage with query: {masked_query or query}")

        raw_column_lineage = lineage_parser.column_lineage
        column_lineage.update(populate_column_lineage_map(raw_column_lineage))
        _key_struct_field_parents(column_lineage, lineage_parser)
        # Read the projections only when there is column lineage to follow into nested fields.
        copied_columns = cast("CopiedColumns", lineage_parser.copied_columns) if column_lineage else NOTHING_COPIED

        for intermediate_table in lineage_parser.intermediate_tables:
            for source_table in lineage_parser.source_tables:
                for procedure, from_table_name in get_source_table_names(
                    metadata=metadata,
                    dialect=dialect,
                    source_table=source_table,
                    database_name=database_name,
                    schema_name=schema_name,
                    service_names=service_names,
                    timeout_seconds=timeout_seconds,
                    column_lineage=column_lineage,
                ):
                    yield from _create_lineage_by_table_name(
                        metadata,
                        from_table=str(from_table_name),
                        to_table=str(intermediate_table),
                        service_names=service_names,
                        database_name=database_name,
                        schema_name=schema_name,
                        masked_query=masked_query,
                        column_lineage_map=column_lineage,
                        copied_columns=copied_columns,
                        lineage_source=lineage_source,
                        procedure=procedure,
                        graph=graph,
                        schema_fallback=schema_fallback,
                    )
            for target_table in lineage_parser.target_tables:
                yield from _create_lineage_by_table_name(
                    metadata,
                    from_table=str(intermediate_table),
                    to_table=str(target_table),
                    service_names=service_names,
                    database_name=database_name,
                    schema_name=schema_name,
                    masked_query=masked_query,
                    column_lineage_map=column_lineage,
                    copied_columns=copied_columns,
                    lineage_source=lineage_source,
                    schema_fallback=schema_fallback,
                    graph=graph,
                    to_table_entities=_view_target(view_entity, target_table),
                )
        if not lineage_parser.intermediate_tables:
            for target_table in lineage_parser.target_tables:
                for source_table in lineage_parser.source_tables:
                    for procedure, from_table_name in get_source_table_names(
                        metadata=metadata,
                        dialect=dialect,
                        source_table=source_table,
                        database_name=database_name,
                        schema_name=schema_name,
                        service_names=service_names,
                        timeout_seconds=timeout_seconds,
                        column_lineage=column_lineage,
                    ):
                        yield from _create_lineage_by_table_name(
                            metadata,
                            from_table=str(from_table_name),
                            to_table=str(target_table),
                            service_names=service_names,
                            database_name=database_name,
                            schema_name=schema_name,
                            masked_query=masked_query,
                            column_lineage_map=column_lineage,
                            copied_columns=copied_columns,
                            lineage_source=lineage_source,
                            procedure=procedure,
                            graph=graph,
                            schema_fallback=schema_fallback,
                            to_table_entities=_view_target(view_entity, target_table),
                        )
    except Exception as exc:
        yield Either(
            left=StackTraceError(
                name="Lineage",
                error=f"Ingesting lineage failed for service(s) [{service_names}]: {exc}",
                stackTrace=traceback.format_exc(),
            )
        )


def get_lineage_via_table_entity(
    metadata: OpenMetadata,
    table_entity: Table,
    database_name: str,
    schema_name: str,
    service_names: str | list[str],
    query: str,
    dialect: Dialect,
    timeout_seconds: int = LINEAGE_PARSING_TIMEOUT,
    lineage_source: LineageSource = LineageSource.QueryLineage,
    graph: DiGraph | None = None,
    lineage_parser: LineageParser | None = None,
    schema_fallback: bool = False,
    parser_type: QueryParserType = QueryParserType.Auto,
) -> Iterable[Either[LineageRequest]]:
    """Get lineage from table entity"""
    column_lineage = {}

    if isinstance(service_names, str):
        service_names = [service_names]
    try:
        if not lineage_parser:
            lineage_parser = LineageParser(query, dialect, timeout_seconds=timeout_seconds, parser_type=parser_type)
        masked_query = lineage_parser.masked_query
        query_hash = lineage_parser.query_hash
        logger.debug(f"[{query_hash}] Getting lineage via table entity using query: {masked_query or query}")
        to_table_name = table_entity.name.root

        for from_table_name in lineage_parser.source_tables:
            for procedure, source_table in get_source_table_names(
                metadata=metadata,
                dialect=dialect,
                source_table=from_table_name,
                database_name=database_name,
                schema_name=schema_name,
                service_names=service_names,
                timeout_seconds=timeout_seconds,
                column_lineage=column_lineage,
            ):
                yield from (
                    _create_lineage_by_table_name(
                        metadata,
                        from_table=str(source_table),
                        to_table=f"{schema_name}.{to_table_name}",
                        service_names=service_names,
                        database_name=database_name,
                        schema_name=schema_name,
                        masked_query=masked_query,
                        column_lineage_map=column_lineage,
                        lineage_source=lineage_source,
                        procedure=procedure,
                        graph=graph,
                        schema_fallback=schema_fallback,
                        # The view was looked up by its FQN already. Joining its names
                        # with dots loses the boundary of a name that contains one.
                        to_table_entities=[table_entity],
                    )
                    or []
                )
    except Exception as exc:  # pylint: disable=broad-except
        Either(
            left=StackTraceError(
                name="Lineage",
                error=(
                    f"Failed to create view lineage for database [{database_name}] and table [{table_entity}]"
                    f" with service(s) [{service_names}]: {exc}"
                ),
                stackTrace=traceback.format_exc(),
            )
        )


def _build_temp_table_lineage(
    table_chain: list[str],
    from_fqn: str,
    to_fqn: str,
) -> list:
    """
    Build a list of lineage hops through temporary/intermediate tables.

    The first hop's source uses the from_fqn and the last hop's target uses
    the to_fqn. Intermediate hops use the raw table names from the chain.

    Returns:
        List of TempLineageTable objects with fromEntity and toEntity fields.
    """
    from metadata.generated.schema.type.entityLineage import TempLineageTable

    if len(table_chain) < 2:
        return [TempLineageTable(fromEntity=from_fqn, toEntity=to_fqn)]

    hops = []
    for i in range(len(table_chain) - 1):
        source = from_fqn if i == 0 else table_chain[i]
        target = to_fqn if i == len(table_chain) - 2 else table_chain[i + 1]
        hops.append(TempLineageTable(fromEntity=source, toEntity=target))
    return hops


def _get_lineage_for_path(
    from_fqn: str,
    to_fqn: str,
    from_node: Any,
    current_node: Any,
    table_chain: list[str],
    metadata: OpenMetadata,
    merged_hops: list | None = None,
) -> Either[LineageRequest] | None:
    """
    Get lineage for a pair of FQNs in the path.
    If merged_hops is provided, uses those instead of computing from table_chain.
    """
    try:
        to_entity = get_entity_from_es_result(
            entity_list=metadata.es_search_from_fqn(
                entity_type=Table,
                fqn_search_string=to_fqn,
            ),
        )
        from_entity = get_entity_from_es_result(
            entity_list=metadata.es_search_from_fqn(
                entity_type=Table,
                fqn_search_string=from_fqn,
            ),
        )
        if to_entity and from_entity:
            temp_lineage_hops = merged_hops or _build_temp_table_lineage(
                table_chain=table_chain,
                from_fqn=from_fqn,
                to_fqn=to_fqn,
            )
            return _build_table_lineage(
                to_entity=to_entity,
                from_entity=from_entity,
                to_table_raw_name=str(current_node),
                from_table_raw_name=str(from_node),
                masked_query=None,
                column_lineage_map={},
                lineage_source=LineageSource.QueryLineage,
                procedure=None,
                temp_lineage_tables=temp_lineage_hops,
            )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Error fetching table entities [{from_fqn} -> {to_fqn}]: {exc}")
    return None


def _process_sequence(
    sequence: list[Any],
    graph: DiGraph,
    metadata: OpenMetadata,
    hops_map: dict[tuple, list] | None = None,
    seen_pairs: set | None = None,
) -> Iterable[Either[LineageRequest]]:
    """
    Process a sequence of nodes to generate lineage information.
    When hops_map is provided, uses pre-merged temp lineage hops and skips
    duplicate (from_fqn, to_fqn) pairs already emitted via seen_pairs.
    """
    from_node = None
    table_chain = []
    for node in sequence:
        try:
            current_node = graph.nodes[node]
            current_fqns = current_node.get("fqns", [])

            # Add the current node name to the chain
            table_chain.append(str(node).replace(f"{DEFAULT_SCHEMA_NAME}.", ""))

            if current_fqns and from_node is not None:
                from_fqns = from_node.get("fqns", [])
                for from_fqn, to_fqn in itertools.product(from_fqns, current_fqns):
                    pair_key = (from_fqn, to_fqn)
                    if seen_pairs is not None:
                        if pair_key in seen_pairs:
                            continue
                        seen_pairs.add(pair_key)
                    lineage = _get_lineage_for_path(
                        from_fqn=from_fqn,
                        to_fqn=to_fqn,
                        from_node=from_node,
                        current_node=node,
                        table_chain=table_chain,
                        metadata=metadata,
                        merged_hops=hops_map.get(pair_key) if hops_map else None,
                    )
                    if lineage:
                        yield lineage

            if current_fqns:
                from_node = graph.nodes[node]
                table_chain = [str(node).replace(f"{DEFAULT_SCHEMA_NAME}.", "")]
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error creating lineage for node [{node}]: {exc}")


def _get_paths_from_subtree(subtree: DiGraph) -> list[list[Any]]:
    """
    Get all paths from root nodes to leaf nodes in a subtree
    """
    paths = []
    # Find all root nodes (nodes with no incoming edges)
    root_nodes = [node for node in subtree if subtree.in_degree(node) == 0]
    # Find all leaf nodes (nodes with no outgoing edges)
    leaf_set = {node for node in subtree if subtree.out_degree(node) == 0}

    # Isolated nodes have no edges at all (both root and leaf).
    # nx.all_simple_paths(G, node, node) returns nothing for same source/target,
    # so we handle them directly by emitting a single-element path.
    isolated_nodes = [node for node in root_nodes if node in leaf_set]
    for node in isolated_nodes:
        paths.append([node])  # noqa: PERF401

    # Only process roots that have at least one outgoing edge
    non_isolated_roots = [node for node in root_nodes if node not in leaf_set]

    @timeout(seconds=NODE_PROCESSING_TIMEOUT)
    def process_root_node(root, leaf_nodes):
        """Process a single root node and return all paths to leaf nodes."""
        logger.debug(f"Processing root node {root}")
        node_paths = []
        for leaf in leaf_nodes:
            node_paths.extend(nx.all_simple_paths(subtree, root, leaf, cutoff=CUTOFF_NODES))
        return node_paths

    # Find all simple paths from each root to each leaf
    for root in non_isolated_roots:
        try:
            root_paths = process_root_node(root, leaf_set)
            paths.extend(root_paths)
        except TimeoutError:
            logger.warning(f"Processing root node {root} failed after timeout of {NODE_PROCESSING_TIMEOUT} seconds")
    return paths


def _collect_temp_lineage_hops(paths: list[list[Any]], graph: DiGraph) -> dict[tuple, list]:
    """
    Pre-compute all temp lineage hops per (from_fqn, to_fqn) pair from paths.
    This walks through each path without making any ES calls, collecting only
    the lightweight TempLineageTable objects grouped by endpoint FQN pair.
    """
    hops_map: dict[tuple, list] = {}
    for sequence in paths:
        from_node = None
        table_chain: list[str] = []
        for node in sequence:
            current_node = graph.nodes[node]
            current_fqns = current_node.get("fqns", [])
            table_chain.append(str(node).replace(f"{DEFAULT_SCHEMA_NAME}.", ""))
            if current_fqns and from_node is not None:
                from_fqns = from_node.get("fqns", [])
                for from_fqn, to_fqn in itertools.product(from_fqns, current_fqns):
                    key = (from_fqn, to_fqn)
                    temp_hops = _build_temp_table_lineage(
                        table_chain=table_chain,
                        from_fqn=from_fqn,
                        to_fqn=to_fqn,
                    )
                    hops_map.setdefault(key, []).extend(temp_hops)
            if current_fqns:
                from_node = graph.nodes[node]
                table_chain = [str(node).replace(f"{DEFAULT_SCHEMA_NAME}.", "")]
    return hops_map


def get_lineage_by_graph(
    graph: DiGraph | None,
    metadata: OpenMetadata,
) -> Iterable[Either[LineageRequest]]:
    """
    Generate lineage information from a directed graph.
    This method processes a directed graph to extract lineage information by identifying
    weakly connected components and traversing each component to generate sequences of nodes.
    It then yields lineage information for each sequence.
    Args:
        graph (DiGraph): A directed graph representing the lineage.
        metadata (OpenMetadata): OpenMetadata client instance to fetch table entities
    Raises:
        Exception: If an error occurs during the lineage creation process, it logs the error.
    """
    if graph is None:
        return

    logger.info(f"Processing graph with {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges")
    # Get all weakly connected components
    components = list(nx.weakly_connected_components(graph))

    # Extract each component as an independent subgraph and process paths
    for component in components:
        subtree = cast("DiGraph", graph.subgraph(component).copy())
        paths = _get_paths_from_subtree(subtree)
        hops_map = _collect_temp_lineage_hops(paths, subtree)
        seen_pairs = set()
        for path in paths:
            yield from _process_sequence(path, subtree, metadata, hops_map, seen_pairs)


def get_lineage_by_procedure_graph(
    procedure_graph_map: dict | None,
    metadata: OpenMetadata,
) -> Iterable[Either[LineageRequest]]:
    """
    Generate lineage information from a directed graph.
    """
    if procedure_graph_map is None:
        return

    for procedure_and_procedure_graph in procedure_graph_map.values():
        for either_lineage in get_lineage_by_graph(
            graph=procedure_and_procedure_graph.graph,
            metadata=metadata,
        ):
            if either_lineage.left is None and either_lineage.right:
                if isinstance(either_lineage.right, OMetaFQNLineageRequest):
                    lineage_details = either_lineage.right.lineage_details
                else:
                    lineage_details = either_lineage.right.edge.lineageDetails
                if lineage_details:
                    lineage_details.pipeline = EntityReference.model_validate(
                        {
                            "id": procedure_and_procedure_graph.procedure.id,
                            "type": "storedProcedure",
                        }
                    )

            yield either_lineage
