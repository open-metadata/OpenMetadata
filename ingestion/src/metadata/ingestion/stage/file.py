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

import json
import logging
import pathlib

from metadata.config.common import ConfigModel
from metadata.ingestion.api.common import Entity, WorkflowContext
from metadata.ingestion.api.stage import Stage, StageStatus
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig

logger = logging.getLogger(__name__)


class FileStageConfig(ConfigModel):
    filename: str


class FileStage(Stage[Entity]):
    config: FileStageConfig
    status: StageStatus

    def __init__(
        self,
        ctx: WorkflowContext,
        config: FileStageConfig,
        metadata_config: MetadataServerConfig,
    ):
        super().__init__(ctx)
        self.config = config
        self.status = StageStatus()

        fpath = pathlib.Path(self.config.filename)
        self.file = fpath.open("w")
        self.wrote_something = False

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = FileStageConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def stage_record(self, record: Entity) -> None:
        json_record = json.loads(record.json())
        self.file.write(json.dumps(json_record))
        self.file.write("\n")
        self.status.records_status(record)

    def get_status(self):
        return self.status

    def close(self):
        self.file.close()
