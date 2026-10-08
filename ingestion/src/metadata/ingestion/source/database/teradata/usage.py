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
Teradata usage module
"""

from metadata.ingestion.source.database.teradata.query_parser import (
    TeradataQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource


class TeradataUsageSource(TeradataQueryParserSource, UsageSource):
    """
    Teradata usage from the DBQL query log
    """

    # Same load-row/DDL exclusion as lineage: INSERT ... VALUES and plain CREATE TABLE
    # touch no source table and would flood resultLimit
    filters = """
        AND (
            UPPER(q.StatementType) LIKE ANY ('SELECT%', 'UPDATE%', 'MERGE%', 'DELETE%')
            OR (
                UPPER(q.StatementType) LIKE ANY ('INSERT%', 'CREATE TABLE%')
                AND UPPER(COALESCE(s.SqlTextInfo, q.QueryText)) LIKE '%SEL%'
            )
        )
    """
