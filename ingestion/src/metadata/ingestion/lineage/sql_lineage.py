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
import traceback
from logging.config import DictConfigurator
from typing import Any, Iterable, Iterator, List, Optional

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.logger import utils_logger
from metadata.utils.lru_cache import LRUCache

# Prevent sqllineage from modifying the logger config
# Disable the DictConfigurator.configure method while importing LineageRunner
configure = DictConfigurator.configure
DictConfigurator.configure = lambda _: None
from sqllineage.runner import LineageRunner  # pylint: disable=wrong-import-position

# Reverting changes after import is done
DictConfigurator.configure = configure

logger = utils_logger()
LRU_CACHE_SIZE = 4096


def split_raw_table_name(database: str, raw_name: str) -> dict:
    database_schema = None
    if "." in raw_name:
        # pylint: disable=unbalanced-tuple-unpacking
        database_schema, table = fqn.split(raw_name)[-2:]
        # pylint: enable=unbalanced-tuple-unpacking
        if database_schema == "<default>":
            database_schema = None
    return {"database": database, "database_schema": database_schema, "table": table}


def get_column_fqn(table_entity: Table, column: str) -> Optional[str]:
    """
    Get fqn of column if exist in table entity
    """
    if not table_entity:
        return None
    for tbl_column in table_entity.columns:
        if column.lower() == tbl_column.name.__root__.lower():
            return tbl_column.fullyQualifiedName.__root__

    return None


search_cache = LRUCache(LRU_CACHE_SIZE)


def search_table_entities(
    metadata: OpenMetadata,
    service_name: str,
    database: Optional[str],
    database_schema: Optional[str],
    table: str,
) -> Optional[List[Table]]:
    """
    Method to get table entity from database, database_schema & table name.
    It uses ES to build the FQN if we miss some info and will run
    a request against the API to find the Entity.
    """
    search_tuple = (service_name, database, database_schema, table)
    if search_tuple in search_cache:
        return search_cache.get(search_tuple)
    try:
        table_fqns = fqn.build(
            metadata,
            entity_type=Table,
            service_name=service_name,
            database_name=database,
            schema_name=database_schema,
            table_name=table,
            fetch_multiple_entities=True,
        )
        table_entities: Optional[List[Table]] = []
        for table_fqn in table_fqns or []:
            table_entity: Table = metadata.get_by_name(Table, fqn=table_fqn)
            if table_entity:
                table_entities.append(table_entity)
        search_cache.put(search_tuple, table_entities)
        return table_entities
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(
            f"Error searching for table entities for service [{service_name}]: {exc}"
        )
        return None


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

    # First try to find the data from the given db and schema
    # Otherwise, pick it up from the table_name str
    # Finally, try with upper case

    split_table = table_name.split(".")
    empty_list: List[Any] = [None]  # Otherwise, there's a typing error in the concat

    database_query, schema_query, table = (
        empty_list * (3 - len(split_table))
    ) + split_table

    table_entities = search_table_entities(
        metadata=metadata,
        service_name=service_name,
        database=database_name,
        database_schema=database_schema,
        table=table,
    )

    if table_entities:
        return table_entities

    table_entities = search_table_entities(
        metadata=metadata,
        service_name=service_name,
        database=database_query,
        database_schema=schema_query,
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


def _build_table_lineage(
    from_entity: Table,
    to_entity: Table,
    from_table_raw_name: str,
    to_table_raw_name: str,
    query: str,
    column_lineage_map: dict,
) -> Optional[Iterator[AddLineageRequest]]:
    """
    Prepare the lineage request generator
    """
    col_lineage = get_column_lineage(
        to_entity=to_entity,
        to_table_raw_name=str(to_table_raw_name),
        from_entity=from_entity,
        from_table_raw_name=str(from_table_raw_name),
        column_lineage_map=column_lineage_map,
    )
    lineage_details = None
    if col_lineage:
        lineage_details = LineageDetails(sqlQuery=query, columnsLineage=col_lineage)
    if from_entity and to_entity:
        lineage = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(
                    id=from_entity.id.__root__,
                    type="table",
                ),
                toEntity=EntityReference(
                    id=to_entity.id.__root__,
                    type="table",
                ),
            )
        )
        if lineage_details:
            lineage.edge.lineageDetails = lineage_details
        yield lineage


# pylint: disable=too-many-arguments
def _create_lineage_by_table_name(
    metadata: OpenMetadata,
    from_table: str,
    to_table: str,
    service_name: str,
    database_name: Optional[str],
    schema_name: Optional[str],
    query: str,
    column_lineage_map: dict,
) -> Optional[Iterable[AddLineageRequest]]:
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

        for from_entity in from_table_entities or []:
            for to_entity in to_table_entities or []:
                yield from _build_table_lineage(
                    to_entity=to_entity,
                    from_entity=from_entity,
                    to_table_raw_name=to_table,
                    from_table_raw_name=from_table,
                    query=query,
                    column_lineage_map=column_lineage_map,
                )

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(
            f"Error creating lineage for service [{service_name}] from table [{from_table}]: {exc}"
        )


def populate_column_lineage_map(raw_column_lineage):
    """populate column lineage map

    Args:
        raw_column_lineage (_type_): raw column lineage
    """
    lineage_map = {}
    if not raw_column_lineage or len(raw_column_lineage[0]) != 2:
        return lineage_map
    for source, target in raw_column_lineage:
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


def get_lineage_by_query(
    metadata: OpenMetadata,
    service_name: str,
    database_name: Optional[str],
    schema_name: Optional[str],
    query: str,
) -> Optional[Iterator[AddLineageRequest]]:
    """
    This method parses the query to get source, target and intermediate table names to create lineage,
    and returns True if target table is found to create lineage otherwise returns False.
    """
    column_lineage = {}

    try:
        logger.debug(f"Running lineage with query: {query}")
        result = LineageRunner(query)

        raw_column_lineage = result.get_column_lineage()
        column_lineage.update(populate_column_lineage_map(raw_column_lineage))

        for intermediate_table in result.intermediate_tables:
            for source_table in result.source_tables:
                yield from _create_lineage_by_table_name(
                    metadata,
                    from_table=str(source_table),
                    to_table=str(intermediate_table),
                    service_name=service_name,
                    database_name=database_name,
                    schema_name=schema_name,
                    query=query,
                    column_lineage_map=column_lineage,
                )
            for target_table in result.target_tables:
                yield from _create_lineage_by_table_name(
                    metadata,
                    from_table=str(intermediate_table),
                    to_table=str(target_table),
                    service_name=service_name,
                    database_name=database_name,
                    schema_name=schema_name,
                    query=query,
                    column_lineage_map=column_lineage,
                )
        if not result.intermediate_tables:
            for target_table in result.target_tables:
                for source_table in result.source_tables:
                    yield from _create_lineage_by_table_name(
                        metadata,
                        from_table=str(source_table),
                        to_table=str(target_table),
                        service_name=service_name,
                        database_name=database_name,
                        schema_name=schema_name,
                        query=query,
                        column_lineage_map=column_lineage,
                    )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Ingesting lineage failed for service [{service_name}]: {exc}")


def get_lineage_via_table_entity(
    metadata: OpenMetadata,
    table_entity: Table,
    database_name: str,
    schema_name: str,
    service_name: str,
    query: str,
) -> Optional[Iterator[AddLineageRequest]]:
    """Get lineage from table entity

    Args:
        metadata (OpenMetadata): OM Server client Object
        table_entity (Table): table entity
        database_name (str): name of the database
        schema_name (str): name of the schema
        service_name (str): name of the service
        query (str): query used for lineage

    Returns:
        Optional[Iterator[AddLineageRequest]]

    Yields:
        Iterator[Optional[Iterator[AddLineageRequest]]]
    """
    column_lineage = {}

    try:
        logger.debug(f"Getting lineage via table entity using query: {query}")
        parser = LineageRunner(query)
        to_table_name = table_entity.name.__root__

        for from_table_name in parser.source_tables:
            yield from _create_lineage_by_table_name(
                metadata,
                from_table=str(from_table_name),
                to_table=f"{schema_name}.{to_table_name}",
                service_name=service_name,
                database_name=database_name,
                schema_name=schema_name,
                query=query,
                column_lineage_map=column_lineage,
            ) or []
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.error(
            f"Failed to create view lineage for database [{database_name}] and table [{table_entity}]: {exc}"
        )
