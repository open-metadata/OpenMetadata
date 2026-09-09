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
Unit tests for usage-ingestion caching (issue #32210).

Covers:
  - _get_or_create_query caches a found/created Query per query hash, so a
    second table referencing the same SQL does not trigger another GET.
  - A miss (None) is never cached, so a Query created by processing one
    table is still found when a second table looks up the same hash.
  - get_cached_user_reference caches a User EntityReference per name,
    shared across staging and lifecycle call sites, including caching a
    miss so a user absent from OpenMetadata is not looked up again.
"""

from unittest.mock import MagicMock, patch
from uuid import UUID

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.mixins.query_mixin import OMetaQueryMixin
from metadata.ingestion.ometa.mixins.user_mixin import OMetaUserMixin
from metadata.ingestion.stage.table_usage import TableUsageStage

QUERY_ID = "00000000-0000-0000-0000-000000000100"
USER_REF_NAME = "john.doe"


def _make_query_mixin() -> OMetaQueryMixin:
    # Caches are created lazily per-instance on first use, so a fresh
    # __new__ instance naturally starts with no cache.
    mixin = OMetaQueryMixin.__new__(OMetaQueryMixin)
    mixin.client = MagicMock()
    return mixin


def _make_user_mixin() -> OMetaUserMixin:
    mixin = OMetaUserMixin.__new__(OMetaUserMixin)
    mixin.client = MagicMock()
    return mixin


def _make_create_query_request(sql: str) -> CreateQueryRequest:
    request = MagicMock()
    request.query.root = sql
    request.model_dump_json.return_value = "{}"
    return request


class TestQueryGetOrCreateCache:
    def test_second_lookup_for_same_query_hits_cache(self):
        mixin = _make_query_mixin()
        query_entity = MagicMock(spec=Query)
        mixin.get_by_name = MagicMock(return_value=query_entity)

        request_a = _make_create_query_request("SELECT * FROM orders")
        request_b = _make_create_query_request("SELECT * FROM orders")

        result_a = mixin._get_or_create_query(request_a)
        result_b = mixin._get_or_create_query(request_b)

        assert result_a is query_entity
        assert result_b is query_entity
        mixin.get_by_name.assert_called_once()

    def test_created_query_is_cached_for_second_table(self):
        mixin = _make_query_mixin()
        query_entity = MagicMock(spec=Query)
        mixin.get_by_name = MagicMock(return_value=None)
        mixin.client.put = MagicMock(return_value={"id": QUERY_ID})
        mixin.get_suffix = MagicMock(return_value="/queries")

        request_a = _make_create_query_request("SELECT * FROM customers")
        with patch("metadata.ingestion.ometa.mixins.query_mixin.Query", return_value=query_entity):
            result_a = mixin._get_or_create_query(request_a)

        assert result_a is query_entity
        assert mixin.get_by_name.call_count == 1

        request_b = _make_create_query_request("SELECT * FROM customers")
        result_b = mixin._get_or_create_query(request_b)

        assert result_b is query_entity
        assert mixin.get_by_name.call_count == 1, "cached hit should skip get_by_name"

    def test_failed_lookup_and_create_is_not_cached(self):
        mixin = _make_query_mixin()
        mixin.get_by_name = MagicMock(return_value=None)
        mixin.client.put = MagicMock(return_value=None)
        mixin.get_suffix = MagicMock(return_value="/queries")

        request_a = _make_create_query_request("SELECT * FROM customers")
        request_b = _make_create_query_request("SELECT * FROM customers")

        result_a = mixin._get_or_create_query(request_a)
        result_b = mixin._get_or_create_query(request_b)

        assert result_a is None
        assert result_b is None
        assert mixin.get_by_name.call_count == 2
        assert mixin.client.put.call_count == 2

    def test_none_query_body_returns_none_without_caching(self):
        mixin = _make_query_mixin()
        mixin.get_by_name = MagicMock()

        request = MagicMock()
        request.query.root = None

        result = mixin._get_or_create_query(request)

        assert result is None
        mixin.get_by_name.assert_not_called()


class TestCachedUserReference:
    def test_second_lookup_for_same_name_hits_cache(self):
        mixin = _make_user_mixin()
        reference = MagicMock()
        mixin.get_entity_reference = MagicMock(return_value=reference)

        result_a = mixin.get_cached_user_reference(name=USER_REF_NAME)
        result_b = mixin.get_cached_user_reference(name=USER_REF_NAME)

        assert result_a is reference
        assert result_b is reference
        mixin.get_entity_reference.assert_called_once()

    def test_miss_is_cached_so_second_lookup_skips_api_call(self):
        mixin = _make_user_mixin()
        mixin.get_entity_reference = MagicMock(return_value=None)

        result_a = mixin.get_cached_user_reference(name="unknown.user")
        result_b = mixin.get_cached_user_reference(name="unknown.user")

        assert result_a is None
        assert result_b is None
        mixin.get_entity_reference.assert_called_once()

    def test_different_names_are_cached_independently(self):
        mixin = _make_user_mixin()
        ref_a = MagicMock()
        ref_b = MagicMock()

        def side_effect(entity, fqn):
            return ref_a if fqn == "alice" else ref_b

        mixin.get_entity_reference = MagicMock(side_effect=side_effect)

        result_a = mixin.get_cached_user_reference(name="alice")
        result_b = mixin.get_cached_user_reference(name="bob")

        assert result_a is ref_a
        assert result_b is ref_b
        assert mixin.get_entity_reference.call_count == 2


class TestTableUsageUserReference:
    def test_user_reference_fqn_is_returned_as_string(self):
        stage = TableUsageStage.__new__(TableUsageStage)
        stage.metadata = MagicMock()
        stage.metadata.get_cached_user_reference.return_value = EntityReference(
            id=Uuid(UUID("00000000-0000-0000-0000-000000000200")),
            type="user",
            fullyQualifiedName=USER_REF_NAME,
        )

        users, used_by = stage._get_user_entity(USER_REF_NAME)

        assert users == [USER_REF_NAME]
        assert used_by == [USER_REF_NAME]
