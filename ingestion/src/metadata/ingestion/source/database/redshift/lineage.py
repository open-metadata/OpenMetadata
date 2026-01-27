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
from metadata.ingestion.source.database.redshift.connection import (
    get_redshift_instance_type,
)
from metadata.ingestion.source.database.redshift.models import RedshiftInstanceType
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_STORED_PROCEDURE_QUERIES_MAP,
    REDSHIFT_SQL_STATEMENT_MAP,
)
from metadata.ingestion.source.database.redshift.query_parser import (
    OpenMetadata,
    RedshiftQueryParserSource,
    WorkflowSource,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    StoredProcedureLineageMixin,
)
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class RedshiftLineageSource(
    RedshiftQueryParserSource, StoredProcedureLineageMixin, LineageSource
):
    provisioned_filters = """
        AND (
          querytxt ILIKE '%%create%%table%%as%%select%%'
          OR querytxt ILIKE '%%insert%%into%%select%%'
          OR querytxt ILIKE '%%update%%'
          OR querytxt ILIKE '%%merge%%'
        )
    """

    serverless_filters = """
        AND (
            (query_text ILIKE '%%create%%table%%as%%select%%' AND query_type = 'CTAS')
            OR (query_text ILIKE '%%insert%%into%%select%%' AND query_type = 'INSERT')
            OR (query_text ILIKE '%%update%%' AND query_type = 'UPDATE')
            OR (query_text ILIKE '%%merge%%' AND query_type = 'MERGE')
        )
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)

        self.redshift_instance_type = get_redshift_instance_type(self.engine)

        if self.redshift_instance_type == RedshiftInstanceType.PROVISIONED:
            self.sql_stmt = REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.PROVISIONED]
            self.filters = self.provisioned_filters
            logger.info(
                "Using STL views for lineage processing of Redshift Provisioned"
            )
        else:
            self.sql_stmt = REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.SERVERLESS]
            self.filters = self.serverless_filters
            logger.info("Using SYS views for lineage processing of Redshift Serverless")

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

    def get_stored_procedure_sql_statement(self) -> str:
        """
        Return the SQL statement to get the stored procedure queries
        """
        start, _ = get_start_and_end(self.source_config.queryLogDuration)
        query = REDSHIFT_GET_STORED_PROCEDURE_QUERIES_MAP[
            self.redshift_instance_type
        ].format(start_date=start)

        return query
