#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
RedPanda source ingestion
"""
import traceback
from typing import Iterable, Optional, cast

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.topic import Topic as TopicEntity
from metadata.generated.schema.entity.services.connections.messaging.redpandaConnection import (
    RedpandaConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.messaging.common_broker_source import CommonBrokerSource
from metadata.ingestion.source.messaging.messaging_service import BrokerTopicDetails
from metadata.ingestion.source.messaging.redpanda.client import RedpandaAdminClient
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager, check_ssl_and_init

logger = ingestion_logger()


class RedpandaSource(CommonBrokerSource):
    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        self.ssl_manager = None
        self.service_connection = cast(
            RedpandaConnection, config.serviceConnection.root.config
        )
        self.ssl_manager: SSLManager = check_ssl_and_init(self.service_connection)
        if self.ssl_manager:
            self.service_connection = self.ssl_manager.setup_ssl(
                self.service_connection
            )
        super().__init__(config, metadata)

        self.admin_client_rp = None
        self._transforms_cache = None
        if self.service_connection.redpandaAdminApiUrl:
            self.admin_client_rp = RedpandaAdminClient(
                str(self.service_connection.redpandaAdminApiUrl)
            )

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: RedpandaConnection = config.serviceConnection.root.config
        if not isinstance(connection, RedpandaConnection):
            raise InvalidSourceException(
                f"Expected RedpandaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def yield_topic_lineage(
        self, topic_details: BrokerTopicDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Yield topic-to-topic lineage from Redpanda data transforms.
        Each transform has one input_topic and one or more output_topics.
        """
        if not self.admin_client_rp:
            return

        if self._transforms_cache is None:
            transforms = self.admin_client_rp.list_transforms()
            self._transforms_cache = {}
            for t in transforms:
                self._transforms_cache.setdefault(t.input_topic, []).append(t)

        current_topic = topic_details.topic_name

        for transform in self._transforms_cache.get(current_topic, []):

            source_topic_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=TopicEntity,
                service_name=self.context.get().messaging_service,
                topic_name=transform.input_topic,
            )
            source_topic = self.metadata.get_by_name(
                entity=TopicEntity, fqn=source_topic_fqn
            )
            if not source_topic:
                continue

            for output_topic_name in transform.output_topics:
                try:
                    target_topic_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=TopicEntity,
                        service_name=self.context.get().messaging_service,
                        topic_name=output_topic_name,
                    )
                    target_topic = self.metadata.get_by_name(
                        entity=TopicEntity, fqn=target_topic_fqn
                    )
                    if not target_topic:
                        logger.debug(
                            f"Target topic {output_topic_name} not found for "
                            f"transform '{transform.name}' lineage"
                        )
                        continue

                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=source_topic.id,
                                    type="topic",
                                ),
                                toEntity=EntityReference(
                                    id=target_topic.id,
                                    type="topic",
                                ),
                                lineageDetails=LineageDetails(
                                    source=LineageSource.PipelineLineage,
                                    description=(
                                        f"Redpanda data transform '{transform.name}'"
                                    ),
                                ),
                            )
                        )
                    )
                except Exception as exc:
                    yield Either(
                        left=StackTraceError(
                            name=topic_details.topic_name,
                            error=(
                                f"Failed to create lineage for transform "
                                f"'{transform.name}': {exc}"
                            ),
                            stackTrace=traceback.format_exc(),
                        )
                    )
