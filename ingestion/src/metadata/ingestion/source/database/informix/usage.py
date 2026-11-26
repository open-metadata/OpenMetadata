#  Copyright 2026 OpenMetadata
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
Informix usage source.
"""

import re

from metadata.ingestion.source.database.informix.query_parser import (
    InformixQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource

# Informix qualifies a table as database:owner.table. The SQL parser does not know
# the "database:" prefix, so it is dropped and the table resolves as owner.table.
INFORMIX_DATABASE_PREFIX = re.compile(r"\b[A-Za-z_]\w*:(\w+\.\w+)\b")


class InformixUsageSource(InformixQueryParserSource, UsageSource):
    """Usage from the statements in sysmaster:syssqltrace."""

    filters = """
        AND LOWER(sql_statement) NOT LIKE '%update statistics%'
    """

    def format_query(self, query: str) -> str:
        return INFORMIX_DATABASE_PREFIX.sub(r"\1", super().format_query(query))
