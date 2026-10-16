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
Tableau dashboard ingestion end to end: the metadata workflow runs the connector
against a fake Tableau site and writes to a live server, and every assertion reads
back what the server stored.

Requires a server at http://localhost:8585.
"""

from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard

from .conftest import DASHBOARD_SERVICE  # noqa: TID252

SALES_CHART_EDGES = [
    ("Customers", "DashboardLineage"),
    ("Orders", "DashboardLineage"),
    ("Revenue", "DashboardLineage"),
]


def _chart_edges(metadata, workbook_id: str) -> list[tuple[str, str]]:
    """(chart display name, lineage source) of every edge drawn from the dashboard,
    kept as a list so a duplicated edge would show."""
    dashboard = metadata.get_by_name(entity=Dashboard, fqn=f"{DASHBOARD_SERVICE}.{workbook_id}")
    assert dashboard is not None, f"{workbook_id} was not ingested"
    lineage = metadata.get_lineage_by_id(entity=Dashboard, entity_id=dashboard.id.root, up_depth=0, down_depth=1)
    nodes = {node["id"]: node for node in lineage.get("nodes", [])}
    return sorted(
        (nodes[edge["toEntity"]]["displayName"], edge["lineageDetails"]["source"])
        for edge in lineage.get("downstreamEdges", [])
        if edge["fromEntity"] == str(dashboard.id.root)
    )


class TestTableauDashboardChartLineage:
    """Every chart created under a dashboard gets one Dashboard -> Chart edge, drawn by
    the shared dashboard topology."""

    def test_each_chart_gets_one_edge_from_its_dashboard(self, metadata, first_run):
        assert _chart_edges(metadata, "wb-sales") == SALES_CHART_EDGES

    def test_a_dashboard_only_links_its_own_charts(self, metadata, first_run):
        assert _chart_edges(metadata, "wb-ops") == [("Incidents", "DashboardLineage")]

    def test_a_filtered_chart_gets_no_entity_and_no_edge(self, metadata, first_run):
        assert {"Draft Revenue": "Chart Pattern not allowed"} in first_run.source.status.filtered
        assert metadata.get_by_name(entity=Chart, fqn=f"{DASHBOARD_SERVICE}.v-draft") is None

    def test_a_chart_that_fails_gets_no_entity_and_no_edge(self, metadata, first_run):
        failures = first_run.source.status.failures
        assert len(failures) == 1
        assert "name='Broken'" in failures[0].error
        assert metadata.get_by_name(entity=Chart, fqn=f"{DASHBOARD_SERVICE}.v-broken") is None

    def test_a_rerun_does_not_duplicate_edges(self, metadata, first_run, ingest):
        ingest()

        assert _chart_edges(metadata, "wb-sales") == SALES_CHART_EDGES

    def test_a_rerun_with_override_lineage_keeps_one_edge_per_chart(self, metadata, first_run, ingest):
        ingest(override_lineage=True)

        assert _chart_edges(metadata, "wb-sales") == SALES_CHART_EDGES
        assert _chart_edges(metadata, "wb-ops") == [("Incidents", "DashboardLineage")]
