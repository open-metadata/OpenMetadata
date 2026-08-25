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
Query mixin lookup must use the server FQN (service.hash), not the bare SQL hash.

See https://github.com/open-metadata/OpenMetadata/issues/32030
"""

from unittest.mock import MagicMock, patch
from uuid import uuid4

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SqlQuery
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.mixins.query_mixin import OMetaQueryMixin

SERVICE = "oda-snowflake"
SQL = "select 1"


def _mixin() -> OMetaQueryMixin:
    mixin = OMetaQueryMixin.__new__(OMetaQueryMixin)
    mixin.client = MagicMock()
    mixin.get_by_name = MagicMock()
    mixin.get_suffix = MagicMock(return_value="queries")
    return mixin


def _create_request() -> CreateQueryRequest:
    return CreateQueryRequest(
        query=SqlQuery(SQL),
        service=FullyQualifiedEntityName(SERVICE),
    )


def _query_entity(query_id: str | None = None) -> MagicMock:
    entity = MagicMock()
    entity.id.root = query_id or str(uuid4())
    return entity


def _api_error(status_code: int, message: str) -> APIError:
    http_error = MagicMock()
    http_error.response.status_code = status_code
    return APIError({"code": status_code, "message": message}, http_error=http_error)


def test_get_or_create_returns_none_when_query_text_missing():
    mixin = _mixin()
    request = _create_request()
    request.query.root = None

    assert mixin._get_or_create_query(request) is None
    mixin.get_by_name.assert_not_called()
    mixin.client.put.assert_not_called()


def test_get_or_create_looks_up_service_qualified_fqn():
    mixin = _mixin()
    existing = _query_entity()
    mixin.get_by_name.return_value = existing
    expected_hash = mixin._get_query_hash(SQL)

    result = mixin._get_or_create_query(_create_request())

    assert result is existing
    mixin.get_by_name.assert_called_once_with(entity=Query, fqn=f"{SERVICE}.{expected_hash}")
    mixin.client.put.assert_not_called()


def test_get_or_create_does_not_lookup_bare_hash():
    mixin = _mixin()
    mixin.get_by_name.return_value = _query_entity()
    bare_hash = mixin._get_query_hash(SQL)

    mixin._get_or_create_query(_create_request())

    looked_up = [call.kwargs["fqn"] for call in mixin.get_by_name.call_args_list]
    assert bare_hash not in looked_up


def test_get_or_create_creates_when_missing():
    mixin = _mixin()
    mixin.get_by_name.return_value = None
    query_id = str(uuid4())
    mixin.client.put.return_value = {
        "id": query_id,
        "name": mixin._get_query_hash(SQL),
        "query": SQL,
        "service": {"id": str(uuid4()), "type": "databaseService", "name": SERVICE},
    }

    result = mixin._get_or_create_query(_create_request())

    assert result is not None
    assert str(result.id.root) == query_id
    mixin.client.put.assert_called_once()
    assert mixin.client.put.call_args.kwargs["data"]  # create payload, not /usage


def test_get_or_create_retries_lookup_after_create_409():
    mixin = _mixin()
    existing = _query_entity()
    expected_hash = mixin._get_query_hash(SQL)
    mixin.get_by_name.side_effect = [None, existing]
    mixin.client.put.side_effect = _api_error(409, "Entity already exists")

    result = mixin._get_or_create_query(_create_request())

    assert result is existing
    assert mixin.get_by_name.call_count == 2
    for call in mixin.get_by_name.call_args_list:
        assert call.kwargs["fqn"] == f"{SERVICE}.{expected_hash}"


def test_get_or_create_reraises_non_409_create_errors():
    mixin = _mixin()
    mixin.get_by_name.return_value = None
    mixin.client.put.side_effect = _api_error(500, "boom")

    try:
        mixin._get_or_create_query(_create_request())
    except APIError as err:
        assert err.status_code == 500
    else:
        raise AssertionError("expected APIError")


def test_get_query_by_hash_uses_qualified_fqn():
    mixin = _mixin()
    mixin.get_by_name.return_value = _query_entity()
    query_hash = mixin._get_query_hash(SQL)

    mixin._OMetaQueryMixin__get_query_by_hash(query_hash, SERVICE)

    mixin.get_by_name.assert_called_with(entity=Query, fqn=f"{SERVICE}.{query_hash}")


@patch("metadata.ingestion.ometa.mixins.query_mixin.mask_query", side_effect=lambda q, _d=None: q)
def test_ingest_writes_usage_when_query_already_exists(_mask):
    mixin = _mixin()
    existing = _query_entity()
    mixin.get_by_name.return_value = existing
    table = MagicMock()
    table.id.root = uuid4()

    mixin.ingest_entity_queries_data(entity=table, queries=[_create_request()])

    usage_calls = [call for call in mixin.client.put.call_args_list if "/usage" in call.args[0]]
    assert len(usage_calls) == 1
    create_calls = [call for call in mixin.client.put.call_args_list if call.args[0] == "queries"]
    assert create_calls == []


@patch("metadata.ingestion.ometa.mixins.query_mixin.mask_query", side_effect=lambda q, _d=None: q)
def test_ingest_writes_users_and_used_by(_mask):
    mixin = _mixin()
    existing = _query_entity()
    mixin.get_by_name.return_value = existing
    table = MagicMock()
    table.id.root = uuid4()
    request = _create_request()
    request.users = [FullyQualifiedEntityName("alice")]
    request.usedBy = ["LOOKER_SERVICE_USER"]

    mixin.ingest_entity_queries_data(entity=table, queries=[request])

    paths = [call.args[0] for call in mixin.client.put.call_args_list]
    assert any(path.endswith("/users") for path in paths)
    assert any(path.endswith("/usedBy") for path in paths)
