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
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class StarRocksLineageSource(StarRocksQueryParserSource, LineageSource):
    """
    StarRocks lineage source implements query log-based lineage extraction
    """

    sql_stmt = STARROCKS_SQL_STATEMENT
    filters = """
        AND (
            lower(`sql`) LIKE '%%create%%table%%as%%select%%'
            OR lower(`sql`) LIKE '%%create%%view%%as%%select%%'
            OR lower(`sql`) LIKE '%%insert%%into%%select%%'
            OR lower(`sql`) LIKE '%%insert%%overwrite%%'
            OR lower(`sql`) LIKE '%%update%%'
            OR lower(`sql`) LIKE '%%merge%%'
        )
    """
