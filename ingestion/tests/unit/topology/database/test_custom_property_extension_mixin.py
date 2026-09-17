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
Test the shared custom property extension mixin.

Covers the bounded registration cache and the name sanitizer directly, rather than through a
connector: Athena runs the table node multi threaded, so the cache is shared state.
"""

import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.type.customProperty import PropertyType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.custom_property_extension_mixin import (
    PROPERTY_NAME_MAX_LENGTH,
    CustomPropertyExtensionMixin,
)
from metadata.utils.lru_cache import LRUCache

SOURCE_LABEL = "test properties"


def _definition(name: str, value: str | tuple[str, str | None]) -> dict:
    """The server's shape for one custom property, from a bare data type or (data type, displayName)."""
    data_type, display_name = value if isinstance(value, tuple) else (value, None)
    return {"name": name, "propertyType": {"name": data_type}, "displayName": display_name}


def _disambiguated(base: str, raw: str) -> str:
    """A name the sanitizer had to rewrite carries a digest of the raw key, so two source keys
    that reduce to the same base stay distinct."""
    return f"{base}_{hashlib.md5(raw.encode('utf-8'), usedforsecurity=False).hexdigest()[:8]}"


class _FakeSource(CustomPropertyExtensionMixin):
    """Minimal host for the mixin: it only needs source_config and metadata."""

    def __init__(
        self,
        capacity: int | None = None,
        enabled: bool = True,
        existing: dict[str, str] | None = None,
    ):
        self.source_config = DatabaseServiceMetadataPipeline(includeCustomProperties=enabled)
        self.metadata = MagicMock()
        self.metadata.get_entity_custom_properties.return_value = [
            _definition(name, value) for name, value in (existing or {}).items()
        ]
        self._init_custom_properties()
        if capacity is not None:
            self._processed_prop = LRUCache(capacity)
        self._string_property_type_ref = PropertyType(
            EntityReference(id=UUID("00000000-0000-0000-0000-000000000001"), type="type")
        )


@pytest.fixture
def source():
    return _FakeSource()


class TestProcessedPropertyCacheIsBounded:
    """The cache must not grow with the catalog; a re-registration after eviction is only a
    redundant idempotent PUT."""

    def test_cache_does_not_grow_past_capacity(self):
        source = _FakeSource(capacity=3)

        source.build_entity_extension({f"key_{i}": "v" for i in range(50)}, source_label=SOURCE_LABEL)

        assert len(source._processed_prop) == 3

    def test_all_properties_are_returned_even_when_the_cache_evicts(self):
        """Eviction must not drop values from the extension payload."""
        source = _FakeSource(capacity=2)

        result = source.build_entity_extension({"a": "1", "b": "2", "c": "3", "d": "4"}, source_label=SOURCE_LABEL)

        assert result == {"a": "1", "b": "2", "c": "3", "d": "4"}

    def test_evicted_name_is_registered_again(self):
        source = _FakeSource(capacity=1)

        source.build_entity_extension({"first": "v"}, source_label=SOURCE_LABEL)
        source.build_entity_extension({"second": "v"}, source_label=SOURCE_LABEL)
        source.build_entity_extension({"first": "v"}, source_label=SOURCE_LABEL)

        # "first" was evicted by "second", so it is registered twice overall.
        registered = [
            call.args[0].createCustomPropertyRequest.name.root
            for call in source.metadata.create_or_update_custom_property.call_args_list
        ]
        assert registered == ["first", "second", "first"]

    def test_cached_name_is_not_registered_again(self):
        source = _FakeSource(capacity=10)

        source.build_entity_extension({"shared": "v"}, source_label=SOURCE_LABEL)
        source.build_entity_extension({"shared": "v"}, source_label=SOURCE_LABEL)

        assert source.metadata.create_or_update_custom_property.call_count == 1


class TestProcessedPropertyCacheConcurrency:
    """Athena sets threads=True on the databaseSchema node and the table node is its child, so
    build_entity_extension runs concurrently against one shared cache."""

    def test_concurrent_calls_do_not_raise(self):
        source = _FakeSource(capacity=4)
        properties = [{f"key_{i % 12}": "v", f"unique_{i}": "v"} for i in range(60)]

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda p: source.build_entity_extension(p, source_label=SOURCE_LABEL), properties))

        assert all(result is not None for result in results)
        assert len(source._processed_prop) <= 4

    def test_every_property_survives_concurrent_registration(self):
        source = _FakeSource(capacity=2)
        properties = [{f"key_{i}": str(i)} for i in range(40)]

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda p: source.build_entity_extension(p, source_label=SOURCE_LABEL), properties))

        assert results == [{f"key_{i}": str(i)} for i in range(40)]

    def test_eviction_between_the_membership_check_and_the_read_is_survivable(self):
        """A concurrent put can evict the name after `in` says it is present but before the
        collision check reads it. LRUCache.get raises KeyError in that window."""
        source = _FakeSource(capacity=4)
        source.build_entity_extension({"dup": "v"}, source_label=SOURCE_LABEL)
        real_contains = LRUCache.__contains__

        def evict_after_check(cache, key):
            present = real_contains(cache, key)
            cache.clear()  # stand in for another thread filling the cache past capacity
            return present

        with patch.object(LRUCache, "__contains__", evict_after_check):
            result = source.build_entity_extension({"dup": "v2"}, source_label=SOURCE_LABEL)

        assert result == {"dup": "v2"}


class TestValueFiltering:
    """Glue extras are not coerced by the model, so a parameter can arrive as a real falsy value."""

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            (0, "0"),
            (False, "False"),
            (0.0, "0.0"),
            ("0", "0"),
            (" ", " "),
            ("value", "value"),
        ],
    )
    def test_falsy_but_valid_values_are_kept(self, source, value, expected):
        assert source.build_entity_extension({"k": value}, source_label=SOURCE_LABEL) == {"k": expected}

    @pytest.mark.parametrize("value", [None, ""])
    def test_absent_and_empty_values_are_dropped(self, source, value):
        assert source.build_entity_extension({"k": value}, source_label=SOURCE_LABEL) is None
        assert source.metadata.create_or_update_custom_property.call_count == 0

    def test_absent_table_type_is_dropped_but_a_zero_sibling_is_kept(self, source):
        """The shape a non-Iceberg Glue table dumps: table_type=None alongside real parameters."""
        result = source.build_entity_extension({"table_type": None, "retention": 0}, source_label=SOURCE_LABEL)

        assert result == {"retention": "0"}


class TestSanitizedNameCollision:
    """Distinct source keys that reduce to one base name must both keep their value."""

    def test_colliding_keys_both_survive(self, source, caplog):
        with caplog.at_level(logging.WARNING):
            result = source.build_entity_extension({"a/b": "first", "a@b": "second"}, source_label=SOURCE_LABEL)

        assert result == {
            _disambiguated("a__b", "a/b"): "first",
            _disambiguated("a__b", "a@b"): "second",
        }
        assert caplog.records == []

    def test_a_rewritten_name_cannot_collide_with_a_verbatim_one(self, source):
        """`_x` is prefixed to `p__x`, which a source is free to send as-is."""
        result = source.build_entity_extension({"_x": "prefixed", "p__x": "verbatim"}, source_label=SOURCE_LABEL)

        assert result == {_disambiguated("p__x", "_x"): "prefixed", "p__x": "verbatim"}

    def test_the_name_does_not_depend_on_iteration_order(self):
        first = _FakeSource().build_entity_extension({"a/b": "1", "a@b": "2"}, source_label=SOURCE_LABEL)
        reordered = _FakeSource().build_entity_extension({"a@b": "2", "a/b": "1"}, source_label=SOURCE_LABEL)

        assert first == reordered

    def test_the_name_does_not_depend_on_cache_state(self, source):
        """The registration cache evicts, so a name derived from it would drift mid-run."""
        before = source.build_entity_extension({"a/b": "v"}, source_label=SOURCE_LABEL)
        source._processed_prop.clear()
        after = source.build_entity_extension({"a/b": "v"}, source_label=SOURCE_LABEL)

        assert before == after

    def test_a_digest_collision_drops_the_value_rather_than_mislabelling_it(self, source, caplog):
        """Out of reach short of an md5 collision, but the fallback must not overwrite: the
        definition's displayName belongs to whichever source key registered it."""
        source.build_entity_extension({"first": "v1"}, source_label=SOURCE_LABEL)

        with (
            patch.object(CustomPropertyExtensionMixin, "_sanitize_property_name", return_value="first"),
            caplog.at_level(logging.WARNING),
        ):
            result = source.build_entity_extension({"second": "v2"}, source_label=SOURCE_LABEL)

        assert result is None
        message = caplog.records[0].getMessage()
        assert "first" in message
        assert "second" in message

    def test_the_same_key_seen_again_is_not_reported(self, source, caplog):
        """The common case - one key across many tables - must stay quiet."""
        source.build_entity_extension({"shared": "v"}, source_label=SOURCE_LABEL)

        with caplog.at_level(logging.WARNING):
            source.build_entity_extension({"shared": "v"}, source_label=SOURCE_LABEL)

        assert caplog.records == []


class TestLoadStringPropertyTypeRef:
    """Without the ref assigned, every connector silently returns no extension at all."""

    def test_ref_is_assigned_from_the_server_response(self):
        source = _FakeSource()
        source._string_property_type_ref = None
        expected = PropertyType(EntityReference(id=UUID("00000000-0000-0000-0000-0000000000ff"), type="type"))
        source.metadata.get_property_type_ref.return_value = expected

        source._load_string_property_type_ref()

        assert source._string_property_type_ref == expected

    def test_ref_is_not_fetched_when_disabled(self):
        source = _FakeSource(enabled=False)
        source._string_property_type_ref = None

        source._load_string_property_type_ref()

        assert source.metadata.get_property_type_ref.call_count == 0
        assert source._string_property_type_ref is None

    def test_a_failed_fetch_leaves_the_ref_unset_without_raising(self):
        """Ingestion must not die because custom property support is unavailable."""
        source = _FakeSource()
        source._string_property_type_ref = None
        source.metadata.get_property_type_ref.side_effect = RuntimeError("boom")

        source._load_string_property_type_ref()

        assert source._string_property_type_ref is None

    def test_build_returns_none_without_a_ref(self):
        source = _FakeSource()
        source._string_property_type_ref = None

        assert source.build_entity_extension({"k": "v"}, source_label=SOURCE_LABEL) is None
        assert source.metadata.create_or_update_custom_property.call_count == 0


class TestSanitizePropertyName:
    """The server rejects names that fail customPropertyName, and the generated EntityName
    carries no pattern to catch it client side."""

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("write.format.default", "write.format.default"),
            ("skip.header.line.count", "skip.header.line.count"),
            ("a-b", "a-b"),
            ("a_b", "a_b"),
            ("owner/team", _disambiguated("owner__team", "owner/team")),
            ("dag id@prod", _disambiguated("dag__id__prod", "dag id@prod")),
            ("_internal", _disambiguated("p__internal", "_internal")),
            (".hidden", _disambiguated("p_.hidden", ".hidden")),
            ("-lead", _disambiguated("p_-lead", "-lead")),
            ("/foo", _disambiguated("p___foo", "/foo")),
        ],
    )
    def test_sanitized_names(self, source, raw, expected):
        assert source._sanitize_property_name(raw) == expected

    def test_boundary_length_is_not_hashed(self, source):
        name = "a" * PROPERTY_NAME_MAX_LENGTH

        assert source._sanitize_property_name(name) == name

    def test_over_length_name_is_hashed(self, source):
        name = "a" * (PROPERTY_NAME_MAX_LENGTH + 1)

        assert (
            source._sanitize_property_name(name) == hashlib.md5(name.encode("utf-8"), usedforsecurity=False).hexdigest()
        )

    def test_prefix_cannot_push_a_name_over_the_limit(self, source):
        """The prefix is applied before the length check, so the result always fits."""
        name = "_" + ("a" * PROPERTY_NAME_MAX_LENGTH)

        assert (
            source._sanitize_property_name(name) == hashlib.md5(name.encode("utf-8"), usedforsecurity=False).hexdigest()
        )

    def test_every_sanitized_name_starts_alphanumeric(self, source):
        for raw in ["_x", ".x", "-x", "/x", "@x", "  x", "__x", "1x", "x"]:
            assert source._sanitize_property_name(raw)[0].isalnum()


class TestExistingDefinitionsAreNotOverwritten:
    """A custom property definition is global to the entity type. Registering over one retypes a
    property every other table shares, invalidating the values they already hold for it."""

    def test_an_incompatible_existing_definition_is_skipped(self, caplog):
        source = _FakeSource(existing={"retention": "integer"})

        with caplog.at_level(logging.WARNING):
            result = source.build_entity_extension({"retention": "30"}, source_label=SOURCE_LABEL)

        assert result is None
        assert source.metadata.create_or_update_custom_property.call_count == 0
        assert "retention" in caplog.records[0].getMessage()

    def test_an_incompatible_name_does_not_block_its_siblings(self):
        source = _FakeSource(existing={"retention": "integer"})

        result = source.build_entity_extension({"retention": "30", "owner": "data-eng"}, source_label=SOURCE_LABEL)

        assert result == {"owner": "data-eng"}

    def test_a_compatible_existing_definition_is_reused_without_a_put(self):
        """Re-registering would replace a curated displayName and description with the raw key."""
        source = _FakeSource(existing={"owner": "string"})

        result = source.build_entity_extension({"owner": "data-eng"}, source_label=SOURCE_LABEL)

        assert result == {"owner": "data-eng"}
        assert source.metadata.create_or_update_custom_property.call_count == 0

    def test_an_unclaimed_name_is_registered(self):
        source = _FakeSource(existing={"other": "integer"})

        result = source.build_entity_extension({"owner": "data-eng"}, source_label=SOURCE_LABEL)

        assert result == {"owner": "data-eng"}
        assert source.metadata.create_or_update_custom_property.call_count == 1

    def test_definitions_are_listed_once_per_entity_type(self):
        source = _FakeSource()

        for name in ["a", "b", "c"]:
            source.build_entity_extension({name: "v"}, source_label=SOURCE_LABEL)

        assert source.metadata.get_entity_custom_properties.call_count == 1

    def test_a_failed_listing_fails_closed(self):
        """Treating an unreadable listing as an empty one would register over whatever is already
        there - the corruption the lookup exists to prevent, from nothing worse than a timeout."""
        source = _FakeSource()
        source.metadata.get_entity_custom_properties.side_effect = RuntimeError("boom")

        result = source.build_entity_extension({"owner": "data-eng"}, source_label=SOURCE_LABEL)

        assert result is None
        assert source.metadata.create_or_update_custom_property.call_count == 0

    def test_a_failed_listing_is_not_cached(self):
        """A transient failure costs one entity its extension, not the rest of the run."""
        source = _FakeSource()
        source.metadata.get_entity_custom_properties.side_effect = [
            RuntimeError("boom"),
            [_definition("other", "string")],
        ]

        assert source.build_entity_extension({"owner": "v"}, source_label=SOURCE_LABEL) is None
        assert source.build_entity_extension({"owner": "v"}, source_label=SOURCE_LABEL) == {"owner": "v"}


class TestLegacyPropertyNamesAreReused:
    """A name registered before rewritten names were disambiguated has to keep working. Switching
    an upgraded install to the new name would orphan every value already ingested under the old one
    and leave two custom properties for one source key."""

    def test_a_legacy_definition_for_the_same_key_is_kept(self):
        source = _FakeSource(existing={"owner__team": ("string", "owner/team")})

        result = source.build_entity_extension({"owner/team": "data-eng"}, source_label=SOURCE_LABEL)

        assert result == {"owner__team": "data-eng"}
        assert source.metadata.create_or_update_custom_property.call_count == 0

    def test_a_fresh_install_gets_the_disambiguated_name(self):
        source = _FakeSource()

        result = source.build_entity_extension({"owner/team": "data-eng"}, source_label=SOURCE_LABEL)

        assert result == {_disambiguated("owner__team", "owner/team"): "data-eng"}

    def test_a_legacy_name_claimed_by_another_key_is_not_reused(self):
        """The legacy definition holds `owner/team`'s values; `owner@team` must not write into it."""
        source = _FakeSource(existing={"owner__team": ("string", "owner/team")})

        result = source.build_entity_extension({"owner@team": "data-eng"}, source_label=SOURCE_LABEL)

        assert result == {_disambiguated("owner__team", "owner@team"): "data-eng"}

    def test_both_keys_coexist_after_an_upgrade(self):
        """The key that lost the collision on the old code finally gets a property of its own."""
        source = _FakeSource(existing={"owner__team": ("string", "owner/team")})

        result = source.build_entity_extension(
            {"owner/team": "first", "owner@team": "second"}, source_label=SOURCE_LABEL
        )

        assert result == {
            "owner__team": "first",
            _disambiguated("owner__team", "owner@team"): "second",
        }

    def test_a_legacy_name_of_another_type_is_not_reused(self):
        """Only a string definition could have come from this mixin, so anything else is a user's."""
        source = _FakeSource(existing={"owner__team": ("integer", "owner/team")})

        result = source.build_entity_extension({"owner/team": "data-eng"}, source_label=SOURCE_LABEL)

        assert result == {_disambiguated("owner__team", "owner/team"): "data-eng"}

    def test_a_legacy_name_without_a_display_name_is_not_reused(self):
        """Nothing ties it to this source key, so it is somebody else's property."""
        source = _FakeSource(existing={"owner__team": "string"})

        result = source.build_entity_extension({"owner/team": "data-eng"}, source_label=SOURCE_LABEL)

        assert result == {_disambiguated("owner__team", "owner/team"): "data-eng"}

    def test_a_name_that_was_never_rewritten_has_nothing_to_migrate(self):
        source = _FakeSource(existing={"write.format.default": ("string", "write.format.default")})

        result = source.build_entity_extension({"write.format.default": "parquet"}, source_label=SOURCE_LABEL)

        assert result == {"write.format.default": "parquet"}
        assert source.metadata.create_or_update_custom_property.call_count == 0

    def test_an_over_long_name_hashed_the_same_way_before_and_after(self):
        """Past the length limit both paths collapse to the md5 hex, so nothing moved."""
        raw = "owner/" + ("a" * PROPERTY_NAME_MAX_LENGTH)
        digest = hashlib.md5(raw.encode("utf-8"), usedforsecurity=False).hexdigest()
        source = _FakeSource(existing={digest: ("string", raw)})

        result = source.build_entity_extension({raw: "v"}, source_label=SOURCE_LABEL)

        assert result == {digest: "v"}
        assert source.metadata.create_or_update_custom_property.call_count == 0


class TestExistingDefinitionsCacheIsBounded:
    """The mixin takes an arbitrary entity_type, and each entry holds a whole server snapshot."""

    def test_cache_does_not_grow_past_capacity(self):
        source = _FakeSource()
        source._existing_properties = LRUCache(2)
        entity_types = [type(f"Entity{i}", (), {}) for i in range(10)]

        for entity_type in entity_types:
            source.build_entity_extension({"k": "v"}, source_label=SOURCE_LABEL, entity_type=entity_type)

        assert len(source._existing_properties) == 2

    def test_an_evicted_entity_type_is_listed_again(self):
        source = _FakeSource()
        source._existing_properties = LRUCache(1)
        other = type("Other", (), {})

        source.build_entity_extension({"k": "v"}, source_label=SOURCE_LABEL)
        source.build_entity_extension({"k": "v"}, source_label=SOURCE_LABEL, entity_type=other)
        source.build_entity_extension({"k": "v"}, source_label=SOURCE_LABEL)

        assert source.metadata.get_entity_custom_properties.call_count == 3
