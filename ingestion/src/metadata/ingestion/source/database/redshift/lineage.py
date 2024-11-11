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
Redshift lineage module

Execute with

source:
  type: redshift-lineage
  serviceName: aws_redshift_demo_2
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

import traceback
from typing import Iterator

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.redshift.queries import REDSHIFT_SQL_STATEMENT
from metadata.ingestion.source.database.redshift.query_parser import (
    RedshiftQueryParserSource,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class RedshiftLineageSource(RedshiftQueryParserSource, LineageSource):
    filters = """
        AND (
          querytxt ILIKE '%%create%%table%%as%%select%%'
          OR querytxt ILIKE '%%insert%%into%%select%%'
          OR querytxt ILIKE '%%update%%'
          OR querytxt ILIKE '%%merge%%'
        )
    """

    sql_stmt = REDSHIFT_SQL_STATEMENT

    def yield_table_query(self) -> Iterator[TableQuery]:
        """
        Given an engine, iterate over the query results to
        yield a TableQuery with query parsing info
        """
        for engine in self.get_engine():
            with engine.connect() as conn:
                rows = conn.execute(
                    self.get_sql_statement(
                        start_time=self.start,
                        end_time=self.end,
                    )
                )
                for row in rows:
                    query_dict = dict(row)
                    try:
                        yield TableQuery(
                            dialect=self.dialect.value,
                            query=query_dict["query_text"]
                            .replace("\\n", "\n")
                            .replace("\\r", ""),
                            databaseName=self.get_database_name(query_dict),
                            serviceName=self.config.serviceName,
                            databaseSchema=self.get_schema_name(query_dict),
                        )
                    except Exception as exc:
                        logger.debug(traceback.format_exc())
                        logger.warning(
                            f"Error processing query_dict {query_dict}: {exc}"
                        )
