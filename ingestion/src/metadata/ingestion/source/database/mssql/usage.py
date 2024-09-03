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
MSSQL usage module
"""
from datetime import datetime

from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.mssql.constants import (
    DEFAULT_DATETIME_FORMAT,
    MSSQL_DATEFORMAT_DATETIME_MAP,
)
from metadata.ingestion.source.database.mssql.queries import MSSQL_SQL_STATEMENT
from metadata.ingestion.source.database.mssql.query_parser import MssqlQueryParserSource
from metadata.ingestion.source.database.mssql.utils import (
    get_sqlalchemy_engine_dateformat,
)
from metadata.ingestion.source.database.usage_source import UsageSource


class MssqlUsageSource(MssqlQueryParserSource, UsageSource):
    sql_stmt = MSSQL_SQL_STATEMENT

    filters = """
        AND lower(t.text) NOT LIKE '%%create%%procedure%%'
        AND lower(t.text) NOT LIKE '%%create%%function%%'
        AND lower(t.text) NOT LIKE '%%declare%%'
        """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
        get_engine: bool = True,
    ):
        super().__init__(config, metadata, get_engine)

        self.dt_format = DEFAULT_DATETIME_FORMAT

        if self.engine:
            server_date_format = get_sqlalchemy_engine_dateformat(self.engine)
            self.dt_format = MSSQL_DATEFORMAT_DATETIME_MAP.get(
                server_date_format, DEFAULT_DATETIME_FORMAT
            )

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs.

        Override if we have specific parameters
        """
        return self.sql_stmt.format(
            start_time=start_time.strftime(self.dt_format),
            end_time=end_time.strftime(self.dt_format),
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,
        )
