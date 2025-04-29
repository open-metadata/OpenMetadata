#  Copyright 2021 Collate
#  Portions Copyright(c) 2023, TOSHIBA CORPORATION
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
PGSpider lineage module
"""
from typing import Iterable, Iterator

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.sql_lineage import search_table_entities
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.postgres.pgspider.queries import (
    PGSPIDER_GET_CHILD_TABLES,
    PGSPIDER_GET_MULTI_TENANT_TABLES,
)


def _get_multi_tenant_tables(connection) -> Iterable[any]:
    """
    Get list of multi tenant tables from PGSpider
    """
    sql = PGSPIDER_GET_MULTI_TENANT_TABLES

    with get_connection(connection).connect() as conn:
        rows = conn.execute(sql)
        return rows


def _get_child_tables(connection, multi_tenant_table: str) -> Iterable[any]:
    """
    Get list of child foreign tables of a multi-tenant table
    """
    sql = PGSPIDER_GET_CHILD_TABLES.format(multi_tenant_table=multi_tenant_table)

    with get_connection(connection).connect() as conn:
        rows = conn.execute(sql)
        return rows


# For column level lineage, find all pairs of columns which have
# the same name and create LineageDetails.
def _get_column_lineages(source_entity, target_entity):
    column_lineages = []
    for source_column in source_entity.columns:
        for target_column in target_entity.columns:
            if source_column.name == target_column.name:
                column_lineages.append(
                    ColumnLineage(
                        fromColumns=[source_column.fullyQualifiedName.root],
                        toColumn=target_column.fullyQualifiedName.root,
                    )
                )
                break
    return column_lineages


def get_lineage_from_multi_tenant_table(
    metadata: OpenMetadata,
    connection: any,
    service_name: str,
) -> Iterator[Either[AddLineageRequest]]:
    """
    For PGSpider, firstly, get list of multi-tenant tables.
    Next, get child foreign tables of each multi-tenant tables.
    Get entities of source and target table to create Lineage request.
    """
    for multi_tenant_table in _get_multi_tenant_tables(connection):
        database = multi_tenant_table["database"]
        schema = multi_tenant_table["nspname"]
        target_table = multi_tenant_table["relname"]
        target_entities = search_table_entities(
            metadata=metadata,
            service_name=service_name,
            database=database,
            database_schema=schema,
            table=target_table,
        )

        for child_foreign_table in _get_child_tables(connection, target_table):
            source_entities = search_table_entities(
                metadata=metadata,
                service_name=service_name,
                database=database,
                database_schema=schema,
                table=child_foreign_table["relname"],
            )

            for target_entity in target_entities:
                for source_entity in source_entities:
                    column_lineages = _get_column_lineages(source_entity, target_entity)
                    lineage_details = LineageDetails(
                        columnsLineage=column_lineages,
                    )
                    yield Either(
                        left=None,
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=source_entity.id, type="table"
                                ),
                                toEntity=EntityReference(
                                    id=target_entity.id, type="table"
                                ),
                                lineageDetails=lineage_details,
                            )
                        ),
                    )
