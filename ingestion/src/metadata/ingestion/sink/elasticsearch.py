#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import json
import logging
import time
from typing import Optional, List

from elasticsearch import Elasticsearch

from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.type import entityReference
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.ometa.openmetadata_rest import OpenMetadataAPIClient, MetadataServerConfig
from metadata.ingestion.sink.elasticsearch_constants import TABLE_ELASTICSEARCH_INDEX_MAPPING, \
    TOPIC_ELASTICSEARCH_INDEX_MAPPING, DASHBOARD_ELASTICSEARCH_INDEX_MAPPING

from metadata.config.common import ConfigModel
from metadata.ingestion.api.common import WorkflowContext, Record
from metadata.ingestion.models.table_metadata import TableESDocument, TopicESDocument, DashboardESDocument

logger = logging.getLogger(__name__)


class ElasticSearchConfig(ConfigModel):
    es_host: str
    es_port: int = 9200
    index_tables: Optional[bool] = True
    index_topics: Optional[bool] = False
    index_dashboards: Optional[bool] = False
    table_index_name: str = "table_search_index"
    topic_index_name: str = "topic_search_index"
    dashboard_index_name: str = "dashboard_search_index"


class ElasticsearchSink(Sink):
    """

    """
    DEFAULT_ELASTICSEARCH_INDEX_MAPPING = TABLE_ELASTICSEARCH_INDEX_MAPPING

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = ElasticSearchConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def __init__(self, ctx: WorkflowContext, config: ElasticSearchConfig,
                 metadata_config: MetadataServerConfig) -> None:

        self.config = config
        self.metadata_config = metadata_config
        self.ctx = ctx
        self.status = SinkStatus()
        self.rest = OpenMetadataAPIClient(self.metadata_config)
        self.elasticsearch_doc_type = '_doc'
        self.elasticsearch_client = Elasticsearch([
            {'host': self.config.es_host,
             'port': self.config.es_port},
        ])
        if self.config.index_tables:
            self._check_or_create_index(self.config.table_index_name, TABLE_ELASTICSEARCH_INDEX_MAPPING)
        if self.config.index_topics:
            self._check_or_create_index(self.config.topic_index_name, TOPIC_ELASTICSEARCH_INDEX_MAPPING)
        if self.config.index_dashboards:
            self._check_or_create_index(self.config.dashboard_index_name, DASHBOARD_ELASTICSEARCH_INDEX_MAPPING)

    def _check_or_create_index(self, index_name: str, es_mapping: str):
        """
        Retrieve all indices that currently have {elasticsearch_alias} alias
        :return: list of elasticsearch indices
        """
        if self.elasticsearch_client.indices.exists(index_name):
            mapping = self.elasticsearch_client.indices.get_mapping()
            if not mapping[index_name]['mappings']:
                logger.debug(f'There are no mappings for index {index_name}. Updating the mapping')
                es_mapping_dict = json.loads(es_mapping)
                es_mapping_update_dict =  {'properties': es_mapping_dict['mappings']['properties']}
                self.elasticsearch_client.indices.put_mapping(index=index_name, body=json.dumps(es_mapping_update_dict))
        else:
            logger.warning("Received index not found error from Elasticsearch. "
                    + "The index doesn't exist for a newly created ES. It's OK on first run.")
            # create new index with mapping
            self.elasticsearch_client.indices.create(index=index_name, body=es_mapping)

    def write_record(self, record: Record) -> None:
        if isinstance(record, Table):
            table_doc = self._create_table_es_doc(record)
            self.elasticsearch_client.index(index=self.config.table_index_name, id=str(table_doc.table_id),
                                            body=table_doc.json())
        if isinstance(record, Topic):
            topic_doc = self._create_topic_es_doc(record)
            self.elasticsearch_client.index(index=self.config.topic_index_name, id=str(topic_doc.topic_id),
                                            body=topic_doc.json())
        if isinstance(record, Dashboard):
            dashboard_doc = self._create_dashboard_es_doc(record)
            self.elasticsearch_client.index(index=self.config.dashboard_index_name, id=str(dashboard_doc.dashboard_id),
                                            body=dashboard_doc.json())
        if (hasattr(record.name,'__root__')):
            self.status.records_written(record.name.__root__)
        else:
            self.status.records_written(record.name)

    def _create_table_es_doc(self, table: Table):
        fqdn = table.fullyQualifiedName
        database = table.database.name
        table_name = table.name
        suggest = [{'input': [fqdn], 'weight': 5}, {'input': [table_name], 'weight': 10}]
        column_names = []
        column_descriptions = []
        tags = set()

        timestamp = time.time()
        tier = None
        for table_tag in table.tags:
            if "Tier" in table_tag.tagFQN:
                tier = table_tag.tagFQN
            else:
                tags.add(table_tag.tagFQN)

        for column in table.columns:
            column_names.append(column.name.__root__)
            if column.description is not None:
                column_descriptions.append(column.description)
            if len(column.tags) > 0:
                for col_tag in column.tags:
                    tags.add(col_tag.tagFQN)

        database_entity = self.rest.get_database_by_id(table.database.id.__root__)
        service_entity = self.rest.get_database_service_by_id(database_entity.service.id.__root__)
        table_owner = str(table.owner.id.__root__) if table.owner is not None else ""
        table_followers = []
        if table.followers:
            for follower in table.followers.__root__:
                table_followers.append(str(follower.id.__root__))
        table_doc = TableESDocument(table_id=str(table.id.__root__),
                                    database=database,
                                    service=service_entity.name,
                                    service_type=service_entity.serviceType.name,
                                    table_name=table.name.__root__,
                                    suggest=suggest,
                                    description=table.description,
                                    table_type=table.tableType.name,
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
                                    schema_description=None,
                                    owner=table_owner,
                                    followers=table_followers)
        return table_doc

    def _create_topic_es_doc(self, topic: Topic):
        fqdn = topic.fullyQualifiedName
        topic_name = topic.name
        suggest = [{'input': [fqdn], 'weight': 5}, {'input': [topic_name], 'weight': 10}]
        tags = set()
        timestamp = time.time()
        service_entity = self.rest.get_messaging_service_by_id(str(topic.service.id.__root__))
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
        topic_doc = TopicESDocument(topic_id=str(topic.id.__root__),
                                    service=service_entity.name,
                                    service_type=service_entity.serviceType.name,
                                    topic_name=topic.name.__root__,
                                    suggest=suggest,
                                    description=topic.description,
                                    last_updated_timestamp=timestamp,
                                    tier=tier,
                                    tags=list(tags),
                                    fqdn=fqdn,
                                    owner=topic_owner,
                                    followers=topic_followers)

        return topic_doc

    def _create_dashboard_es_doc(self, dashboard: Dashboard):
        fqdn = dashboard.fullyQualifiedName
        dashboard_name = dashboard.name
        suggest = [{'input': [dashboard.displayName], 'weight': 10}]
        tags = set()
        timestamp = time.time()
        service_entity = self.rest.get_dashboard_service_by_id(str(dashboard.service.id.__root__))
        dashboard_owner = str(dashboard.owner.id.__root__) if dashboard.owner is not None else ""
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
        dashboard_doc = DashboardESDocument(dashboard_id=str(dashboard.id.__root__),
                                            service=service_entity.name,
                                            service_type=service_entity.serviceType.name,
                                            dashboard_name=dashboard.displayName,
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
                                            )

        return dashboard_doc

    def _get_charts(self, chart_refs: Optional[List[entityReference.EntityReference]]):
        charts = []
        if chart_refs is not None:
            for chart_ref in chart_refs:
                chart = self.rest.get_chart_by_id(str(chart_ref.id.__root__))
                charts.append(chart)
        return charts

    def get_status(self):
        return self.status

    def close(self):
        self.elasticsearch_client.close()
