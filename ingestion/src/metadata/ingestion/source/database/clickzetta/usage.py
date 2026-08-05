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
"""ClickZetta usage source."""

from collections.abc import Iterable
from datetime import timedelta

from sqlalchemy import text

from metadata.generated.schema.type.tableQuery import TableQueries
from metadata.ingestion.source.database.clickzetta.query_parser import (
    ClickzettaQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ClickzettaUsageSource(ClickzettaQueryParserSource, UsageSource):
    """Extract bounded query usage from a configured ClickZetta history view."""

    filters = """
    AND (
        query_type IS NULL
        OR upper(query_type) NOT IN (
            'ALTER', 'CREATE_TABLE', 'CREATE_TABLE_AS_SELECT', 'CREATE_VIEW',
            'DROP', 'SHOW', 'DESCRIBE', 'USE'
        )
    )
    """

    def yield_table_queries(self) -> Iterable[TableQueries]:
        """Read query-history rows in at-most-one-day windows."""
        window_start = self.start
        while window_start < self.end:
            window_end = min(window_start + timedelta(days=1), self.end)
            logger.info(f"Scanning ClickZetta query history for {window_start} - {window_end}")
            try:
                for engine in self.get_engine():
                    sql_statement = self.get_sql_statement(window_start, window_end)
                    with engine.connect() as connection:
                        rows = connection.execute(text(sql_statement))
                        queries = []
                        for row in rows:
                            table_query = self.normalize_query_row(row, include_usage=True)
                            if table_query is not None:
                                queries.append(table_query)
                        if queries:
                            yield TableQueries(queries=queries)
            except Exception as exc:
                logger.error(f"ClickZetta usage query failed: {exc}")
            window_start = window_end
