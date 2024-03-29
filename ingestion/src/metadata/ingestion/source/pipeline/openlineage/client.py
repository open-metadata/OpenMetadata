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
Wrapper module of DagsterGraphQLClient client
"""
import json
import traceback
from abc import abstractmethod
from typing import List, Optional

import requests
from confluent_kafka import Consumer as KafkaConsumer
from confluent_kafka import TopicPartition

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    OpenLineageConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.openLineageKafkaConnection import (
    SecurityProtocol as KafkaSecProtocol,
)

from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    OpenLineageConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OpenLineageEventReader:

    @abstractmethod
    def get_events(self):
        pass

    @abstractmethod
    def connection_check(self):
        pass


class OpenLineageKafkaClient(OpenLineageEventReader):
    def __init__(self, kafka_connection: OpenLineageConnection):
        try:
            self.connection = kafka_connection.connection
            config = {
                "bootstrap.servers": self.connection.brokersUrl,
                "group.id": self.connection.consumerGroupName,
                "auto.offset.reset": self.connection.consumerOffsets.value,
            }
            if self.connection.securityProtocol.value == KafkaSecProtocol.SSL.value:
                config.update(
                    {
                        "security.protocol": self.connection.securityProtocol.value,
                        "ssl.ca.location": self.connection.SSLCALocation,
                        "ssl.certificate.location": self.connection.SSLCertificateLocation,
                        "ssl.key.location": self.connection.SSLKeyLocation,
                    }
                )

            kafka_consumer = KafkaConsumer(config)
            kafka_consumer.subscribe([self.connection.topicName])

            self.kafka_consumer = kafka_consumer
        except Exception as exc:
            msg = f"Unknown error connecting with {self.connection}: {exc}."
            raise SourceConnectionException(msg)

    def get_raw_kafka_events(self):
        session_active = True
        empty_msg_cnt = 0
        pool_timeout = self.connection.poolTimeout
        while session_active:
            message = self.kafka_consumer.poll(timeout=pool_timeout)
            if message is None:
                logger.debug("no new messages")
                empty_msg_cnt += 1
                if (
                        empty_msg_cnt * pool_timeout
                        > self.connection.sessionTimeout
                ):
                    # There is no new messages, timeout is passed
                    session_active = False
            else:
                logger.debug(f"new message {message.value()}")
                empty_msg_cnt = 0

            yield message

    def get_events(self):
        for raw_kafka_msg in self.get_raw_kafka_events():
            if raw_kafka_msg is not None:
                try:
                    ol_event = json.loads(raw_kafka_msg.value())
                    yield ol_event
                except Exception as e:
                    logger.debug(e)
            else:
                yield None

    def connection_check(self):
        self.kafka_consumer.get_watermark_offsets(
            TopicPartition(self.connection.topicName, 0)
        )


class OpenLineageApiClient(OpenLineageEventReader):

    def __init__(self, api_connection: OpenLineageConnection):
        self.api_key = api_connection.connection.apiKey.get_secret_value()
        self.url = api_connection.connection.apiUrl

    def fetch_data(self, limit=10, offset=0, after=None, api_key =None,  sort_direction="asc"):
        """
        Fetch data with pagination and optional sorting.
        :param limit: Number of items to fetch per request.
        :param after: Cursor for fetching items after this cursor (for pagination).
        :param sort_direction: Direction for sorting items ('asc' or 'desc').
        :return: JSON response data.
        """
        params = {
            'limit': limit,
            'sort': sort_direction,
            'offset': offset
        }
        # Include the 'after' cursor for pagination if provided
        if after:
            params['after'] = after

        headers = {
            "Content-Type": "application/json"
        }
        if api_key:
            headers['Authorization'] = f"Bearer {api_key}"

        response = requests.get(self.url, headers=headers, params=params)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Failed to fetch data: {response.status_code}")
            return None

    def connection_check(self):
        self.kafka_consumer.get_watermark_offsets(
            TopicPartition(self.connection.topicName, 0)
        )

    def get_events(self):
        pass
