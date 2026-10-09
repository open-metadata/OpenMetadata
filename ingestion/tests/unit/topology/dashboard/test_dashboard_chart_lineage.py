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
"""The shared dashboard topology draws one Dashboard -> Chart edge per chart the
server holds under the dashboard.

The server is the boundary faked here, with the bulk sink's semantics: the dashboard
written in this node is only readable once a ``Barrier`` has flushed the buffer.
"""

import uuid

import pytest

from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.dashboard.dashboard_service import (
    DashboardServiceTopology,
)
from metadata.ingestion.source.dashboard.ssrs.metadata import SsrsSource

SERVICE = "dashboard_svc"
CHARTS = ("revenue", "orders", "customers")


def _dashboard(charts: tuple[str, ...]) -> Dashboard:
    return Dashboard(
        id=uuid.uuid4(),
        name="sales",
        fullyQualifiedName=f"{SERVICE}.sales",
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        charts=EntityReferenceList(
            [
                EntityReference(id=uuid.uuid4(), type="chart", fullyQualifiedName=f"{SERVICE}.{chart}")
                for chart in charts
            ]
        ),
    )


class FakeServer:
    """Answers ``get_by_name`` the way the bulk sink makes it: the dashboard written in
    this node is only readable after a ``Barrier`` went down the stream."""

    def __init__(self, dashboard: Dashboard | None = None, error: Exception | None = None):
        self.dashboard = dashboard
        self.error = error
        self.flushed = False

    def get_by_name(self, entity, fqn, fields=None):
        if self.error:
            raise self.error
        if (
            self.flushed
            and self.dashboard
            and fqn == self.dashboard.fullyQualifiedName.root
            and "charts" in (fields or [])
        ):
            return self.dashboard
        return None


def _source(server: FakeServer, dashboard: str | None = "sales", override_lineage: bool = False) -> SsrsSource:
    source = SsrsSource.__new__(SsrsSource)
    source.metadata = server
    source.source_config = DashboardServiceMetadataPipeline(overrideLineage=override_lineage)
    source.context = TopologyContextManager(DashboardServiceTopology())
    source.context.get().upsert("dashboard_service", SERVICE)
    source.context.get().upsert("dashboard", dashboard)
    return source


def _drain(source: SsrsSource) -> list:
    records = []
    for record in source.yield_dashboard_chart_lineage(None):
        if isinstance(record.right, Barrier):
            source.metadata.flushed = True
        records.append(record)
    return records


def _edges(records: list) -> list[tuple[str, str, LineageSource, bool]]:
    return [
        (
            record.right.lineage_request.edge.fromEntity.fullyQualifiedName,
            record.right.lineage_request.edge.toEntity.fullyQualifiedName,
            record.right.lineage_request.edge.lineageDetails.source,
            record.right.override_lineage,
        )
        for record in records
        if isinstance(record.right, OMetaLineageRequest)
    ]


class TestDashboardChartLineage:
    def test_the_stage_runs_right_after_the_dashboard_is_yielded(self):
        processors = [stage.processor for stage in DashboardServiceTopology().dashboard.stages]

        assert processors.index("yield_dashboard_chart_lineage") == processors.index("yield_dashboard") + 1

    def test_each_chart_under_the_dashboard_gets_one_edge_after_the_barrier(self):
        records = _drain(_source(FakeServer(_dashboard(CHARTS))))

        assert isinstance(records[0].right, Barrier)
        assert _edges(records) == [
            (f"{SERVICE}.sales", f"{SERVICE}.{chart}", LineageSource.DashboardLineage, False) for chart in CHARTS
        ]

    def test_override_lineage_is_carried_on_every_edge(self):
        records = _drain(_source(FakeServer(_dashboard(CHARTS)), override_lineage=True))

        assert [override for *_, override in _edges(records)] == [True, True, True]

    @pytest.mark.parametrize(
        "server",
        [FakeServer(), FakeServer(_dashboard(()))],
        ids=["dashboard-not-on-the-server", "dashboard-without-charts"],
    )
    def test_no_chart_under_the_dashboard_means_no_edge_and_no_error(self, server):
        records = _drain(_source(server))

        assert [type(record.right) for record in records] == [Barrier]
        assert all(record.left is None for record in records)

    def test_nothing_is_drawn_before_any_dashboard_was_yielded(self):
        assert _drain(_source(FakeServer(_dashboard(CHARTS)), dashboard=None)) == []

    def test_a_failed_lookup_is_reported_instead_of_raised(self):
        records = _drain(_source(FakeServer(error=RuntimeError("server unavailable"))))

        assert isinstance(records[0].right, Barrier)
        assert [record.left.name for record in records[1:]] == ["sales"]
        assert "server unavailable" in records[1].left.error
