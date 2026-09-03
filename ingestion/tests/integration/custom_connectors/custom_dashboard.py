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
"""Custom Dashboard connector yielding a deterministic in-memory dashboard.

``DataModelType`` has no vendor-neutral member, so a custom connector has to
borrow one; ``SupersetDataModel`` is used here.
"""

from collections.abc import Iterable

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.dashboard import DashboardType
from metadata.generated.schema.entity.data.dashboardDataModel import DataModelType
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.connections.dashboard.customDashboardConnection import (
    CustomDashboardConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata

CHARTS: list[tuple[str, ChartType, str]] = [
    ("revenue_by_month", ChartType.Line, "Monthly revenue trend"),
    ("orders_by_region", ChartType.Bar, "Order counts split by sales region"),
]

DATA_MODEL = "my_revenue_model"
DASHBOARD_NAME = "my_sales_overview"


class CustomDashboardSource(Source):
    """Yields two charts, a data model and one dashboard referencing both."""

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = config.serviceConnection.root.config

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "CustomDashboardSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, CustomDashboardConnection):
            raise InvalidSourceException(f"Expected CustomDashboardConnection, but got {connection}")
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        """No external system to reach"""

    def close(self) -> None:
        """Nothing to close"""

    def _iter(self, *_, **__) -> Iterable[Either]:
        service_name = self.config.serviceName
        yield Either(
            right=CreateDashboardServiceRequest(
                name=service_name,
                serviceType=DashboardServiceType.CustomDashboard,
                connection=self.config.serviceConnection.root,
                displayName="Custom Dashboard Demo",
                description="Reporting served by the custom dashboard connector",
            )
        )
        for chart_name, chart_type, chart_description in CHARTS:
            yield Either(
                right=CreateChartRequest(
                    name=chart_name,
                    displayName=chart_name.replace("_", " ").title(),
                    description=chart_description,
                    chartType=chart_type,
                    service=service_name,
                    sourceUrl=f"https://dashboards.example.com/chart/{chart_name}",
                )
            )
        yield Either(
            right=CreateDashboardDataModelRequest(
                name=DATA_MODEL,
                displayName="My Revenue Model",
                description="Semantic model backing the sales overview",
                service=service_name,
                dataModelType=DataModelType.SupersetDataModel,
                sql="SELECT day, sum(total_amount) AS revenue FROM orders GROUP BY day",
                columns=[
                    Column(name="day", dataType=DataType.DATE, description="Calendar day"),
                    Column(name="revenue", dataType=DataType.DECIMAL, description="Revenue for the day"),
                ],
            )
        )
        yield Either(
            right=CreateDashboardRequest(
                name=DASHBOARD_NAME,
                displayName="My Sales Overview",
                description="Dashboard produced by the custom dashboard connector",
                dashboardType=DashboardType.Dashboard,
                service=service_name,
                charts=[f"{service_name}.{chart_name}" for chart_name, _, _ in CHARTS],
                dataModels=[f"{service_name}.model.{DATA_MODEL}"],
                sourceUrl=f"https://dashboards.example.com/dashboard/{DASHBOARD_NAME}",
            )
        )
