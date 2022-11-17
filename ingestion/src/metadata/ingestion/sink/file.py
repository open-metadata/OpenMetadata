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
"""
Sink that will store metadata in a file.
Useful for local testing without having OM up.
"""
import pathlib

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class FileSinkConfig(ConfigModel):
    filename: str


class FileSink(Sink[Entity]):
    """
    Sink implementation to store metadata in a file
    """

    config: FileSinkConfig
    report: SinkStatus

    def __init__(
        self,
        config: FileSinkConfig,
        metadata_config: OpenMetadataConnection,
    ):

        self.config = config
        self.metadata_config = metadata_config
        self.report = SinkStatus()

        fpath = pathlib.Path(self.config.filename)
        self.file = fpath.open("w", encoding=UTF_8)
        self.file.write("[\n")
        self.wrote_something = False

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = FileSinkConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def write_record(self, record: Entity) -> None:

        if self.wrote_something:
            self.file.write(",\n")

        self.file.write(record.json())
        self.wrote_something = True
        self.report.records_written(record)

    def get_status(self):
        return self.report

    def close(self):
        self.file.write("\n]")
        self.file.close()
