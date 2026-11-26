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
Doris usage module
"""

from metadata.ingestion.source.database.doris.queries import DORIS_SQL_STATEMENT
from metadata.ingestion.source.database.doris.query_parser import DorisQueryParserSource
from metadata.ingestion.source.database.usage_source import UsageSource


class DorisUsageSource(DorisQueryParserSource, UsageSource):
    """
    Implements the necessary methods to extract
    Database Usage from Doris Source
    """

    sql_stmt = DORIS_SQL_STATEMENT

    # The queries users ran: is_internal marks the ones Doris runs itself, such as statistics collection
    filters = "AND is_query = 1 AND is_internal = 0"
