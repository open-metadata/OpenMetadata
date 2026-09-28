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
"""Unit tests for QlikSense stream → project mapping (issue #32502)."""

from unittest.mock import MagicMock

from metadata.ingestion.source.dashboard.qliksense.metadata import QliksenseSource
from metadata.ingestion.source.dashboard.qliksense.models import (
    QlikDashboard,
    QlikDashboardMeta,
    QlikStream,
)

SOURCE_MODULE = "metadata.ingestion.source.dashboard.qliksense.metadata"


def _make_source() -> QliksenseSource:
    """Build a QliksenseSource with all external calls patched."""
    source = QliksenseSource.__new__(QliksenseSource)
    source.source_config = MagicMock()
    source.service_connection = MagicMock()
    source.context = MagicMock()
    source.client = MagicMock()
    source.metadata = MagicMock()
    return source


def _make_dashboard(stream_name: str | None) -> QlikDashboard:
    stream = QlikStream(id="stream-id", name=stream_name) if stream_name is not None else None
    meta = QlikDashboardMeta(published=True, stream=stream)
    return QlikDashboard(qDocId="app-1", qDocName="MyApp", qTitle="My App", qMeta=meta)


class TestGetProjectName:
    def test_returns_stream_name_when_present(self):
        source = _make_source()
        dashboard = _make_dashboard("sandbox")
        assert source.get_project_name(dashboard) == "sandbox"

    def test_returns_none_when_stream_is_none(self):
        source = _make_source()
        dashboard = _make_dashboard(None)
        assert source.get_project_name(dashboard) is None

    def test_returns_none_when_qmeta_is_none(self):
        source = _make_source()
        dashboard = QlikDashboard(qDocId="app-1", qDocName="MyApp", qTitle="My App", qMeta=None)
        assert source.get_project_name(dashboard) is None

    def test_returns_none_when_stream_name_is_none(self):
        source = _make_source()
        dashboard = QlikDashboard(
            qDocId="app-1",
            qDocName="MyApp",
            qTitle="My App",
            qMeta=QlikDashboardMeta(stream=QlikStream(id="sid", name=None)),
        )
        assert source.get_project_name(dashboard) is None


class TestQlikStreamModel:
    def test_stream_parsed_from_qmeta(self):
        data = {
            "qDocId": "app-1",
            "qDocName": "MyApp",
            "qTitle": "My App",
            "qMeta": {"published": True, "stream": {"id": "abc", "name": "Monitoring apps"}},
        }
        dashboard = QlikDashboard.model_validate(data)
        assert dashboard.qMeta.stream.name == "Monitoring apps"
        assert dashboard.qMeta.stream.id == "abc"

    def test_missing_stream_field_defaults_to_none(self):
        data = {
            "qDocId": "app-1",
            "qDocName": "MyApp",
            "qTitle": "My App",
            "qMeta": {"published": True},
        }
        dashboard = QlikDashboard.model_validate(data)
        assert dashboard.qMeta.stream is None
