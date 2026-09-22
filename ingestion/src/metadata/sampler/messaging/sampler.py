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
from typing import Any, cast

from metadata.generated.schema.entity.data.table import ColumnName, DataType, TableData
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.messagingService import MessagingConnection
from metadata.generated.schema.type.schema import DataTypeTopic
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sampler.sampler_config import MessagingSamplerConfig
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.logger import sampler_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = sampler_logger()

# Distinguishes an absent path from a field explicitly set to null.
MISSING = object()


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
        config: MessagingSamplerConfig | None = None,
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

    def get_columns(self) -> list[SQALikeColumn]:
        entity: Topic = cast("Topic", self.entity)
        if entity.messageSchema and entity.messageSchema.schemaFields:
            columns = []
            for field in entity.messageSchema.schemaFields:
                columns.extend(self._flatten_field(field, depth=0))
            return columns
        return []

    def _flatten_field(self, field, depth: int = 0, max_depth: int = 10, parent_name: str = "") -> list[SQALikeColumn]:
        """
        Recursively flatten RECORD fields to their leaf columns.
        Handles nested RECORDs (RECORD within RECORD) up to max_depth to prevent infinite recursion.
        For flat messages where schemaFields children are top-level JSON keys, unpacking produces correct columns.
        For nested messages, unpacked child names won't match top-level JSON keys and will yield None values.

        Column names use dotted path notation (parent.child.field) to uniquely identify each leaf
        and avoid collisions when multiple RECORD branches have fields with the same name.
        """
        current_name = f"{parent_name}.{field.name.root}" if parent_name else field.name.root

        if depth > max_depth:
            logger.warning(f"RECORD nesting exceeded max_depth {max_depth}; stopping recursion at field {current_name}")
            return [SQALikeColumn(current_name, cast("DataType", field.dataType))]

        if field.dataType == DataTypeTopic.RECORD and field.children:
            result = []
            for child in field.children:
                result.extend(
                    self._flatten_field(child, depth=depth + 1, max_depth=max_depth, parent_name=current_name)
                )
            return result
        return [SQALikeColumn(current_name, cast("DataType", field.dataType))]

    @abstractmethod
    def _fetch_messages(self, count: int) -> list[dict]:
        """
        Fetch up to `count` messages from the topic.
        Returns a list of dicts mapping field name to value.
        """

    @staticmethod
    def _walk(msg: dict, dotted: str) -> object:
        """Walk a dotted path into nested dicts, returning MISSING when absent.

        Schema paths interleave record *type* names with field names: the avro
        parser emits ``Order.shipping.Address.city`` for a wire message shaped
        ``{"shipping": {"city": ...}}``, naming the record type at every RECORD
        level. Only the field names reach the wire, so a segment the current
        object does not carry is a type name and is skipped.

        The leaf is exempt from that skip. A missing leaf is a genuine miss, and
        letting it through would resolve the column to its own container.
        """
        cur: object = msg
        parts = dotted.split(".")
        for index, part in enumerate(parts):
            if not isinstance(cur, dict):
                return MISSING
            if part in cur:
                cur = cur[part]
            elif index == len(parts) - 1:
                return MISSING
        return cur

    @staticmethod
    def _resolve(msg: dict, dotted: str) -> object:
        """Resolve a column path against a message, tolerating schema type names.

        Column paths carry the schema's record type names because that is what
        the auto-classification processor matches on, while the message on the
        wire carries only field names. Consuming a segment whenever the message
        does have it keeps a genuinely wrapped message winning over a same-named
        sibling, and keeps a field explicitly set to null on its own value
        instead of inheriting one.
        """
        value = MessagingSampler._walk(msg, dotted)
        return None if value is MISSING else value

    def fetch_sample_data(self, columns: list[SQALikeColumn] | None) -> TableData:
        column_objs = columns or self.get_columns()
        column_names = [col.name for col in column_objs]
        if not column_names:
            return TableData(rows=[], columns=[])
        messages = self._fetch_messages(self.sample_limit)
        rows = [[self._resolve(msg, col_name) for col_name in column_names] for msg in messages]
        column_name_objs = [ColumnName(col_name) for col_name in column_names]
        return TableData(columns=column_name_objs, rows=rows)

    def close(self):
        """Nothing to close for messaging samplers by default."""
