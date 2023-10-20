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
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresScheme,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.postgres.pgspider.lineage import (
    get_lineage_from_multi_tenant_table,
)
from metadata.ingestion.source.database.postgres.queries import POSTGRES_SQL_STATEMENT
from metadata.ingestion.source.database.postgres.query_parser import (
    PostgresQueryParserSource,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PostgresLineageSource(PostgresQueryParserSource, LineageSource):
    """
    Implements the necessary methods to extract
    Database lineage from Postgres Source
    """

    sql_stmt = POSTGRES_SQL_STATEMENT

    filters = """
                AND (
                    query_text ILIKE '%%create table%%as%%select%%'
                    OR query_text ILIKE '%%insert%%into%%select%%'
                    OR query_text ILIKE '%%update%%'
                    OR query_text ILIKE '%%merge%%'
                )
            """

    
