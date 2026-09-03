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
"""Unit tests for the Mode dashboard source."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.mode.metadata import ModeSource

MOCK_CONFIG = {
    "source": {
        "type": "mode",
        "serviceName": "mock_mode",
        "serviceConnection": {
            "config": {
                "type": "Mode",
                "hostPort": "https://app.mode.com/",
                "accessToken": "token",
                "accessTokenPassword": "password",
                "workspaceName": "acme",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DashboardMetadata",
                "dashboardFilterPattern": {},
                "chartFilterPattern": {},
                "dataModelFilterPattern": {},
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "test-token"},
        },
    },
}

REPORT = {
    "token": "report-token",
    "name": "Revenue Report",
    "description": "Revenue by account",
    "_links": {"share": {"href": "/acme/reports/report-token"}},
}

QUERY = {
    "token": "query-token",
    "name": "Revenue Query",
    "raw_query": "SELECT * FROM analytics.orders",
    "data_source_id": "source-id",
}


def _embedded(name: str, values: list[dict]) -> dict:
    return {"_embedded": {name: values}}


@pytest.fixture
def mode_source():
    mode_api = MagicMock()
    mode_api.get_all_data_sources.return_value = {
        "source-id": {
            "token": "warehouse-token",
            "name": "Warehouse",
            "database": "analytics_db",
        }
    }
    mode_api.get_all_queries.return_value = _embedded("queries", [QUERY])
    mode_api.get_all_charts.return_value = _embedded("charts", [])

    with (
        patch("metadata.ingestion.source.dashboard.dashboard_service.run_test_connection"),
        patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection") as create_connection,
    ):
        create_connection.return_value.client = mode_api
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_CONFIG)
        source = ModeSource.create(
            MOCK_CONFIG["source"],
            OpenMetadata(config.workflowConfig.openMetadataServerConfig),
        )

    source.client = mode_api
    source.data_sources = mode_api.get_all_data_sources.return_value
    source.dashboard_source_state = set()
    source.datamodel_source_state = set()
    source.chart_source_state = set()
    source.context.get().__dict__["dashboard_service"] = "mock_mode"
    source.context.get().__dict__["charts"] = []
    source.context.get().__dict__["dataModels"] = []
    source.status = MagicMock()
    return source


def _details(mode_source, queries=None):
    if queries is not None:
        mode_source.client.get_all_queries.return_value = _embedded("queries", queries)
    return mode_source.get_dashboard_details(REPORT)


def _lineage_entities():
    data_model = DashboardDataModel.model_construct(
        id=Uuid("6e781e63-e30f-4c6e-891a-389f1f982cab"),
        fullyQualifiedName=FullyQualifiedEntityName('mock_mode."report-token.query-token"'),
    )
    dashboard = Dashboard.model_construct(
        id=Uuid("4248eaa4-2183-4bc4-980a-26893311676f"),
        fullyQualifiedName=FullyQualifiedEntityName("mock_mode.report-token"),
    )
    table = Table.model_construct(
        id=Uuid("b9553fd0-408d-45aa-b38a-43e72ec731ee"),
        fullyQualifiedName=FullyQualifiedEntityName("warehouse.analytics_db.analytics.orders"),
    )
    return data_model, dashboard, table


class TestModeQueryMetadata:
    def test_dashboard_name_falls_back_to_token(self, mode_source):
        assert mode_source.get_dashboard_name({**REPORT, "name": None}) == "report-token"

    def test_query_becomes_registered_dashboard_data_model(self, mode_source):
        result = list(mode_source.yield_datamodel(_details(mode_source)))

        assert len(result) == 1
        data_model = result[0].right
        assert data_model.name.root == "report-token.query-token"
        assert data_model.displayName == "Revenue Query"
        assert data_model.dataModelType.value == "ModeDataModel"
        assert data_model.service.root == "mock_mode"
        assert data_model.serviceType.value == "Mode"
        assert data_model.sql.root == QUERY["raw_query"]
        assert data_model.columns == []
        assert data_model.sourceUrl.root == ("https://app.mode.com/acme/reports/report-token/queries/query-token")
        assert len(mode_source.datamodel_source_state) == 1

    def test_query_name_falls_back_to_token(self, mode_source):
        unnamed_query = {**QUERY, "name": None}

        result = list(mode_source.yield_datamodel(_details(mode_source, [unnamed_query])))

        assert result[0].right.displayName == "query-token"

    def test_data_model_filter_uses_query_name(self, mode_source):
        mode_source.source_config.dataModelFilterPattern = FilterPattern(excludes=["Revenue Query"])

        result = list(mode_source.yield_datamodel(_details(mode_source)))

        assert result == []
        mode_source.status.filter.assert_called_once_with("Revenue Query", "Data model filtered out.")

    def test_include_data_models_false_skips_queries(self, mode_source):
        mode_source.source_config.includeDataModels = False

        assert list(mode_source.yield_datamodel(_details(mode_source))) == []
        assert mode_source.datamodel_source_state == set()

    def test_dashboard_contains_only_emitted_query_models(self, mode_source):
        details = _details(mode_source)
        mode_source.context.get().__dict__["dataModels"] = ["report-token.query-token"]

        dashboard = next(iter(mode_source.yield_dashboard(details))).right

        assert [value.root for value in dashboard.dataModels] == ['mock_mode.model."report-token.query-token"']

    def test_dashboard_omits_data_models_when_disabled(self, mode_source):
        mode_source.source_config.includeDataModels = False
        details = _details(mode_source)
        mode_source.context.get().__dict__["dataModels"] = ["report-token.query-token"]

        dashboard = next(iter(mode_source.yield_dashboard(details))).right

        assert dashboard.dataModels is None

    def test_report_without_queries_is_still_ingested(self, mode_source):
        details = _details(mode_source, [])

        assert list(mode_source.yield_datamodel(details)) == []
        assert list(mode_source.yield_dashboard_chart(details)) == []
        dashboard = next(iter(mode_source.yield_dashboard(details))).right
        assert dashboard.name.root == "report-token"
        assert dashboard.dataModels == []

    def test_charts_use_the_queries_already_loaded_for_the_report(self, mode_source):
        mode_source.client.get_all_charts.return_value = _embedded(
            "charts",
            [
                {
                    "token": "chart-token",
                    "view_vegas": {"title": "Revenue by Account"},
                    "_links": {"report_viz_web": {"href": "/acme/reports/report-token/charts/chart-token"}},
                }
            ],
        )
        details = _details(mode_source)

        chart = next(iter(mode_source.yield_dashboard_chart(details))).right

        assert chart.name.root == "chart-token"
        assert chart.displayName == "Revenue by Account"
        assert chart.sourceUrl.root.endswith("/acme/reports/report-token/charts/chart-token")
        mode_source.client.get_all_queries.assert_called_once()

    def test_chart_stage_reports_missing_query_token_and_continues(self, mode_source):
        query_without_token = {**QUERY, "token": None}
        mode_source.client.get_all_charts.return_value = _embedded("charts", [])

        result = list(mode_source.yield_dashboard_chart(_details(mode_source, [query_without_token, QUERY])))

        assert result[0].left.name == "Revenue Query"
        assert result[0].left.error == "Mode query is missing its token; charts could not be fetched"
        mode_source.client.get_all_charts.assert_called_once_with(
            workspace_name="acme",
            report_token="report-token",
            query_token="query-token",
        )

    def test_chart_stage_handles_failed_charts_request(self, mode_source):
        mode_source.client.get_all_charts.return_value = None

        assert list(mode_source.yield_dashboard_chart(_details(mode_source))) == []

    def test_queries_are_fetched_once_for_all_report_stages(self, mode_source):
        details = _details(mode_source)

        list(mode_source.yield_dashboard_chart(details))
        list(mode_source.yield_datamodel(details))
        list(mode_source.yield_dashboard_lineage_details(details))

        mode_source.client.get_all_queries.assert_called_once_with(workspace_name="acme", report_token="report-token")


class TestModeQueryLineage:
    @staticmethod
    def _prepare_metadata(mode_source, data_model_available=True):
        data_model, dashboard, table = _lineage_entities()

        def get_by_name(entity, **_):
            if entity is DashboardDataModel:
                return data_model if data_model_available else None
            if entity is Dashboard:
                return dashboard
            return None

        mode_source.metadata = MagicMock()
        mode_source.metadata.get_by_name = MagicMock(side_effect=get_by_name)
        mode_source.metadata.search_in_any_service = MagicMock(return_value=[table])
        return data_model, dashboard, table

    @staticmethod
    def _run_lineage(mode_source):
        parser = SimpleNamespace(
            query_hash="query-hash",
            source_tables=["analytics.orders"],
        )
        with patch(
            "metadata.ingestion.source.dashboard.mode.metadata.LineageParser",
            return_value=parser,
        ):
            return list(mode_source.yield_dashboard_lineage_details(_details(mode_source)))

    def test_table_lineage_targets_query_data_model_with_sql(self, mode_source):
        data_model, _, table = self._prepare_metadata(mode_source)
        mode_source.context.get().__dict__["dataModels"] = ["report-token.query-token"]

        result = self._run_lineage(mode_source)

        assert len(result) == 1
        edge = result[0].right.edge
        assert edge.fromEntity.id == table.id
        assert edge.toEntity.id == data_model.id
        assert edge.toEntity.type == "dashboardDataModel"
        assert edge.lineageDetails.sqlQuery.root == QUERY["raw_query"]

    def test_lineage_targets_dashboard_when_data_models_disabled(self, mode_source):
        _, dashboard, _ = self._prepare_metadata(mode_source)
        mode_source.source_config.includeDataModels = False

        result = self._run_lineage(mode_source)

        assert result[0].right.edge.toEntity.id == dashboard.id
        assert result[0].right.edge.toEntity.type == "dashboard"

    def test_lineage_targets_dashboard_when_query_model_was_filtered(self, mode_source):
        _, dashboard, _ = self._prepare_metadata(mode_source)
        mode_source.context.get().__dict__["dataModels"] = []

        result = self._run_lineage(mode_source)

        assert result[0].right.edge.toEntity.id == dashboard.id

    def test_lineage_falls_back_when_query_model_is_unavailable(self, mode_source):
        _, dashboard, _ = self._prepare_metadata(mode_source, data_model_available=False)
        mode_source.context.get().__dict__["dataModels"] = ["report-token.query-token"]

        result = self._run_lineage(mode_source)

        assert result[0].right.edge.toEntity.id == dashboard.id

    def test_lineage_skips_query_when_database_is_unknown(self, mode_source):
        self._prepare_metadata(mode_source)
        mode_source.data_sources["source-id"].pop("database")

        result = self._run_lineage(mode_source)

        assert result == []
        mode_source.metadata.search_in_any_service.assert_not_called()
