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
Clickhouse lineage module
"""
from typing import Iterator

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.clickhouse.query_parser import (
    ClickhouseQueryParserSource,
)
from metadata.ingestion.source.database.clickhouse.utils import get_mv_to_target_table
from metadata.ingestion.source.database.lineage_source import LineageSource


class ClickhouseLineageSource(ClickhouseQueryParserSource, LineageSource):
    """
    Implements the necessary methods to extract
    Database lineage from Clickhouse Source
    """

    sql_stmt = CLICKHOUSE_SQL_STATEMENT

    filters = """
        and (
            query_kind='Create'
            or (query_kind='Insert' and query ilike '%%insert%%into%%select%%')
        )
    """

    database_field = ""

    schema_field = "databases"

    def query_lineage_producer(self) -> Iterator[TableQuery]:
        """
        Yield the normal query logs, and — for CREATE MATERIALIZED VIEW ... TO <target>
        statements — additionally yield a synthetic ``INSERT INTO <target> SELECT * FROM <mv>``
        so the lineage parser can emit the downstream ``mv -> target`` edge that standard
        SQL parsers miss from ClickHouse's TO clause.
        """
        for table_query in super().query_lineage_producer():
            yield table_query
            mv_target = get_mv_to_target_table(table_query.query)
            if mv_target is None:
                continue
            mv_name, target_table = mv_target
            yield TableQuery(
                dialect=table_query.dialect,
                query=f"INSERT INTO {target_table} SELECT * FROM {mv_name}",
                databaseName=table_query.databaseName,
                serviceName=table_query.serviceName,
                databaseSchema=table_query.databaseSchema,
            )
