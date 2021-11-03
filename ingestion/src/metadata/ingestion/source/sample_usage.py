import csv
import json
from datetime import datetime
from typing import Iterable

from metadata.ingestion.api.source import Source
from metadata.ingestion.models.table_queries import TableQuery

from ..ometa.openmetadata_rest import MetadataServerConfig
from .sample_data import (
    SampleDataSourceConfig,
    SampleDataSourceStatus,
    get_database_service_or_create,
)


class SampleUsageSource(Source):

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
        self.service = get_database_service_or_create(
            self.service_json, metadata_config
        )

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
