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
Postgres usage module
"""
from metadata.ingestion.source.database.postgres.queries import POSTGRES_SQL_STATEMENT
from metadata.ingestion.source.database.postgres.query_parser import (
    PostgresQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource


class PostgresUsageSource(PostgresQueryParserSource, UsageSource):
    """
    Postgres class for Usage
    """

    sql_stmt = POSTGRES_SQL_STATEMENT
    filters = ""
    database_field = "d.datname"
    schema_field = ""  # schema filtering not available
