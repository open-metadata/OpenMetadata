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
Postgres lineage module
"""
from typing import Iterable

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.postgres.queries import POSTGRES_SQL_STATEMENT
from metadata.ingestion.source.database.postgres.query_parser import (
    PostgresQueryParserSource,
)


class PostgresLineageSource(PostgresQueryParserSource, LineageSource):
    """
    Implements the necessary methods to extract
    Database lineage from Postgres Source
    """

    sql_stmt = POSTGRES_SQL_STATEMENT

    filters = """
                AND (
                    s.query ILIKE '%%create table%%as%%select%%'
                    OR s.query ILIKE '%%insert%%'
                )
            """
    database_field = "d.datname"
    schema_field = ""  # schema filtering not available

    def next_record(self) -> Iterable[AddLineageRequest]:
        """
        Based on the query logs, prepare the lineage
        and send it to the sink
        """
        for table_queries in self.get_table_query():
            for table_query in table_queries.queries:
                lineages = get_lineage_by_query(
                    self.metadata,
                    query=table_query.query,
                    service_name=table_query.serviceName,
                    database_name=table_query.databaseName,
                    schema_name=table_query.databaseSchema,
                    dialect=Dialect.POSTGRES,
                )

                for lineage_request in lineages or []:
                    yield lineage_request
