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

import logging
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.ingestion.api.common import Entity, WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig

logger = logging.getLogger(__name__)


class MetadataTablesRestSourceConfig(ConfigModel):
    include_tables: Optional[bool] = True
    include_topics: Optional[bool] = True
    include_dashboards: Optional[bool] = True
    include_pipelines: Optional[bool] = True
    limit_records: int = 1000


@dataclass
class MetadataSourceStatus(SourceStatus):

    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def scanned_table(self, table_name: str) -> None:
        self.success.append(table_name)
        logger.info("Table Scanned: {}".format(table_name))

    def scanned_topic(self, topic_name: str) -> None:
        self.success.append(topic_name)
        logger.info("Topic Scanned: {}".format(topic_name))

    def scanned_dashboard(self, dashboard_name: str) -> None:
        self.success.append(dashboard_name)
        logger.info("Dashboard Scanned: {}".format(dashboard_name))

    def filtered(
        self, table_name: str, err: str, dataset_name: str = None, col_type: str = None
    ) -> None:
        self.warnings.append(table_name)
        logger.warning("Dropped Entity {} due to {}".format(table_name, err))


class MetadataSource(Source[Entity]):
    config: MetadataTablesRestSourceConfig
    report: SourceStatus

    def __init__(
        self,
        config: MetadataTablesRestSourceConfig,
        metadata_config: MetadataServerConfig,
        ctx: WorkflowContext,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = MetadataSourceStatus()
        self.wrote_something = False
        self.metadata = OpenMetadata(self.metadata_config)
        self.tables = None
        self.topics = None

    def prepare(self):
        pass

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = MetadataTablesRestSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def next_record(self) -> Iterable[Entity]:
        yield from self.fetch_table()
        yield from self.fetch_topic()
        yield from self.fetch_dashboard()
        yield from self.fetch_pipeline()

    def fetch_table(self) -> Table:
        if self.config.include_tables:
            after = None
            while True:
                table_entities = self.metadata.list_entities(
                    entity=Table,
                    fields=[
                        "columns",
                        "tableConstraints",
                        "usageSummary",
                        "owner",
                        "tags",
                        "followers",
                    ],
                    after=after,
                    limit=self.config.limit_records,
                )
                for table in table_entities.entities:
                    self.status.scanned_table(table.name.__root__)
                    yield table
                if table_entities.after is None:
                    break
                after = table_entities.after

    def fetch_topic(self) -> Topic:
        if self.config.include_topics:
            after = None
            while True:
                topic_entities = self.metadata.list_entities(
                    entity=Topic,
                    fields=["owner", "tags", "followers"],
                    after=after,
                    limit=self.config.limit_records,
                )
                for topic in topic_entities.entities:
                    self.status.scanned_topic(topic.name.__root__)
                    yield topic
                if topic_entities.after is None:
                    break
                after = topic_entities.after

    def fetch_dashboard(self) -> Dashboard:
        if self.config.include_dashboards:
            after = None
            while True:
                dashboard_entities = self.metadata.list_entities(
                    entity=Dashboard,
                    fields=[
                        "owner",
                        "tags",
                        "followers",
                        "charts",
                        "usageSummary",
                    ],
                    after=after,
                    limit=self.config.limit_records,
                )
                for dashboard in dashboard_entities.entities:
                    self.status.scanned_dashboard(dashboard.name)
                    yield dashboard
                if dashboard_entities.after is None:
                    break
                after = dashboard_entities.after

    def fetch_pipeline(self) -> Pipeline:
        if self.config.include_pipelines:
            after = None
            while True:
                pipeline_entities = self.metadata.list_entities(
                    entity=Pipeline,
                    fields=["owner", "tags", "followers", "tasks"],
                    after=after,
                    limit=self.config.limit_records,
                )
                for pipeline in pipeline_entities.entities:
                    self.status.scanned_dashboard(pipeline.name)
                    yield pipeline
                if pipeline_entities.after is None:
                    break
                after = pipeline_entities.after

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass
