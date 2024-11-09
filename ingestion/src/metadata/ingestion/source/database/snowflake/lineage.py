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
Snowflake lineage module
"""

from typing import Dict, List

from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES,
    SNOWFLAKE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.snowflake.query_parser import (
    SnowflakeQueryParserSource,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    QueryByProcedure,
    StoredProcedureLineageMixin,
)
from metadata.utils.helpers import get_start_and_end


class SnowflakeLineageSource(
    SnowflakeQueryParserSource, StoredProcedureLineageMixin, LineageSource
):
    """
    Snowflake class for Lineage
    """

    sql_stmt = SNOWFLAKE_SQL_STATEMENT

    filters = """
        AND (
            QUERY_TYPE IN ('MERGE', 'UPDATE','CREATE_TABLE_AS_SELECT')
            OR (QUERY_TYPE = 'INSERT' and query_text ILIKE '%%insert%%into%%select%%')
        )
    """

    stored_procedure_query = SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES

    def get_stored_procedure_queries_dict(self) -> Dict[str, List[QueryByProcedure]]:
        """
        Return the dictionary associating stored procedures to the
        queries they triggered
        """
        start, _ = get_start_and_end(self.source_config.queryLogDuration)
        query = self.stored_procedure_query.format(
            start_date=start,
        )
        queries_dict = self.procedure_queries_dict(
            query=query,
        )

        return queries_dict
