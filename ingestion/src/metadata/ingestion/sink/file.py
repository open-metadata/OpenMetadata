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
from typing import Optional

from metadata.config.common import ConfigModel
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Sink
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import UTF_8
from metadata.utils.logger import get_log_name, ingestion_logger

logger = ingestion_logger()


class FileSinkConfig(ConfigModel):
    filename: str


class FileSink(Sink):
    """
    Sink implementation to store metadata in a file
    """

    config: FileSinkConfig

    def __init__(
        self,
        config: FileSinkConfig,
    ):
        super().__init__()
        self.config = config
        fpath = pathlib.Path(self.config.filename)
        # pylint: disable=consider-using-with
        self.file = fpath.open("w", encoding=UTF_8)
        self.file.write("[\n")
        self.wrote_something = False

    @classmethod
    def create(
        cls, config_dict: dict, _: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = FileSinkConfig.model_validate(config_dict)
        return cls(config)

    def _run(self, record: Entity, *_, **__) -> Either[str]:
        if self.wrote_something:
            self.file.write(",\n")

        self.file.write(record.model_dump_json())
        self.wrote_something = True
        return Either(right=get_log_name(record))

    def close(self):
        self.file.write("\n]")
        self.file.close()
