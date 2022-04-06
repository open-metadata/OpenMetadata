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

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataServerConfig,
)
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.source.bigquery import BigQueryConfig, BigquerySource
from metadata.ingestion.source.sql_alchemy_helper import SQLSourceStatus
from metadata.utils.helpers import get_start_and_end, ingest_lineage

logger = log.getLogger(__name__)


class BigqueryUsageSource(Source[TableQuery]):
    SERVICE_TYPE = DatabaseServiceType.BigQuery.value
    scheme = "bigquery"

    def __init__(self, config, metadata_config):
        super().__init__()
        self.temp_credentials = None
        self.metadata_config = metadata_config
        self.config = config
        self.project_id = self.config.project_id
        self.logger_name = "cloudaudit.googleapis.com%2Fdata_access"
        self.status = SQLSourceStatus()

        if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            if config.options.get("credentials_path"):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = config.options[
                    "credentials_path"
                ]
            elif config.options.get("credentials"):
                self.temp_credentials = BigquerySource.create_credential_temp_file(
                    credentials=config.options.get("credentials")
                )
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = self.temp_credentials
                del config.options["credentials"]
            else:
                logger.warning(
                    "Please refer to the BigQuery connector documentation, especially the credentials part "
                    "https://docs.open-metadata.org/connectors/bigquery-usage"
                )

    def get_connection_url(self):
        if self.project_id:
            return f"{self.scheme}://{self.project_id}"
        return f"{self.scheme}://"

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataServerConfig):
        config = BigQueryConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[TableQuery]:
        logging_client = logging.Client()
        usage_logger = logging_client.logger(self.logger_name)
        logger.debug("Listing entries for logger {}:".format(usage_logger.name))
        start, end = get_start_and_end(self.config.duration)
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
                            database = ""
                            if hasattr(queryConfig, "destinationTable"):
                                database = queryConfig["destinationTable"]
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
                                service_name=self.config.service_name,
                            )
                            yield tq

                            query_info = {
                                "sql": tq.sql,
                                "from_type": "table",
                                "to_type": "table",
                                "service_name": self.config.service_name,
                            }

                            ingest_lineage(query_info, self.metadata_config)

        except Exception as err:
            logger.error(repr(err))

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        super().close()
        if self.temp_credentials:
            os.unlink(self.temp_credentials)
