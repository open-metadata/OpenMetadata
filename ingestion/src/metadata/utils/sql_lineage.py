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

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.helpers import _get_formmated_table_name
from metadata.utils.logger import utils_logger


# Prevent sqllineage from modifying the logger config
def configure(self):
    pass


DictConfigurator.configure = configure


logger = utils_logger()


def _separate_fqn(database, fqn):
    database_schema, table = fqn.split(".")[-2:]
    if not database_schema:
        database_schema = None
    return {"database": database, "database_schema": database_schema, "name": table}


def _create_lineage_by_table_name(
    metadata: OpenMetadata,
    from_table: str,
    to_table: str,
    service_name: str,
    database: str,
):
    """
    This method is to create a lineage between two tables
    """
    try:
        from_table = str(from_table).replace("<default>", "")
        to_table = str(to_table).replace("<default>", "")
        from_fqdn = fqn.build(
            metadata,
            entity_type=Table,
            service_name=service_name,
            database_name=database,
            schema_name=None,  # TODO: Split table name
            table_name=_get_formmated_table_name(str(from_table)),
        )
        from_entity: Table = metadata.get_by_name(entity=Table, fqdn=from_fqdn)
        if not from_entity:
            table_obj = _separate_fqn(database=database, fqn=from_fqdn)
            multiple_from_fqns = metadata.es_search_from_service(
                entity_type=Table,
                service_name=service_name,
                filters=table_obj,
            )
        else:
            multiple_from_fqns = [from_entity]
        to_fqdn = fqn.build(
            metadata,
            entity_type=Table,
            service_name=service_name,
            database_name=database,
            schema_name=None,  # TODO: Split table name
            table_name=_get_formmated_table_name(str(to_table)),
        )
        to_entity: Table = metadata.get_by_name(entity=Table, fqdn=to_fqdn)
        if not to_entity:
            table_obj = _separate_fqn(database=database, fqn=to_fqdn)
            multiple_to_fqns = metadata.es_search_from_service(
                entity_type=Table,
                service_name=service_name,
                filters=table_obj,
            )
        else:
            multiple_to_fqns = [to_entity]
        if not multiple_to_fqns or not multiple_from_fqns:
            return None
        for from_entity in multiple_from_fqns:
            for to_entity in multiple_to_fqns:
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

                created_lineage = metadata.add_lineage(lineage)
                logger.info(f"Successfully added Lineage {created_lineage}")

    except Exception as err:
        logger.debug(traceback.format_exc())
        logger.error(err)


def ingest_lineage_by_query(
    metadata: OpenMetadata, query: str, database: str, service_name: str
) -> bool:
    """
    This method parses the query to get source, target and intermediate table names to create lineage,
    and returns True if target table is found to create lineage otherwise returns False.
    """
    from sqllineage.runner import LineageRunner

    try:
        result = LineageRunner(query)
        if not result.target_tables:
            return False
        for intermediate_table in result.intermediate_tables:
            for source_table in result.source_tables:
                _create_lineage_by_table_name(
                    metadata,
                    from_table=source_table,
                    to_table=intermediate_table,
                    service_name=service_name,
                    database=database,
                )
            for target_table in result.target_tables:
                _create_lineage_by_table_name(
                    metadata,
                    from_table=intermediate_table,
                    to_table=target_table,
                    service_name=service_name,
                    database=database,
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
                    )
        return True
    except Exception as err:
        logger.debug(str(err))
        logger.warning(f"Ingesting lineage failed")
    return False
