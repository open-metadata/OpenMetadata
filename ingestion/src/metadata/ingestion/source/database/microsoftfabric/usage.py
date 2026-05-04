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
Microsoft Fabric usage module
"""

from metadata.ingestion.source.database.microsoftfabric.queries import (
    FABRIC_SQL_STATEMENT,
)
from metadata.ingestion.source.database.microsoftfabric.query_parser import (
    MicrosoftFabricQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource


class MicrosoftFabricUsageSource(MicrosoftFabricQueryParserSource, UsageSource):
    sql_stmt = FABRIC_SQL_STATEMENT

    filters = """
        AND lower(h.command) NOT LIKE '%%create%%procedure%%'
        AND lower(h.command) NOT LIKE '%%create%%function%%'
        AND lower(h.command) NOT LIKE '%%declare%%'
        AND lower(h.command) NOT LIKE '%%exec sp_set_session_context%%'
        AND lower(h.command) NOT LIKE '%%exec sp_%%'
    """
