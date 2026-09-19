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
from dataclasses import dataclass
from typing import Any, List, Optional  # noqa: UP035

from metadata.generated.schema.type.schema import DataTypeTopic, SchemaType
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
CURRENT_SELF_MANAGED_CLASS = "SnowflakeStreamingSinkConnector"
# Dots are valid and common in literal Kafka topic names. Other regex operators are
# unambiguous selectors and must never be emitted as if they were concrete topics.
# This split governs *discovery* only -- which topics we go looking for. Resolution
# compiles every key, exactly as the connector does.
REGEX_META_CHARACTERS = frozenset("*+?[](){}|^$\\")
# How every parser renders an array in dataTypeDisplay ("ARRAY<record>",
# "UNION<null,ARRAY<record>>"), which is where a nullable array's arrayness survives.
ARRAY_TYPE_DISPLAY = "ARRAY<"


@dataclass(frozen=True)
class TopicTableMapping:
    """One parsed Snowflake topic-to-table selector."""

    topic_pattern: str
    table_template: str
    preserve_table_case: bool

    @property
    def is_regex(self) -> bool:
        """
        Whether this key selects topics, rather than naming one.

        A discovery-time question only: can this key be treated as a concrete topic name to
        go and fetch? The connector never subscribes by this map -- it consumes what `topics`
        / `topics.regex` name -- so a key with operators in it names no topic we could look
        up. Resolution deliberately does not consult this: there, every key is a pattern.
        """
        return any(char in REGEX_META_CHARACTERS for char in self.topic_pattern)


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


def snowflake_table_name(topic: str, sanitize: bool = True) -> str:
    """
    Derive the Snowflake table a topic lands in when no topic2table.map entry applies.

    Transliterated from the connector's Utils.deriveTableName, statement for statement,
    because every deviation is a table name that silently does not exist:

    - the hash is taken from the *original* topic, before the ".*" strip below;
    - literal ".*" sequences are dropped ("remove wildcard regex from topic name"),
      which is not the same as sanitising them to underscores;
    - an invalid first character emits a placeholder without consuming the character,
      so it is *also* sanitised by the loop -- "-orders" becomes "__ORDERS_<hash>",
      with two underscores, not one.
    """
    if not sanitize:
        return topic
    if VALID_SNOWFLAKE_IDENTIFIER.match(topic):
        return topic.upper()

    hashed = abs(java_string_hashcode(topic))
    stripped = topic.replace(".*", "")
    if not stripped:
        # Upstream indexes position 0 unconditionally here and throws on a topic that is
        # nothing but wildcards; there is no table name to predict, so say so rather than
        # inventing one that cannot exist.
        logger.warning(f"Topic '{topic}' leaves no derivable Snowflake table name; skipping its lineage")
        return ""

    if re.match(r"[_a-zA-Z]", stripped[0]):
        result, index = [stripped[0]], 1
    else:
        # Upstream appends the placeholder without advancing its index, so the offending
        # character is then sanitised again by the loop below. Keep both underscores.
        result, index = ["_"], 0
    result.extend(char if re.match(r"[_$a-zA-Z0-9]", char) else "_" for char in stripped[index:])
    return f"{''.join(result).upper()}_{hashed}"


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
        mappings = self._topic2table_mappings(config)
        if mappings is None:
            # The map is one the connector would refuse to start on, so the sink it describes
            # is not running. Deriving names from the topics anyway would invent lineage.
            return []
        if not topic_names and not mappings:
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

        datasets = []
        for topic in self._with_mapped_topics(config, topic_names, mappings):
            mapping_applies, mapped_table = self._mapped_table(topic, mappings, config)
            if mapping_applies and mapped_table is None:
                continue
            datasets.append(
                KafkaConnectDatasetDetails(
                    table=(
                        mapped_table
                        if mapping_applies
                        else snowflake_table_name(topic, self._sanitize_generated_names(config))
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
            )
        return datasets

    def topic_patterns(self, config: dict) -> List[str]:  # noqa: UP006
        # A metachar-free key names one topic, so escaping it keeps discovery exact.
        # Compiled raw, its dots turn into wildcards and `prod.orders` claims a real
        # `prodXorders`, minting lineage for a topic this connector never consumes.
        # Escaping rather than dropping matters: discovery is what resolves the topic
        # *entity*, which the name-only recovery in `_with_mapped_topics` cannot do.
        return [
            mapping.topic_pattern if mapping.is_regex else re.escape(mapping.topic_pattern)
            for mapping in self._topic2table_mappings(config) or []
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
                target_column=self._target_column_name(delimiter.join(path), config),
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
            transform_type = config.get(f"transforms.{name}.type") or ""
            if name and transform_type.endswith("Flatten$Value"):
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
        schema_type = getattr(schema, "schemaType", None)

        paths: List[List[str]] = []  # noqa: UP006

        def walk(field: Any, prefix: List[str]) -> None:  # noqa: UP006
            path = [*prefix, model_str(field.name)]
            # Flatten recurses into STRUCT only. An array is copied through whole, so an
            # array of records is one VARIANT column named after the array field -- descending
            # into it would invent columns that do not exist and, worse, suppress the real
            # one, since a non-empty mapping list turns off 1:1 inference for every column.
            # dataType alone is not enough: an optional array (["null", {"type": "array"}])
            # parses as UNION carrying the item record as its child, so the display type --
            # the only place the array survives in that shape -- has to be consulted too.
            # MAP needs no such guard: the parser already gives it no children.
            if field.dataType is DataTypeTopic.ARRAY or ARRAY_TYPE_DISPLAY in (field.dataTypeDisplay or ""):
                paths.append(path)
                return
            children = field.children or []
            if not children:
                paths.append(path)
                return
            if schema_type == SchemaType.Avro:
                nested_fields = [nested for type_level in children for nested in type_level.children or []]
                # Some Avro producers omit the named-record wrapper. Keeping the direct
                # children in that shape prevents a valid struct from disappearing.
                if not nested_fields:
                    nested_fields = children
            else:
                nested_fields = children
            for nested_field in nested_fields:
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
    def _with_mapped_topics(config: dict, topic_names: list[str], mappings: list[TopicTableMapping]) -> List[str]:  # noqa: UP006
        """
        `topic_names` plus any topic that only topic2table.map knows about.

        A topics.regex subscription whose concrete topics were not all discovered leaves the
        rest named solely in the map -- explicit user configuration pairing a topic with a
        table, so dropping it loses lineage the config plainly asked for. Discovered topics
        keep their position; recovered ones are appended. `topic_names` may be empty, which
        is that same subscription with nothing discovered at all.
        """
        discovered = set(topic_names)
        mapped_only = [
            mapping.topic_pattern
            for mapping in mappings
            if mapping.topic_pattern not in discovered and not mapping.is_regex
        ]
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
    def _topic2table_mappings(config: dict) -> Optional[List[TopicTableMapping]]:  # noqa: UP006, UP045
        """
        The parsed map, or None when it is one the connector would reject.

        The two are not the same answer: a map that parses to nothing -- absent, empty, or
        only whitespace -- means every topic derives its own name, exactly as with no map at
        all. Conflating that with a rejected map costs a working sink all of its lineage.
        """
        raw_mapping = config.get("snowflake.topic2table.map") or ""
        if not raw_mapping:
            return []
        try:
            mappings = SnowflakeSinkResolver._parse_topic2table_mappings(raw_mapping)
        except ValueError as exc:
            logger.warning(f"Ignoring invalid snowflake.topic2table.map for sink '{config.get('name')}': {exc}")
            return None
        else:
            return mappings

    @staticmethod
    def _parse_topic2table_mappings(raw_mapping: str) -> List[TopicTableMapping]:  # noqa: UP006
        """
        Transliteration of TopicToTableParser.parseAndValidate.

        Tokenising rather than splitting on separators is what makes `"topic:one":"table,one"`
        parse: inside quotes the delimiters are ordinary characters. The overlap rule is the
        connector's own -- it refuses to start on a map where one key's regex would also
        select another key -- so a running connector can never present an ambiguous map, and
        the first-match-wins resolution below is deterministic rather than merely arbitrary.
        """
        entries = SnowflakeSinkResolver._parse_entries(raw_mapping)
        seen: List[str] = []  # noqa: UP006
        for entry in entries:
            # Upstream only compiles a key when something first matches against it, so a lone
            # unparseable pattern surfaces as a task failure rather than a config error. Same
            # outcome, reported earlier: a key that cannot compile predicts no table at all,
            # and deriving one from the topic name instead would be a confident wrong answer.
            try:
                re.compile(entry.topic_pattern)
            except re.error as exc:
                raise ValueError(f"invalid topic selector {entry.topic_pattern!r}: {exc}") from exc
            if entry.topic_pattern in seen:
                raise ValueError(f"Duplicate topic: {entry.topic_pattern}")
            for previous in seen:
                if SnowflakeSinkResolver._full_match(entry.topic_pattern, previous) or (
                    SnowflakeSinkResolver._full_match(previous, entry.topic_pattern)
                ):
                    raise ValueError(
                        f"Topic regexes cannot overlap. Overlapping regexes: {previous}, {entry.topic_pattern}"
                    )
            seen.append(entry.topic_pattern)
        return entries

    @staticmethod
    def _parse_entries(raw_mapping: str) -> List[TopicTableMapping]:  # noqa: UP006
        """Transliteration of TopicToTableParser.parseEntries."""
        entries = []
        index = 0
        while True:
            index = SnowflakeSinkResolver._skip_whitespace(raw_mapping, index)
            if index >= len(raw_mapping):
                return entries
            topic, _, index = SnowflakeSinkResolver._parse_token(raw_mapping, index)
            index = SnowflakeSinkResolver._skip_whitespace(raw_mapping, index)
            index = SnowflakeSinkResolver._expect(raw_mapping, index, ":")
            index = SnowflakeSinkResolver._skip_whitespace(raw_mapping, index)
            table, table_quoted, index = SnowflakeSinkResolver._parse_token(raw_mapping, index)
            # Only the table token drives case folding; quotes around a topic are discarded.
            entries.append(TopicTableMapping(SnowflakeSinkResolver._to_python_regex(topic), table, table_quoted))
            index = SnowflakeSinkResolver._skip_whitespace(raw_mapping, index)
            if index >= len(raw_mapping):
                return entries
            index = SnowflakeSinkResolver._expect(raw_mapping, index, ",")

    @staticmethod
    def _skip_whitespace(raw_mapping: str, position: int) -> int:
        while position < len(raw_mapping) and raw_mapping[position].isspace():
            position += 1
        return position

    @staticmethod
    def _parse_token(raw_mapping: str, position: int) -> tuple[str, bool, int]:
        """One quoted or unquoted token, plus whether it was quoted and where it ended."""
        if position >= len(raw_mapping):
            raise ValueError(f"Expected token, found end of input at position {position}")
        if raw_mapping[position] != '"':
            start = position
            while position < len(raw_mapping) and not (
                raw_mapping[position].isspace() or raw_mapping[position] in ':,"'
            ):
                position += 1
            if position == start:
                raise ValueError(f"Expected token at position {position}")
            return raw_mapping[start:position], False, position
        position += 1
        start = position
        while position < len(raw_mapping) and raw_mapping[position] != '"':
            position += 1
        if position >= len(raw_mapping):
            raise ValueError(f"Unterminated quoted token at position {position}")
        if position == start:
            raise ValueError(f"Empty quoted token at position {position}")
        return raw_mapping[start:position], True, position + 1

    @staticmethod
    def _expect(raw_mapping: str, position: int, character: str) -> int:
        if position >= len(raw_mapping) or raw_mapping[position] != character:
            raise ValueError(f"Expected '{character}' at position {position}: {raw_mapping!r}")
        return position + 1

    @staticmethod
    def _to_python_regex(pattern: str) -> str:
        """
        Spell a Java named group the way `re` does.

        The connector compiles these with java.util.regex, where a named group is `(?<env>x)`;
        Python spells the same thing `(?P<env>x)` and raises on the Java form -- which would
        reject the whole map and lose every mapping in it. Lookbehind (`(?<=`, `(?<!`) is
        spelled identically in both and must survive untouched. Java-only constructs beyond
        this (possessive quantifiers, `\\p{...}`) still fail to compile, which is the safe
        direction: no predicted table beats a wrong one.
        """
        return re.sub(r"\(\?<(?![=!])", "(?P<", pattern)

    @staticmethod
    def _full_match(pattern: str, value: str) -> bool:
        """Java's String.matches: a full match, and an unusable pattern is a config error."""
        try:
            return re.fullmatch(pattern, value) is not None
        except re.error as exc:
            raise ValueError(f"invalid topic selector {pattern!r}: {exc}") from exc

    @staticmethod
    def _mapped_table(topic: str, mappings: list[TopicTableMapping], config: dict) -> tuple[bool, Optional[str]]:  # noqa: UP045
        """
        The table this map sends `topic` to, mirroring whichever resolver the connector builds.

        With `snowflake.topic2table.map.regex.replacement` off (the default, and the only
        behaviour before connector 4.1.0) this is StaticTopicToTableResolver: exact key first,
        then *every* key retried as a regex in declaration order -- literal-looking keys
        included, since the connector compiles them all. With it on it is
        RegexTopicToTableResolver, which has no exact-match stage at all and expands group
        references into the template.
        """
        if SnowflakeSinkResolver._config_bool(config, "snowflake.topic2table.map.regex.replacement", default=False):
            return SnowflakeSinkResolver._resolve_with_replacement(topic, mappings)
        return SnowflakeSinkResolver._resolve_static(topic, mappings)

    @staticmethod
    def _resolve_static(topic: str, mappings: list[TopicTableMapping]) -> tuple[bool, Optional[str]]:  # noqa: UP045
        """Transliteration of StaticTopicToTableResolver.resolve -- no group substitution."""
        mapping = next((entry for entry in mappings if entry.topic_pattern == topic), None)
        if mapping is None:
            mapping = next(
                (entry for entry in mappings if SnowflakeSinkResolver._safe_full_match(entry.topic_pattern, topic)),
                None,
            )
        if mapping is None:
            return False, None
        return True, SnowflakeSinkResolver._fold(mapping.table_template, mapping)

    @staticmethod
    def _resolve_with_replacement(topic: str, mappings: list[TopicTableMapping]) -> tuple[bool, Optional[str]]:  # noqa: UP045
        """Transliteration of RegexTopicToTableResolver.resolve -- declaration order, then expand."""
        for mapping in mappings:
            try:
                match = re.fullmatch(mapping.topic_pattern, topic)
            except re.error as exc:
                logger.warning(f"Ignoring invalid topic2table regex '{mapping.topic_pattern}': {exc}")
                continue
            if not match:
                continue
            # Java's Matcher.replaceFirst template syntax: $1 numbered, ${name} named.
            replacement = re.sub(r"\$\{([^}]+)\}", r"\\g<\1>", mapping.table_template)
            replacement = re.sub(r"\$(\d+)", r"\\g<\1>", replacement)
            try:
                expanded = match.expand(replacement)
            except (IndexError, re.error) as exc:
                logger.warning(
                    f"Unable to expand Snowflake table mapping '{mapping.table_template}' for topic '{topic}': {exc}"
                )
                return True, None
            # Upstream uppercases *after* substitution, so an unquoted template folds the
            # captured groups too.
            return True, SnowflakeSinkResolver._fold(expanded, mapping)
        return False, None

    @staticmethod
    def _safe_full_match(pattern: str, topic: str) -> bool:
        try:
            return re.fullmatch(pattern, topic) is not None
        except re.error as exc:
            logger.warning(f"Ignoring invalid topic2table regex '{pattern}': {exc}")
            return False

    @staticmethod
    def _fold(table: str, mapping: TopicTableMapping) -> str:
        """
        The connector puts the configured value straight into CREATE TABLE. Unquoted,
        Snowflake uppercases it, so `order_events:orders` lands in ORDERS -- matching how the
        derived branch folds. Leaving the two to fold differently would build an exact FQN
        that misses, on the path this resolver exists to make deterministic. Double quoting is
        the one way to keep case, and the parser has already dropped the quotes: they are
        delimiters, not part of the name.
        """
        return table if mapping.preserve_table_case else table.upper()

    @staticmethod
    def _config_bool(config: dict, key: str, default: bool) -> bool:
        value = config.get(key)
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() == "true"

    @staticmethod
    def _sanitize_generated_names(config: dict) -> bool:
        """
        Whether the connector sanitises the names it derives, per its own version's default.

        The compatibility switches only exist on the current streaming connector, where
        Constants.SNOWFLAKE_COMPATIBILITY_ENABLE_AUTOGENERATED_TABLE_NAME_SANITIZATION_DEFAULT
        is false; every earlier and managed connector sanitised unconditionally and has no
        flag to read. Reading the flag for those would answer for a version that never
        shipped it.
        """
        connector_class = (config.get("connector.class") or "").split(".")[-1]
        if connector_class != CURRENT_SELF_MANAGED_CLASS:
            return True
        return SnowflakeSinkResolver._config_bool(
            config,
            "snowflake.compatibility.enable.autogenerated.table.name.sanitization",
            default=False,
        )

    @staticmethod
    def _target_column_name(column: str, config: dict) -> str:
        connector_class = (config.get("connector.class") or "").split(".")[-1]
        default_normalization = connector_class != CURRENT_SELF_MANAGED_CLASS
        if SnowflakeSinkResolver._config_bool(
            config,
            "snowflake.compatibility.enable.column.identifier.normalization",
            default=default_normalization,
        ):
            return column.upper()
        return column

    @staticmethod
    def _topic_names(config: dict, topics: Optional[List[KafkaConnectTopics]]) -> List[str]:  # noqa: UP006, UP045
        names = [str(topic.name) for topic in topics or [] if topic.name]
        if names:
            return names
        return [name.strip() for name in (config.get("topics") or "").split(",") if name.strip()]


@sink_resolver_registry.add("SnowflakeSink")  # Confluent Cloud managed plugin name
@sink_resolver_registry.add("SnowflakeSinkConnector")  # self-managed Java class
@sink_resolver_registry.add("SnowflakeStreamingSinkConnector")  # current self-managed Java class
def _snowflake_sink_resolver() -> SnowflakeSinkResolver:
    return SnowflakeSinkResolver()
