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
Databricks lineage module
"""

from metadata.ingestion.source.database.databricks.queries import (
    DATABRICKS_SQL_STATEMENT,
)
from metadata.ingestion.source.database.databricks.query_parser import (
    DatabricksQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DatabricksLineageSource(DatabricksQueryParserSource, LineageSource):
    """
    Databricks Lineage Legacy Source
    """

    sql_stmt = DATABRICKS_SQL_STATEMENT

    filters = """
        AND (
            lower(statement_text) LIKE '%%create%%select%%'
            OR lower(statement_text) LIKE '%%insert%%into%%select%%'
            OR lower(statement_text) LIKE '%%update%%'
            OR lower(statement_text) LIKE '%%merge%%'
        )
    """
