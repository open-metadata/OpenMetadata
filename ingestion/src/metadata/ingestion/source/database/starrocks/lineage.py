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
StarRocks lineage module
"""

import re
from collections.abc import Iterable

from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.starrocks.queries import STARROCKS_SQL_STATEMENT
from metadata.ingestion.source.database.starrocks.query_parser import (
    StarRocksQueryParserSource,
)
from metadata.ingestion.source.models import TableView

MV_DDL_PATTERN = re.compile(r"^\s*CREATE\s+(?:OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW\s+", re.IGNORECASE)
MV_BODY_PATTERN = re.compile(r"\bAS\s+(?=SELECT\b|WITH\b)", re.IGNORECASE)
MV_NAME_PATTERN = re.compile(
    r"^\s*CREATE\s+(?:OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW\s+"
    r"(?:IF\s+NOT\s+EXISTS\s+)?((?:`[^`]+`|\w+)(?:\.(?:`[^`]+`|\w+))*)",
    re.IGNORECASE,
)
QUOTED_STRING_PATTERN = re.compile(r"'(?:[^'\\]|\\.|'')*'|\"(?:[^\"\\]|\\.|\"\")*\"")


def _mask_quoted_strings(query: str) -> str:
    """Replace the contents of single/double-quoted string literals with
    same-length filler. Length-preserving, so offsets into the result map 1:1
    onto the original query. Used so a literal ``AS SELECT``/``AS WITH`` inside
    a COMMENT or PROPERTIES value is not mistaken for the query body.
    """
    return QUOTED_STRING_PATTERN.sub(lambda m: m.group()[0] + "x" * (len(m.group()) - 2) + m.group()[-1], query)


def normalize_mv_ddl(query: str) -> str:
    """Normalize StarRocks/Doris CREATE MATERIALIZED VIEW DDL to a form that
    sqlglot can parse (CREATE VIEW ... AS SELECT ...).

    Discards every clause between the MV name and the query body (column list,
    COMMENT, PARTITION BY, DISTRIBUTED BY, BUCKETS, ORDER BY, REFRESH,
    PROPERTIES). Anchors on the ``AS`` that introduces the body (``AS SELECT``
    / ``AS WITH``); quoted strings are masked first so an ``AS SELECT`` inside a
    COMMENT or PROPERTIES value is not mistaken for it. Non-MV queries are
    returned unchanged.
    """
    result = query
    if MV_DDL_PATTERN.match(query):
        body_match = MV_BODY_PATTERN.search(_mask_quoted_strings(query))
        name_match = MV_NAME_PATTERN.match(query)
        if body_match and name_match:
            body = query[body_match.end() :].strip()
            result = f"CREATE VIEW {name_match.group(1)} AS {body}"
    return result


class StarRocksLineageSource(StarRocksQueryParserSource, LineageSource):
    """
    Implements the necessary methods to extract
    Database lineage from StarRocks audit logs.

    Extracts lineage from:
    - CREATE TABLE AS SELECT
    - CREATE VIEW AS SELECT
    - CREATE MATERIALIZED VIEW AS SELECT
    - INSERT INTO ... SELECT
    - INSERT OVERWRITE ... SELECT
    """

    sql_stmt = STARROCKS_SQL_STATEMENT

    filters = """
        AND (
            stmt LIKE '%CREATE%TABLE%AS%SELECT%'
            OR stmt LIKE '%CREATE%VIEW%AS%SELECT%'
            OR stmt LIKE '%CREATE%MATERIALIZED%VIEW%AS%SELECT%'
            OR stmt LIKE '%INSERT%INTO%SELECT%'
            OR stmt LIKE '%INSERT%OVERWRITE%SELECT%'
        )
    """

    database_field = "database_name"

    schema_field = "schema_name"

    def prepare_lineage_query(self, query: str) -> str:
        return normalize_mv_ddl(query)

    def view_lineage_producer(self) -> Iterable[TableView]:
        """
        Normalize materialized-view definitions so the view-lineage path
        (which parses ``view_definition`` directly) handles StarRocks MV DDL
        the same way as the query-log path.
        """
        for view in super().view_lineage_producer():
            if view.view_definition:
                view.view_definition = normalize_mv_ddl(view.view_definition)
            yield view
