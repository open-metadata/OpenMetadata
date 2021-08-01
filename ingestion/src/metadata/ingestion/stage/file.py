import json
import logging
import pathlib
from typing import Dict, Any

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import TableEntity
from metadata.ingestion.api.common import WorkflowContext, Record
from metadata.ingestion.api.stage import Stage, StageStatus
from metadata.ingestion.ometa.client import MetadataServerConfig

logger = logging.getLogger(__name__)


class FileStageConfig(ConfigModel):
    filename: str


class FileStage(Stage):
    config: FileStageConfig
    status: StageStatus

    def __init__(self, ctx: WorkflowContext, config: FileStageConfig, metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.status = StageStatus()

        fpath = pathlib.Path(self.config.filename)
        self.file = fpath.open("w")
        self.wrote_something = False

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict:dict, ctx: WorkflowContext):
        config = FileStageConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def stage_record(
        self,
        record: TableEntity
    ) -> None:
        json_record = json.loads(record.json())
        self.file.write(json.dumps(json_record))
        self.file.write("\n")
        self.status.records_status(record)

    def get_status(self):
        return self.status

    def close(self):
        self.file.close()
