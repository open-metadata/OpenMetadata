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
Informix lineage source.
"""

from collections.abc import Iterator

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.informix.query_parser import (
    InformixQueryParserSource,
    normalise_table_references,
)
from metadata.ingestion.source.database.lineage_source import LineageSource


class InformixLineageSource(InformixQueryParserSource, LineageSource):
    """Lineage from the statements in sysmaster:syssqltrace that write data."""

    filters = """
        AND (
            LOWER(sql_statement) LIKE '%create%table%as%select%'
            OR LOWER(sql_statement) LIKE '%insert%into%select%'
            OR (LOWER(sql_statement) LIKE '%update%' AND LOWER(sql_statement) LIKE '%set%')
            OR LOWER(sql_statement) LIKE '%merge%'
        )
    """

    def yield_table_query(self) -> Iterator[TableQuery]:
        for table_query in super().yield_table_query():
            table_query.query = normalise_table_references(table_query.query)
            yield table_query
