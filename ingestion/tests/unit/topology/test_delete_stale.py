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
Validate that stale-entity detection is delegated to the server and only falls back to the
legacy client-side paginate-and-diff against older servers.
"""

from unittest.mock import MagicMock

import pytest
from pydantic import BaseModel

from metadata.generated.schema.type.bulkOperationResult import BulkOperationResult
from metadata.ingestion.api.delete import delete_entity_from_source
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class MockEntity:
    """Stand-in entity type; only used as a key for get_suffix / list_all_entities."""


class _Fqn(BaseModel):
    root: str


class _MockEntity(BaseModel):
    """A minimal pydantic Entity for the legacy diff path (DeleteEntity.entity is a BaseModel)."""

    fullyQualifiedName: _Fqn  # noqa: N815


def _entity(fqn: str) -> _MockEntity:
    return _MockEntity(fullyQualifiedName=_Fqn(root=fqn))


class TestDeleteStaleEntitiesMixin:
    """Unit tests for OpenMetadata.delete_stale_entities."""

    def test_builds_request_and_returns_result(self):
        metadata = MagicMock()
        metadata.get_suffix.return_value = "/tables"
        metadata.client.put.return_value = {
            "status": "success",
            "numberOfRowsProcessed": 1,
            "numberOfRowsPassed": 1,
            "numberOfRowsFailed": 0,
        }

        result = OpenMetadata.delete_stale_entities(
            metadata,
            entity=MockEntity,
            scope_params={"databaseSchema": "svc.db.sch"},
            live_fqns={"svc.db.sch.t1", "svc.db.sch.t2"},
            recursive=True,
        )

        assert isinstance(result, BulkOperationResult)
        metadata.client.put.assert_called_once()
        url, kwargs = (
            metadata.client.put.call_args.args[0],
            metadata.client.put.call_args.kwargs,
        )
        assert url == "/tables/deleteStale"
        body = kwargs["json"]
        assert body["scopeFqn"] == "svc.db.sch"
        assert body["scopeEntityType"] == "databaseSchema"
        assert body["recursive"] is True
        assert sorted(body["seenFqns"]) == ["svc.db.sch.t1", "svc.db.sch.t2"]

    def test_returns_none_when_endpoint_missing(self):
        """A 404 from the server means the endpoint is unavailable - fall back, don't raise."""
        metadata = MagicMock()
        metadata.get_suffix.return_value = "/tables"
        http_error = MagicMock()
        http_error.response.status_code = 404
        metadata.client.put.side_effect = APIError({"message": "not found"}, http_error)

        result = OpenMetadata.delete_stale_entities(
            metadata,
            entity=MockEntity,
            scope_params={"database": "svc.db"},
            live_fqns=[],
            recursive=True,
        )

        assert result is None

    def test_raises_on_non_404_errors(self):
        metadata = MagicMock()
        metadata.get_suffix.return_value = "/tables"
        http_error = MagicMock()
        http_error.response.status_code = 500
        metadata.client.put.side_effect = APIError({"message": "boom"}, http_error)

        with pytest.raises(APIError):
            OpenMetadata.delete_stale_entities(
                metadata,
                entity=MockEntity,
                scope_params={"database": "svc.db"},
                live_fqns=[],
            )

    def test_missing_scope_returns_empty_result(self):
        """A missing scope is a server-side no-op: it returns 200 + an empty BulkOperationResult
        (zero rows), which the client passes through so the caller does not fall back to legacy."""
        metadata = MagicMock()
        metadata.get_suffix.return_value = "/tables"
        metadata.client.put.return_value = {
            "status": "success",
            "numberOfRowsProcessed": 0,
            "numberOfRowsPassed": 0,
            "numberOfRowsFailed": 0,
        }

        result = OpenMetadata.delete_stale_entities(
            metadata,
            entity=MockEntity,
            scope_params={"databaseSchema": "svc.db.sch"},
            live_fqns=[],
        )

        assert isinstance(result, BulkOperationResult)
        assert result.numberOfRowsProcessed.root == 0

    def test_requires_scope(self):
        metadata = MagicMock()
        with pytest.raises(ValueError):
            OpenMetadata.delete_stale_entities(
                metadata,
                entity=MockEntity,
                scope_params=None,
                live_fqns=[],
            )


class TestDeleteEntityFromSource:
    """Unit tests for delete_entity_from_source - server-first with a legacy fallback."""

    def test_delegates_to_server_and_yields_nothing(self):
        """When the server handles stale deletion, nothing is pushed through the sink."""
        metadata = MagicMock()
        metadata.delete_stale_entities.return_value = BulkOperationResult(
            numberOfRowsProcessed=2, numberOfRowsPassed=2, numberOfRowsFailed=0
        )

        results = list(
            delete_entity_from_source(
                metadata=metadata,
                entity_type=MockEntity,
                entity_source_state={"svc.db.sch.t1"},
                recursive=True,
                params={"databaseSchema": "svc.db.sch"},
            )
        )

        barriers = [r for r in results if isinstance(r.right, Barrier)]
        deletes = [r for r in results if not isinstance(r.right, Barrier)]
        assert len(barriers) == 1
        assert deletes == []
        metadata.delete_stale_entities.assert_called_once_with(
            entity=MockEntity,
            scope_params={"databaseSchema": "svc.db.sch"},
            live_fqns={"svc.db.sch.t1"},
            recursive=True,
        )
        # The connector must not paginate the API itself when the server handled it.
        metadata.list_all_entities.assert_not_called()

    def test_falls_back_to_legacy_when_endpoint_missing(self):
        """An old server (delete_stale_entities returns None) falls back to client-side diff."""
        metadata = MagicMock()
        metadata.delete_stale_entities.return_value = None
        metadata.list_all_entities.return_value = [
            _entity("svc.db.sch.t1"),
            _entity("svc.db.sch.t2"),
            _entity("svc.db.sch.t3"),
        ]

        results = list(
            delete_entity_from_source(
                metadata=metadata,
                entity_type=MockEntity,
                entity_source_state={"svc.db.sch.t1"},
                recursive=True,
                params={"databaseSchema": "svc.db.sch"},
            )
        )

        metadata.list_all_entities.assert_called_once()
        deleted_fqns = {r.right.entity.fullyQualifiedName.root for r in results if not isinstance(r.right, Barrier)}
        assert deleted_fqns == {"svc.db.sch.t2", "svc.db.sch.t3"}
