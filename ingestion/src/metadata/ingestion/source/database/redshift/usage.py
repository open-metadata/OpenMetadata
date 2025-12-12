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
Redshift usage module
"""
from metadata.ingestion.source.database.redshift.connection import (
    detect_redshift_serverless,
)
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_SQL_STATEMENT,
    REDSHIFT_SERVERLESS_SQL_STATEMENT,
    get_redshift_queries,
)
from metadata.ingestion.source.database.redshift.query_parser import (
    RedshiftQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class RedshiftUsageSource(RedshiftQueryParserSource, UsageSource):
    filters = """
        AND querytxt NOT ILIKE 'fetch%%'
        AND querytxt NOT ILIKE 'padb_fetch_sample:%%'
        AND querytxt NOT ILIKE 'Undoing%%transactions%%on%%table%%with%%current%%xid%%'
    """

    # Serverless uses different filter syntax for query_text vs querytxt
    serverless_filters = """
        AND query_text NOT ILIKE 'fetch%%'
        AND query_text NOT ILIKE 'padb_fetch_sample:%%'
        AND query_text NOT ILIKE 'Undoing%%transactions%%on%%table%%with%%current%%xid%%'
    """

    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)
        
        # Detect Redshift deployment type
        try:
            self.is_serverless = detect_redshift_serverless(self.engine)
            logger.info(f"Redshift deployment type: {'Serverless' if self.is_serverless else 'Provisioned'}")
        except Exception as exc:
            logger.warning(f"Could not detect Redshift deployment type, defaulting to Provisioned: {exc}")
            self.is_serverless = False
        
        # Set appropriate queries and filters
        if self.is_serverless:
            self.sql_stmt = REDSHIFT_SERVERLESS_SQL_STATEMENT
            self.filters = self.serverless_filters
            logger.info("Using SYS views for Redshift Serverless")
        else:
            self.sql_stmt = REDSHIFT_SQL_STATEMENT
            self.filters = self.filters
            logger.info("Using STL views for Redshift Provisioned")
