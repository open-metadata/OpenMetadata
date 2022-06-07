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
from typing import List, Optional

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.helpers import get_formatted_entity_name
from metadata.utils.logger import utils_logger

logger = utils_logger()
column_lineage_map = {}


def split_raw_table_name(database: str, raw_name: str) -> dict:
    database_schema = None
    if "." in raw_name:
        database_schema, table = fqn.split(raw_name)[-2:]
        if database_schema == "<default>":
            database_schema = None
    return {"database": database, "database_schema": database_schema, "table": table}


def get_column_fqn(table_entity: Table, column: str) -> Optional[str]:
    """
    Get fqn of column if exist in table entity
    """
    if not table_entity:
        return
    for tbl_column in table_entity.columns:
        if column.lower() == tbl_column.name.__root__.lower():
            return tbl_column.fullyQualifiedName.__root__


def search_table_entities(
    metadata: OpenMetadata,
    service_name: str,
    database: str,
    database_schema: Optional[str],
    table: str,
) -> Optional[List[Table]]:
    """
    Method to get table entity from database, database_schema & table name
    """
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
        table_entities = []
        for table_fqn in table_fqns or []:
            try:
                table_entity = metadata.get_by_name(Table, fqn=table_fqn)
                table_entities.append(table_entity)
            except APIError:
                logger.debug(f"Table not found for fqn: {fqn}")
        return table_entities
    except Exception as err:
        logger.debug(traceback.format_exc())
        logger.error(err)


def get_column_lineage(
    to_entity: Table,
    from_entity: Table,
    to_table_raw_name: str,
    from_table_raw_name: str,
) -> List[ColumnLineage]:
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


def _create_lineage_by_table_name(
    metadata: OpenMetadata,
    from_table: str,
    to_table: str,
    service_name: str,
    database: str,
    query: str,
):
    """
    This method is to create a lineage between two tables
    """

    try:
        from_raw_name = get_formatted_entity_name(str(from_table))
        from_table_obj = split_raw_table_name(database=database, raw_name=from_raw_name)
        from_entities = search_table_entities(
            table=from_table_obj.get("table"),
            database_schema=from_table_obj.get("database_schema"),
            database=from_table_obj.get("database"),
            metadata=metadata,
            service_name=service_name,
        )
        to_raw_name = get_formatted_entity_name(str(to_table))
        to_table_obj = split_raw_table_name(database=database, raw_name=to_raw_name)
        to_entities = search_table_entities(
            table=to_table_obj.get("table"),
            database_schema=to_table_obj.get("database_schema"),
            database=to_table_obj.get("database"),
            metadata=metadata,
            service_name=service_name,
        )
        if not to_entities or not from_entities:
            return None
        for from_entity in from_entities:
            for to_entity in to_entities:
                col_lineage = get_column_lineage(
                    to_entity=to_entity,
                    to_table_raw_name=str(to_table),
                    from_entity=from_entity,
                    from_table_raw_name=str(from_table),
                )
                lineage_details = None
                if col_lineage:
                    lineage_details = LineageDetails(
                        sqlQuery=query, columnsLineage=col_lineage
                    )
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
                    created_lineage = metadata.add_lineage(lineage)
                    logger.info(f"Successfully added Lineage {created_lineage}")

    except Exception:
        logger.debug(traceback.format_exc())
        logger.error(traceback.format_exc())


def populate_column_lineage_map(raw_column_lineage):
    lineage_map = {}
    if not raw_column_lineage or len(raw_column_lineage[0]) != 2:
        return
    for source, target in raw_column_lineage:
        if lineage_map.get(str(target.parent)):
            ele = lineage_map.get(str(target.parent))
            if ele.get(str(source.parent)):
                ele[str(source.parent)].append(
                    (
                        target.raw_name,
                        source.raw_name,
                    )
                )
            else:
                ele[str(source.parent)] = [(target.raw_name, source.raw_name)]
        else:
            lineage_map[str(target.parent)] = {
                str(source.parent): [(target.raw_name, source.raw_name)]
            }
    return lineage_map


def ingest_lineage_by_query(
    metadata: OpenMetadata, query: str, database: str, service_name: str
) -> bool:
    """
    This method parses the query to get source, target and intermediate table names to create lineage,
    and returns True if target table is found to create lineage otherwise returns False.
    """
    # Prevent sqllineage from modifying the logger config
    # Disable the DictConfigurator.configure method while importing LineageRunner
    configure = DictConfigurator.configure
    DictConfigurator.configure = lambda _: None
    from sqllineage.runner import LineageRunner

    # Reverting changes after import is done
    DictConfigurator.configure = configure
    column_lineage_map.clear()

    try:
        result = LineageRunner(query)
        if not result.target_tables:
            return False
        raw_column_lineage = result.get_column_lineage()
        column_lineage_map.update(populate_column_lineage_map(raw_column_lineage))
        for intermediate_table in result.intermediate_tables:
            for source_table in result.source_tables:
                _create_lineage_by_table_name(
                    metadata,
                    from_table=source_table,
                    to_table=intermediate_table,
                    service_name=service_name,
                    database=database,
                    query=query,
                )
            for target_table in result.target_tables:
                _create_lineage_by_table_name(
                    metadata,
                    from_table=intermediate_table,
                    to_table=target_table,
                    service_name=service_name,
                    database=database,
                    query=query,
                )
        if not result.intermediate_tables:
            for target_table in result.target_tables:
                for source_table in result.source_tables:
                    _create_lineage_by_table_name(
                        metadata,
                        from_table=source_table,
                        to_table=target_table,
                        service_name=service_name,
                        database=database,
                        query=query,
                    )
        return True
    except Exception as err:
        logger.debug(str(err))
        logger.warning(f"Ingesting lineage failed")
    return False
