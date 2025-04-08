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
from metadata.ingestion.source.database.redshift.queries import REDSHIFT_SQL_STATEMENT
from metadata.ingestion.source.database.redshift.query_parser import (
    RedshiftQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource


class RedshiftUsageSource(RedshiftQueryParserSource, UsageSource):
    filters = """
        AND querytxt NOT ILIKE 'fetch%%'
        AND querytxt NOT ILIKE 'padb_fetch_sample:%%'
        AND querytxt NOT ILIKE 'Undoing%%transactions%%on%%table%%with%%current%%xid%%'
    """

    sql_stmt = REDSHIFT_SQL_STATEMENT
