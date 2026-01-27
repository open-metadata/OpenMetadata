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
    get_redshift_instance_type,
)
from metadata.ingestion.source.database.redshift.models import RedshiftInstanceType
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_SQL_STATEMENT_MAP,
)
from metadata.ingestion.source.database.redshift.query_parser import (
    RedshiftQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class RedshiftUsageSource(RedshiftQueryParserSource, UsageSource):
    """Redshift Usage Source with support for both Provisioned and Serverless deployments."""

    provisioned_filters = """
        AND querytxt NOT ILIKE 'fetch%%'
        AND querytxt NOT ILIKE 'padb_fetch_sample:%%'
        AND querytxt NOT ILIKE 'Undoing%%transactions%%on%%table%%with%%current%%xid%%'
    """

    # Serverless uses SYS views instead of STL views and have query_text column instead of querytxt
    serverless_filters = """
        AND query_text NOT ILIKE 'fetch%%'
        AND query_text NOT ILIKE 'padb_fetch_sample:%%'
        AND query_text NOT ILIKE 'Undoing%%transactions%%on%%table%%with%%current%%xid%%'
    """

    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

        self.redshift_instance_type = get_redshift_instance_type(self.engine)

        if self.redshift_instance_type == RedshiftInstanceType.PROVISIONED:
            self.sql_stmt = REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.PROVISIONED]
            self.filters = self.provisioned_filters
            logger.info("Using STL views for usage processing of Redshift Provisioned")
        else:
            self.sql_stmt = REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.SERVERLESS]
            self.filters = self.serverless_filters
            logger.info("Using SYS views for usage processing of Redshift Serverless")
