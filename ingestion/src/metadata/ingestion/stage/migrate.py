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
from functools import singledispatch

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.stage import Stage, StageStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.metadata.migrate import (
    DatabaseServiceWrapper,
    MessagingServiceWrapper,
    PolicyWrapper,
    TableWrapper,
    TagWrapper,
)

logger = logging.getLogger(__name__)

file_dict = {}


def open_files(dir_path):
    file_dict.update(
        {
            "TableWrapper": open(f"{dir_path}/table.json", "w"),
            "User": open(f"{dir_path}/user.json", "w"),
            "Topic": open(f"{dir_path}/topic.json", "w"),
            "Pipeline": open(f"{dir_path}/pipeline.json", "w"),
            "Glossary": open(f"{dir_path}/glossary.json", "w"),
            "GlossaryTerm": open(f"{dir_path}/glossary_term.json", "w"),
            "TagWrapper": open(f"{dir_path}/tag.json", "w"),
            "DatabaseServiceWrapper": open(f"{dir_path}/database_service.json", "w"),
            "Role": open(f"{dir_path}/role.json", "w"),
            "PolicyWrapper": open(f"{dir_path}/policy.json", "w"),
            "PipelineService": open(f"{dir_path}/pipeline_service.json", "w"),
            "MessagingServiceWrapper": open(f"{dir_path}/messaging_service.json", "w"),
        }
    )


@singledispatch
def write_record(record):
    logger.warning(f"Write record not implemented for type {type(record)}")


@write_record.register(User)
@write_record.register(Topic)
@write_record.register(Pipeline)
@write_record.register(Glossary)
@write_record.register(GlossaryTerm)
@write_record.register(Role)
@write_record.register(PipelineService)
def _(record):
    file = file_dict.get(type(record).__name__)
    file.write(record.json())
    file.write("\n")


@write_record.register(TableWrapper)
@write_record.register(TagWrapper)
@write_record.register(PolicyWrapper)
@write_record.register(MessagingServiceWrapper)
@write_record.register(DatabaseServiceWrapper)
def _(record):
    file = file_dict.get(type(record).__name__)
    json_obj = json.dumps(record.data_dict)
    file.write(json_obj)
    file.write("\n")


class FileSinkConfig(ConfigModel):
    dirPath: str


class MigrateStage(Stage[Entity]):
    config: FileSinkConfig
    report: StageStatus

    def __init__(
        self,
        config: FileSinkConfig,
        metadata_config: OpenMetadataConnection,
    ):
        self.config = config
        self.metadata_config = metadata_config
        self.report = StageStatus()
        open_files(self.config.dirPath)
        self.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(self.metadata_config)
        )

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = FileSinkConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def stage_record(self, record: Entity) -> None:
        write_record(record)
        self.report.records_status(record)

    def get_status(self):
        return self.report

    def close(self):
        for file in file_dict.values():
            file.close()
