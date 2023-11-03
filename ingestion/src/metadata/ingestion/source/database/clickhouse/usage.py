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
Clickhouse usage module
"""
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.clickhouse.query_parser import (
    ClickhouseQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource


class ClickhouseUsageSource(ClickhouseQueryParserSource, UsageSource):
    """
    Implements the necessary methods to extract
    Database Usage from Clickhouse Source
    """

    sql_stmt = CLICKHOUSE_SQL_STATEMENT

    filters = """
        and query_kind = 'Select'
    """

    database_field = ""

    schema_field = "databases"
