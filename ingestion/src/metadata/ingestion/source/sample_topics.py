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
from dataclasses import dataclass, field
from typing import Iterable, List
from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createTopic import CreateTopic
from metadata.generated.schema.api.services.createMessagingService import CreateMessagingServiceEntityRequest
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import SourceStatus, Source
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.ometa.client import REST


def get_service_or_create(service_json, metadata_config) -> MessagingService:
    client = REST(metadata_config)
    service = client.get_messaging_service(service_json['name'])
    if service is not None:
        return service
    else:
        created_service = client.create_messaging_service(CreateMessagingServiceEntityRequest(**service_json))
        return created_service


class SampleTopicSourceConfig(ConfigModel):
    sample_schema_folder: str
    service_name: str
    service_type: str = "Kafka"

    def get_sample_schema_folder(self):
        return self.sample_schema_folder


@dataclass
class SampleTopicSourceStatus(SourceStatus):
    topics_scanned: List[str] = field(default_factory=list)

    def report_topic_scanned(self, topic_name: str) -> None:
        self.topics_scanned.append(topic_name)


class SampleTopicsSource(Source):

    def __init__(self, config: SampleTopicSourceConfig, metadata_config: MetadataServerConfig, ctx):
        super().__init__(ctx)
        self.status = SampleTopicSourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.client = REST(metadata_config)
        self.service_json = json.load(open(config.sample_schema_folder + "/service.json", 'r'))
        self.topics = json.load(open(config.sample_schema_folder + "/topics.json", 'r'))
        self.service = get_service_or_create(self.service_json, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SampleTopicSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[CreateTopic]:
        for topic in self.topics['topics']:
            topic['service'] = EntityReference(id=self.service.id, type="messagingService")
            create_topic = CreateTopic(**topic)
            self.status.scanned(create_topic.name.__root__)
            yield create_topic

    def close(self):
        pass

    def get_status(self):
        return self.status
