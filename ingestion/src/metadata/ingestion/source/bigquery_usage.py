#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# This import verifies that the dependencies are available.
import logging as log
from metadata.ingestion.models.table_queries import TableQuery
from google.cloud import logging
import collections
from datetime import datetime
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.api.source import Source, SourceStatus
from typing import Dict, Any, Iterable
from metadata.ingestion.source.sql_alchemy_helper import SQLSourceStatus
from metadata.utils.helpers import get_start_and_end
from metadata.ingestion.source.bigquery import BigQueryConfig

logger = log.getLogger(__name__)


class BigqueryUsageSource(Source):
    SERVICE_TYPE = 'Bigquery'
    scheme = "bigquery"

    def __init__(self, config, metadata_config, ctx):
        super().__init__(ctx)

        self.config = config
        self.project_id = self.config.project_id
        self.logger_name = "cloudaudit.googleapis.com%2Fdata_access"
        self.status = SQLSourceStatus()

    def get_connection_url(self):
        if self.project_id:
            print(f"{self.scheme}://{self.project_id}")
            return f"{self.scheme}://{self.project_id}"
        return f"{self.scheme}://"

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = BigQueryConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[TableQuery]:
        logging_client = logging.Client()
        logger = logging_client.logger(self.logger_name)
        print("Listing entries for logger {}:".format(logger.name))
        start, end = get_start_and_end(self.config.duration)
        for entry in logger.list_entries():
            timestamp = entry.timestamp.isoformat()
            timestamp = datetime.strptime(timestamp[0:10], "%Y-%m-%d")
            if timestamp >= start and timestamp <= end:
                if("query" in str(entry.payload)) and type(entry.payload) == collections.OrderedDict:
                    payload = list(entry.payload.items())[-1][1]
                    if "jobChange" in payload:
                        print(f"\nEntries: {payload}")
                        queryConfig = payload['jobChange']['job']['jobConfig']['queryConfig']
                        jobStats = payload['jobChange']['job']['jobStats']
                        statementType = queryConfig['statementType'] if hasattr(queryConfig, 'statementType') else ''
                        database = queryConfig['destinationTable'] if hasattr(queryConfig, 'destinationTable') is not None else ''
                        analysis_date = str(datetime.strptime(jobStats['startTime'][0:19], "%Y-%m-%dT%H:%M:%S").strftime('%Y-%m-%d %H:%M:%S'))
                        tq = TableQuery(statementType,
                                        queryConfig['priority'], 0, 0, 0, str(jobStats['startTime']),
                                        str(jobStats['endTime']), analysis_date, self.config.duration, str(
                                            database), 0, queryConfig['query'])
                        yield tq

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status
