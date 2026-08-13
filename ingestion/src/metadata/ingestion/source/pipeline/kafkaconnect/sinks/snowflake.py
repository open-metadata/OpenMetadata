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

from metadata.generated.schema.type.schema import DataTypeTopic
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.pipeline.kafkaconnect.constants import ConnectorConfigKeys
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectColumnMapping,
    KafkaConnectDatasetDetails,
    KafkaConnectTopics,
)
from metadata.ingestion.source.pipeline.kafkaconnect.sinks.base import (
    DefaultResolver,
    SinkDatasetResolver,
    sink_resolver_registry,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# The connector's own isValidSnowflakeObjectIdentifier, reproduced character for character:
# ^([_a-zA-Z]{1}[_$a-zA-Z0-9]+)$. The trailing + rather than * is deliberate -- it makes a
# one-character topic invalid upstream, so it takes the sanitise-and-hash path here too.
VALID_SNOWFLAKE_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]+$")


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


def snowflake_mapped_table_name(table: str) -> str:
    """
    Fold a topic2table.map value the way Snowflake stores it.

    The connector puts the configured value straight into CREATE TABLE. Unquoted, Snowflake
    uppercases it, so `order_events:orders` lands in ORDERS and is ingested into
    OpenMetadata as ORDERS -- while the derived branch of the same expression already
    uppercases. Leaving the two to fold differently would hand Priority 1 an exact FQN that
    misses, on the path this resolver exists to make deterministic. A double-quoted value is
    the one way to keep case, and the quotes are delimiters rather than part of the name.
    """
    if len(table) > 1 and table.startswith('"') and table.endswith('"'):
        return table[1:-1]
    return table.upper()


class SnowflakeSinkResolver(SinkDatasetResolver):
    """
    Resolve the Snowflake tables a sink connector writes to.

    The connector defaults to one table per topic and only deviates where
    topic2table.map says so, which is why the generic key-list strategy finds
    nothing: there is no config key naming the table at all in the common case.

    Registering a resolver makes the key-list path unreachable for this connector
    class, so everything the key-list path could answer must still be answered
    here -- hence the key variations and the fallbacks below.
    """

    def resolve_datasets(
        self,
        config: dict,
        topics: Optional[List[KafkaConnectTopics]] = None,  # noqa: UP006, UP045
    ) -> List[KafkaConnectDatasetDetails]:  # noqa: UP006
        topic_names = self._topic_names(config, topics)
        mapping = self._topic2table_map(config)
        if not topic_names and not mapping:
            # A connector can subscribe by topics.regex, and get_connector_topics answers
            # None on any transport failure, so an empty topic list is not proof that the
            # connector writes nothing. With nothing left naming a topic, defer: that keeps
            # self-managed sinks at the lineage they had before this resolver existed.
            logger.info(
                f"Snowflake sink '{config.get('name')}' declares no topics; "
                f"resolving its target from the connector config keys instead"
            )
            datasets = DefaultResolver().resolve_datasets(config, topics)
            if not datasets:
                logger.warning(f"Snowflake sink '{config.get('name')}' declares no topics; no lineage can be built")
            return datasets

        database = self._first_configured(config, ConnectorConfigKeys.SNOWFLAKE_DATABASE_KEYS)
        schema = self._first_configured(config, ConnectorConfigKeys.SNOWFLAKE_SCHEMA_KEYS)
        self._warn_on_partial_qualification(config, database, schema)

        return [
            KafkaConnectDatasetDetails(
                table=(
                    snowflake_mapped_table_name(mapping[topic]) if topic in mapping else snowflake_table_name(topic)
                ),
                database=database,
                schema=schema,
                source_topic=topic,
                # fully_qualified decides which FQN slot `database` fills, and a Snowflake sink's
                # database is always a real database -- never a Debezium-style logical server
                # name. Requiring `schema` too would push a lone database into the schema slot
                # and build an FQN that can never match the table.
                fully_qualified=bool(database),
            )
            for topic in self._with_mapped_topics(config, topic_names, mapping)
        ]

    def match_topic(self, dataset: KafkaConnectDatasetDetails, topic_entity_map: dict, config: dict) -> Optional[Any]:  # noqa: UP045
        if not dataset.source_topic:
            # Datasets from the resolve_datasets fallback above carry no originating topic,
            # so the generic name-based match is the only one left that can pair them.
            return DefaultResolver().match_topic(dataset, topic_entity_map, config)
        topic_entity = topic_entity_map.get(dataset.source_topic)
        if topic_entity is None:
            logger.warning(
                f"Topic '{dataset.source_topic}' feeding Snowflake table "
                f"'{dataset.table}' was not found in OpenMetadata"
            )
        return topic_entity

    def column_mappings(self, config: dict, topic_entity: Any) -> List[KafkaConnectColumnMapping]:  # noqa: UP006
        """
        Map topic fields to columns when a Flatten SMT rewrites nested paths.

        Without Flatten the connector writes one column per top-level field and a nested
        record becomes a single VARIANT, which the caller's 1:1 name inference already
        handles -- so returning [] here is the correct answer, not a gap.
        """
        delimiter = self._flatten_delimiter(config)
        if delimiter is None:
            return []

        return [
            KafkaConnectColumnMapping(
                # The dotted path, not the bare leaf name: sibling records routinely reuse
                # leaf names (shipping.city and billing.city), and a bare "city" cannot tell
                # the resolver's consumer which of the two is the upstream of which column.
                source_column=".".join(path),
                target_column=delimiter.join(path).upper(),
            )
            for path in self._leaf_paths(topic_entity)
        ]

    @staticmethod
    def _flatten_delimiter(config: dict) -> Optional[str]:  # noqa: UP045
        """
        The delimiter of the chain's Flatten transform, or None when it has none.

        Only a transform's own `type` may be consulted: Confluent Cloud omits defaulted
        properties from the config it returns, so the absence of
        snowflake.enable.schematization or snowflake.ingestion.method says nothing about
        whether flattening happens.
        """
        for name in (entry.strip() for entry in (config.get("transforms") or "").split(",")):
            if name and "Flatten" in (config.get(f"transforms.{name}.type") or ""):
                return config.get(f"transforms.{name}.delimiter") or "."
        return None

    @staticmethod
    def _leaf_paths(topic_entity: Any) -> List[List[str]]:  # noqa: UP006
        """
        Field-name paths to every leaf of the topic schema, with Avro type levels dropped.

        The Avro parser names the level below a record-typed field after the record *type*
        rather than the field, so `address` (RECORD) holds a single child `Address` whose
        children are street/city/zipcode. Flatten joins field names only, so each type
        level is stepped over instead of becoming a path segment. The schemaFields roots
        are themselves type levels (the top-level record name), hence their children --
        not the roots -- are the top-level fields.
        """
        schema = getattr(topic_entity, "messageSchema", None)
        roots = getattr(schema, "schemaFields", None) or []

        paths: List[List[str]] = []  # noqa: UP006

        def walk(field: Any, prefix: List[str]) -> None:  # noqa: UP006
            path = [*prefix, model_str(field.name)]
            # Flatten recurses into STRUCT only. An array is copied through whole, so an
            # array of records is one VARIANT column named after the array field -- descending
            # into it would invent columns that do not exist and, worse, suppress the real
            # one, since a non-empty mapping list turns off 1:1 inference for every column.
            # MAP needs no such guard: the parser already gives it no children.
            if field.dataType is DataTypeTopic.ARRAY:
                paths.append(path)
                return
            type_levels = field.children or []
            if not type_levels:
                paths.append(path)
                return
            for type_level in type_levels:
                for nested_field in type_level.children or []:
                    walk(nested_field, path)

        for root in roots:
            for field in root.children or []:
                walk(field, [])
        return paths

    @staticmethod
    def _warn_on_partial_qualification(config: dict, database: Optional[str], schema: Optional[str]) -> None:  # noqa: UP045
        """
        Report a config that names a database but no schema, or the reverse.

        The connector itself requires both, so one of them missing is a misconfiguration
        upstream; naming the absent key turns an otherwise silent table-not-found into
        something a support engineer can act on.
        """
        if bool(database) == bool(schema):
            return
        if database:
            present, missing = f"database '{database}'", ConnectorConfigKeys.SNOWFLAKE_SCHEMA_KEYS[0]
        else:
            present, missing = f"schema '{schema}'", ConnectorConfigKeys.SNOWFLAKE_DATABASE_KEYS[0]
        logger.warning(
            f"Snowflake sink '{config.get('name')}' declares a {present} but no '{missing}'; "
            f"its tables cannot be addressed by a full FQN and lineage may be missed"
        )

    @staticmethod
    def _with_mapped_topics(config: dict, topic_names: List[str], mapping: Dict[str, str]) -> List[str]:  # noqa: UP006
        """
        `topic_names` plus any topic that only topic2table.map knows about.

        A topics.regex subscription whose concrete topics were not all discovered leaves the
        rest named solely in the map -- explicit user configuration pairing a topic with a
        table, so dropping it loses lineage the config plainly asked for. Discovered topics
        keep their position; recovered ones are appended. `topic_names` may be empty, which
        is that same subscription with nothing discovered at all.
        """
        discovered = set(topic_names)
        mapped_only = [topic for topic in mapping if topic not in discovered]
        if mapped_only:
            logger.info(
                f"Snowflake sink '{config.get('name')}' maps topic(s) missing from its topic list "
                f"({', '.join(mapped_only)}); building their datasets from snowflake.topic2table.map"
            )
        return [*topic_names, *mapped_only]

    @staticmethod
    def _first_configured(config: dict, keys: List[str]) -> Optional[str]:  # noqa: UP006, UP045
        """The value of the first of `keys` the connector actually set."""
        for key in keys:
            value = config.get(key)
            if value:
                return value
        return None

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
