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
Base sampler for messaging services (Kafka, Kinesis, PubSub, etc.)
"""

from abc import abstractmethod
from typing import Any, List, Optional  # noqa: UP035

from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.messagingService import MessagingConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sampler.sampler_config import MessagingSamplerConfig
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.logger import sampler_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = sampler_logger()


class MessagingSampler(SamplerInterface):
    """
    Base sampler for messaging services.
    Reads messages from a topic and converts schema field values to TableData format.
    """

    def __init__(
        self,
        service_connection_config: MessagingConnection,
        ometa_client: OpenMetadata,
        entity: Topic,
        config: Optional[MessagingSamplerConfig] = None,  # noqa: UP045
        **kwargs,
    ):
        super().__init__(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            config=config or MessagingSamplerConfig(),
            **kwargs,
        )

    @property
    def raw_dataset(self):
        return None

    def get_client(self) -> Any:
        return None

    def _rdn_sample_from_user_query(self):
        raise NotImplementedError

    def _fetch_sample_data_from_user_query(self) -> TableData:
        raise NotImplementedError

    def get_dataset(self, **kwargs):
        raise NotImplementedError

    def get_columns(self) -> List[SQALikeColumn]:  # noqa: UP006
        entity: Topic = self.entity
        if entity.messageSchema and entity.messageSchema.schemaFields:
            return [SQALikeColumn(field.name.root, field.dataType) for field in entity.messageSchema.schemaFields]
        return []

    @abstractmethod
    def _fetch_messages(self, count: int) -> List[dict]:  # noqa: UP006
        """
        Fetch up to `count` messages from the topic.
        Returns a list of dicts mapping field name to value.
        """

    def fetch_sample_data(self, columns: Optional[List[SQALikeColumn]]) -> TableData:  # noqa: UP006, UP045
        column_names = [col.name for col in (columns or self.get_columns())]
        if not column_names:
            return TableData(rows=[], columns=[])
        messages = self._fetch_messages(self.sample_limit)
        rows = [[msg.get(col) for col in column_names] for msg in messages]
        return TableData(columns=column_names, rows=rows)

    def close(self):
        """Nothing to close for messaging samplers by default."""
