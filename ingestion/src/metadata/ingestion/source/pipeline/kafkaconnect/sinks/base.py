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
Per-connector-class resolution of the dataset a Kafka Connect sink writes to.

Sink connectors describe their target in mutually incompatible ways: JDBC uses
table.name.format, S3 uses a bucket plus prefix, Snowflake derives the table from
the topic name unless topic2table.map overrides it. This registry keeps each of
those descriptions with the connector that owns it instead of accumulating them
as branches in the shared lineage path.
"""

from abc import ABC, abstractmethod
from typing import Any, List, Optional  # noqa: UP035

from metadata.ingestion.source.pipeline.kafkaconnect.constants import SUPPORTED_DATASETS
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectColumnMapping,
    KafkaConnectDatasetDetails,
    KafkaConnectTopics,
)
from metadata.utils.dispatch import enum_register
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

sink_resolver_registry = enum_register()


class SinkDatasetResolver(ABC):
    """Strategy for turning a sink connector's config into target datasets."""

    @abstractmethod
    def resolve_datasets(
        self,
        config: dict,
        topics: Optional[List[KafkaConnectTopics]],  # noqa: UP006, UP045
    ) -> List[KafkaConnectDatasetDetails]:  # noqa: UP006
        """Return one dataset per target this connector writes to."""

    @abstractmethod
    def match_topic(self, dataset: KafkaConnectDatasetDetails, topic_entity_map: dict, config: dict) -> Optional[Any]:  # noqa: UP045
        """Return the Topic entity feeding this dataset, or None."""

    def column_mappings(self, config: dict, topic_entity: Any) -> List[KafkaConnectColumnMapping]:  # noqa: UP006
        """
        Explicit source-field -> target-column mappings.

        Empty means "infer 1:1 by name", which is correct whenever the connector
        writes one column per top-level field without renaming.
        """
        return []

    def topic_patterns(self, config: dict) -> List[str]:  # noqa: UP006
        """Topic selectors that must be expanded against the messaging service."""
        return []


def get_resolver(connector_class: str) -> SinkDatasetResolver:
    """
    Pick the resolver for a connector class.

    Confluent Cloud reports the short plugin name ("SnowflakeSink") while
    self-managed Connect reports a Java FQCN, so both reduce to the last
    dot-separated segment before lookup.
    """
    key = (connector_class or "").split(".")[-1]
    factory = sink_resolver_registry.registry.get(key)
    if factory is None:
        return DefaultResolver()
    return factory()


class DefaultResolver(SinkDatasetResolver):
    """
    The historical key-list behaviour, unchanged.

    Applies to every connector class without a dedicated resolver.
    """

    def resolve_datasets(  # noqa: C901
        self,
        config: dict,
        topics: Optional[List[KafkaConnectTopics]] = None,  # noqa: UP006, UP045
    ) -> List[KafkaConnectDatasetDetails]:  # noqa: UP006
        datasets_to_process = []
        found_values = {}

        for dataset_type, key_categories in SUPPORTED_DATASETS.items():
            for key in key_categories.get("single", []):
                if key in config:
                    found_values[dataset_type] = [config[key]]
                    logger.debug(f"Found single value for {dataset_type} from key '{key}'")
                    break

            if dataset_type not in found_values:
                for key in key_categories.get("list", []):
                    if key in config:
                        value = config[key]
                        found_values[dataset_type] = [v.strip() for v in value.split(",") if v.strip()]
                        logger.debug(
                            f"Found list values for {dataset_type} from key '{key}': "
                            f"{len(found_values[dataset_type])} items"
                        )
                        break

            if dataset_type not in found_values:
                for key in key_categories.get("mapping", []):
                    if key in config:
                        value = config[key]
                        mappings = [m.strip() for m in value.split(",")]
                        found_values[dataset_type] = [m.split(":")[-1].strip() for m in mappings if ":" in m]
                        logger.debug(
                            f"Found mapping values for {dataset_type} from key '{key}': "
                            f"{len(found_values[dataset_type])} items"
                        )
                        break

        if not found_values:
            return []

        max_count = max(len(values) for values in found_values.values())
        for i in range(max_count):
            result = {}
            for dataset_type, values in found_values.items():
                idx = min(i, len(values) - 1)
                value = values[idx]

                if dataset_type == "table" and "." in value and "schema" not in result:
                    parts = value.rsplit(".", 1)
                    if len(parts) == 2:
                        result["schema"] = parts[0]
                        result["table"] = parts[1]
                        logger.debug(f"Parsed schema-qualified table: schema='{parts[0]}', table='{parts[1]}'")
                        continue

                result[dataset_type] = value

            if result.get("table") or result.get("container_name"):
                datasets_to_process.append(KafkaConnectDatasetDetails(**result))

        return datasets_to_process

    def match_topic(self, dataset: KafkaConnectDatasetDetails, topic_entity_map: dict, config: dict) -> Optional[Any]:  # noqa: UP045
        if not dataset.table:
            return None

        if dataset.table in topic_entity_map:
            logger.info(f"Matched sink dataset table '{dataset.table}' to topic '{dataset.table}' (exact match)")
            return topic_entity_map[dataset.table]

        pattern = None
        for key in ("collection.name.format", "table.name.format"):
            if key in config:
                pattern = config[key]
                logger.debug(f"Found naming format using key '{key}': {pattern}")
                break

        if not pattern:
            pattern = "${topic}"
            logger.warning("No naming format key found. Defaulting to '${topic}'.")

        for topic_name, topic_entity in topic_entity_map.items():
            sanitized_topic = topic_name.replace(".", "_")
            resolved_table = pattern.replace("${topic}", sanitized_topic).lower()
            if resolved_table == dataset.table.lower():
                logger.info(f"Matched sink dataset table '{dataset.table}' to topic '{topic_name}' (case-insensitive)")
                return topic_entity

        logger.warning(f"No matching topic found for sink dataset table '{dataset.table}'")
        return None
