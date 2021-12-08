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

from metadata.ingestion.api.source import Source
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sample_data import (
    SampleDataSourceConfig,
    SampleDataSourceStatus,
)
from metadata.utils.helpers import get_database_service_or_create


class SampleUsageSource(Source[TableQuery]):

    service_type = "BigQuery"

    def __init__(
        self, config: SampleDataSourceConfig, metadata_config: MetadataServerConfig, ctx
    ):
        super().__init__(ctx)
        self.status = SampleDataSourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.service_json = json.load(
            open(config.sample_data_folder + "/datasets/service.json", "r")
        )
        self.query_log_csv = config.sample_data_folder + "/datasets/query_log"
        with open(self.query_log_csv, "r") as fin:
            self.query_logs = [dict(i) for i in csv.DictReader(fin)]
        self.service = get_database_service_or_create(self.config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SampleDataSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[TableQuery]:
        for row in self.query_logs:
            tq = TableQuery(
                query=row["query"],
                user_name="",
                starttime="",
                endtime="",
                analysis_date=datetime.today().strftime("%Y-%m-%d %H:%M:%S"),
                database="shopify",
                aborted=False,
                sql=row["query"],
            )
            yield tq

    def close(self):
        pass

    def get_status(self):
        return self.status
