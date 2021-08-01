import logging
from typing import Dict, Any, Iterable, Optional

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import TableEntity
from metadata.ingestion.api.common import WorkflowContext, Record
from metadata.ingestion.api.source import SourceStatus, Source
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.ometa.client import REST

logger = logging.getLogger(__name__)


class MetadataTablesRestSourceConfig(ConfigModel):
    api_endpoint: Optional[str] = None


class MetadataTablesRestSource(Source):
    config: MetadataTablesRestSourceConfig
    report: SourceStatus

    def __init__(self, config: MetadataTablesRestSourceConfig, metadata_config: MetadataServerConfig, ctx: WorkflowContext):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SourceStatus()
        self.wrote_something = False
        self.client = REST(self.metadata_config)
        self.tables = None

    def prepare(self):
        self.tables = self.client.list_tables(fields="columns,tableConstraints,usageSummary,owner,database,tags,followers",
                                              offset=0, limit=10000)

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = MetadataTablesRestSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def next_record(self) -> Iterable[TableEntity]:
        for table in self.tables:
            self.status.records_produced(table.name)
            yield table

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass
