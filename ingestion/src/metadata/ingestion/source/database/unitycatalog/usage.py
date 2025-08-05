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
unity catalog usage module
"""

from metadata.ingestion.source.database.unitycatalog.queries import (
    UNITY_CATALOG_SQL_STATEMENT,
)
from metadata.ingestion.source.database.unitycatalog.query_parser import (
    UnityCatalogQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class UnitycatalogUsageSource(UnityCatalogQueryParserSource, UsageSource):
    """
    UnityCatalog Usage Source

    This class would be inheriting all the methods from
    DatabricksUsageSource as both the sources would call
    the same API for fetching Usage Queries
    """

    sql_stmt = UNITY_CATALOG_SQL_STATEMENT

    filters = """
        AND statement_type NOT IN ('SHOW', 'DESCRIBE', 'USE')
    """

    def get_engine(self):
        yield self.sql_client

    def get_sql_statement(self, start_time, end_time):
        """
        returns sql statement to fetch query logs.

        Override if we have specific parameters
        """
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,
        )
