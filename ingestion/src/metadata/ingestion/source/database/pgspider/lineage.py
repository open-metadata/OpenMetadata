#  Copyright 2021 Collate
#  Portions Copyright(c) 2023, TOSHIBA CORPORATION
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
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.pgspider.queries import (
    PGSPIDER_GET_MULTI_TENANT_TABLES,
    PGSPIDER_GET_CHILD_TABLES
)
from metadata.ingestion.source.database.pgspider.query_parser import PGSpiderQueryParserSource
from metadata.ingestion.source.database.postgres.lineage import PostgresLineageSource
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.lineage.sql_lineage import search_table_entities
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityReference import EntityReference


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
            return rows

    def get_child_tables(self, multi_tenant_table: str) -> Iterable[any]:
        """
        Get list of child foreign tables of a multi-tenant table
        """
        sql = PGSPIDER_GET_CHILD_TABLES.format(multi_tenant_table=multi_tenant_table)

        with get_connection(self.service_connection).connect() as conn:
            rows = conn.execute(sql)
            return rows

    def next_record(self) -> Iterable[AddLineageRequest]:
        """
        Based on the query logs, prepare the lineage
        and send it to the sink
        """
        yield from PostgresLineageSource.next_record(self)

        """
        For PGSpider, firstly, get list of multi-tenant tables.
        Next, get child foreign tables of each multi-tenant tables.
        Get entities of source and target table to create Lineage request.
        For column level lineage, find all pairs of columns which have
        the same name and create LineageDetails.
        """
        for multi_tenant_table in self.get_multi_tenant_tables():
            multi_tenant_table = dict(multi_tenant_table)
            target_table = multi_tenant_table["relname"]
            database = multi_tenant_table["database"]
            schema = multi_tenant_table["nspname"]

            target_table_entities = search_table_entities(
                metadata=self.metadata,
                service_name=self.config.serviceName,
                database=database,
                database_schema=schema,
                table=target_table,
            )

            for child_foreign_table in self.get_child_tables(target_table):
                child_foreign_table = dict(child_foreign_table)
                source_table = child_foreign_table["relname"]
                source_table_entities = search_table_entities(
                    metadata=self.metadata,
                    service_name=self.config.serviceName,
                    database=database,
                    database_schema=schema,
                    table=source_table,
                )

                for source_entity in source_table_entities or []:
                    for target_entity in target_table_entities or []:
                        column_lineages = []
                        for source_column in source_entity.columns:
                            for target_column in target_entity.columns:
                                """ Find that matching pair of column """
                                if source_column.name == target_column.name:
                                    column_lineages.append(
                                        ColumnLineage(
                                            fromColumns=[source_column.fullyQualifiedName.__root__],
                                            toColumn=target_column.fullyQualifiedName.__root__
                                        )
                                    )
                                    break

                        lineage_details = LineageDetails(
                            columnsLineage=column_lineages,
                        )
                        yield AddLineageRequest(
                            description="Lineage Request: source = " + source_table + ", target = " + target_table,
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(id=source_entity.id, type="table"),
                                toEntity=EntityReference(id=target_entity.id, type="table"),
                                lineageDetails=lineage_details
                            )
                        )
