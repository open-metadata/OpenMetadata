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
Handle big query lineage extraction
"""
from typing import Dict, List

from metadata.ingestion.source.database.bigquery.queries import (
    BIGQUERY_GET_STORED_PROCEDURE_QUERIES,
    BIGQUERY_STATEMENT,
)
from metadata.ingestion.source.database.bigquery.query_parser import (
    BigqueryQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.stored_procedures_mixin import (
    QueryByProcedure,
    StoredProcedureLineageMixin,
)
from metadata.utils.helpers import get_start_and_end


class BigqueryLineageSource(
    BigqueryQueryParserSource, StoredProcedureLineageMixin, LineageSource
):
    """
    Implements the necessary methods to extract
    Database lineage from Bigquery Source
    """

    sql_stmt = BIGQUERY_STATEMENT

    filters = """
        AND (
            statement_type IN ("MERGE", "CREATE_TABLE_AS_SELECT", "UPDATE") 
            OR (statement_type = "INSERT" and UPPER(query) like '%%INSERT%%INTO%%SELECT%%')
        )
    """

    def get_stored_procedure_queries_dict(self) -> Dict[str, List[QueryByProcedure]]:
        """
        Pick the stored procedure name from the context
        and return the list of associated queries
        """
        start, _ = get_start_and_end(self.source_config.queryLogDuration)
        query = BIGQUERY_GET_STORED_PROCEDURE_QUERIES.format(
            start_date=start,
            region=self.service_connection.usageLocation,
        )
        queries_dict = self.procedure_queries_dict(
            query=query,
        )
        return queries_dict
