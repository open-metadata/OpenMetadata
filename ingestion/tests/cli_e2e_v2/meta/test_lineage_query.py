#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Exercise strict lineage reads and polling at the authenticated HTTP boundary."""

from types import SimpleNamespace

import pytest

from metadata.ingestion.ometa.client import APIError, RestTransportError
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from ..features.database.lineage import lineage_query
from ..runtime import expect


def scripted_query(responses, fqn="svc.default.demo.my_table", expected_path=None):
    pending = iter(responses)

    def get(path):
        if expected_path is not None:
            assert path == expected_path
        response = next(pending)
        if isinstance(response, Exception):
            raise response
        return response

    return lineage_query(SimpleNamespace(client=SimpleNamespace(get=get), get_suffix=OpenMetadata.get_suffix), fqn)


def graph_present(graph):
    assert graph is not None, "lineage missing"


@pytest.fixture
def graph():
    return {
        "entity": {"id": "1", "type": "table", "fullyQualifiedName": "svc.default.demo.my_table"},
        "nodes": [],
        "upstreamEdges": [],
        "downstreamEdges": [],
    }


def test_lineage_absence_then_graph(polling_clock, graph):
    query = scripted_query([APIError({"code": 404, "message": "Not found"}), graph])
    assert expect.poll(query).satisfies(graph_present) == graph


@pytest.mark.parametrize("code", [401, 403, 500])
def test_lineage_api_failure_propagates(polling_clock, graph, code):
    error = APIError({"code": code, "message": "Lineage request failed"})
    with pytest.raises(APIError) as raised:
        expect.poll(scripted_query([error, graph])).satisfies(graph_present)
    assert raised.value is error


@pytest.mark.parametrize(
    "error",
    [RestTransportError("GET", "lineage", TimeoutError("request timed out")), ValueError("invalid JSON response")],
)
def test_lineage_transport_or_parse_failure_propagates(polling_clock, graph, error):
    with pytest.raises(type(error)) as raised:
        expect.poll(scripted_query([error, graph])).satisfies(graph_present)
    assert raised.value is error


def test_lineage_quoted_fqn_endpoint_and_depth(graph):
    query = scripted_query(
        [graph],
        'svc.default."demo schema"."my/table+name"',
        "/lineage/table/name/svc.default.%22demo%20schema%22.%22my%2Ftable%2Bname%22?upstreamDepth=1&downstreamDepth=1",
    )
    assert query.read() == graph
