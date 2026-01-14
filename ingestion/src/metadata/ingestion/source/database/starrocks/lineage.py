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
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.starrocks.queries import STARROCKS_SQL_STATEMENT
from metadata.ingestion.source.database.starrocks.query_parser import (
    StarRocksQueryParserSource,
)


class StarRocksLineageSource(StarRocksQueryParserSource, LineageSource):
    """
    Implements the necessary methods to extract
    Database lineage from StarRocks audit logs.

    Extracts lineage from:
    - CREATE TABLE AS SELECT
    - CREATE VIEW AS SELECT
    - INSERT INTO ... SELECT
    - INSERT OVERWRITE ... SELECT
    """

    sql_stmt = STARROCKS_SQL_STATEMENT

    filters = """
        AND (
            stmt LIKE '%CREATE%TABLE%AS%SELECT%'
            OR stmt LIKE '%CREATE%VIEW%AS%SELECT%'
            OR stmt LIKE '%INSERT%INTO%SELECT%'
            OR stmt LIKE '%INSERT%OVERWRITE%SELECT%'
        )
    """

    database_field = "database_name"

    schema_field = "schema_name"
