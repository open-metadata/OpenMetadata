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
Trino lineage module
"""

from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.trino.queries import TRINO_SQL_STATEMENT
from metadata.ingestion.source.database.trino.query_parser import TrinoQueryParserSource


class TrinoLineageSource(TrinoQueryParserSource, LineageSource):
    """
    Trino class for Lineage
    """

    sql_stmt = TRINO_SQL_STATEMENT

    filters = """
        AND (
            lower("query") LIKE '%%create%%table%%as%%select%%'
            OR lower("query") LIKE '%%insert%%into%%select%%'
            OR lower("query") LIKE '%%update%%'
            OR lower("query") LIKE '%%merge%%'
        )
    """
