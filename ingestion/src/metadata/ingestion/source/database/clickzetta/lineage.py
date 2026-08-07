#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""ClickZetta query-lineage source."""

from collections.abc import Iterator

from sqlalchemy import text

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.clickzetta.query_parser import (
    ClickzettaQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ClickzettaLineageSource(ClickzettaQueryParserSource, LineageSource):
    """Extract lineage-bearing DML/CTAS statements from query history."""

    filters = """
    AND (
        upper(query_type) IN (
            'CREATE_TABLE_AS_SELECT', 'CREATE_VIEW', 'INSERT', 'MERGE', 'UPDATE'
        )
        OR lower(query_text) LIKE '%insert%into%select%'
        OR lower(query_text) LIKE '%create%table%as%select%'
        OR lower(query_text) LIKE '%merge%into%'
    )
    """

    def yield_table_query(self) -> Iterator[TableQuery]:
        """Read one bounded query-history window for SQL lineage parsing."""
        for engine in self.get_engine():
            sql_statement = self.get_sql_statement(self.start, self.end)
            try:
                with engine.connect() as connection:
                    rows = connection.execute(text(sql_statement))
                    for row in rows:
                        table_query = self.normalize_query_row(row, include_usage=False)
                        if table_query is not None:
                            yield table_query
            except Exception as exc:
                logger.error(f"ClickZetta lineage query failed: {exc}")
