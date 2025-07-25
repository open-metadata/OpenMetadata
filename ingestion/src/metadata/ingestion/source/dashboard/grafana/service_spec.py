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
Grafana Service Specification
"""
from metadata.generated.schema.entity.services.connections.dashboard.grafanaConnection import (
    GrafanaConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)

ServiceSpec = {
    "type": DashboardServiceType.Grafana,
    "spec": {
        "class": "metadata.ingestion.source.dashboard.grafana.metadata.GrafanaSource",
        "connection": GrafanaConnection,
    },
}
