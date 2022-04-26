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
import logging as log
import os
from datetime import datetime
from typing import Iterable

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
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.source.sql_alchemy_helper import SQLSourceStatus
from metadata.utils.credentials import set_google_credentials
from metadata.utils.helpers import get_start_and_end

logger = log.getLogger(__name__)


class BigqueryUsageSource(Source[TableQuery]):
    SERVICE_TYPE = DatabaseServiceType.BigQuery.value
    scheme = "bigquery"

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.temp_credentials = None
        self.metadata_config = metadata_config
        self.config = config
        self.service_connection = config.serviceConnection.__root__.config

        # Used as db
        self.project_id = (
            self.service_connection.projectId
            or self.service_connection.credentials.gcsConfig.projectId
        )

        self.logger_name = "cloudaudit.googleapis.com%2Fdata_access"
        self.status = SQLSourceStatus()

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

    def prepare(self):
        pass

    def next_record(self) -> Iterable[TableQuery]:
        logging_client = logging.Client()
        usage_logger = logging_client.logger(self.logger_name)
        logger.debug("Listing entries for logger {}:".format(usage_logger.name))
        start, end = get_start_and_end(self.config.sourceConfig.config.queryLogDuration)
        try:
            entries = usage_logger.list_entries()
            for entry in entries:
                timestamp = entry.timestamp.isoformat()
                timestamp = datetime.strptime(timestamp[0:10], "%Y-%m-%d")
                if timestamp >= start and timestamp <= end:
                    if ("query" in str(entry.payload)) and type(
                        entry.payload
                    ) == collections.OrderedDict:
                        payload = list(entry.payload.items())[-1][1]
                        if "jobChange" in payload:
                            logger.debug(f"\nEntries: {payload}")
                            if (
                                "queryConfig"
                                in payload["jobChange"]["job"]["jobConfig"]
                            ):
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
                            logger.debug(
                                f"Query :{statementType}:{queryConfig['query']}"
                            )
                            tq = TableQuery(
                                query=statementType,
                                user_name=entry.resource.labels["project_id"],
                                starttime=str(jobStats["startTime"]),
                                endtime=str(jobStats["endTime"]),
                                analysis_date=analysis_date,
                                aborted=0,
                                database=str(database),
                                sql=queryConfig["query"],
                                service_name=self.config.serviceName,
                            )
                            yield tq

        except Exception as err:
            logger.error(repr(err))

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> SourceStatus:
        pass

    def close(self):
        super().close()
        if self.temp_credentials:
            os.unlink(self.temp_credentials)
