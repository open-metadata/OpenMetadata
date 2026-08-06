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
Dataset resolution for the Snowflake Sink connector (managed and self-managed).
"""

import re
from typing import Any, Dict, List, Optional  # noqa: UP035

from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectDatasetDetails,
    KafkaConnectTopics,
)
from metadata.ingestion.source.pipeline.kafkaconnect.sinks.base import (
    SinkDatasetResolver,
    sink_resolver_registry,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Snowflake unquoted identifiers: letter or underscore first, then alphanumerics, _ or $.
VALID_SNOWFLAKE_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")


def java_string_hashcode(value: str) -> int:
    """
    Reimplement Java's String.hashCode().

    The Snowflake Kafka connector appends abs(topic.hashCode()) to tables whose
    topic name is not a legal identifier, so reproducing the exact Java semantics
    -- including 32-bit signed overflow -- is what makes the target table name
    computable instead of guessable.
    """
    result = 0
    for char in value:
        result = (31 * result + ord(char)) & 0xFFFFFFFF
    if result >= 2**31:
        result -= 2**32
    return result


def snowflake_table_name(topic: str) -> str:
    """
    Derive the Snowflake table a topic lands in when no topic2table.map entry applies.
    """
    if VALID_SNOWFLAKE_IDENTIFIER.match(topic):
        return topic.upper()

    sanitized = "".join(char if (char.isascii() and char.isalnum()) or char in "_$" else "_" for char in topic)
    if not re.match(r"^[A-Za-z_]", sanitized):
        sanitized = f"_{sanitized}"
    return f"{sanitized.upper()}_{abs(java_string_hashcode(topic))}"


class SnowflakeSinkResolver(SinkDatasetResolver):
    """
    Resolve the Snowflake tables a sink connector writes to.

    The connector defaults to one table per topic and only deviates where
    topic2table.map says so, which is why the generic key-list strategy finds
    nothing: there is no config key naming the table at all in the common case.
    """

    def resolve_datasets(
        self,
        config: dict,
        topics: Optional[List[KafkaConnectTopics]] = None,  # noqa: UP006, UP045
    ) -> List[KafkaConnectDatasetDetails]:  # noqa: UP006
        database = config.get("snowflake.database.name")
        schema = config.get("snowflake.schema.name")
        mapping = self._topic2table_map(config)

        datasets = [
            KafkaConnectDatasetDetails(
                table=mapping.get(topic) or snowflake_table_name(topic),
                database=database,
                schema=schema,
                source_topic=topic,
                fully_qualified=bool(database and schema),
            )
            for topic in self._topic_names(config, topics)
        ]

        if not datasets:
            logger.warning(f"Snowflake sink '{config.get('name')}' declares no topics; no lineage can be built")
        return datasets

    def match_topic(self, dataset: KafkaConnectDatasetDetails, topic_entity_map: dict, config: dict) -> Optional[Any]:  # noqa: UP045
        if not dataset.source_topic:
            return None
        topic_entity = topic_entity_map.get(dataset.source_topic)
        if topic_entity is None:
            logger.warning(
                f"Topic '{dataset.source_topic}' feeding Snowflake table "
                f"'{dataset.table}' was not found in OpenMetadata"
            )
        return topic_entity

    @staticmethod
    def _topic2table_map(config: dict) -> Dict[str, str]:  # noqa: UP006
        mapping = {}
        for pair in (config.get("snowflake.topic2table.map") or "").split(","):
            if ":" not in pair:
                continue
            topic, table = pair.split(":", 1)
            if topic.strip() and table.strip():
                mapping[topic.strip()] = table.strip()
        return mapping

    @staticmethod
    def _topic_names(config: dict, topics: Optional[List[KafkaConnectTopics]]) -> List[str]:  # noqa: UP006, UP045
        names = [str(topic.name) for topic in topics or [] if topic.name]
        if names:
            return names
        return [name.strip() for name in (config.get("topics") or "").split(",") if name.strip()]


@sink_resolver_registry.add("SnowflakeSink")  # Confluent Cloud managed plugin name
@sink_resolver_registry.add("SnowflakeSinkConnector")  # self-managed Java class
def _snowflake_sink_resolver() -> SnowflakeSinkResolver:
    return SnowflakeSinkResolver()
