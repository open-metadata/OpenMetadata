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
Lineage edge cache lifetime.

An overrideLineage run deletes the edges into an entity, then writes them back. The
write looks the edge up first and only PUTs when the server has none. Edges another
client read before that delete must not answer the lookup, or the edge is reported as
written and stays deleted. Within one client the cache still spares repeat reads.
Each client below is one workflow run in the same process.
"""

from types import SimpleNamespace

import pytest

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.mixins.lineage_mixin import OMetaLineageMixin

DASHBOARD_ID = "d311bdf2-c4a9-4be3-9937-3b26309759af"
CHART_ID = "abea43f7-ccc2-4daf-9dfb-115549461244"
DASHBOARD_FQN = "svc.sales"
CHART_FQN = "svc.revenue"
DETAILS = LineageDetails(source=LineageSource.DashboardLineage)
REQUEST = AddLineageRequest(
    edge=EntitiesEdge(
        fromEntity=EntityReference(id=DASHBOARD_ID, type="dashboard", fullyQualifiedName=DASHBOARD_FQN),
        toEntity=EntityReference(id=CHART_ID, type="chart", fullyQualifiedName=CHART_FQN),
        lineageDetails=DETAILS,
    )
)


class FakeLineageServer:
    """The lineage endpoints a write goes through, holding the one edge. It counts the
    edge reads, and its lineage graph can lag a write by leaving the edge out."""

    def __init__(self, edge_exists: bool = True, graph_lists_edge: bool = True):
        self.edge_exists = edge_exists
        self.graph_lists_edge = graph_lists_edge
        self.edge_reads = 0

    def get(self, path):
        if "getLineageEdge" in path:
            self.edge_reads += 1
            if self.edge_exists:
                return {"edge": {"columnsLineage": [], "source": DETAILS.source.value}}
        elif path.startswith(f"/lineage/dashboard/{DASHBOARD_ID}"):
            listed = self.edge_exists and self.graph_lists_edge
            return {"downstreamEdges": [{"toEntity": CHART_ID, "lineageDetails": {}}] if listed else []}
        raise APIError(
            {"message": "not found", "code": 404}, SimpleNamespace(response=SimpleNamespace(status_code=404))
        )

    def put(self, path, data=None):
        self.edge_exists = True

    def patch(self, path, data=None):
        """An edge with nothing to change sends no patch."""

    def delete(self, path):
        self.edge_exists = False


class WorkflowClient(OMetaLineageMixin):
    """The real lineage mixin of one workflow run, over the fake server."""

    def __init__(self, server: FakeLineageServer):
        self.client = server

    def get_suffix(self, entity):
        return "/lineage"


class TestLineageEdgeCacheLifetime:
    def test_an_edge_deleted_by_a_later_override_run_is_written_back(self):
        server = FakeLineageServer()
        WorkflowClient(server).add_lineage(REQUEST, check_patch=True, return_lineage=False)

        override_run = WorkflowClient(server)
        override_run.delete_lineage_by_source(entity_type="chart", entity_id=CHART_ID, source=DETAILS.source.value)
        override_run.add_lineage(REQUEST, check_patch=True, return_lineage=False)

        assert server.edge_exists

    def test_an_edge_deleted_by_name_by_a_later_override_run_is_written_back(self):
        server = FakeLineageServer()

        def write(client: WorkflowClient) -> None:
            client.add_lineage_by_name(
                from_entity_fqn=DASHBOARD_FQN,
                from_entity_type="dashboard",
                to_entity_fqn=CHART_FQN,
                to_entity_type="chart",
                lineage_details=DETAILS,
                check_patch=True,
                return_lineage=False,
            )

        write(WorkflowClient(server))

        override_run = WorkflowClient(server)
        override_run.delete_lineage_by_source_by_name(
            entity_type="chart", entity_fqn=CHART_FQN, source=DETAILS.source.value
        )
        write(override_run)

        assert server.edge_exists

    @pytest.mark.parametrize(
        "read",
        [
            pytest.param(
                lambda client: client.add_lineage(REQUEST, check_patch=True, return_lineage=False), id="write"
            ),
            pytest.param(
                lambda client: client.get_lineage_edge_by_name("dashboard", DASHBOARD_FQN, "chart", CHART_FQN),
                id="by-name",
            ),
            pytest.param(lambda client: client.get_lineage_edge(DASHBOARD_ID, CHART_ID), id="by-id"),
        ],
    )
    def test_a_client_reads_an_edge_from_the_server_once(self, read):
        server = FakeLineageServer()
        client = WorkflowClient(server)

        read(client)
        read(client)

        assert server.edge_reads == 1

    @pytest.mark.parametrize("graph_lists_edge", [True, False], ids=["graph-lists-edge", "graph-lags"])
    def test_a_write_that_reads_the_graph_back_spares_the_next_edge_read(self, graph_lists_edge):
        server = FakeLineageServer(edge_exists=False, graph_lists_edge=graph_lists_edge)
        client = WorkflowClient(server)

        client.add_lineage(REQUEST, check_patch=True)
        client.add_lineage(REQUEST, check_patch=True)

        assert server.edge_reads == 1
        assert server.edge_exists
