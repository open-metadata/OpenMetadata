import json
import csv
from metadata.ingestion.api.source import Source
from .sample_tables import SampleTableSourceConfig, SampleTableSourceStatus, get_service_or_create
from metadata.ingestion.models.table_queries import TableQuery
from typing import Iterable
from datetime import datetime
from ..ometa.openmetadata_rest import OpenMetadataAPIClient, MetadataServerConfig


class SampleUsageSource(Source):

    def __init__(self, config: SampleTableSourceConfig, metadata_config: MetadataServerConfig, ctx):
        super().__init__(ctx)
        self.status = SampleTableSourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.client = OpenMetadataAPIClient(metadata_config)
        self.service_json = json.load(open(config.sample_schema_folder + "/service.json", 'r'))
        self.query_log_csv = config.sample_schema_folder + "/query_log"
        with open(self.query_log_csv, 'r') as fin:
            self.query_logs = [dict(i) for i in csv.DictReader(fin)]
        self.service = get_service_or_create(self.service_json, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SampleTableSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[TableQuery]:
        for row in self.query_logs:
            tq = TableQuery(row['query'], '', 100, 0, 0, '',
                            '', datetime.today().strftime('%Y-%m-%d %H:%M:%S'), 100, 'shopify',
                            False, row['query'])
            yield tq

    def close(self):
        pass

    def get_status(self):
        return self.status
