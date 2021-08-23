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

import inspect
import logging
import time
from typing import Optional

from elasticsearch import Elasticsearch
from elasticsearch.exceptions import NotFoundError

import metadata
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.sink.elasticsearch_constants import TABLE_ELASTICSEARCH_INDEX_MAPPING, \
    TOPIC_ELASTICSEARCH_INDEX_MAPPING

from metadata.config.common import ConfigModel
from metadata.ingestion.api.common import WorkflowContext, Record
from metadata.ingestion.models.table_metadata import TableESDocument, TopicESDocument
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.ometa.client import REST

logger = logging.getLogger(__name__)


class ElasticSearchConfig(ConfigModel):
    es_host_port: str
    index_tables: Optional[bool] = True
    index_topics: Optional[bool] = False
    table_index_name: str = "table_search_index"
    topic_index_name: str = "topic_search_index"


class ElasticsearchSink(Sink):
    """
    Elasticsearch Publisher uses Bulk API to load data from JSON file.
    A new index is created and data is uploaded into it. After the upload
    is complete, index alias is swapped to point to new index from old index
    and traffic is routed to new index.

    Old index is deleted after the alias swap is complete
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
        self.rest = REST(self.metadata_config)
        self.elasticsearch_doc_type = '_doc'
        self.elasticsearch_client = Elasticsearch([
            {'host': self.config.es_host_port},
        ])
        if self.config.index_tables:
            self._check_or_create_index(self.config.table_index_name, TABLE_ELASTICSEARCH_INDEX_MAPPING)
        if self.config.index_topics:
            self._check_or_create_index(self.config.topic_index_name, TOPIC_ELASTICSEARCH_INDEX_MAPPING)

    def _check_or_create_index(self, index_name: str, es_mapping: str):
        """
        Retrieve all indices that currently have {elasticsearch_alias} alias
        :return: list of elasticsearch indices
        """
        try:
            indices = self.elasticsearch_client.indices.get_alias(index_name).keys()
        except NotFoundError:
            logger.warn("Received index not found error from Elasticsearch. "
                        + "The index doesn't exist for a newly created ES. It's OK on first run.")
            # create new index with mapping
            self.elasticsearch_client.indices.create(index=index_name, body=es_mapping)

    def write_record(self, record: Record) -> None:
        if isinstance(record, metadata.generated.schema.entity.data.table.Table):
            table_doc = self._create_table_es_doc(record)
            self.elasticsearch_client.index(index=self.config.table_index_name, id=str(table_doc.table_id),
                                            body=table_doc.json())
        if isinstance(record, metadata.generated.schema.entity.data.topic.Topic):
            topic_doc = self._create_topic_es_doc(record)
            self.elasticsearch_client.index(index=self.config.topic_index_name, id=str(topic_doc.topic_id),
                                            body=topic_doc.json())
        self.status.records_written(record)

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

    def get_status(self):
        return self.status

    def close(self):
        self.elasticsearch_client.close()
