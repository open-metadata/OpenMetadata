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

import collections

# This import verifies that the dependencies are available.
import os
from datetime import datetime
from typing import Any, Dict, Iterable, Optional

from google import auth
from google.cloud import logging

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.credentials import set_google_credentials
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class BigqueryUsageSource(UsageSource):
    SERVICE_TYPE = DatabaseServiceType.BigQuery.value
    scheme = "bigquery"

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        self.temp_credentials = None

        self.project_id = self.set_project_id()

        self.logger_name = "cloudaudit.googleapis.com%2Fdata_access"
        self.logging_client = logging.Client()
        self.usage_logger = self.logging_client.logger(self.logger_name)
        logger.debug("Listing entries for logger {}:".format(self.usage_logger.name))

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: BigQueryConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, BigQueryConnection):
            raise InvalidSourceException(
                f"Expected BigQueryConnection, but got {connection}"
            )

        set_google_credentials(
            gcs_credentials=config.serviceConnection.__root__.config.credentials
        )

        return cls(config, metadata_config)

    @staticmethod
    def set_project_id():
        _, project_id = auth.default()
        return project_id

    def get_table_query(self, entries: Iterable):
        query_list = []
        for entry in entries:
            timestamp = entry.timestamp.isoformat()
            timestamp = datetime.strptime(timestamp[0:10], "%Y-%m-%d")
            if timestamp >= self.start and timestamp <= self.end:
                if ("query" in str(entry.payload)) and type(
                    entry.payload
                ) == collections.OrderedDict:
                    payload = list(entry.payload.items())[-1][1]
                    if "jobChange" in payload:
                        logger.debug(f"\nEntries: {payload}")
                        if "queryConfig" in payload["jobChange"]["job"]["jobConfig"]:
                            queryConfig = payload["jobChange"]["job"]["jobConfig"][
                                "queryConfig"
                            ]
                        else:
                            continue
                        jobStats = payload["jobChange"]["job"]["jobStats"]
                        statementType = ""
                        if hasattr(queryConfig, "statementType"):
                            statementType = queryConfig["statementType"]
                        database = self.project_id
                        analysis_date = str(
                            datetime.strptime(
                                jobStats["startTime"][0:19], "%Y-%m-%dT%H:%M:%S"
                            ).strftime("%Y-%m-%d %H:%M:%S")
                        )
                        logger.debug(f"Query :{statementType}:{queryConfig['query']}")
                        tq = TableQuery(
                            query=queryConfig["query"],
                            userName=entry.resource.labels["project_id"],
                            startTime=str(jobStats["startTime"]),
                            endTime=str(jobStats["endTime"]),
                            analysisDate=analysis_date,
                            aborted=0,
                            databaseName=str(database),
                            serviceName=self.config.serviceName,
                            databaseSchema=None,
                        )
                        query_list.append(tq)
        return query_list

    def _get_raw_extract_iter(self) -> Optional[Iterable[Dict[str, Any]]]:
        entries = self.usage_logger.list_entries()
        yield TableQueries(
            queries=self.get_table_query(entries),
        )

    def close(self):
        super().close()
        if self.temp_credentials:
            os.unlink(self.temp_credentials)
