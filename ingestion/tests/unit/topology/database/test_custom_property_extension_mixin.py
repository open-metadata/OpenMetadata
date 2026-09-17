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


class _FakeSource(CustomPropertyExtensionMixin):
    """Minimal host for the mixin: it only needs source_config and metadata."""

    def __init__(self, capacity: int | None = None, enabled: bool = True):
        self.source_config = DatabaseServiceMetadataPipeline(includeCustomProperties=enabled)
        self.metadata = MagicMock()
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
    """Two distinct source keys can sanitize to one name; the second value overwrites the first."""

    def test_colliding_keys_are_reported_at_warning(self, source, caplog):
        with caplog.at_level(logging.WARNING):
            result = source.build_entity_extension({"a/b": "first", "a@b": "second"}, source_label=SOURCE_LABEL)

        assert result == {"a__b": "second"}
        assert len(caplog.records) == 1
        message = caplog.records[0].getMessage()
        assert "a/b" in message
        assert "a@b" in message
        assert "a__b" in message

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
            ("owner/team", "owner__team"),
            ("dag id@prod", "dag__id__prod"),
            ("_internal", "p__internal"),
            (".hidden", "p_.hidden"),
            ("-lead", "p_-lead"),
            ("/foo", "p___foo"),
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
