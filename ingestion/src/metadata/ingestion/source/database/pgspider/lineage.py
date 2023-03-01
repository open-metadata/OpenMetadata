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
PGSpider lineage module
"""
from typing import Iterable

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.pgspider.queries import PGSPIDER_GET_MULTI_TENANT_TABLES, \
    PGSPIDER_GET_CHILD_TABLES
from metadata.ingestion.source.database.pgspider.query_parser import (
    PGSpiderQueryParserSource,
)
from metadata.ingestion.source.database.postgres.lineage import (
    PostgresLineageSource,
)
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.lineage.sql_lineage import search_table_entities
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PgspiderLineageSource(PGSpiderQueryParserSource, PostgresLineageSource, LineageSource):
    """
    Implements the necessary methods to extract Lineage information
    for multi-tenant tables and foreign table from PGSpider Source
    """
    def get_multi_tenant_tables(self) -> Iterable[any]:
        """
        Get list of multi tenant tables from PGSpider
        """
        sql = PGSPIDER_GET_MULTI_TENANT_TABLES

        with get_connection(self.service_connection).connect() as conn:
            rows = conn.execute(sql)
            logger.info(type(rows))
            return rows

    def get_child_tables(self, multi_tenant_table: str) -> Iterable[str]:
        """
        Get list of child foreign tables of a multi-tenant table
        """
        sql = PGSPIDER_GET_CHILD_TABLES.format(multi_tenant_table=multi_tenant_table)

        child_tables_list = []
        with get_connection(self.service_connection).connect() as conn:
            rows = conn.execute(sql)
            for row in rows:
                row = dict(row)
                child_tables_list.append(row["relname"])

        return child_tables_list

    def next_record(self) -> Iterable[AddLineageRequest]:
        """
        Based on the query logs, prepare the lineage
        and send it to the sink
        """
        yield from PostgresLineageSource.next_record(self)

        """
        For PGSpider, firstly, get list of multi-tenant tables.
        Next, get child foreign table of each multi-tenant tables.
        Create the INSERT query which follows the format of Lineage feature,
        with source table is multi-tenant table, and child table is child
        foreign table. Prepare the lineage and send it to the sink.
        """
        for multi_tenant_table in self.get_multi_tenant_tables():
            multi_tenant_table = dict(multi_tenant_table)
            target_table = multi_tenant_table["relname"]

            for source_table in self.get_child_tables(target_table):
                target_table_entities = search_table_entities(
                    metadata=self.metadata,
                    service_name=self.config.serviceName,
                    database=multi_tenant_table["database"],
                    database_schema=multi_tenant_table["nspname"],
                    table=target_table,
                )
                source_table_entities = search_table_entities(
                    metadata=self.metadata,
                    service_name=self.config.serviceName,
                    database=multi_tenant_table["database"],
                    database_schema=multi_tenant_table["nspname"],
                    table=source_table,
                )

                for source in source_table_entities or []:
                    for target in target_table_entities or []:
                        """
                        Loop through all columns of source and target,
                        get the matching pair to create column lineage
                        """
                        column_lineages = []
                        for source_column in source.columns:
                            for target_column in target.columns:
                                if source_column.name == target_column.name:
                                    logger.info(source_column.fullyQualifiedName)
                                    logger.info(target_column.fullyQualifiedName)
                                    column_lineage = ColumnLineage(
                                        fromColumns=[source_column.fullyQualifiedName.__root__],
                                        toColumn=target_column.fullyQualifiedName.__root__
                                    )
                                    column_lineages.append(column_lineage)

                        lineage_details = LineageDetails(
                            columnsLineage=column_lineages,
                        )
                        yield AddLineageRequest(
                            description="Lineage Request: source = " + source_table + ", target = " + target_table,
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(id=source.id, type="table"),
                                toEntity=EntityReference(id=target.id, type="table"),
                                lineageDetails=lineage_details
                            ),
                        )
