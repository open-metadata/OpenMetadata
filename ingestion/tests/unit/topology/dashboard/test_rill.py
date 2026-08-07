#  Copyright 2025 OpenMetadata
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Tests for the Rill dashboard connector."""

from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch, sentinel

import pytest

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.dashboardDataModel import DataModelType
from metadata.generated.schema.entity.data.table import DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.rillConnection import (
    RillConnection,
)
from metadata.ingestion.source.dashboard.rill.client import (
    EXPLORE_KIND,
    METRICS_VIEW_KIND,
    MODEL_KIND,
    RillApiClient,
    get_rill_cloud_project,
)
from metadata.ingestion.source.dashboard.rill.connection import (
    RillConnection as RillConnectionHandler,
)
from metadata.ingestion.source.dashboard.rill.metadata import RillSource
from metadata.ingestion.source.dashboard.rill.models import RillResource
from metadata.ingestion.source.dashboard.rill.service_spec import ServiceSpec

EXPLORE_RESOURCE = {
    "meta": {
        "name": {
            "kind": "rill.runtime.v1.Explore",
            "name": "pull_request_velocity",
        },
        "refs": [
            {
                "kind": "rill.runtime.v1.MetricsView",
                "name": "pull_request_metrics",
            }
        ],
    },
    "explore": {
        "spec": {
            "displayName": "Old display name",
            "description": "Old description",
            "metricsView": "pull_request_metrics",
        },
        "state": {
            "validSpec": {
                "displayName": "Pull Request Velocity",
                "description": "Review and merge performance.",
                "metricsView": "pull_request_metrics",
            }
        },
    },
}

CANVAS_RESOURCE = {
    "meta": {
        "name": {
            "kind": "rill.runtime.v1.Canvas",
            "name": "engineering_overview",
        }
    },
    "canvas": {
        "state": {
            "validSpec": {
                "displayName": "Engineering Overview",
                "rows": [
                    {
                        "items": [
                            {"component": "merge_time"},
                            {"component": "review_table"},
                        ]
                    },
                    {
                        "tabGroup": {
                            "name": "details",
                            "tabs": [
                                {
                                    "name": "velocity",
                                    "rows": [
                                        {
                                            "items": [
                                                {"component": "merge_time"},
                                            ]
                                        }
                                    ],
                                }
                            ],
                        }
                    },
                ],
            }
        }
    },
}

COMPONENT_RESOURCES = [
    {
        "meta": {
            "name": {
                "kind": "rill.runtime.v1.Component",
                "name": "merge_time",
            },
            "refs": [
                {
                    "kind": "rill.runtime.v1.MetricsView",
                    "name": "pull_request_metrics",
                }
            ],
        },
        "component": {
            "state": {
                "validSpec": {
                    "displayName": "Merge Time",
                    "description": "Average time to merge.",
                    "renderer": "line_chart",
                    "rendererProperties": {
                        "metrics_view": "pull_request_metrics",
                    },
                }
            }
        },
    },
    {
        "meta": {
            "name": {
                "kind": "rill.runtime.v1.Component",
                "name": "review_table",
            }
        },
        "component": {
            "state": {
                "validSpec": {
                    "displayName": "Reviews",
                    "renderer": "table",
                }
            }
        },
    },
]

METRICS_VIEW_RESOURCE = {
    "meta": {
        "name": {
            "kind": "rill.runtime.v1.MetricsView",
            "name": "pull_request_metrics",
        },
        "refs": [
            {
                "kind": "rill.runtime.v1.Model",
                "name": "pull_requests",
            }
        ],
        "filePaths": ["/metrics/pull_request_metrics.yaml"],
    },
    "metricsView": {
        "state": {
            "validSpec": {
                "model": "pull_requests",
                "displayName": "Pull Request Metrics",
                "description": "Semantic metrics for pull requests.",
                "timeDimension": "created_at",
                "dimensions": [
                    {
                        "name": "repository",
                        "displayName": "Repository",
                        "description": "Repository name.",
                        "column": "repository",
                        "dataType": {
                            "code": "CODE_STRING",
                            "rawType": "VARCHAR",
                        },
                    }
                ],
                "measures": [
                    {
                        "name": "average_merge_time",
                        "displayName": "Average Merge Time",
                        "description": "Average time to merge.",
                        "expression": "AVG(merge_time_hours)",
                        "dataType": {
                            "code": "CODE_FLOAT64",
                            "rawType": "DOUBLE",
                        },
                    }
                ],
            }
        }
    },
}

MODEL_RESOURCE = {
    "meta": {
        "name": {
            "kind": "rill.runtime.v1.Model",
            "name": "pull_requests",
        },
        "refs": [
            {
                "kind": "rill.runtime.v1.Model",
                "name": "raw_pull_requests",
            }
        ],
        "filePaths": ["/models/pull_requests.sql"],
    },
    "model": {
        "spec": {
            "inputConnector": "duckdb",
            "inputProperties": {
                "sql": "SELECT * FROM raw_pull_requests",
            },
            "outputConnector": "duckdb",
            "outputProperties": {
                "materialize": True,
            },
        },
        "state": {
            "resultTable": "pull_requests",
        },
    },
}

EXTERNAL_METRICS_VIEW_RESOURCE = {
    "meta": {
        "name": {
            "kind": "rill.runtime.v1.MetricsView",
            "name": "auction_metrics",
        },
        "refs": [
            {
                "kind": "rill.runtime.v1.Connector",
                "name": "clickhouse",
            }
        ],
    },
    "metricsView": {
        "state": {
            "validSpec": {
                "connector": "clickhouse",
                "databaseSchema": "rill_data",
                "table": "auctions",
                "displayName": "Auction Metrics",
            }
        }
    },
}

RILL_TABLE_METRICS_VIEW_RESOURCE = {
    "meta": {
        "name": {
            "kind": "rill.runtime.v1.MetricsView",
            "name": "pull_request_table_metrics",
        },
        "refs": [
            {
                "kind": "rill.runtime.v1.Model",
                "name": "pull_requests",
            }
        ],
    },
    "metricsView": {
        "state": {
            "validSpec": {
                "connector": "duckdb",
                "table": "pull_requests",
                "displayName": "Pull Request Table Metrics",
            }
        }
    },
}

EXTERNAL_MODEL_RESOURCE = {
    "meta": {
        "name": {
            "kind": "rill.runtime.v1.Model",
            "name": "auction_rollup",
        },
        "refs": [
            {
                "kind": "rill.runtime.v1.Connector",
                "name": "clickhouse",
            }
        ],
    },
    "model": {
        "spec": {
            "inputConnector": "clickhouse",
            "inputProperties": {
                "sql": "SELECT * FROM rill_data.auctions",
            },
            "outputConnector": "clickhouse",
        }
    },
}


def make_source(host_port: str) -> RillSource:
    source = object.__new__(RillSource)
    source.service_connection = RillConnection(
        type="Rill",
        hostPort=host_port,
        token="test-token",
    )
    source.metadata = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(
        dashboard_service="mock_rill",
        charts=[],
    )
    source.source_config = SimpleNamespace(
        chartFilterPattern=None,
        dataModelFilterPattern=None,
        includeDataModels=True,
    )
    source.status = MagicMock()
    source.register_record = MagicMock()
    source.register_record_chart = MagicMock()
    source.register_record_datamodel = MagicMock()
    source.components = {
        resource["meta"]["name"]["name"]: RillResource.model_validate(resource) for resource in COMPONENT_RESOURCES
    }
    source.models = {
        "pull_requests": RillResource.model_validate(MODEL_RESOURCE),
    }
    source.metrics_views = {
        "pull_request_metrics": RillResource.model_validate(METRICS_VIEW_RESOURCE),
    }
    source.lineage_edges = set()
    return source


class TestRillClient:
    def test_service_spec_registers_source_and_connection(self):
        assert ServiceSpec.metadata_source_class == "metadata.ingestion.source.dashboard.rill.metadata.RillSource"
        assert ServiceSpec.connection_class == "metadata.ingestion.source.dashboard.rill.connection.RillConnection"

    @patch("metadata.ingestion.source.dashboard.rill.connection.test_connection_steps")
    def test_connection_steps_match_test_connection_definition(self, test_connection_steps):
        connection = RillConnectionHandler(
            RillConnection(
                type="Rill",
                hostPort="http://localhost:9009",
            )
        )
        connection._client = MagicMock()

        connection.test_connection(MagicMock())

        assert list(test_connection_steps.call_args.kwargs["test_fn"]) == [
            "CheckAccess",
            "GetDashboards",
            "GetCharts",
            "GetDataModels",
        ]

    def test_cloud_project_url_uses_runtime_proxy(self):
        config = RillConnection(
            type="Rill",
            hostPort="https://api.rilldata.com/v1/orgs/demo/projects/rill-openrtb-prog-ads",
            token="test-token",
        )

        with patch("metadata.ingestion.source.dashboard.rill.client.TrackedREST") as tracked_rest:
            RillApiClient(config)

        client_config = tracked_rest.call_args.args[0]
        assert client_config.api_version == "runtime"
        assert client_config.access_token == "test-token"
        assert client_config.auth_token_mode == "Bearer"

    def test_local_runtime_uses_default_instance(self):
        config = RillConnection(
            type="Rill",
            hostPort="http://localhost:9009",
        )

        with patch("metadata.ingestion.source.dashboard.rill.client.TrackedREST") as tracked_rest:
            RillApiClient(config)

        client_config = tracked_rest.call_args.args[0]
        assert client_config.api_version == "v1/instances/default"
        assert client_config.auth_header is None

    def test_cloud_project_without_token_raises_a_clear_error(self):
        config = RillConnection(
            type="Rill",
            hostPort="https://api.rilldata.com/v1/orgs/demo/projects/rill-openrtb-prog-ads",
        )

        with pytest.raises(ValueError, match="API token is required"):
            RillApiClient(config)

    def test_cloud_project_with_branch_raises_unsupported_error(self):
        config = RillConnection(
            type="Rill",
            hostPort="https://api.rilldata.com/v1/orgs/demo/projects/rill-openrtb-prog-ads/branch/staging",
            token="test-token",
        )

        with pytest.raises(ValueError, match="branch-level routing is not supported"):
            RillApiClient(config)

    def test_cloud_project_parser_supports_current_and_legacy_paths(self):
        assert get_rill_cloud_project("https://api.rilldata.com/v1/orgs/demo/projects/rill-openrtb-prog-ads") == (
            "demo",
            "rill-openrtb-prog-ads",
        )
        assert get_rill_cloud_project(
            "https://api.rilldata.com/v1/organizations/demo/projects/rill-openrtb-prog-ads"
        ) == ("demo", "rill-openrtb-prog-ads")
        assert get_rill_cloud_project("http://localhost:9009") is None

    def test_resource_pagination(self):
        client = object.__new__(RillApiClient)
        client.client = MagicMock()
        client.client.get.side_effect = [
            {
                "resources": [EXPLORE_RESOURCE],
                "nextPageToken": "next-page",
            },
            {
                "resources": [
                    {
                        **EXPLORE_RESOURCE,
                        "meta": {
                            "name": {
                                "kind": EXPLORE_KIND,
                                "name": "second_dashboard",
                            }
                        },
                    }
                ],
                "nextPageToken": "",
            },
        ]

        resources = list(client._paginate_resources(EXPLORE_KIND))

        assert [resource.meta.name.name for resource in resources] == [
            "pull_request_velocity",
            "second_dashboard",
        ]
        assert client.client.get.call_args_list == [
            call(
                "/resources",
                data={"kind": EXPLORE_KIND, "pageSize": 100},
            ),
            call(
                "/resources",
                data={
                    "kind": EXPLORE_KIND,
                    "pageSize": 100,
                    "pageToken": "next-page",
                },
            ),
        ]

    def test_get_datamodels_lists_models_before_metrics_views(self):
        client = object.__new__(RillApiClient)
        client._paginate_resources = MagicMock(
            side_effect=[
                [RillResource.model_validate(MODEL_RESOURCE)],
                [RillResource.model_validate(METRICS_VIEW_RESOURCE)],
            ]
        )

        resources = client.get_datamodels()

        assert [resource.meta.name.kind for resource in resources] == [MODEL_KIND, METRICS_VIEW_KIND]
        assert client._paginate_resources.call_args_list == [call(MODEL_KIND), call(METRICS_VIEW_KIND)]


class TestRillSource:
    def test_explore_dashboard_request_uses_valid_spec_and_cloud_url(self):
        source = make_source("https://api.rilldata.com/v1/orgs/demo/projects/rill-openrtb-prog-ads")
        resource = RillResource.model_validate(EXPLORE_RESOURCE)

        results = list(source.yield_dashboard(resource))

        assert len(results) == 1
        request = results[0].right
        assert isinstance(request, CreateDashboardRequest)
        assert request.name.root == "pull_request_velocity"
        assert request.displayName == "Pull Request Velocity"
        assert request.description.root == "Review and merge performance."
        assert (
            str(request.sourceUrl.root)
            == "https://ui.rilldata.com/demo/rill-openrtb-prog-ads/explore/pull_request_velocity"
        )
        source.register_record.assert_called_once_with(request)

    def test_canvas_components_are_deduplicated_and_yielded_as_charts(self):
        source = make_source("http://localhost:9009")
        resource = RillResource.model_validate(CANVAS_RESOURCE)

        results = list(source.yield_dashboard_chart(resource))
        requests = [result.right for result in results]

        assert len(requests) == 2
        assert all(isinstance(request, CreateChartRequest) for request in requests)
        assert [(request.name.root, request.chartType.value) for request in requests] == [
            ("merge_time", "Line"),
            ("review_table", "Table"),
        ]
        assert all(
            str(request.sourceUrl.root) == "http://localhost:9009/canvas/engineering_overview" for request in requests
        )
        assert requests[0].description.root == "Average time to merge."
        assert requests[1].description is None

    def test_canvas_dashboard_does_not_generate_a_description(self):
        source = make_source("http://localhost:9009")
        resource = RillResource.model_validate(CANVAS_RESOURCE)

        results = list(source.yield_dashboard(resource))

        assert len(results) == 1
        assert results[0].right.description is None

    def test_missing_canvas_component_yields_contextual_error(self):
        source = make_source("http://localhost:9009")
        source.components.pop("review_table")
        resource = RillResource.model_validate(CANVAS_RESOURCE)

        results = list(source.yield_dashboard_chart(resource))

        errors = [result.left for result in results if result.left]
        assert len(errors) == 1
        assert "review_table" in errors[0].error

    def test_explore_dashboard_has_no_discrete_charts(self):
        source = make_source("http://localhost:9009")
        resource = RillResource.model_validate(EXPLORE_RESOURCE)

        assert list(source.yield_dashboard_chart(resource)) == []

    def test_list_datamodels_caches_models_and_metrics_views(self):
        source = make_source("http://localhost:9009")
        source.client = MagicMock()
        source.client.get_datamodels.return_value = [
            RillResource.model_validate(MODEL_RESOURCE),
            RillResource.model_validate(METRICS_VIEW_RESOURCE),
        ]

        resources = list(source.list_datamodels())

        assert len(resources) == 2
        assert list(source.models) == ["pull_requests"]
        assert list(source.metrics_views) == ["pull_request_metrics"]

    def test_metrics_view_is_reported_with_dimensions_and_measures(self):
        source = make_source("https://api.rilldata.com/v1/orgs/demo/projects/rill-openrtb-prog-ads")
        resource = RillResource.model_validate(METRICS_VIEW_RESOURCE)

        results = list(source.yield_bulk_datamodel(resource))

        assert len(results) == 1
        request = results[0].right
        assert isinstance(request, CreateDashboardDataModelRequest)
        assert request.name.root == "pull_request_metrics"
        assert request.dataModelType == DataModelType.RillMetricsView
        assert request.project == "rill-openrtb-prog-ads"
        assert request.description.root == "Semantic metrics for pull requests."
        assert [(column.name.root, column.dataType) for column in request.columns] == [
            ("repository", DataType.STRING),
            ("average_merge_time", DataType.MEASURE),
        ]
        assert "AVG(merge_time_hours)" in request.columns[1].description.root
        source.register_record_datamodel.assert_called_once_with(request)

    def test_sql_model_is_reported_with_its_query(self):
        source = make_source("http://localhost:9009")
        resource = RillResource.model_validate(MODEL_RESOURCE)

        results = list(source.yield_bulk_datamodel(resource))

        assert len(results) == 1
        request = results[0].right
        assert isinstance(request, CreateDashboardDataModelRequest)
        assert request.name.root == "pull_requests"
        assert request.dataModelType == DataModelType.RillModel
        assert request.sql.root == "SELECT * FROM raw_pull_requests"
        assert request.columns == []
        assert request.description is None

    def test_get_project_name_returns_cloud_project_for_filtering(self):
        cloud_source = make_source("https://api.rilldata.com/v1/orgs/demo/projects/rill-openrtb-prog-ads")
        local_source = make_source("http://localhost:9009")
        resource = RillResource.model_validate(EXPLORE_RESOURCE)

        assert cloud_source.get_project_name(resource) == "rill-openrtb-prog-ads"
        assert local_source.get_project_name(resource) is None

    def test_metrics_view_columns_deduplicate_dimension_measure_name_collision(self):
        spec = RillResource.model_validate(
            {
                "meta": {"name": {"kind": METRICS_VIEW_KIND, "name": "collision"}},
                "metricsView": {
                    "state": {
                        "validSpec": {
                            "dimensions": [{"name": "revenue", "column": "revenue"}],
                            "measures": [{"name": "revenue", "expression": "SUM(revenue)"}],
                        }
                    }
                },
            }
        ).metrics_view.effective_spec

        columns = RillSource._get_metrics_view_columns(spec)

        assert [column.name.root for column in columns] == ["revenue"]
        assert columns[0].dataType == DataType.UNKNOWN

    def test_canvas_metrics_views_are_deduplicated(self):
        source = make_source("http://localhost:9009")
        resource = RillResource.model_validate(CANVAS_RESOURCE)

        assert source._get_dashboard_metrics_views(resource) == ["pull_request_metrics"]

    def test_dashboard_metrics_views_skip_components_without_spec(self):
        source = make_source("http://localhost:9009")
        source.components["merge_time"] = RillResource.model_validate(
            {
                "meta": {
                    "name": {"kind": "rill.runtime.v1.Component", "name": "merge_time"},
                    "refs": [{"kind": METRICS_VIEW_KIND, "name": "pull_request_metrics"}],
                },
                "component": {},
            }
        )
        resource = RillResource.model_validate(CANVAS_RESOURCE)

        assert source._get_dashboard_metrics_views(resource) == ["pull_request_metrics"]

    def test_dashboard_lineage_includes_metrics_view_and_model(self):
        source = make_source("http://localhost:9009")
        source.metadata.get_by_name.return_value = sentinel.dashboard
        source._get_datamodel_entity = MagicMock(return_value=sentinel.datamodel)
        source._get_add_lineage_request = MagicMock(return_value=sentinel.lineage)
        resource = RillResource.model_validate(EXPLORE_RESOURCE)

        results = list(source.yield_dashboard_lineage_details(resource))

        assert results == [sentinel.lineage, sentinel.lineage]
        assert source._get_add_lineage_request.call_args_list == [
            call(
                to_entity=sentinel.dashboard,
                from_entity=sentinel.datamodel,
            ),
            call(
                to_entity=sentinel.datamodel,
                from_entity=sentinel.datamodel,
            ),
        ]
        assert source.lineage_edges == {
            ("datamodel:pull_request_metrics", "dashboard:pull_request_velocity"),
            ("datamodel:pull_requests", "datamodel:pull_request_metrics"),
        }

    def test_external_metrics_view_table_creates_physical_table_lineage(self):
        source = make_source("http://localhost:9009")
        source._get_datamodel_entity = MagicMock(return_value=sentinel.datamodel)
        source.metadata.search_in_any_service.return_value = [sentinel.table]
        source._get_add_lineage_request = MagicMock(return_value=sentinel.lineage)
        resource = RillResource.model_validate(EXTERNAL_METRICS_VIEW_RESOURCE)

        results = list(
            source._yield_datamodel_dependencies(
                resource,
                visited=set(),
                db_service_prefix="Clickhouse",
            )
        )

        assert results == [sentinel.lineage]
        source.metadata.search_in_any_service.assert_called_once_with(
            entity_type=Table,
            fqn_search_string="Clickhouse.*.rill_data.auctions",
            fetch_multiple_entities=True,
        )
        source._get_add_lineage_request.assert_called_once_with(
            to_entity=sentinel.datamodel,
            from_entity=sentinel.table,
            sql=None,
        )
        assert ("table:auctions", "datamodel:auction_metrics") in source.lineage_edges

    def test_rill_table_target_stays_internal_when_it_resolves_to_a_model(self):
        source = make_source("http://localhost:9009")
        source._get_datamodel_entity = MagicMock(return_value=sentinel.datamodel)
        source._get_add_lineage_request = MagicMock(return_value=sentinel.lineage)
        resource = RillResource.model_validate(RILL_TABLE_METRICS_VIEW_RESOURCE)

        results = list(
            source._yield_datamodel_dependencies(
                resource,
                visited=set(),
                db_service_prefix="Clickhouse",
            )
        )

        assert results == [sentinel.lineage]
        source.metadata.search_in_any_service.assert_not_called()
        source._get_add_lineage_request.assert_called_once_with(
            to_entity=sentinel.datamodel,
            from_entity=sentinel.datamodel,
        )

    def test_sql_model_creates_lineage_from_non_rill_source_tables(self):
        source = make_source("http://localhost:9009")
        source._get_datamodel_entity = MagicMock(return_value=sentinel.datamodel)
        source.metadata.search_in_any_service.return_value = [sentinel.table]
        source._get_add_lineage_request = MagicMock(return_value=sentinel.lineage)
        resource = RillResource.model_validate(EXTERNAL_MODEL_RESOURCE)

        results = list(
            source._yield_datamodel_dependencies(
                resource,
                visited=set(),
                db_service_prefix="Clickhouse",
            )
        )

        assert results == [sentinel.lineage]
        source.metadata.search_in_any_service.assert_called_once_with(
            entity_type=Table,
            fqn_search_string="Clickhouse.*.rill_data.auctions",
            fetch_multiple_entities=True,
        )
        source._get_add_lineage_request.assert_called_once_with(
            to_entity=sentinel.datamodel,
            from_entity=sentinel.table,
            sql="SELECT * FROM rill_data.auctions",
        )

    def test_rill_renderers_map_to_standard_chart_types(self):
        expected_types = {
            "combo_chart": "Bar",
            "donut_chart": "Pie",
            "kpi_grid": "Text",
            "markdown": "Text",
            "scatter_plot": "Scatter",
            "stacked_bar": "Bar",
            "table": "Table",
        }

        for renderer, expected_type in expected_types.items():
            assert RillSource._get_chart_type(renderer) == expected_type
