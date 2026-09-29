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
Simple unit tests for Grafana connector components
"""

from unittest.mock import MagicMock

from metadata.ingestion.source.dashboard.grafana.client import GrafanaApiClient
from metadata.ingestion.source.dashboard.grafana.metadata import GrafanaSource
from metadata.ingestion.source.dashboard.grafana.models import (
    GrafanaDashboardResponse,
    GrafanaPanel,
)


class TestGrafanaComponents:
    """Test individual Grafana components"""

    def test_panel_type_mapping(self):
        """Test Grafana panel type to OpenMetadata chart type mapping"""
        # Create a minimal instance just for testing the method
        source = MagicMock(spec=GrafanaSource)

        # Add the method we want to test
        source._map_panel_type_to_chart_type = GrafanaSource._map_panel_type_to_chart_type.__get__(source)

        test_cases = {
            "graph": "Line",
            "timeseries": "Line",
            "table": "Table",
            "stat": "Text",
            "gauge": "Gauge",
            "bargauge": "Bar",
            "bar": "Bar",
            "piechart": "Pie",
            "heatmap": "Heatmap",
            "histogram": "Histogram",
            "geomap": "Map",
            "nodeGraph": "Graph",
            "unknown": "Other",
        }

        for panel_type, expected_chart_type in test_cases.items():
            result = source._map_panel_type_to_chart_type(panel_type)
            # The method returns an enum value, compare its value
            assert result.value == expected_chart_type

    def test_extract_datasource_name(self):
        """Test datasource name extraction"""
        source = MagicMock(spec=GrafanaSource)
        source._extract_datasource_name = GrafanaSource._extract_datasource_name.__get__(source)

        # Test with string datasource in target
        target = MagicMock()
        target.datasource = "postgres-uid"
        panel = MagicMock()
        panel.datasource = None

        assert source._extract_datasource_name(target, panel) == "postgres-uid"

        # Test with dict datasource in target
        target.datasource = {"uid": "postgres-uid", "type": "postgres"}
        assert source._extract_datasource_name(target, panel) == "postgres-uid"

        # Test fallback to panel datasource
        target.datasource = None
        panel.datasource = "panel-datasource"
        assert source._extract_datasource_name(target, panel) == "panel-datasource"

    def test_dashboard_response_parsing(self):
        """Test parsing of dashboard response"""
        dashboard_data = {
            "dashboard": {
                "uid": "test-uid",
                "title": "Test Dashboard",
                "tags": ["test", "demo"],
                "panels": [
                    {
                        "id": 1,
                        "type": "graph",
                        "title": "Test Panel",
                    }
                ],
            },
            "meta": {
                "type": "db",
                "canSave": True,
                "canEdit": True,
                "canAdmin": True,
                "canStar": True,
                "canDelete": True,
                "slug": "test-dashboard",
                "url": "/d/test-uid/test-dashboard",
            },
        }

        response = GrafanaDashboardResponse(**dashboard_data)
        assert response.dashboard.uid == "test-uid"
        assert response.dashboard.title == "Test Dashboard"
        assert len(response.dashboard.panels) == 1
        assert response.meta.slug == "test-dashboard"

    def test_flatten_panels_collapsed_row(self):
        """Panels nested inside a collapsed row must be surfaced at the top level."""
        panels = [
            GrafanaPanel(id=1, type="graph", title="Top Level"),
            GrafanaPanel(
                id=2,
                type="row",
                title="Collapsed",
                collapsed=True,
                panels=[
                    GrafanaPanel(id=3, type="stat", title="Nested A"),
                    GrafanaPanel(id=4, type="table", title="Nested B"),
                ],
            ),
            GrafanaPanel(id=5, type="row", title="Expanded", collapsed=False, panels=[]),
            GrafanaPanel(id=6, type="bargauge", title="After Expanded Row"),
        ]
        flat = GrafanaSource._flatten_panels(panels)

        panel_ids = [p.id for p in flat]
        # Collapsed row (id=2) is replaced by its children 3 & 4; the expanded
        # row (id=5) stays as-is and its child (id=6) is already top-level.
        assert 1 in panel_ids, "Top-level panel must survive"
        assert 3 in panel_ids, "First panel inside collapsed row must be surfaced"
        assert 4 in panel_ids, "Second panel inside collapsed row must be surfaced"
        assert 2 not in panel_ids, "Collapsed row sentinel must not appear in output"
        assert 5 in panel_ids, "Expanded row sentinel stays (for type filtering)"
        assert 6 in panel_ids, "Child of expanded row at top level must survive"
        assert len(flat) == 5

    def test_flatten_panels_expanded_row_unchanged(self):
        """An expanded row (collapsed=False, empty panels) must not lose panels."""
        panels = [
            GrafanaPanel(id=1, type="graph", title="Normal"),
            GrafanaPanel(id=2, type="row", title="Row", collapsed=False, panels=[]),
            GrafanaPanel(id=3, type="stat", title="After Row"),
        ]
        flat = GrafanaSource._flatten_panels(panels)
        assert [p.id for p in flat] == [1, 2, 3]

    def test_flatten_panels_no_panels(self):
        """Empty or None input must not raise."""
        assert GrafanaSource._flatten_panels([]) == []
        assert GrafanaSource._flatten_panels(None) == []

    def test_api_client_initialization(self):
        """Test API client initialization"""
        client = GrafanaApiClient(
            host_port="https://grafana.example.com",
            api_key="test_key",
            verify_ssl=True,
            page_size=50,
        )

        assert client.host_port == "https://grafana.example.com"
        assert client.page_size == 50
        assert client.verify_ssl

        # Test session headers
        session = client.session
        assert session.headers["Authorization"] == "Bearer test_key"
        assert session.headers["Accept"] == "application/json"
