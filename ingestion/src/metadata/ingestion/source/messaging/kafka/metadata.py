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
Kafka source ingestion
"""
from typing import Optional, cast

from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.messaging.common_broker_source import CommonBrokerSource
from metadata.utils.ssl_manager import SSLManager, check_ssl_and_init


class KafkaSource(CommonBrokerSource):
    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        self.ssl_manager = None
        self.service_connection = cast(
            KafkaConnection, config.serviceConnection.root.config
        )
        self.ssl_manager: SSLManager = check_ssl_and_init(self.service_connection)
        if self.ssl_manager:
            self.service_connection = self.ssl_manager.setup_ssl(
                self.service_connection
            )
        super().__init__(config, metadata)

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: KafkaConnection = config.serviceConnection.root.config
        if not isinstance(connection, KafkaConnection):
            raise InvalidSourceException(
                f"Expected KafkaConnection, but got {connection}"
            )
        return cls(config, metadata)
