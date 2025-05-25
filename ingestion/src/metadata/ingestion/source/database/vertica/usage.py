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
Vertica lineage module
"""
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.ingestion.source.database.vertica.queries import VERTICA_SQL_STATEMENT
from metadata.ingestion.source.database.vertica.query_parser import (
    VerticaQueryParserSource,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class VerticaUsageSource(VerticaQueryParserSource, UsageSource):
    sql_stmt = VERTICA_SQL_STATEMENT

    filters = "AND query_type NOT IN ('UTILITY', 'TRANSACTION', 'SHOW', 'SET')"

    database_field = "DBNAME()"

    schema_field = ""  # schema filtering not available
