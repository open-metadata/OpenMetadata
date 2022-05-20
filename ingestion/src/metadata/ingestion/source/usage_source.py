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
from typing import Any, Dict, Iterable

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus

# This import verifies that the dependencies are available.
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.source.sql_alchemy_helper import SQLSourceStatus
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.helpers import get_start_and_end


class UsageSource(Source[TableQuery]):
    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.connection = config.serviceConnection.__root__.config
        start, end = get_start_and_end(self.config.sourceConfig.config.queryLogDuration)
        self.analysis_date = start
        self.report = SQLSourceStatus()
        self.engine = get_connection(self.connection)

    def prepare(self):
        return super().prepare()

    def _get_raw_extract_iter(self) -> Iterable[Dict[str, Any]]:
        if self.config.sourceConfig.config.queryLogFilePath:
            with open(self.config.sourceConfig.config.queryLogFilePath, "r") as fin:
                for i in csv.DictReader(fin):
                    query_dict = dict(i)
                    row = {
                        "query_type": query_dict.get("query"),
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
            table_query = TableQuery(
                query=row["query_type"],
                user_name=row["user_name"],
                starttime=str(row["start_time"]),
                endtime=str(row["end_time"]),
                analysis_date=self.analysis_date,
                aborted=row["aborted"],
                database=row["database_name"],
                sql=row["query_text"],
                service_name=self.config.serviceName,
            )
            if not row["schema_name"]:
                self.report.scanned(f"{row['database_name']}.{row['schema_name']}")
            else:
                self.report.scanned(f"{row['database_name']}")
            yield table_query

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
