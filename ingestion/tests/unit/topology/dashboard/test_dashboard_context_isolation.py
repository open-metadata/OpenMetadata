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
"""Dashboard requests only reference charts from their own source."""

from unittest.mock import MagicMock

import pytest

from metadata.ingestion.source.dashboard.redash.metadata import RedashSource
from metadata.ingestion.source.dashboard.superset.metadata import SupersetSource


@pytest.mark.parametrize("previous_type", ["redash", "superset"])
@pytest.mark.parametrize("previous_charts", [[], ["37"]])
def test_dashboard_charts_do_not_leak_between_sources(monkeypatch, previous_type, previous_charts):
    monkeypatch.setattr("metadata.ingestion.source.dashboard.dashboard_service.create_connection", lambda _: None)
    monkeypatch.setattr("metadata.ingestion.source.dashboard.dashboard_service.get_connection", lambda _: MagicMock())
    monkeypatch.setattr("metadata.ingestion.source.dashboard.dashboard_service.run_test_connection", lambda **_: None)
    config = {
        "type": "redash",
        "serviceName": "my_service",
        "serviceConnection": {
            "config": {
                "type": "Redash",
                "hostPort": "http://localhost:5000",
                "apiKey": "testing",
                "username": "testing",
            }
        },
        "sourceConfig": {"config": {"type": "DashboardMetadata", "includeTags": False, "includeOwners": False}},
    }
    if previous_type == "superset":
        previous = SupersetSource.create(
            {
                **config,
                "type": "superset",
                "serviceConnection": {
                    "config": {
                        "type": "Superset",
                        "hostPort": "http://localhost:8088",
                        "connection": {"username": "testing", "password": "testing", "provider": "db"},
                    }
                },
            },
            MagicMock(),
        )
    else:
        previous = RedashSource.create(config, MagicMock())
    previous.context.get().upsert("dashboard_service", "previous_service")
    previous.context.get().upsert("charts", previous_charts)

    current = RedashSource.create(config, MagicMock())
    current.context.get().upsert("dashboard_service", "my_service")
    result = next(current.yield_dashboard({"id": 1, "name": "My dashboard", "widgets": []}))
    assert result.left is None
    assert result.right.charts == []

    current.context.get().upsert("charts", ["my_chart"])
    result = next(current.yield_dashboard({"id": 2, "name": "Another dashboard", "widgets": []}))
    assert result.left is None
    assert [chart.root for chart in result.right.charts] == ["my_service.my_chart"]
    assert previous.context.get().dashboard_service == "previous_service"
    assert previous.context.get().charts == previous_charts
