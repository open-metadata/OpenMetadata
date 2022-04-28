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

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.stage import Stage, StageStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.migrate_source import Policy

logger = logging.getLogger(__name__)


class FileSinkConfig(ConfigModel):
    filename: str


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
        self.table_file = open(f"{self.config.filename}/table.json", "w")
        self.user_file = open(f"{self.config.filename}/user.json", "w")
        self.team_file = open(f"{self.config.filename}/team.json", "w")
        self.topic_file = open(f"{self.config.filename}/topic.json", "w")
        self.dashboard_file = open(f"{self.config.filename}/dashboard.json", "w")
        self.pipeline_file = open(f"{self.config.filename}/pipeline.json", "w")
        self.glossary_file = open(f"{self.config.filename}/glossary.json", "w")
        self.glossary_term_file = open(
            f"{self.config.filename}/glossary_term.json", "w"
        )
        self.location_file = open(f"{self.config.filename}/location.json", "w")
        self.chart_file = open(f"{self.config.filename}/chart.json", "w")
        self.database_service_file = open(
            f"{self.config.filename}/database_service.json", "w"
        )
        self.role_file = open(f"{self.config.filename}/role.json", "w")
        self.policy_file = open(f"{self.config.filename}/policy.json", "w")
        self.table_file.write("[\n")
        self.user_file.write("[\n")
        self.team_file.write("[\n")
        self.topic_file.write("[\n")
        self.dashboard_file.write("[\n")
        self.pipeline_file.write("[\n")
        self.glossary_file.write("[\n")
        self.glossary_term_file.write("[\n")
        self.location_file.write("[\n")
        self.chart_file.write("[\n")
        self.role_file.write("[\n")
        self.policy_file.write("[\n")
        self.database_service_file.write("[\n")
        self.wrote_table = False
        self.wrote_user = False
        self.wrote_team = False
        self.wrote_topic = False
        self.wrote_dashboard = False
        self.wrote_pipeline = False
        self.wrote_glossary = False
        self.wrote_glossary_term = False
        self.wrote_location = False
        self.wrote_chart = False
        self.wrote_database_service = False
        self.wrote_role = False
        self.wrote_policy = False

        self.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(self.metadata_config)
        )

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = FileSinkConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def stage_record(self, record: Entity) -> None:
        if isinstance(record, Table):
            self.write_table(record=record)
        elif isinstance(record, User):
            self.write_user(record=record)
        elif isinstance(record, Topic):
            self.write_topic(record=record)
        elif isinstance(record, Dashboard):
            self.write_dashboard(record=record)
        elif isinstance(record, Pipeline):
            self.write_pipeline(record=record)
        elif isinstance(record, Glossary):
            self.write_glossary(record=record)
        elif isinstance(record, GlossaryTerm):
            self.write_glossary_term(record=record)
        elif isinstance(record, Location):
            self.write_location(record=record)
        elif isinstance(record, Chart):
            self.write_chart(record=record)
        elif isinstance(record, DatabaseService):
            self.write_database_service(record=record)
        elif isinstance(record, Role):
            self.write_role(record=record)
        elif isinstance(record, Policy):
            self.write_policy(record=record)
        self.report.records_status(record)

    def write_table(self, record: Entity) -> None:
        if self.wrote_table:
            self.table_file.write(",\n")
        self.wrote_table = True
        self.table_file.write(record.json())

    def write_user(self, record: Entity) -> None:
        if self.wrote_user:
            self.user_file.write(",\n")
        self.wrote_user = True
        self.user_file.write(record.json())

    def write_team(self, record: Entity) -> None:
        if self.wrote_team:
            self.team_file.write(",\n")
        self.wrote_team = True
        self.team_file.write(record.json())

    def write_topic(self, record: Entity) -> None:
        if self.wrote_topic:
            self.topic_file.write(",\n")
        self.wrote_topic = True
        self.topic_file.write(record.json())

    def write_dashboard(self, record: Entity) -> None:
        if self.wrote_dashboard:
            self.dashboard_file.write(",\n")
        self.wrote_dashboard = True
        self.dashboard_file.write(record.json())

    def write_pipeline(self, record: Entity) -> None:
        if self.wrote_pipeline:
            self.pipeline_file.write(",\n")
        self.wrote_pipeline = True
        self.pipeline_file.write(record.json())

    def write_glossary(self, record: Entity) -> None:
        if self.wrote_glossary:
            self.glossary_file.write(",\n")
        self.wrote_glossary = True
        self.glossary_file.write(record.json())

    def write_glossary_term(self, record: Entity) -> None:
        if self.wrote_glossary_term:
            self.glossary_term_file.write(",\n")
        self.wrote_glossary_term = True
        self.glossary_term_file.write(record.json())

    def write_location(self, record: Entity) -> None:
        if self.wrote_location:
            self.location_file.write(",\n")
        self.wrote_location = True
        self.location_file.write(record.json())

    def write_chart(self, record: Entity) -> None:
        if self.wrote_chart:
            self.chart_file.write(",\n")
        self.wrote_chart = True
        self.chart_file.write(record.json())

    def write_database_service(self, record: Entity) -> None:
        if self.wrote_database_service:
            self.database_service_file.write(",\n")
        self.wrote_database_service = True
        self.database_service_file.write(record.json())

    def write_role(self, record: Entity) -> None:
        if self.wrote_role:
            self.role_file.write(",\n")
        self.wrote_role = True
        self.role_file.write(record.json())

    def write_policy(self, record: Entity) -> None:
        if self.wrote_policy:
            self.policy_file.write(",\n")
        self.wrote_policy = True
        policy_obj = json.dumps(record.policy_dict)
        self.policy_file.write(policy_obj)

    def get_status(self):
        return self.report

    def close(self):
        self.table_file.write("\n]")
        self.user_file.write("\n]")
        self.team_file.write("\n]")
        self.topic_file.write("\n]")
        self.dashboard_file.write("\n]")
        self.pipeline_file.write("\n]")
        self.glossary_file.write("\n]")
        self.glossary_term_file.write("\n]")
        self.location_file.write("\n]")
        self.database_service_file.write("\n]")
        self.role_file.write("\n]")
        self.chart_file.write("\n]")
        self.policy_file.write("\n]")
        self.table_file.close()
        self.user_file.close()
        self.team_file.close()
        self.topic_file.close()
        self.dashboard_file.close()
        self.pipeline_file.close()
        self.glossary_file.close()
        self.role_file.close()
        self.glossary_term_file.close()
        self.location_file.close()
        self.chart_file.close()
        self.database_service_file.close()
        self.policy_file.close()
