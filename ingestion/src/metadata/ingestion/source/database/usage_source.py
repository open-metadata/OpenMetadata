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
Usage Souce Module
"""
import csv
import traceback
from typing import Any, Dict, Iterable, Optional

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)

# This import verifies that the dependencies are available.
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class UsageSource(Source[TableQuery]):
    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.connection = config.serviceConnection.__root__.config
        start, _ = get_start_and_end(self.config.sourceConfig.config.queryLogDuration)
        self.analysis_date = start
        self.report = SQLSourceStatus()
        self.engine = get_connection(self.connection)

    def prepare(self):
        return super().prepare()

    def get_database(self, data: dict) -> str:
        """
        Method to get database name
        """
        return data["database_name"]

    def get_aborted_status(self, data: dict) -> bool:
        """
        Method to get aborted status of query
        """
        return data["aborted"]

    def _get_raw_extract_iter(self) -> Optional[Iterable[Dict[str, Any]]]:
        if self.config.sourceConfig.config.queryLogFilePath:
            with open(self.config.sourceConfig.config.queryLogFilePath, "r") as fin:
                for i in csv.DictReader(fin):
                    query_dict = dict(i)
                    row = {
                        "user_name": query_dict.get("user_name", ""),
                        "start_time": query_dict.get("start_time", ""),
                        "end_time": query_dict.get("end_time", ""),
                        "aborted": query_dict.get("aborted", False),
                        "database_name": query_dict.get(
                            "database_name",
                            self.connection.database
                            if self.connection.database
                            else "default",
                        ),
                        "query_text": query_dict.get("query"),
                        "schema_name": query_dict.get("schema_name"),
                    }
                    yield row
        else:
            rows = self.engine.execute(self.sql_stmt)
            for row in rows:
                yield row

    def next_record(self) -> Iterable[TableQuery]:
        """
        Using itertools.groupby and raw level iterator,
        it groups to table and yields TableMetadata
        :return:
        """
        for row in self._get_raw_extract_iter():
            if row:
                try:
                    table_query = TableQuery(
                        query=row["query_text"],
                        userName=row["user_name"],
                        startTime=str(row["start_time"]),
                        endTime=str(row["end_time"]),
                        analysisDate=self.analysis_date,
                        aborted=self.get_aborted_status(row),
                        database=self.get_database(row),
                        serviceName=self.config.serviceName,
                        databaseSchema=row["schema_name"],
                    )
                    logger.debug(f"Parsed Query: {row['query_text']}")
                    if not row["schema_name"]:
                        self.report.scanned(
                            f"{row['database_name']}.{row['schema_name']}"
                        )
                    else:
                        self.report.scanned(f"{row['database_name']}")
                    yield table_query
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(str(err))

    def get_report(self):
        """
        get report

        Returns:
        """
        return self.report

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.report

    def test_connection(self) -> None:
        test_connection(self.engine)
