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
        for record in PostgresLineageSource.next_record(self):
            yield record

        """
        For PGSpider, firstly, get list of multi-tenant tables.
        Next, get child foreign table of each multi-tenant tables.
        Create the INSERT query which follows the format of Lineage feature,
        with source table is multi-tenant table, and child table is child
        foreign table. Prepare the lineage and send it to the sink.
        """
        for multi_tenant_table in self.get_multi_tenant_tables():
            # logger.info(multi_tenant_table)
            multi_tenant_table = dict(multi_tenant_table)
            for child_table in self.get_child_tables(multi_tenant_table["relname"]):
                logger.info(child_table)
                sql = "INSERT INTO " + multi_tenant_table["relname"] + " SELECT * FROM " + child_table + ";"
                logger.info(sql)
                lineages = get_lineage_by_query(
                    self.metadata,
                    query=sql,
                    service_name=self.config.serviceName,
                    database_name=multi_tenant_table["database"],
                    schema_name=multi_tenant_table["nspname"],
                    dialect=Dialect.POSTGRES
                )

                for lineage_request in lineages or []:
                    yield lineage_request
