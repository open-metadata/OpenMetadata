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
Tests for Looker explore → dashboard and explore → chart lineage
"""

import uuid
from copy import deepcopy
from unittest.mock import MagicMock, patch

import pytest
from looker_sdk.sdk.api40.models import Dashboard as LookerDashboard
from looker_sdk.sdk.api40.models import DashboardElement, Query
from pydantic import ValidationError

from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.looker.metadata import (
    LookerSource,
    build_datamodel_name,
)

MOCK_LOOKER_CONFIG = {
    "source": {
        "type": "looker",
        "serviceName": "test_looker",
        "serviceConnection": {
            "config": {
                "type": "Looker",
                "clientId": "00000",
                "clientSecret": "abcdefg",
                "hostPort": "https://my-looker.com",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DashboardMetadata",
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        },
    },
}

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="test_looker",
    fullyQualifiedName=FullyQualifiedEntityName("test_looker"),
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Looker,
)

MOCK_EXPLORE_ID = uuid.uuid4()
MOCK_DASHBOARD_ID = uuid.uuid4()
MOCK_CHART_ID = uuid.uuid4()

MOCK_EXPLORE = DashboardDataModel(
    id=MOCK_EXPLORE_ID,
    name="model_view",
    fullyQualifiedName="test_looker.model.model_view",
    service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
    dataModelType="LookMlExplore",
    serviceType="Looker",
    columns=[],
)

MOCK_DASHBOARD_ENTITY = Dashboard(
    id=MOCK_DASHBOARD_ID,
    name="1",
    fullyQualifiedName="test_looker.1",
    service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
)

MOCK_CHART_ENTITY = Chart(
    id=MOCK_CHART_ID,
    name="chart_id1",
    fullyQualifiedName="test_looker.chart_id1",
    service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
)

MOCK_DASHBOARD_ELEMENTS = [
    DashboardElement(
        id="chart_id1",
        title="Chart 1",
        type="line",
        query=Query(model="model", view="view", share_url="https://my-looker.com/q/1"),
    ),
]

MOCK_LOOKER_DASHBOARD = LookerDashboard(
    id="1",
    title="Dashboard 1",
    dashboard_elements=MOCK_DASHBOARD_ELEMENTS,
)


@pytest.fixture
def create_looker_source():
    with patch("metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"):

        def create_source(source_config_overrides):
            config_dict = deepcopy(MOCK_LOOKER_CONFIG)
            config_dict["source"]["sourceConfig"]["config"].update(source_config_overrides)
            config = OpenMetadataWorkflowConfig.model_validate(config_dict)
            source = LookerSource.create(
                config_dict["source"],
                OpenMetadata(config.workflowConfig.openMetadataServerConfig),
            )
            source.context.get().__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root
            source.context.get().__dict__["dashboard"] = "1"
            return source

        yield create_source


@pytest.fixture
def looker_source(create_looker_source):
    return create_looker_source({})


class TestGetChartSourceMapping:
    def test_maps_chart_id_to_explore_names(self):
        mapping = LookerSource.get_chart_source_mapping(MOCK_LOOKER_DASHBOARD)

        assert "chart_id1" in mapping
        assert build_datamodel_name("model", "view") in mapping["chart_id1"]

    def test_chart_without_id_is_skipped(self):
        dashboard = LookerDashboard(
            id="d1",
            dashboard_elements=[
                DashboardElement(
                    id=None,
                    query=Query(model="model", view="view"),
                )
            ],
        )
        mapping = LookerSource.get_chart_source_mapping(dashboard)
        assert len(mapping) == 0

    def test_chart_without_query_view_is_skipped(self):
        dashboard = LookerDashboard(
            id="d1",
            dashboard_elements=[DashboardElement(id="c1", query=Query(model="model", view=None))],
        )
        mapping = LookerSource.get_chart_source_mapping(dashboard)
        assert len(mapping) == 0

    def test_multiple_charts_each_get_their_explores(self):
        dashboard = LookerDashboard(
            id="d1",
            dashboard_elements=[
                DashboardElement(
                    id="c1",
                    query=Query(model="model_a", view="explore_a"),
                ),
                DashboardElement(
                    id="c2",
                    query=Query(model="model_b", view="explore_b"),
                ),
            ],
        )
        mapping = LookerSource.get_chart_source_mapping(dashboard)

        assert "c1" in mapping
        assert "c2" in mapping
        assert build_datamodel_name("model_a", "explore_a") in mapping["c1"]
        assert build_datamodel_name("model_b", "explore_b") in mapping["c2"]

    def test_result_maker_query_is_used_when_present(self):
        result_maker = MagicMock()
        result_maker.query = Query(model="rm_model", view="rm_view")
        dashboard = LookerDashboard(
            id="d1",
            dashboard_elements=[
                DashboardElement(id="c1", result_maker=result_maker),
            ],
        )
        mapping = LookerSource.get_chart_source_mapping(dashboard)

        assert "c1" in mapping
        assert build_datamodel_name("rm_model", "rm_view") in mapping["c1"]

    def test_empty_dashboard_elements_returns_empty_mapping(self):
        dashboard = LookerDashboard(id="d1", dashboard_elements=[])
        mapping = LookerSource.get_chart_source_mapping(dashboard)
        assert mapping == {}


class TestYieldDashboardLineageDetails:
    @pytest.mark.parametrize(
        ("source_config", "expected_chart_lookups"),
        [
            ({}, 2),
            ({"includeDirectChartLineage": True}, 2),
            ({"includeDirectChartLineage": False}, 0),
            ({"includeDirectChartLineage": None}, 2),
        ],
        ids=["omitted", "enabled", "disabled", "null"],
    )
    def test_direct_chart_lineage_option(self, create_looker_source, source_config, expected_chart_lookups):
        source = create_looker_source(source_config)
        second_chart = Chart(
            id=uuid.uuid4(),
            name="chart_id2",
            fullyQualifiedName="test_looker.chart_id2",
            service=MOCK_CHART_ENTITY.service,
        )
        dashboard = LookerDashboard(
            id="1",
            title="Dashboard 1",
            dashboard_elements=[
                *MOCK_DASHBOARD_ELEMENTS,
                DashboardElement(id="chart_id2", query=Query(model="model", view="view")),
            ],
        )
        entities_by_name = {
            (Dashboard, "test_looker.1"): MOCK_DASHBOARD_ENTITY,
            (DashboardDataModel, "test_looker.model.model_view"): MOCK_EXPLORE,
            (Chart, "test_looker.chart_id1"): MOCK_CHART_ENTITY,
            (Chart, "test_looker.chart_id2"): second_chart,
        }

        def find_entity(entity, fqn):
            return entities_by_name[entity, fqn]

        with patch.object(OpenMetadata, "get_by_name", side_effect=find_entity) as get_by_name:
            results = list(source.yield_dashboard_lineage_details(dashboard))

        assert not [result.left for result in results if result.left]
        expected_targets = [("dashboard", MOCK_DASHBOARD_ID)]
        if expected_chart_lookups:
            expected_targets += [("chart", MOCK_CHART_ID), ("chart", second_chart.id.root)]
        assert [
            (
                result.right.edge.fromEntity.type,
                result.right.edge.fromEntity.id.root,
                result.right.edge.toEntity.type,
                result.right.edge.toEntity.id.root,
                result.right.edge.lineageDetails.source,
            )
            for result in results
        ] == [
            ("dashboardDataModel", MOCK_EXPLORE_ID, entity_type, entity_id, LineageSource.DashboardLineage)
            for entity_type, entity_id in expected_targets
        ]
        assert sum(call.kwargs["entity"] is Chart for call in get_by_name.call_args_list) == expected_chart_lookups

    def test_invalid_direct_chart_lineage_option_is_rejected(self, create_looker_source):
        with pytest.raises(ValidationError, match="includeDirectChartLineage"):
            create_looker_source({"includeDirectChartLineage": "not a boolean"})

    def test_explore_to_dashboard_lineage_is_created(self, looker_source):
        with (
            patch.object(
                OpenMetadata,
                "get_by_name",
                side_effect=lambda entity, fqn: (
                    MOCK_DASHBOARD_ENTITY
                    if entity is Dashboard
                    else MOCK_EXPLORE
                    if entity is DashboardDataModel
                    else None
                ),
            ),
        ):
            results = list(looker_source.yield_dashboard_lineage_details(MOCK_LOOKER_DASHBOARD))

        lineage_results = [r for r in results if r and r.right]
        assert len(lineage_results) > 0

        edges = [r.right.edge for r in lineage_results]
        explore_to_dashboard = [
            e for e in edges if e.toEntity.type == "dashboard" and e.fromEntity.type == "dashboardDataModel"
        ]
        assert len(explore_to_dashboard) == 1
        assert explore_to_dashboard[0].fromEntity.id.root == MOCK_EXPLORE_ID
        assert explore_to_dashboard[0].toEntity.id.root == MOCK_DASHBOARD_ID

    def test_explore_to_chart_lineage_is_created(self, looker_source):
        def get_by_name_side_effect(entity, fqn):
            if entity is Dashboard:
                return MOCK_DASHBOARD_ENTITY
            if entity is DashboardDataModel:
                return MOCK_EXPLORE
            if entity is Chart:
                return MOCK_CHART_ENTITY
            return None

        with patch.object(OpenMetadata, "get_by_name", side_effect=get_by_name_side_effect):
            results = list(looker_source.yield_dashboard_lineage_details(MOCK_LOOKER_DASHBOARD))

        lineage_results = [r for r in results if r and r.right]
        edges = [r.right.edge for r in lineage_results]

        explore_to_chart = [
            e for e in edges if e.toEntity.type == "chart" and e.fromEntity.type == "dashboardDataModel"
        ]
        assert len(explore_to_chart) == 1
        assert explore_to_chart[0].fromEntity.id.root == MOCK_EXPLORE_ID
        assert explore_to_chart[0].toEntity.id.root == MOCK_CHART_ID

    def test_lineage_source_is_dashboard_lineage(self, looker_source):
        def get_by_name_side_effect(entity, fqn):
            if entity is Dashboard:
                return MOCK_DASHBOARD_ENTITY
            if entity is DashboardDataModel:
                return MOCK_EXPLORE
            if entity is Chart:
                return MOCK_CHART_ENTITY
            return None

        with patch.object(OpenMetadata, "get_by_name", side_effect=get_by_name_side_effect):
            results = list(looker_source.yield_dashboard_lineage_details(MOCK_LOOKER_DASHBOARD))

        for r in results:
            if r and r.right:
                assert r.right.edge.lineageDetails.source == LineageSource.DashboardLineage

    def test_no_lineage_when_explore_not_found(self, looker_source):
        def get_by_name_side_effect(entity, fqn):
            if entity is Dashboard:
                return MOCK_DASHBOARD_ENTITY
            return None  # explore and chart not found

        with patch.object(OpenMetadata, "get_by_name", side_effect=get_by_name_side_effect):
            results = list(looker_source.yield_dashboard_lineage_details(MOCK_LOOKER_DASHBOARD))

        lineage_results = [r for r in results if r and r.right]
        assert len(lineage_results) == 0

    @pytest.mark.parametrize("include_direct_chart_lineage", [True, False])
    def test_no_dashboard_lineage_when_dashboard_not_found(self, create_looker_source, include_direct_chart_lineage):
        source = create_looker_source({"includeDirectChartLineage": include_direct_chart_lineage})

        def get_by_name_side_effect(entity, fqn):
            if entity is Dashboard:
                return None  # dashboard not found
            if entity is DashboardDataModel:
                return MOCK_EXPLORE
            if entity is Chart:
                return MOCK_CHART_ENTITY
            return None

        with patch.object(OpenMetadata, "get_by_name", side_effect=get_by_name_side_effect):
            results = list(source.yield_dashboard_lineage_details(MOCK_LOOKER_DASHBOARD))

        edges = [r.right.edge for r in results if r and r.right]
        explore_to_dashboard = [e for e in edges if e.toEntity.type == "dashboard"]
        assert len(explore_to_dashboard) == 0

        explore_to_chart = [e for e in edges if e.toEntity.type == "chart"]
        assert len(explore_to_chart) == (1 if include_direct_chart_lineage else 0)

    def test_explore_cached_takes_precedence_over_api(self, looker_source):
        cached_explore = DashboardDataModel(
            id=uuid.uuid4(),
            name="model_view",
            fullyQualifiedName="test_looker.model_view",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            dataModelType="LookMlExplore",
            serviceType="Looker",
            columns=[],
        )
        looker_source._explores_cache["model_view"] = cached_explore

        api_call_count = {"count": 0}

        def get_by_name_side_effect(entity, fqn):
            if entity is DashboardDataModel:
                api_call_count["count"] += 1
            if entity is Dashboard:
                return MOCK_DASHBOARD_ENTITY
            if entity is Chart:
                return MOCK_CHART_ENTITY
            return None

        with patch.object(OpenMetadata, "get_by_name", side_effect=get_by_name_side_effect):
            results = list(looker_source.yield_dashboard_lineage_details(MOCK_LOOKER_DASHBOARD))

        # explore was served from cache, not from API
        assert api_call_count["count"] == 0
        lineage_results = [r for r in results if r and r.right]
        assert len(lineage_results) > 0

    def test_chart_lineage_error_does_not_stop_processing(self, looker_source):
        dashboard = LookerDashboard(
            id="d_multi",
            dashboard_elements=[
                DashboardElement(
                    id="c_bad",
                    query=Query(model="model", view="view"),
                ),
                DashboardElement(
                    id="c_good",
                    query=Query(model="model", view="view"),
                ),
            ],
        )
        looker_source.context.get().__dict__["dashboard"] = "d_multi"

        call_count = {"n": 0}

        def get_by_name_side_effect(entity, fqn):
            if entity is Dashboard:
                return MOCK_DASHBOARD_ENTITY
            if entity is DashboardDataModel:
                return MOCK_EXPLORE
            if entity is Chart:
                call_count["n"] += 1
                if call_count["n"] == 1:
                    raise Exception("API error for first chart")  # noqa: TRY002
                return MOCK_CHART_ENTITY
            return None

        with patch.object(OpenMetadata, "get_by_name", side_effect=get_by_name_side_effect):
            results = list(looker_source.yield_dashboard_lineage_details(dashboard))

        # Second chart lineage was still processed despite first chart error
        explore_to_chart = [r for r in results if r and r.right and r.right.edge.toEntity.type == "chart"]
        assert len(explore_to_chart) == 1

    def test_both_lineage_types_created_together(self, looker_source):
        def get_by_name_side_effect(entity, fqn):
            if entity is Dashboard:
                return MOCK_DASHBOARD_ENTITY
            if entity is DashboardDataModel:
                return MOCK_EXPLORE
            if entity is Chart:
                return MOCK_CHART_ENTITY
            return None

        with patch.object(OpenMetadata, "get_by_name", side_effect=get_by_name_side_effect):
            results = list(looker_source.yield_dashboard_lineage_details(MOCK_LOOKER_DASHBOARD))

        lineage_results = [r for r in results if r and r.right]
        edges = [r.right.edge for r in lineage_results]

        to_types = {e.toEntity.type for e in edges}
        assert "dashboard" in to_types
        assert "chart" in to_types
