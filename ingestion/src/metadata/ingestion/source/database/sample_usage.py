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
from typing import Dict, Iterable, Optional

from metadata.generated.schema.entity.services.connections.database.sampleDataConnection import (
    SampleDataConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.ingestion.source.database.sample_data import SampleDataSourceStatus
from metadata.ingestion.source.database.usage_source import UsageSource


class SampleUsageSource(UsageSource):

    service_type = DatabaseServiceType.BigQuery.value

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        self.status = SampleDataSourceStatus()
        self.config = config
        self.service_connection = config.serviceConnection.__root__.config
        self.source_config = config.sourceConfig.config
        self.metadata_config = metadata_config
        self.report = SQLSourceStatus()
        self.metadata = OpenMetadata(metadata_config)
        self.analysis_date = datetime.utcnow()

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
        self.service = self.metadata.get_service_or_create(
            entity=DatabaseService, config=config
        )

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SampleDataConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SampleDataConnection):
            raise InvalidSourceException(
                f"Expected MssqlConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def _get_raw_extract_iter(self) -> Optional[Iterable[Dict[str, str]]]:
        yield TableQueries(
            queries=[
                TableQuery(
                    query=row["query"],
                    userName="",
                    startTime="",
                    endTime="",
                    analysisDate=self.analysis_date,
                    aborted=False,
                    databaseName="ecommerce_db",
                    serviceName=self.config.serviceName,
                    databaseSchema="shopify",
                )
                for row in self.query_logs
            ]
        )
