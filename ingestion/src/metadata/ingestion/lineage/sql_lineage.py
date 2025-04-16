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
Helper functions to handle SQL lineage operations
"""
import functools
import itertools
import traceback
from collections import defaultdict
from copy import deepcopy
from typing import Any, Iterable, List, Optional, Tuple, Union

import networkx as nx
from collate_sqllineage.core.holders import SQLLineageHolder
from collate_sqllineage.core.models import Column, DataFunction
from collate_sqllineage.core.models import Table as LineageTable
from networkx import DiGraph

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.storedProcedure import (
    Language,
    StoredProcedure,
    StoredProcedureType,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import (
    Dialect,
    QueryParsingError,
    QueryParsingFailures,
)
from metadata.ingestion.lineage.parser import LINEAGE_PARSING_TIMEOUT, LineageParser
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.elasticsearch import get_entity_from_es_result
from metadata.utils.execution_time_tracker import (
    calculate_execution_time,
    calculate_execution_time_generator,
)
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.logger import utils_logger
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache

logger = utils_logger()
DEFAULT_SCHEMA_NAME = "<default>"
CUTOFF_NODES = 20

# pylint: disable=too-many-function-args,protected-access
def get_column_fqn(table_entity: Table, column: str) -> Optional[str]:
    """
    Get fqn of column if exist in table entity
    """
    if not table_entity:
        return None
    for tbl_column in table_entity.columns:
        if column.lower() == tbl_column.name.root.lower():
            return tbl_column.fullyQualifiedName.root

    return None


search_cache = LRUCache(LRU_CACHE_SIZE)


@calculate_execution_time(context="SearchTableEntities")
def search_table_entities(
    metadata: OpenMetadata,
    service_name: str,
    database: Optional[str],
    database_schema: Optional[str],
    table: str,
) -> Optional[List[Table]]:
    """
    Method to get table entity from database, database_schema & table name.

    It will try to search first in ES and doing an extra call to get Table entities
    with the needed fields like columns for column lineage.

    If the ES result is empty, it will try by running
    a request against the API to find the Entity.

    Args:
        metadata: OMeta client
        service_name: service name
        database: database name
        database_schema: schema name
        table: table name

    Returns:
        A list of Table entities, otherwise, None
    """
    search_tuple = (service_name, database, database_schema, table)
    if search_tuple in search_cache:
        return search_cache.get(search_tuple)
    try:
        table_entities: Optional[List[Table]] = []
        # search on ES first
        fqn_search_string = build_es_fqn_search_string(
            database, database_schema, service_name, table
        )
        es_result_entities = metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
        )
        if es_result_entities:
            table_entities = es_result_entities
        else:
            # build FQNs and search with the API in case ES response is empty
            table_fqns = fqn.build(
                metadata,
                entity_type=Table,
                service_name=service_name,
                database_name=database,
                schema_name=database_schema,
                table_name=table,
                fetch_multiple_entities=True,
                skip_es_search=True,
            )
            for table_fqn in table_fqns or []:
                table_entity: Table = metadata.get_by_name(Table, fqn=table_fqn)
                if table_entity:
                    table_entities.append(table_entity)
        # added the search tuple to the cache
        search_cache.put(search_tuple, table_entities)
        return table_entities
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(
            f"Error searching for table entities for service [{service_name}]: {exc}"
        )
        return None


def get_table_fqn_from_query_name(
    table_name: str,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Method to extract database, schema and table name
    from raw table name used in query
    """

    split_table = table_name.split(".")
    empty_list: List[Any] = [None]  # Otherwise, there's a typing error in the concat

    if len(split_table) > 3:
        # In case of bigquery, it is possible that tables within information schema when
        # referred with their fully qualified name may look like this
        # `project-id.dataset-id.information_schema.table-name` in such cases there
        # will be 4 values to unpack vs the expected 3 values, hence in such case we
        # just pick the table name and keep the database and schema name as none

        table = split_table[-1]
        database_query, schema_query = None, None
    else:
        database_query, schema_query, table = (
            empty_list * (3 - len(split_table))
        ) + split_table

    if schema_query == DEFAULT_SCHEMA_NAME:
        schema_query = None

    if database_query == DEFAULT_SCHEMA_NAME:
        database_query = None

    return database_query, schema_query, table


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


def __process_column_mappings(
    mappings: dict, result: dict, source_table: str, intermediate_column_lineage: dict
):
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
    column_lineage_generated: List[Tuple[Column, Column]],
):
    """
    Handle UDF column lineage
    """
    try:
        result = defaultdict(dict)
        intermediate_column_lineage = populate_column_lineage_map(
            column_lineage_generated
        )
        # Iterate through the original dictionary
        for source_table, mappings in column_lineage_original.items():
            __process_column_mappings(
                mappings, result, source_table, intermediate_column_lineage
            )
        column_lineage_original.update(result)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Error handling UDF column lineage: {exc}")


@functools.lru_cache(maxsize=1000)
def _get_udf_parser(
    code: str, dialect: Dialect, timeout_seconds: int
) -> Optional[LineageParser]:
    if code:
        return LineageParser(
            f"create table dummy_table_name as {code}",
            dialect=dialect,
            timeout_seconds=timeout_seconds,
        )
    return None


def _replace_target_table(
    parser: LineageParser, expected_table_name: str
) -> LineageParser:
    try:
        # Create a new target table instead of modifying the existing one
        new_table = Table(expected_table_name.replace(DEFAULT_SCHEMA_NAME, ""))

        # Create a new statement holder with the updated target table
        stmt_holder = parser.parser._stmt_holders[0]
        old_write = list(stmt_holder.write)[0]  # Get the original target table

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
                try:
                    # remove the old edge
                    stmt_holder.graph.remove_edge(col_lineage[-2], tgt_col)
                except Exception as _:
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
    source_table: Union[DataFunction, LineageTable],
    database_name: Optional[str],
    schema_name: Optional[str],
    service_name: Optional[str],
    timeout_seconds: int,
    column_lineage: dict,
    es_result_entities: List[StoredProcedure],
    procedure: Optional[StoredProcedure] = None,
):
    for entity in es_result_entities:
        if (
            entity.storedProcedureType == StoredProcedureType.UDF
            and entity.storedProcedureCode
            and entity.storedProcedureCode.language == Language.SQL
        ):

            lineage_parser = _get_udf_parser(
                entity.storedProcedureCode.code, dialect, timeout_seconds
            )
            if lineage_parser and lineage_parser.parser:
                expected_table_name = str(source_table).replace(
                    f"{DEFAULT_SCHEMA_NAME}.", ""
                )
                lineage_parser_copy = deepcopy(lineage_parser)
                _replace_target_table(lineage_parser_copy, expected_table_name)

                handle_udf_column_lineage(
                    column_lineage, lineage_parser_copy.column_lineage
                )
                for source in lineage_parser_copy.source_tables or []:
                    yield from get_source_table_names(
                        metadata,
                        dialect,
                        source,
                        database_name,
                        schema_name,
                        service_name,
                        timeout_seconds,
                        column_lineage,
                        procedure or entity,
                    )


def __process_udf_table_names(
    metadata: OpenMetadata,
    dialect: Dialect,
    source_table: Union[DataFunction, LineageTable],
    database_name: Optional[str],
    schema_name: Optional[str],
    service_name: Optional[str],
    timeout_seconds: int,
    column_lineage: dict,
    procedure: Optional[StoredProcedure] = None,
):
    database_query, schema_query, table = get_table_fqn_from_query_name(
        str(source_table)
    )
    function_fqn_string = build_es_fqn_search_string(
        database_query or database_name,
        schema_query or schema_name,
        service_name,
        table,
    )
    es_result_entities: Optional[List[StoredProcedure]] = metadata.es_search_from_fqn(
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
            service_name,
            timeout_seconds,
            column_lineage,
            es_result_entities,
            procedure,
        )


@calculate_execution_time_generator(context="GetSourceTableNames")
def get_source_table_names(
    metadata: OpenMetadata,
    dialect: Dialect,
    source_table: Union[DataFunction, LineageTable],
    database_name: Optional[str],
    schema_name: Optional[str],
    service_name: Optional[str],
    timeout_seconds: int,
    column_lineage: dict,
    procedure: Optional[StoredProcedure] = None,
) -> Iterable[Tuple[Optional[EntityReference], str]]:
    """
    Get source table names from DataFunction
    """
    try:
        if not isinstance(source_table, DataFunction):
            yield EntityReference(
                id=procedure.id.root, type="storedProcedure"
            ) if procedure else None, str(source_table)
        else:
            yield from __process_udf_table_names(
                metadata,
                dialect,
                source_table,
                database_name,
                schema_name,
                service_name,
                timeout_seconds,
                column_lineage,
                procedure,
            )

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(
            f"Error getting source table names for table [{source_table}]: {exc}"
        )


def get_table_entities_from_query(
    metadata: OpenMetadata,
    service_name: str,
    database_name: str,
    database_schema: str,
    table_name: str,
) -> Optional[List[Table]]:
    """
    Fetch data from API and ES with a fallback strategy.

    If the sys data is incorrect, use the table name ingredients.

    :param metadata: OpenMetadata client
    :param service_name: Service being ingested.
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
        service_name=service_name,
        database=database_query if database_query else database_name,
        database_schema=schema_query if schema_query else database_schema,
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
) -> List[ColumnLineage]:
    """Get column lineage

    Args:
        to_entity (Table): entity to link to
        from_entity (Table): entity link comes from
        to_table_raw_name (str): table entity raw name we link to
        from_table_raw_name (str): table entity raw name we link from
        column_lineage_map (dict): map of the column lineage

    Returns:
        List[ColumnLineage]
    """
    column_lineage = []
    if column_lineage_map.get(to_table_raw_name) and column_lineage_map.get(
        to_table_raw_name
    ).get(from_table_raw_name):
        # Select all
        if "*" in column_lineage_map.get(to_table_raw_name).get(from_table_raw_name)[0]:
            column_lineage_map[to_table_raw_name][from_table_raw_name] = [
                (c.name.root, c.name.root) for c in from_entity.columns
            ]

        # Other cases
        for to_col, from_col in column_lineage_map.get(to_table_raw_name).get(
            from_table_raw_name
        ):
            to_col_fqn = get_column_fqn(to_entity, to_col)
            from_col_fqn = get_column_fqn(from_entity, from_col)
            if to_col_fqn and from_col_fqn:
                column_lineage.append(
                    ColumnLineage(fromColumns=[from_col_fqn], toColumn=to_col_fqn)
                )
    return column_lineage


# pylint: disable=too-many-arguments
def _build_table_lineage(
    from_entity: Table,
    to_entity: Table,
    from_table_raw_name: str,
    to_table_raw_name: str,
    masked_query: str,
    column_lineage_map: dict,
    lineage_source: LineageSource = LineageSource.QueryLineage,
    procedure: Optional[EntityReference] = None,
) -> Either[AddLineageRequest]:
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

    Returns:
        Either[AddLineageRequest] with the lineage request or an error
    """
    try:
        col_lineage = get_column_lineage(
            to_entity=to_entity,
            to_table_raw_name=str(to_table_raw_name),
            from_entity=from_entity,
            from_table_raw_name=str(from_table_raw_name),
            column_lineage_map=column_lineage_map,
        )
        lineage_details = LineageDetails(
            sqlQuery=masked_query, source=lineage_source, pipeline=procedure
        )
        if col_lineage:
            lineage_details.columnsLineage = col_lineage
        lineage = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(
                    id=from_entity.id.root,
                    type="table",
                ),
                toEntity=EntityReference(
                    id=to_entity.id.root,
                    type="table",
                ),
            )
        )
        if lineage_details:
            lineage.edge.lineageDetails = lineage_details
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
    service_name: str,
    database_name: Optional[str],
    schema_name: Optional[str],
    masked_query: str,
    column_lineage_map: dict,
    lineage_source: LineageSource = LineageSource.QueryLineage,
    procedure: Optional[EntityReference] = None,
    graph: DiGraph = None,
) -> Iterable[Either[AddLineageRequest]]:
    """
    This method is to create a lineage between two tables
    """
    try:
        from_table_entities = get_table_entities_from_query(
            metadata=metadata,
            service_name=service_name,
            database_name=database_name,
            database_schema=schema_name,
            table_name=from_table,
        )

        to_table_entities = get_table_entities_from_query(
            metadata=metadata,
            service_name=service_name,
            database_name=database_name,
            database_schema=schema_name,
            table_name=to_table,
        )

        for table_name, entity in (
            (from_table, from_table_entities),
            (to_table, to_table_entities),
        ):
            if entity is None:
                logger.debug(
                    f"WARNING: Table entity [{table_name}] not found in OpenMetadata"
                )
        if graph is not None and (not from_table_entities or not to_table_entities):
            # Add nodes and edges with minimal data
            graph.add_node(
                from_table,
                fqns=[table.fullyQualifiedName.root for table in from_table_entities]
                if from_table_entities
                else [],
            )
            graph.add_node(
                to_table,
                fqns=[table.fullyQualifiedName.root for table in to_table_entities]
                if to_table_entities
                else [],
            )
            graph.add_edge(from_table, to_table)
            return

        for from_entity, to_entity in itertools.product(
            from_table_entities or [], to_table_entities or []
        ):
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
                )

    except Exception as exc:
        yield Either(
            left=StackTraceError(
                name="Lineage",
                error=f"Error creating lineage for service [{service_name}] from table [{from_table}]: {exc}",
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
                lineage_map[str(target.parent)] = {
                    str(parent): [(target.raw_name, source.raw_name)]
                }
    return lineage_map


# pylint: disable=too-many-locals
@calculate_execution_time_generator(context="GetLineageByQuery")
def get_lineage_by_query(
    metadata: OpenMetadata,
    service_name: str,
    database_name: Optional[str],
    schema_name: Optional[str],
    query: str,
    dialect: Dialect,
    timeout_seconds: int = LINEAGE_PARSING_TIMEOUT,
    lineage_source: LineageSource = LineageSource.QueryLineage,
    graph: DiGraph = None,
    lineage_parser: Optional[LineageParser] = None,
) -> Iterable[Either[AddLineageRequest]]:
    """
    This method parses the query to get source, target and intermediate table names to create lineage,
    and returns True if target table is found to create lineage otherwise returns False.
    """
    column_lineage = {}
    query_parsing_failures = QueryParsingFailures()

    try:
        if not lineage_parser:
            lineage_parser = LineageParser(
                query, dialect, timeout_seconds=timeout_seconds
            )
        masked_query = lineage_parser.masked_query
        logger.debug(f"Running lineage with query: {masked_query or query}")

        raw_column_lineage = lineage_parser.column_lineage
        column_lineage.update(populate_column_lineage_map(raw_column_lineage))

        for intermediate_table in lineage_parser.intermediate_tables:
            for source_table in lineage_parser.source_tables:
                for procedure, from_table_name in get_source_table_names(
                    metadata=metadata,
                    dialect=dialect,
                    source_table=source_table,
                    database_name=database_name,
                    schema_name=schema_name,
                    service_name=service_name,
                    timeout_seconds=timeout_seconds,
                    column_lineage=column_lineage,
                ):
                    yield from _create_lineage_by_table_name(
                        metadata,
                        from_table=str(from_table_name),
                        to_table=str(intermediate_table),
                        service_name=service_name,
                        database_name=database_name,
                        schema_name=schema_name,
                        masked_query=masked_query,
                        column_lineage_map=column_lineage,
                        lineage_source=lineage_source,
                        procedure=procedure,
                        graph=graph,
                    )
            for target_table in lineage_parser.target_tables:
                yield from _create_lineage_by_table_name(
                    metadata,
                    from_table=str(intermediate_table),
                    to_table=str(target_table),
                    service_name=service_name,
                    database_name=database_name,
                    schema_name=schema_name,
                    masked_query=masked_query,
                    column_lineage_map=column_lineage,
                    lineage_source=lineage_source,
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
                        service_name=service_name,
                        timeout_seconds=timeout_seconds,
                        column_lineage=column_lineage,
                    ):
                        yield from _create_lineage_by_table_name(
                            metadata,
                            from_table=str(from_table_name),
                            to_table=str(target_table),
                            service_name=service_name,
                            database_name=database_name,
                            schema_name=schema_name,
                            masked_query=masked_query,
                            column_lineage_map=column_lineage,
                            lineage_source=lineage_source,
                            procedure=procedure,
                            graph=graph,
                        )
        if not lineage_parser.query_parsing_success:
            query_parsing_failures.add(
                QueryParsingError(
                    query=masked_query or query,
                    error=lineage_parser.query_parsing_failure_reason,
                )
            )
    except Exception as exc:
        yield Either(
            left=StackTraceError(
                name="Lineage",
                error=f"Ingesting lineage failed for service [{service_name}]: {exc}",
                stackTrace=traceback.format_exc(),
            )
        )


@calculate_execution_time_generator(context="GetLineageViaTableEntity")
def get_lineage_via_table_entity(
    metadata: OpenMetadata,
    table_entity: Table,
    database_name: str,
    schema_name: str,
    service_name: str,
    query: str,
    dialect: Dialect,
    timeout_seconds: int = LINEAGE_PARSING_TIMEOUT,
    lineage_source: LineageSource = LineageSource.QueryLineage,
    graph: DiGraph = None,
    lineage_parser: Optional[LineageParser] = None,
) -> Iterable[Either[AddLineageRequest]]:
    """Get lineage from table entity"""
    column_lineage = {}
    query_parsing_failures = QueryParsingFailures()

    try:
        if not lineage_parser:
            lineage_parser = LineageParser(
                query, dialect, timeout_seconds=timeout_seconds
            )
        masked_query = lineage_parser.masked_query
        logger.debug(
            f"Getting lineage via table entity using query: {masked_query or query}"
        )
        to_table_name = table_entity.name.root

        for from_table_name in lineage_parser.source_tables:
            for procedure, source_table in get_source_table_names(
                metadata=metadata,
                dialect=dialect,
                source_table=from_table_name,
                database_name=database_name,
                schema_name=schema_name,
                service_name=service_name,
                timeout_seconds=timeout_seconds,
                column_lineage=column_lineage,
            ):
                yield from _create_lineage_by_table_name(
                    metadata,
                    from_table=str(source_table),
                    to_table=f"{schema_name}.{to_table_name}",
                    service_name=service_name,
                    database_name=database_name,
                    schema_name=schema_name,
                    masked_query=masked_query,
                    column_lineage_map=column_lineage,
                    lineage_source=lineage_source,
                    procedure=procedure,
                    graph=graph,
                ) or []
        if not lineage_parser.query_parsing_success:
            query_parsing_failures.add(
                QueryParsingError(
                    query=masked_query,
                    error=lineage_parser.query_parsing_failure_reason,
                )
            )
    except Exception as exc:  # pylint: disable=broad-except
        Either(
            left=StackTraceError(
                name="Lineage",
                error=f"Failed to create view lineage for database [{database_name}] and table [{table_entity}]: {exc}",
                stackTrace=traceback.format_exc(),
            )
        )


def _get_lineage_for_path(
    from_fqn: str,
    to_fqn: str,
    from_node: Any,
    current_node: Any,
    table_chain: List[str],
    metadata: OpenMetadata,
) -> Optional[Either[AddLineageRequest]]:
    """
    Get lineage for a pair of FQNs in the path
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
            # Create the table chain string
            table_relationship = "--- TEMPT TABLE LINEAGE \n--- "
            table_relationship += " > ".join(table_chain)
            return _build_table_lineage(
                to_entity=to_entity,
                from_entity=from_entity,
                to_table_raw_name=str(current_node),
                from_table_raw_name=str(from_node),
                masked_query=table_relationship,  # Using table chain as the query
                column_lineage_map={},
                lineage_source=LineageSource.QueryLineage,
                procedure=None,
            )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Error fetching table entities [{from_fqn} -> {to_fqn}]: {exc}")
    return None


def _process_sequence(
    sequence: List[Any], graph: DiGraph, metadata: OpenMetadata
) -> Iterable[Either[AddLineageRequest]]:
    """
    Process a sequence of nodes to generate lineage information.
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
                    lineage = _get_lineage_for_path(
                        from_fqn=from_fqn,
                        to_fqn=to_fqn,
                        from_node=from_node,
                        current_node=node,
                        table_chain=table_chain,
                        metadata=metadata,
                    )
                    if lineage:
                        yield lineage

            if current_fqns:
                from_node = graph.nodes[node]
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error creating lineage for node [{node}]: {exc}")


def _get_paths_from_subtree(subtree: DiGraph) -> List[List[Any]]:
    """
    Get all paths from root nodes to leaf nodes in a subtree
    """
    paths = []
    # Find all root nodes (nodes with no incoming edges)
    root_nodes = [node for node in subtree if subtree.in_degree(node) == 0]
    # Find all leaf nodes (nodes with no outgoing edges)
    leaf_nodes = [node for node in subtree if subtree.out_degree(node) == 0]

    # Find all simple paths from each root to each leaf
    for root in root_nodes:
        logger.debug(f"Processing root node {root}")
        for leaf in leaf_nodes:
            paths.extend(nx.all_simple_paths(subtree, root, leaf, cutoff=CUTOFF_NODES))
    return paths


def get_lineage_by_graph(
    graph: DiGraph,
    metadata: OpenMetadata,
) -> Iterable[Either[AddLineageRequest]]:
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

    logger.info(
        f"Processing graph with {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges"
    )
    # Get all weakly connected components
    components = list(nx.weakly_connected_components(graph))

    # Extract each component as an independent subgraph and process paths
    for component in components:
        subtree = graph.subgraph(component).copy()
        for path in _get_paths_from_subtree(subtree):
            yield from _process_sequence(path, subtree, metadata)
