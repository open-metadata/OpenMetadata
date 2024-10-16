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
Oracle lineage module

Execute with

source:
  type: oracle-lineage
  serviceName: oracle
  sourceConfig:
    config:
      queryLogDuration: 1
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "token"
"""

from typing import Dict, List

from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.oracle.queries import (
    ORACLE_GET_STORED_PROCEDURE_QUERIES,
    ORACLE_QUERY_HISTORY_STATEMENT,
)
from metadata.ingestion.source.database.oracle.query_parser import (
    OracleQueryParserSource,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    QueryByProcedure,
    StoredProcedureLineageMixin,
)
from metadata.utils.helpers import get_start_and_end


class OracleLineageSource(
    OracleQueryParserSource, StoredProcedureLineageMixin, LineageSource
):
    filters = """
        AND COMMAND_TYPE IN (1, 2) AND (
            lower(SQL_FULLTEXT) LIKE '%%create%%table%%as%%select%%'
            OR lower(SQL_FULLTEXT) LIKE '%%insert%%into%%select%%'
            OR lower(SQL_FULLTEXT) LIKE '%%update%%'
            OR lower(SQL_FULLTEXT) LIKE '%%merge%%'
        )
        """

    sql_stmt = ORACLE_QUERY_HISTORY_STATEMENT

    stored_procedure_query = ORACLE_GET_STORED_PROCEDURE_QUERIES

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
