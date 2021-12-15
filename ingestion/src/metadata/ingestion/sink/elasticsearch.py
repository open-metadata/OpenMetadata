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
import ssl
import time
from datetime import datetime
from typing import List, Optional

from dateutil import parser
from elasticsearch import Elasticsearch
from elasticsearch.connection import create_ssl_context

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.type import entityReference
from metadata.ingestion.api.common import Entity, WorkflowContext
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.models.table_metadata import (
    ChangeDescription,
    DashboardESDocument,
    PipelineESDocument,
    TableESDocument,
    TopicESDocument,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.sink.elasticsearch_constants import (
    DASHBOARD_ELASTICSEARCH_INDEX_MAPPING,
    PIPELINE_ELASTICSEARCH_INDEX_MAPPING,
    TABLE_ELASTICSEARCH_INDEX_MAPPING,
    TOPIC_ELASTICSEARCH_INDEX_MAPPING,
)

logger = logging.getLogger(__name__)


def epoch_ms(dt: datetime):
    return int(dt.timestamp() * 1000)


class ElasticSearchConfig(ConfigModel):
    es_host: str
    es_port: int = 9200
    es_username: Optional[str] = None
    es_password: Optional[str] = None
    index_tables: Optional[bool] = True
    index_topics: Optional[bool] = True
    index_dashboards: Optional[bool] = True
    index_pipelines: Optional[bool] = True
    index_dbt_models: Optional[bool] = True
    table_index_name: str = "table_search_index"
    topic_index_name: str = "topic_search_index"
    dashboard_index_name: str = "dashboard_search_index"
    pipeline_index_name: str = "pipeline_search_index"
    dbt_index_name: str = "dbt_model_search_index"
    scheme: str = "http"
    use_ssl: bool = False
    verify_certs: bool = False
    timeout: int = 30
    ca_certs: Optional[str] = None


class ElasticsearchSink(Sink[Entity]):
    """ """

    DEFAULT_ELASTICSEARCH_INDEX_MAPPING = TABLE_ELASTICSEARCH_INDEX_MAPPING

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = ElasticSearchConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def __init__(
        self,
        ctx: WorkflowContext,
        config: ElasticSearchConfig,
        metadata_config: MetadataServerConfig,
    ) -> None:

        self.config = config
        self.metadata_config = metadata_config
        self.ctx = ctx
        self.status = SinkStatus()
        self.metadata = OpenMetadata(self.metadata_config)
        self.elasticsearch_doc_type = "_doc"
        http_auth = None
        if self.config.es_username:
            http_auth = (self.config.es_username, self.config.es_password)

        ssl_context = None
        if self.config.scheme == "https" and not self.config.verify_certs:
            ssl_context = create_ssl_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        self.elasticsearch_client = Elasticsearch(
            [
                {"host": self.config.es_host, "port": self.config.es_port},
            ],
            http_auth=http_auth,
            scheme=self.config.scheme,
            use_ssl=self.config.use_ssl,
            verify_certs=self.config.verify_certs,
            ssl_context=ssl_context,
            ca_certs=self.config.ca_certs,
        )

        if self.config.index_tables:
            self._check_or_create_index(
                self.config.table_index_name, TABLE_ELASTICSEARCH_INDEX_MAPPING
            )
        if self.config.index_topics:
            self._check_or_create_index(
                self.config.topic_index_name, TOPIC_ELASTICSEARCH_INDEX_MAPPING
            )
        if self.config.index_dashboards:
            self._check_or_create_index(
                self.config.dashboard_index_name, DASHBOARD_ELASTICSEARCH_INDEX_MAPPING
            )
        if self.config.index_pipelines:
            self._check_or_create_index(
                self.config.pipeline_index_name, PIPELINE_ELASTICSEARCH_INDEX_MAPPING
            )

    def _check_or_create_index(self, index_name: str, es_mapping: str):
        """
        Retrieve all indices that currently have {elasticsearch_alias} alias
        :return: list of elasticsearch indices
        """
        if self.elasticsearch_client.indices.exists(index_name):
            mapping = self.elasticsearch_client.indices.get_mapping()
            if not mapping[index_name]["mappings"]:
                logger.debug(
                    f"There are no mappings for index {index_name}. Updating the mapping"
                )
                es_mapping_dict = json.loads(es_mapping)
                es_mapping_update_dict = {
                    "properties": es_mapping_dict["mappings"]["properties"]
                }
                self.elasticsearch_client.indices.put_mapping(
                    index=index_name,
                    body=json.dumps(es_mapping_update_dict),
                    request_timeout=self.config.timeout,
                )
        else:
            logger.warning(
                "Received index not found error from Elasticsearch. "
                + "The index doesn't exist for a newly created ES. It's OK on first run."
            )
            # create new index with mapping
            self.elasticsearch_client.indices.create(
                index=index_name, body=es_mapping, request_timeout=self.config.timeout
            )

    def write_record(self, record: Entity) -> None:
        if isinstance(record, Table):
            table_doc = self._create_table_es_doc(record)
            self.elasticsearch_client.index(
                index=self.config.table_index_name,
                id=str(table_doc.table_id),
                body=table_doc.json(),
                request_timeout=self.config.timeout,
            )
        if isinstance(record, Topic):
            topic_doc = self._create_topic_es_doc(record)
            self.elasticsearch_client.index(
                index=self.config.topic_index_name,
                id=str(topic_doc.topic_id),
                body=topic_doc.json(),
                request_timeout=self.config.timeout,
            )
        if isinstance(record, Dashboard):
            dashboard_doc = self._create_dashboard_es_doc(record)
            self.elasticsearch_client.index(
                index=self.config.dashboard_index_name,
                id=str(dashboard_doc.dashboard_id),
                body=dashboard_doc.json(),
                request_timeout=self.config.timeout,
            )
        if isinstance(record, Pipeline):
            pipeline_doc = self._create_pipeline_es_doc(record)
            self.elasticsearch_client.index(
                index=self.config.pipeline_index_name,
                id=str(pipeline_doc.pipeline_id),
                body=pipeline_doc.json(),
                request_timeout=self.config.timeout,
            )

        if hasattr(record.name, "__root__"):
            self.status.records_written(record.name.__root__)
        else:
            self.status.records_written(record.name)

    def _create_table_es_doc(self, table: Table):
        fqdn = table.fullyQualifiedName
        database = table.database.name
        table_name = table.name
        suggest = [
            {"input": [fqdn], "weight": 5},
            {"input": [table_name], "weight": 10},
        ]
        column_names = []
        column_descriptions = []
        tags = set()

        timestamp = epoch_ms(table.updatedAt.__root__)
        tier = None
        for table_tag in table.tags:
            if "Tier" in table_tag.tagFQN:
                tier = table_tag.tagFQN
            else:
                tags.add(table_tag.tagFQN)
        self._parse_columns(
            table.columns, None, column_names, column_descriptions, tags
        )

        database_entity = self.metadata.get_by_id(
            entity=Database, entity_id=str(table.database.id.__root__)
        )
        service_entity = self.metadata.get_by_id(
            entity=DatabaseService, entity_id=str(database_entity.service.id.__root__)
        )
        table_owner = str(table.owner.id.__root__) if table.owner is not None else ""
        table_followers = []
        if table.followers:
            for follower in table.followers.__root__:
                table_followers.append(str(follower.id.__root__))
        table_type = None
        if hasattr(table.tableType, "name"):
            table_type = table.tableType.name

        change_descriptions = self._get_change_descriptions(Table, table.id.__root__)
        table_doc = TableESDocument(
            table_id=str(table.id.__root__),
            database=str(database_entity.name.__root__),
            service=service_entity.name,
            service_type=service_entity.serviceType.name,
            service_category="databaseService",
            name=table.name.__root__,
            suggest=suggest,
            description=table.description,
            table_type=table_type,
            last_updated_timestamp=timestamp,
            column_names=column_names,
            column_descriptions=column_descriptions,
            monthly_stats=table.usageSummary.monthlyStats.count,
            monthly_percentile_rank=table.usageSummary.monthlyStats.percentileRank,
            weekly_stats=table.usageSummary.weeklyStats.count,
            weekly_percentile_rank=table.usageSummary.weeklyStats.percentileRank,
            daily_stats=table.usageSummary.dailyStats.count,
            daily_percentile_rank=table.usageSummary.dailyStats.percentileRank,
            tier=tier,
            tags=list(tags),
            fqdn=fqdn,
            owner=table_owner,
            followers=table_followers,
            change_descriptions=change_descriptions,
        )
        return table_doc

    def _create_topic_es_doc(self, topic: Topic):
        fqdn = topic.fullyQualifiedName
        topic_name = topic.name
        suggest = [
            {"input": [fqdn], "weight": 5},
            {"input": [topic_name], "weight": 10},
        ]
        tags = set()
        timestamp = epoch_ms(topic.updatedAt.__root__)
        service_entity = self.metadata.get_by_id(
            entity=MessagingService, entity_id=str(topic.service.id.__root__)
        )
        topic_owner = str(topic.owner.id.__root__) if topic.owner is not None else ""
        topic_followers = []
        if topic.followers:
            for follower in topic.followers.__root__:
                topic_followers.append(str(follower.id.__root__))
        tier = None
        for topic_tag in topic.tags:
            if "Tier" in topic_tag.tagFQN:
                tier = topic_tag.tagFQN
            else:
                tags.add(topic_tag.tagFQN)
        change_descriptions = self._get_change_descriptions(Topic, topic.id.__root__)
        topic_doc = TopicESDocument(
            topic_id=str(topic.id.__root__),
            service=service_entity.name,
            service_type=service_entity.serviceType.name,
            service_category="messagingService",
            name=topic.name.__root__,
            suggest=suggest,
            description=topic.description,
            last_updated_timestamp=timestamp,
            tier=tier,
            tags=list(tags),
            fqdn=fqdn,
            owner=topic_owner,
            followers=topic_followers,
            change_descriptions=change_descriptions,
        )
        return topic_doc

    def _create_dashboard_es_doc(self, dashboard: Dashboard):
        fqdn = dashboard.fullyQualifiedName
        dashboard_name = dashboard.name
        suggest = [{"input": [dashboard.displayName], "weight": 10}]
        tags = set()
        timestamp = epoch_ms(dashboard.updatedAt.__root__)
        service_entity = self.metadata.get_by_id(
            entity=DashboardService, entity_id=str(dashboard.service.id.__root__)
        )
        dashboard_owner = (
            str(dashboard.owner.id.__root__) if dashboard.owner is not None else ""
        )
        dashboard_followers = []
        if dashboard.followers:
            for follower in dashboard.followers.__root__:
                dashboard_followers.append(str(follower.id.__root__))
        tier = None
        for dashboard_tag in dashboard.tags:
            if "Tier" in dashboard_tag.tagFQN:
                tier = dashboard_tag.tagFQN
            else:
                tags.add(dashboard_tag.tagFQN)
        charts: List[Chart] = self._get_charts(dashboard.charts)
        chart_names = []
        chart_descriptions = []
        for chart in charts:
            chart_names.append(chart.displayName)
            if chart.description is not None:
                chart_descriptions.append(chart.description)
            if len(chart.tags) > 0:
                for col_tag in chart.tags:
                    tags.add(col_tag.tagFQN)
        change_descriptions = self._get_change_descriptions(
            Dashboard, dashboard.id.__root__
        )
        dashboard_doc = DashboardESDocument(
            dashboard_id=str(dashboard.id.__root__),
            service=service_entity.name,
            service_type=service_entity.serviceType.name,
            service_category="dashboardService",
            name=dashboard.displayName,
            chart_names=chart_names,
            chart_descriptions=chart_descriptions,
            suggest=suggest,
            description=dashboard.description,
            last_updated_timestamp=timestamp,
            tier=tier,
            tags=list(tags),
            fqdn=fqdn,
            owner=dashboard_owner,
            followers=dashboard_followers,
            monthly_stats=dashboard.usageSummary.monthlyStats.count,
            monthly_percentile_rank=dashboard.usageSummary.monthlyStats.percentileRank,
            weekly_stats=dashboard.usageSummary.weeklyStats.count,
            weekly_percentile_rank=dashboard.usageSummary.weeklyStats.percentileRank,
            daily_stats=dashboard.usageSummary.dailyStats.count,
            daily_percentile_rank=dashboard.usageSummary.dailyStats.percentileRank,
            change_descriptions=change_descriptions,
        )

        return dashboard_doc

    def _create_pipeline_es_doc(self, pipeline: Pipeline):
        fqdn = pipeline.fullyQualifiedName
        suggest = [{"input": [pipeline.displayName], "weight": 10}]
        tags = set()
        timestamp = epoch_ms(pipeline.updatedAt.__root__)
        service_entity = self.metadata.get_by_id(
            entity=PipelineService, entity_id=str(pipeline.service.id.__root__)
        )
        pipeline_owner = (
            str(pipeline.owner.id.__root__) if pipeline.owner is not None else ""
        )
        pipeline_followers = []
        if pipeline.followers:
            for follower in pipeline.followers.__root__:
                pipeline_followers.append(str(follower.id.__root__))
        tier = None
        for pipeline_tag in pipeline.tags:
            if "Tier" in pipeline_tag.tagFQN:
                tier = pipeline_tag.tagFQN
            else:
                tags.add(pipeline_tag.tagFQN)
        tasks: List[Task] = pipeline.tasks
        task_names = []
        task_descriptions = []
        for task in tasks:
            task_names.append(task.displayName)
            if task.description is not None:
                task_descriptions.append(task.description)
            if tags in task and len(task.tags) > 0:
                for col_tag in task.tags:
                    tags.add(col_tag.tagFQN)
        change_descriptions = self._get_change_descriptions(
            Pipeline, pipeline.id.__root__
        )
        pipeline_doc = PipelineESDocument(
            pipeline_id=str(pipeline.id.__root__),
            service=service_entity.name,
            service_type=service_entity.serviceType.name,
            service_category="pipelineService",
            name=pipeline.displayName,
            task_names=task_names,
            task_descriptions=task_descriptions,
            suggest=suggest,
            description=pipeline.description,
            last_updated_timestamp=timestamp,
            tier=tier,
            tags=list(tags),
            fqdn=fqdn,
            owner=pipeline_owner,
            followers=pipeline_followers,
            change_descriptions=change_descriptions,
        )

        return pipeline_doc

    def _get_charts(self, chart_refs: Optional[List[entityReference.EntityReference]]):
        charts = []
        if chart_refs:
            for chart_ref in chart_refs:
                chart = self.metadata.get_by_id(
                    entity=Chart, entity_id=str(chart_ref.id.__root__), fields=["tags"]
                )
                charts.append(chart)
        return charts

    def _parse_columns(
        self,
        columns: List[Column],
        parent_column,
        column_names,
        column_descriptions,
        tags,
    ):
        for column in columns:
            col_name = (
                parent_column + "." + column.name.__root__
                if parent_column is not None
                else column.name.__root__
            )
            column_names.append(col_name)
            if column.description is not None:
                column_descriptions.append(column.description)
            if len(column.tags) > 0:
                for col_tag in column.tags:
                    tags.add(col_tag.tagFQN)
            if column.children is not None:
                self._parse_columns(
                    column.children,
                    column.name.__root__,
                    column_names,
                    column_descriptions,
                    tags,
                )

    def _get_change_descriptions(self, entity_type, entity_id):
        try:
            entity_versions = self.metadata.list_versions(entity_id, entity_type)
            change_descriptions = []
            for version in entity_versions.versions:
                version_json = json.loads(version)
                updatedAt = parser.parse(version_json["updatedAt"])
                change_description = ChangeDescription(
                    updatedBy=version_json["updatedBy"], updatedAt=epoch_ms(updatedAt)
                )
                if "changeDescription" in version_json:
                    change_description.fieldsAdded = version_json["changeDescription"][
                        "fieldsAdded"
                    ]
                    change_description.fieldsDeleted = version_json[
                        "changeDescription"
                    ]["fieldsDeleted"]
                    change_description.fieldsUpdated = version_json[
                        "changeDescription"
                    ]["fieldsUpdated"]
                change_descriptions.append(change_description)
            return change_descriptions
        except Exception as err:
            logger.error(repr(err))

    def get_status(self):
        return self.status

    def close(self):
        self.elasticsearch_client.close()
