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
Lineage sqlQuery patch tests (issue #29520).

Patching an existing lineage edge must add or update the incoming sqlQuery, never
drop an already-stored query, and never crash build_patch on an edge that already
carries a query. Covered through the add_lineage (by id) entry point.
"""

import json
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.mixins.lineage_mixin import OMetaLineageMixin

FROM_ID = "d311bdf2-c4a9-4be3-9937-3b26309759af"
TO_ID = "abea43f7-ccc2-4daf-9dfb-115549461244"
STORED_QUERY = "SELECT 1 FROM source_table"
INCOMING_QUERY = "SELECT 2 FROM source_table"


class StubbedLineage(OMetaLineageMixin):
    """OMetaLineageMixin with only the HTTP calls stubbed, so add_lineage
    exercises the real patch reconstruction and build_patch.
    `existing_edge` is what the edge lookup returns."""

    def __init__(self, existing_edge):
        self.client = MagicMock()
        self._existing_edge = existing_edge

    def get_lineage_edge(self, from_id, to_id):
        return self._existing_edge

    def get_suffix(self, entity):
        return "/lineage"

    def get_lineage_by_id(self, *args, **kwargs):
        return {}

    def get_lineage_by_name(self, *args, **kwargs):
        return {}

    def _update_cache(self, *args, **kwargs):
        return None


def edge_lookup(stored_query=None):
    """Server edge-lookup payload, optionally carrying an already-stored sqlQuery."""
    details = {"columnsLineage": []}
    if stored_query is not None:
        details["sqlQuery"] = stored_query
    return {"edge": details}


def incoming_details(sql_query):
    return (
        LineageDetails(source=LineageSource.QueryLineage, sqlQuery=sql_query)
        if sql_query is not None
        else LineageDetails(source=LineageSource.QueryLineage)
    )


def sql_query_ops(client):
    """JSON-patch ops targeting /sqlQuery from the single client.patch call."""
    if not client.patch.called:
        return []
    patch = json.loads(client.patch.call_args.kwargs["data"])
    return [op for op in patch if op.get("path") == "/sqlQuery"]


# (stored query on the existing edge, incoming query, expected query after patch)
PATCH_CASES = [
    pytest.param(
        None, INCOMING_QUERY, INCOMING_QUERY, id="backfill-onto-query-less-edge"
    ),
    pytest.param(
        STORED_QUERY, INCOMING_QUERY, INCOMING_QUERY, id="update-existing-query"
    ),
    pytest.param(STORED_QUERY, None, None, id="keep-stored-query-when-incoming-empty"),
]


def assert_patched(client, expected_query):
    assert not client.put.called
    if expected_query is None:
        assert sql_query_ops(client) == []
    else:
        assert sql_query_ops(client) == [
            {"op": "add", "path": "/sqlQuery", "value": expected_query}
        ]


class TestAddLineageSqlQuery:
    """add_lineage (by id) reconstruction adds/updates the incoming query, keeps a
    stored one when the run has none, and never crashes on an edge with a query."""

    @pytest.mark.parametrize("stored, incoming, expected", PATCH_CASES)
    def test_patches_sql_query(self, stored, incoming, expected):
        service = StubbedLineage(edge_lookup(stored))
        request = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=FROM_ID, type="table"),
                toEntity=EntityReference(id=TO_ID, type="table"),
                lineageDetails=incoming_details(incoming),
            )
        )

        service.add_lineage(request, check_patch=True)

        assert_patched(service.client, expected)
