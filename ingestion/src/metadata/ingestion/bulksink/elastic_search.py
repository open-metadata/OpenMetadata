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
import uuid

from elasticsearch import Elasticsearch
from elasticsearch.exceptions import NotFoundError
from typing import List, Optional, Set

from metadata.generated.schema.entity.data.table import TableEntity
from metadata.ingestion.bulksink.elasticsearch_constants import TABLE_ELASTICSEARCH_INDEX_MAPPING

from metadata.config.common import ConfigModel
from metadata.ingestion.api.bulk_sink import BulkSink, BulkSinkStatus
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.models.table_metadata import TableESDocument
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.ometa.client import REST

logger = logging.getLogger(__name__)


class ElasticSearchConfig(ConfigModel):
    filename: str
    es_host_port: str
    index_name: str
    batch_size: Optional[int] = 10000


class ElasticSearchBulkSink(BulkSink):
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
        self.status = BulkSinkStatus()
        self.table_index_new = config.index_name + str(uuid.uuid4())
        self.file_handler = open(self.config.filename, 'r')
        self.rest = REST(self.metadata_config)
        self.elasticsearch_mapping = TABLE_ELASTICSEARCH_INDEX_MAPPING
        self.elasticsearch_doc_type = '_doc'
        self.elasticsearch_client = Elasticsearch([
            {'host': self.config.es_host_port},
        ])

    def _fetch_old_index(self) -> List[str]:
        """
        Retrieve all indices that currently have {elasticsearch_alias} alias
        :return: list of elasticsearch indices
        """
        try:
            indices = self.elasticsearch_client.indices.get_alias(self.config.index_name).keys()
            return indices
        except NotFoundError:
            logger.warn("Received index not found error from Elasticsearch. "
                        + "The index doesn't exist for a newly created ES. It's OK on first run.")
            # return empty list on exception
            return []

    def write_records(self) -> None:
        table_entities = [TableEntity(**json.loads(l)) for l in self.file_handler.readlines()]
        docs = []
        for table in table_entities:
            fqdn = table.fullyQualifiedName
            database = table.database.name
            table_name = table.name
            suggest = [{'input': [fqdn], 'weight': 5}, {'input': [table_name], 'weight': 10}]
            column_names = []
            column_descriptions = []
            tags = set[str]()

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
                                        table_type=table.tableType,
                                        last_updated_timestamp=timestamp,
                                        column_names=column_names,
                                        column_descriptions=column_descriptions,
                                        monthly_stats=table.usageSummary.monthlyStats.count,
                                        weekly_stats=table.usageSummary.weeklyStats.count,
                                        daily_stats=table.usageSummary.dailyStats.count,
                                        tier=tier,
                                        tags=list(tags),
                                        fqdn=fqdn,
                                        schema_description=None,
                                        owner=table_owner,
                                        followers=table_followers,
                                        table_entity=table)

            docs.append(table_doc)
        # ensure new data exists
        if not docs:
            logger.warning("There are no entities in OpenMetadata to index into ElasticSearch")
            return

        records = []
        count = 0

        # create new index with mapping
        self.elasticsearch_client.indices.create(index=self.table_index_new, body=self.elasticsearch_mapping)
        for doc in docs:
            index_row = dict(index=dict(_index=self.table_index_new,
                                        _type=self.elasticsearch_doc_type))
            records.append(index_row)
            records.append(doc.json())
            count += 1
            if count == self.config.batch_size:
                self.elasticsearch_client.bulk(records)
                logger.info('Sink {} of records into ElasticSearch'.format(str(cnt)))
                cnt = 0
                self.status.records_written(count)
                records = []

        if docs:
            r = self.elasticsearch_client.bulk(records)
        self.status.records_written(count)
        # update alias to point to the new index
        actions = [{"add": {"index": self.table_index_new, "alias": self.config.index_name}}]

        # fetch indices that have {elasticsearch_alias} as alias
        elasticsearch_old_indices = self._fetch_old_index()

        # delete old indices
        delete_actions = [{"remove_index": {"index": index}} for index in elasticsearch_old_indices]
        actions.extend(delete_actions)

        update_action = {"actions": actions}

        # perform alias update and index delete in single atomic operation
        self.elasticsearch_client.indices.update_aliases(update_action)

    def get_status(self):
        return self.status

    def close(self):
        self.elasticsearch_client.close()
        self.file_handler.close()
