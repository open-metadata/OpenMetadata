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
Snowflake lineage module
"""

from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.snowflake_query_parser import (
    SnowflakeQueryParserSource,
)
from metadata.utils.sql_queries import SNOWFLAKE_SQL_STATEMENT


class SnowflakeLineageSource(SnowflakeQueryParserSource, LineageSource):
    """
    Snowflake class for Lineage
    """

    sql_stmt = SNOWFLAKE_SQL_STATEMENT

    filters = """
        AND QUERY_TYPE IN ('INSERT', 'MERGE', 'UPDATE','COPY','CREATE_TABLE_AS_SELECT')
    """
