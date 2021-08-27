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

import logging

from pydantic import ValidationError

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createTopic import CreateTopic
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.ometa.client import  APIError
from metadata.ingestion.ometa.openmetadata_rest import OpenMetadataAPIClient, MetadataServerConfig

logger = logging.getLogger(__name__)


class MetadataTopicsSinkConfig(ConfigModel):
    api_endpoint: str = None


class MetadataRestTopicsSink(Sink):
    config: MetadataTopicsSinkConfig
    status: SinkStatus

    def __init__(self, ctx: WorkflowContext, config: MetadataTopicsSinkConfig, metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SinkStatus()
        self.wrote_something = False
        self.rest = OpenMetadataAPIClient(self.metadata_config)

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = MetadataTopicsSinkConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def write_record(self, topic: CreateTopic) -> None:
        try:
            created_topic = self.rest.create_or_update_topic(topic)
            logger.info(
                'Successfully ingested {}'.format(created_topic.name.__root__))
            self.status.records_written(created_topic)
        except (APIError, ValidationError) as err:
            logger.error(
                "Failed to ingest topic {} ".format(topic.name.__root__))
            logger.error(err)
            self.status.failure(topic.name)

    def get_status(self):
        return self.status

    def close(self):
        pass
