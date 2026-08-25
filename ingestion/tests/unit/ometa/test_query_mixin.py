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
"""Query lookup uses service.hash (issue #32030)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SqlQuery
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.mixins.query_mixin import OMetaQueryMixin

SERVICE = "test_service"
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


def _query_entity() -> MagicMock:
    entity = MagicMock()
    entity.id.root = str(uuid4())
    return entity


def _api_error(status_code: int, message: str) -> APIError:
    http_error = MagicMock()
    http_error.response.status_code = status_code
    return APIError({"code": status_code, "message": message}, http_error=http_error)


def test_get_or_create_looks_up_service_qualified_fqn():
    mixin = _mixin()
    existing = _query_entity()
    mixin.get_by_name.return_value = existing

    result = mixin._get_or_create_query(_create_request())

    assert result is existing
    mixin.get_by_name.assert_called_once_with(entity=Query, fqn=f"{SERVICE}.{mixin._get_query_hash(SQL)}")
    mixin.client.put.assert_not_called()


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

    assert str(result.id.root) == query_id
    mixin.client.put.assert_called_once()
    assert mixin.client.put.call_args.args[0] == "queries"


def test_get_or_create_retries_lookup_after_create_409():
    mixin = _mixin()
    existing = _query_entity()
    expected_fqn = f"{SERVICE}.{mixin._get_query_hash(SQL)}"
    mixin.get_by_name.side_effect = [None, existing]
    mixin.client.put.side_effect = _api_error(409, "Entity already exists")

    result = mixin._get_or_create_query(_create_request())

    assert result is existing
    assert [call.kwargs["fqn"] for call in mixin.get_by_name.call_args_list] == [
        expected_fqn,
        expected_fqn,
    ]


def test_get_or_create_reraises_non_409_create_errors():
    mixin = _mixin()
    mixin.get_by_name.return_value = None
    mixin.client.put.side_effect = _api_error(500, "boom")

    with pytest.raises(APIError) as err:
        mixin._get_or_create_query(_create_request())
    assert err.value.status_code == 500


@patch("metadata.ingestion.ometa.mixins.query_mixin.mask_query", side_effect=lambda q, _d=None: q)
def test_ingest_writes_usage_when_query_already_exists(_mask):
    mixin = _mixin()
    mixin.get_by_name.return_value = _query_entity()
    table = MagicMock()
    table.id.root = uuid4()

    mixin.ingest_entity_queries_data(entity=table, queries=[_create_request()])

    paths = [call.args[0] for call in mixin.client.put.call_args_list]
    assert any(path.endswith("/usage") for path in paths)
    assert "queries" not in paths
