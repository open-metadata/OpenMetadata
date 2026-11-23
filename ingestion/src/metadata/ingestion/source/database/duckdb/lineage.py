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
DuckDB lineage source: view lineage from view definitions, and query lineage from
``main.duckdb_query_log`` when that table exists.
"""

from metadata.ingestion.source.database.duckdb.query_log import DuckDBQueryParserSource
from metadata.ingestion.source.database.lineage_source import LineageSource


class DuckDBLineageSource(DuckDBQueryParserSource, LineageSource):
    filters = """
        AND (
            query_text ILIKE '%%create%%table%%as%%select%%'
            OR query_text ILIKE '%%create%%view%%'
            OR query_text ILIKE '%%insert%%into%%select%%'
            OR query_text ILIKE '%%update%%'
            OR query_text ILIKE '%%merge%%'
        )
    """
