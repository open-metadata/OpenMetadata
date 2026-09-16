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
Tests for OpenMetadata._group_entities_by_type bulk-create ordering.

A Dashboard references Charts and DashboardDataModels by FQN. The backend rejects
a Dashboard bulk-create with HTTP 400 ("chart instance ... not found") when those
references are not yet persisted. The bulk sink groups a mixed buffer by type and
must always create Charts and DashboardDataModels before the Dashboards that
reference them, regardless of the order entities were buffered in.
"""

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.dashboardDataModel import DataModelType
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.ingestion.ometa.ometa_api import OpenMetadata

SERVICE = FullyQualifiedEntityName("test_service")


def _chart(name: str) -> CreateChartRequest:
    return CreateChartRequest(name=EntityName(name), service=SERVICE)


def _dashboard(name: str) -> CreateDashboardRequest:
    return CreateDashboardRequest(name=EntityName(name), service=SERVICE)


def _data_model(name: str) -> CreateDashboardDataModelRequest:
    return CreateDashboardDataModelRequest(
        name=EntityName(name),
        service=SERVICE,
        dataModelType=DataModelType.QuickSightDataModel,
        columns=[Column(name="col1", dataType=DataType.STRING)],
    )


def _group(entities):
    """_group_entities_by_type only relies on get_entity_from_create + the cached
    hierarchy, so it needs no live connection — bypass __init__."""
    ometa = OpenMetadata.__new__(OpenMetadata)
    return list(ometa._group_entities_by_type(entities).keys())


class TestGroupEntitiesByTypeOrdering:
    def test_chart_and_datamodel_grouped_before_dashboard(self):
        """Even when the Dashboard is buffered first, Chart and DashboardDataModel
        groups must be ordered ahead of the Dashboard group."""
        buffer = [
            _dashboard("dash-1"),
            _chart("chart-1"),
            _data_model("dm-1"),
        ]

        ordered_types = _group(buffer)

        dashboard_idx = ordered_types.index(CreateDashboardRequest)
        chart_idx = ordered_types.index(CreateChartRequest)
        datamodel_idx = ordered_types.index(CreateDashboardDataModelRequest)

        assert chart_idx < dashboard_idx
        assert datamodel_idx < dashboard_idx

    def test_dashboard_first_in_batch_still_orders_charts_first(self):
        """Regression for the bulk-flush batch where a Dashboard is the first-seen
        type (the original 400 'chart instance not found' scenario)."""
        buffer = [
            _dashboard("dash-1"),
            _dashboard("dash-2"),
            _chart("chart-1"),
            _chart("chart-2"),
        ]

        ordered_types = _group(buffer)

        assert ordered_types.index(CreateChartRequest) < ordered_types.index(CreateDashboardRequest)
