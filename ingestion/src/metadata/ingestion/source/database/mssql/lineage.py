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
MSSQL lineage module
"""
import traceback
from datetime import datetime
from typing import Dict, List

from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.mssql.constants import (
    DEFAULT_DATETIME_FORMAT,
    MSSQL_DATEFORMAT_DATETIME_MAP,
)
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_STORED_PROCEDURE_QUERIES,
    MSSQL_SQL_STATEMENT,
)
from metadata.ingestion.source.database.mssql.query_parser import MssqlQueryParserSource
from metadata.ingestion.source.database.mssql.utils import (
    get_sqlalchemy_engine_dateformat,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    QueryByProcedure,
    StoredProcedureLineageMixin,
)
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MssqlLineageSource(
    MssqlQueryParserSource, StoredProcedureLineageMixin, LineageSource
):

    sql_stmt = MSSQL_SQL_STATEMENT

    filters = """
        AND (
            lower(t.text) LIKE '%%select%%into%%'
            OR lower(t.text) LIKE '%%insert%%into%%select%%'
            OR lower(t.text) LIKE '%%update%%'
            OR lower(t.text) LIKE '%%merge%%'
        )
        AND lower(t.text) NOT LIKE '%%create%%procedure%%'
        AND lower(t.text) NOT LIKE '%%create%%function%%'
        AND lower(t.text) NOT LIKE '%%declare%%'
    """

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs.
        """
        server_date_format = get_sqlalchemy_engine_dateformat(self.engine)
        current_datetime_format = MSSQL_DATEFORMAT_DATETIME_MAP.get(
            server_date_format, DEFAULT_DATETIME_FORMAT
        )
        return self.sql_stmt.format(
            start_time=start_time.strftime(current_datetime_format),
            end_time=end_time.strftime(current_datetime_format),
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,
        )

    def get_stored_procedure_queries_dict(self) -> Dict[str, List[QueryByProcedure]]:
        """
        Return the dictionary associating stored procedures to the
        queries they triggered
        """
        start, _ = get_start_and_end(self.source_config.queryLogDuration)
        server_date_format = get_sqlalchemy_engine_dateformat(self.engine)
        current_datetime_format = MSSQL_DATEFORMAT_DATETIME_MAP.get(
            server_date_format, DEFAULT_DATETIME_FORMAT
        )
        start = start.strftime(current_datetime_format)
        query = MSSQL_GET_STORED_PROCEDURE_QUERIES.format(
            start_date=start,
        )
        try:
            queries_dict = self.procedure_queries_dict(
                query=query,
            )
        except Exception as ex:  # pylint: disable=broad-except
            logger.debug(f"Error runnning query:\n{query}")
            self.status.failed(
                StackTraceError(
                    name="Stored Procedure",
                    error=f"Error trying to get stored procedure queries: {ex}",
                    stackTrace=traceback.format_exc(),
                )
            )
            return {}

        return queries_dict
