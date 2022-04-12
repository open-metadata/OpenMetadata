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
Clickhouse usage module
"""

import ast
from typing import Any, Dict, Iterable

from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataServerConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus

# This import verifies that the dependencies are available.
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.source.sql_alchemy_helper import (
    SQLAlchemyHelper,
    SQLSourceStatus,
)
from metadata.utils.helpers import get_raw_extract_iter, get_start_and_end
from metadata.utils.sql_queries import CLICKHOUSE_SQL_USAGE_STATEMENT


class ClickhouseUsageSource(Source[TableQuery]):
    """
    Clickhouse Usage source

    Args:
        config:
        metadata_config:
        ctx:

    Attributes:
        config:
        analysis_date:
        sql_stmt:
        alchemy_helper:
        report:
    """

    def __init__(
        self, config: WorkflowSource, metadata_config: OpenMetadataServerConfig
    ):
        super().__init__()
        self.config = config
        self.connection = config.serviceConnection.__root__.config
        start, end = get_start_and_end(self.config.sourceConfig.config.queryLogDuration)
        self.analysis_date = start
        self.sql_stmt = CLICKHOUSE_SQL_USAGE_STATEMENT.format(
            start_time=start, end_time=end
        )
        self.alchemy_helper = SQLAlchemyHelper(
            self.connection,
            metadata_config,
            DatabaseServiceType.ClickHouse.value,
            self.sql_stmt,
        )
        self.report = SQLSourceStatus()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataServerConfig):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: ClickhouseConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, ClickhouseConnection):
            raise InvalidSourceException(
                f"Expected ClickhouseConnection, but got {connection}"
            )

        return cls(config, metadata_config)

    def prepare(self):
        return super().prepare()

    def _get_raw_extract_iter(self) -> Iterable[Dict[str, Any]]:
        """
        Provides iterator of result row from SQLAlchemy helper
        :return:
        """
        rows = self.alchemy_helper.execute_query()
        for row in rows:
            yield row

    def next_record(self) -> Iterable[TableQuery]:
        """
        Using itertools.groupby and raw level iterator,
        it groups to table and yields TableMetadata
        :return:
        """
        for row in get_raw_extract_iter(self.alchemy_helper):
            database = "default"
            if row["database_name"]:
                database_list = ast.literal_eval(row["database_name"])
                database = database_list[0] if len(database_list) == 1 else "default"

            table_query = TableQuery(
                query=row["query_id"],
                user_name=row["user_name"],
                starttime=str(row["start_time"]),
                endtime=str(row["end_time"]),
                analysis_date=self.analysis_date,
                aborted=row["aborted"],
                database=database,
                sql=row["query_text"],
                service_name=self.config.serviceName,
            )
            yield table_query

    def get_report(self):
        """
        get report

        Returns:
        """
        return self.report

    def close(self):
        self.alchemy_helper.close()

    def get_status(self) -> SourceStatus:
        return self.report
