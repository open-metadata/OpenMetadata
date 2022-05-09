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
from typing import Iterable

from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus

# This import verifies that the dependencies are available.
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.source.sql_alchemy_helper import SQLSourceStatus
from metadata.ingestion.source.usage_source import UsageSource
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.helpers import get_start_and_end
from metadata.utils.sql_queries import CLICKHOUSE_SQL_USAGE_STATEMENT


class ClickhouseUsageSource(UsageSource):
    def __init__(self, config: WorkflowSource, metadata_config: WorkflowConfig):
        super().__init__(config, metadata_config)
        self.config = config
        self.connection = config.serviceConnection.__root__.config
        start, end = get_start_and_end(self.config.sourceConfig.config.queryLogDuration)
        self.analysis_date = start
        self.sql_stmt = CLICKHOUSE_SQL_USAGE_STATEMENT.format(
            start_time=start, end_time=end
        )
        self.report = SQLSourceStatus()
        self.engine = get_connection(self.connection)

    @classmethod
    def create(cls, config_dict, metadata_config: WorkflowConfig):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: ClickhouseConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, ClickhouseConnection):
            raise InvalidSourceException(
                f"Expected ClickhouseConnection, but got {connection}"
            )

        return cls(config, metadata_config)

    def next_record(self) -> Iterable[TableQuery]:
        """
        Using itertools.groupby and raw level iterator,
        it groups to table and yields TableMetadata
        :return:
        """
        for row in self._get_raw_extract_iter():
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
