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

import csv
import json
from datetime import datetime
from typing import Iterable

from metadata.generated.schema.entity.services.connections.database.sampleDataConnection import (
    SampleDataConnection,
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
from metadata.ingestion.api.source import InvalidSourceException, Source
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.source.sample_data import SampleDataSourceStatus
from metadata.utils.helpers import get_database_service_or_create


class SampleUsageSource(Source[TableQuery]):

    service_type = DatabaseServiceType.BigQuery.value

    def __init__(
        self, config: WorkflowSource, metadata_config: OpenMetadataServerConfig
    ):
        super().__init__()
        self.status = SampleDataSourceStatus()
        self.config = config
        self.service_connection = config.serviceConnection.__root__.config
        self.metadata_config = metadata_config
        self.service_json = json.load(
            open(
                self.service_connection.sampleDataFolder + "/datasets/service.json", "r"
            )
        )
        self.query_log_csv = (
            self.service_connection.sampleDataFolder + "/datasets/query_log"
        )
        with open(self.query_log_csv, "r") as fin:
            self.query_logs = [dict(i) for i in csv.DictReader(fin)]
        self.service = get_database_service_or_create(
            config=self.config, metadata_config=metadata_config
        )

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataServerConfig):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SampleDataConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SampleDataConnection):
            raise InvalidSourceException(
                f"Expected MssqlConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[TableQuery]:
        for row in self.query_logs:
            tq = TableQuery(
                query=row["query"],
                user_name="",
                starttime="",
                endtime="",
                analysis_date=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                database="shopify",
                aborted=False,
                sql=row["query"],
                service_name=self.config.serviceName,
            )
            yield tq

    def close(self):
        pass

    def get_status(self):
        return self.status
