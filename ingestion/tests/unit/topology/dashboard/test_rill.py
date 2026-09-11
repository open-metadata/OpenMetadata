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
"""Tests for the Rill dashboard connector."""

from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch
from uuid import uuid4

import pytest

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.rillConnection import (
    RillConnection,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.source.dashboard.rill.client import (
    COMPONENT_KIND,
    EXPLORE_KIND,
    METRICS_VIEW_KIND,
    MODEL_KIND,
    RillApiClient,
    get_rill_cloud_project,
)
from metadata.ingestion.source.dashboard.rill.connection import (
    RillConnection as RillConnectionHandler,
)
from metadata.ingestion.source.dashboard.rill.metadata import (
    _DATAMODEL_LINEAGE_SENTINEL,
    RillSource,
)
from metadata.ingestion.source.dashboard.rill.models import RillResource
from metadata.ingestion.source.dashboard.rill.service_spec import ServiceSpec

SERVICE_NAME = "mock_rill"

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

RAW_MODEL_RESOURCE = {
    "meta": {
        "name": {
            "kind": "rill.runtime.v1.Model",
            "name": "raw_pull_requests",
        },
    },
    "model": {
        "spec": {
            "inputConnector": "duckdb",
            "inputProperties": {
                "sql": "SELECT 1 AS id, 'open' AS state",
            },
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

DEFAULT_CATALOG = [
    *COMPONENT_RESOURCES,
    METRICS_VIEW_RESOURCE,
    MODEL_RESOURCE,
    RAW_MODEL_RESOURCE,
]


def make_datamodel(name: str, data_model_type: DataModelType = DataModelType.RillMetricsView) -> DashboardDataModel:
    return DashboardDataModel(
        id=uuid4(),
        name=name,
        fullyQualifiedName=f"{SERVICE_NAME}.model.{name}",
        dataModelType=data_model_type,
        columns=[],
    )


def make_model(name: str) -> DashboardDataModel:
    """Rill models are ingested with a `_model` suffix; see RillSource._datamodel_name."""
    return make_datamodel(f"{name}_model", DataModelType.RillModel)


def make_dashboard(name: str) -> Dashboard:
    return Dashboard(
        id=uuid4(),
        name=name,
        fullyQualifiedName=f"{SERVICE_NAME}.{name}",
        service=EntityReference(id=uuid4(), type="dashboardService"),
    )


def make_table(fqn: str) -> Table:
    return Table(id=uuid4(), name=fqn.rsplit(".", 1)[-1], fullyQualifiedName=fqn, columns=[])


def make_source(
    host_port: str,
    catalog: list[dict] = DEFAULT_CATALOG,
    entities: list[Dashboard | DashboardDataModel] = (),
) -> RillSource:
    """Build a RillSource whose Rill API and OpenMetadata lookups are served from
    in-memory fixtures; lineage requests are built by the real base class code."""
    resources = {
        (resource["meta"]["name"]["kind"], resource["meta"]["name"]["name"]): RillResource.model_validate(resource)
        for resource in catalog
    }
    source = object.__new__(RillSource)
    source.service_connection = RillConnection(
        type="Rill",
        hostPort=host_port,
        token="test-token",
    )
    source.client = MagicMock()
    source.client.get_datamodels.return_value = [
        resource for resource in resources.values() if resource.meta.name.kind in {MODEL_KIND, METRICS_VIEW_KIND}
    ]
    source.components = {name: resource for (kind, name), resource in resources.items() if kind == COMPONENT_KIND}
    source.models = {name: resource for (kind, name), resource in resources.items() if kind == MODEL_KIND}
    source.metrics_views = {name: resource for (kind, name), resource in resources.items() if kind == METRICS_VIEW_KIND}
    source.lineage_edges = set()
    known_entities = {entity.fullyQualifiedName.root: entity for entity in entities}
    source.metadata = MagicMock()
    source.metadata.get_by_name.side_effect = lambda entity, fqn: known_entities.get(fqn)
    source.metadata.search_in_any_service.return_value = []
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(
        dashboard_service=SERVICE_NAME,
        charts=[],
    )
    source.source_config = SimpleNamespace(
        chartFilterPattern=None,
        dataModelFilterPattern=None,
        includeDataModels=True,
        lineageInformation=None,
        overrideLineage=False,
    )
    source.status = MagicMock()
    source.register_record = MagicMock()
    source.register_record_chart = MagicMock()
    source.register_record_datamodel = MagicMock()
    return source


def lineage_edges(results) -> list[tuple[str, str]]:
    """(from FQN, to FQN) for every lineage request among the yielded records."""
    return [
        (
            result.right.lineage_request.edge.fromEntity.fullyQualifiedName,
            result.right.lineage_request.edge.toEntity.fullyQualifiedName,
        )
        for result in results
        if result.right is not None and not isinstance(result.right, Barrier)
    ]


def errors(results) -> list[str]:
    return [result.left.error for result in results if result.left is not None]


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
        assert client_config.verify is True

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

    def test_verify_ssl_can_be_disabled(self):
        config = RillConnection(
            type="Rill",
            hostPort="https://rill.internal:9009",
            verifySSL=False,
        )

        with patch("metadata.ingestion.source.dashboard.rill.client.TrackedREST") as tracked_rest:
            RillApiClient(config)

        assert tracked_rest.call_args.args[0].verify is False

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


class TestRillModels:
    def test_null_maps_and_lists_fall_back_to_field_defaults(self):
        resource = RillResource.model_validate(
            {
                "meta": {"name": {"kind": MODEL_KIND, "name": "nullable"}, "refs": None},
                "model": {"spec": {"inputProperties": None, "outputProperties": None}, "state": None},
            }
        )

        assert resource.meta.refs == []
        assert resource.model.spec.input_properties == {}
        assert resource.model.spec.output_properties == {}
        assert resource.model.state is None

    def test_null_canvas_tab_group_and_dimension_type_are_accepted(self):
        canvas = RillResource.model_validate(
            {
                "meta": {"name": {"kind": "rill.runtime.v1.Canvas", "name": "c"}},
                "canvas": {"spec": {"rows": [{"items": [{"component": "kpi"}], "tabGroup": None}]}},
            }
        )
        metrics_view = RillResource.model_validate(
            {
                "meta": {"name": {"kind": METRICS_VIEW_KIND, "name": "m"}},
                "metricsView": {"spec": {"dimensions": [{"name": "d", "dataType": None}], "measures": None}},
            }
        )

        assert list(canvas.canvas.effective_spec.iter_component_names()) == ["kpi"]
        assert metrics_view.metrics_view.effective_spec.dimensions[0].data_type is None
        assert metrics_view.metrics_view.effective_spec.measures == []


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

    def test_list_datamodels_caches_models_and_metrics_views(self):
        source = make_source("http://localhost:9009")
        source.models = {}
        source.metrics_views = {}

        resources = list(source.list_datamodels())

        assert list(source.models) == ["pull_requests", "raw_pull_requests"]
        assert list(source.metrics_views) == ["pull_request_metrics"]
        assert resources[-1] is _DATAMODEL_LINEAGE_SENTINEL

    def test_lineage_edges_are_emitted_once_across_repeated_passes(self):
        metrics_view = make_datamodel("pull_request_metrics")
        dashboard = make_dashboard("pull_request_velocity")
        source = make_source(
            "http://localhost:9009",
            entities=[metrics_view, dashboard, make_model("pull_requests"), make_model("raw_pull_requests")],
        )

        first = list(source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))
        second = list(source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))
        dashboard_first = list(source.yield_dashboard_lineage(RillResource.model_validate(EXPLORE_RESOURCE)))
        dashboard_second = list(source.yield_dashboard_lineage(RillResource.model_validate(EXPLORE_RESOURCE)))

        assert len(lineage_edges(first)) == 2
        assert lineage_edges(second) == []
        assert len(lineage_edges(dashboard_first)) == 1
        assert lineage_edges(dashboard_second) == []
        assert source.lineage_edges == {
            ("datamodel:pull_requests_model", "datamodel:pull_request_metrics"),
            ("datamodel:raw_pull_requests_model", "datamodel:pull_requests_model"),
            ("datamodel:pull_request_metrics", "dashboard:pull_request_velocity"),
        }

    def test_model_and_metrics_view_sharing_a_name_and_an_upstream_both_get_edges(self):
        shared_model = {
            "meta": {
                "name": {"kind": MODEL_KIND, "name": "runtime_instances"},
                "refs": [{"kind": MODEL_KIND, "name": "raw_runtime"}],
            },
            "model": {"spec": {"inputProperties": {"sql": "SELECT * FROM raw_runtime"}}},
        }
        shared_metrics_view = {
            "meta": {
                "name": {"kind": METRICS_VIEW_KIND, "name": "runtime_instances"},
                "refs": [{"kind": MODEL_KIND, "name": "raw_runtime"}],
            },
            "metricsView": {"spec": {"model": "raw_runtime"}},
        }
        raw_model = make_model("raw_runtime")
        model = make_model("runtime_instances")
        metrics_view = make_datamodel("runtime_instances")
        source = make_source(
            "http://localhost:9009",
            catalog=[
                RAW_MODEL_RESOURCE | {"meta": {"name": {"kind": MODEL_KIND, "name": "raw_runtime"}}},
                shared_model,
                shared_metrics_view,
            ],
            entities=[raw_model, model, metrics_view],
        )

        results = list(source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))

        assert sorted(lineage_edges(results)) == sorted(
            [
                (raw_model.fullyQualifiedName.root, model.fullyQualifiedName.root),
                (raw_model.fullyQualifiedName.root, metrics_view.fullyQualifiedName.root),
            ]
        )
        assert errors(results) == []

    def test_canvas_dashboard_does_not_generate_a_description(self):
        source = make_source("http://localhost:9009")
        resource = RillResource.model_validate(CANVAS_RESOURCE)

        results = list(source.yield_dashboard(resource))

        assert len(results) == 1
        assert results[0].right.description is None

    def test_missing_canvas_component_yields_contextual_error(self):
        source = make_source("http://localhost:9009", catalog=[COMPONENT_RESOURCES[0]])
        resource = RillResource.model_validate(CANVAS_RESOURCE)

        results = list(source.yield_dashboard_chart(resource))

        assert len(errors(results)) == 1
        assert "review_table" in errors(results)[0]

    def test_explore_dashboard_has_no_discrete_charts(self):
        source = make_source("http://localhost:9009")
        resource = RillResource.model_validate(EXPLORE_RESOURCE)

        assert list(source.yield_dashboard_chart(resource)) == []

    def test_list_datamodels_ends_with_the_lineage_sentinel(self):
        source = make_source("http://localhost:9009")

        resources = list(source.list_datamodels())

        assert [resource.meta.name.name for resource in resources[:-1]] == [
            "pull_request_metrics",
            "pull_requests",
            "raw_pull_requests",
        ]
        assert resources[-1] is _DATAMODEL_LINEAGE_SENTINEL

    def test_list_datamodels_is_empty_when_data_models_are_disabled(self):
        source = make_source("http://localhost:9009")
        source.source_config.includeDataModels = False

        assert list(source.list_datamodels()) == []
        source.client.get_datamodels.assert_not_called()

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
        assert request.name.root == "pull_requests_model"
        assert request.displayName == "pull_requests"
        assert request.dataModelType == DataModelType.RillModel
        assert request.sql.root == "SELECT * FROM raw_pull_requests"
        assert request.columns == []
        assert request.description is None

    def test_model_and_metrics_view_sharing_a_name_get_distinct_data_models(self):
        source = make_source("http://localhost:9009")
        shared_model = {**MODEL_RESOURCE, "meta": {"name": {"kind": MODEL_KIND, "name": "runtime_instances"}}}
        shared_metrics_view = {
            **METRICS_VIEW_RESOURCE,
            "meta": {"name": {"kind": METRICS_VIEW_KIND, "name": "runtime_instances"}},
        }

        requests = [
            next(iter(source.yield_bulk_datamodel(RillResource.model_validate(resource)))).right
            for resource in (shared_model, shared_metrics_view)
        ]

        assert [request.name.root for request in requests] == ["runtime_instances_model", "runtime_instances"]
        assert [request.displayName for request in requests] == ["runtime_instances", "Pull Request Metrics"]

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
        bare_component = {
            "meta": {
                "name": {"kind": "rill.runtime.v1.Component", "name": "merge_time"},
                "refs": [{"kind": METRICS_VIEW_KIND, "name": "pull_request_metrics"}],
            },
            "component": {},
        }
        source = make_source("http://localhost:9009", catalog=[bare_component, COMPONENT_RESOURCES[1]])
        resource = RillResource.model_validate(CANVAS_RESOURCE)

        assert source._get_dashboard_metrics_views(resource) == ["pull_request_metrics"]

    def test_dashboard_lineage_links_only_the_metrics_view_to_the_dashboard(self):
        dashboard = make_dashboard("pull_request_velocity")
        metrics_view = make_datamodel("pull_request_metrics")
        source = make_source(
            "http://localhost:9009",
            entities=[dashboard, metrics_view, make_model("pull_requests")],
        )
        resource = RillResource.model_validate(EXPLORE_RESOURCE)

        results = list(source.yield_dashboard_lineage(resource))

        assert isinstance(results[0].right, Barrier)
        assert lineage_edges(results) == [(metrics_view.fullyQualifiedName.root, dashboard.fullyQualifiedName.root)]
        assert errors(results) == []

    def test_dashboard_lineage_reports_a_metrics_view_missing_from_openmetadata(self):
        dashboard = make_dashboard("pull_request_velocity")
        source = make_source("http://localhost:9009", entities=[dashboard])
        resource = RillResource.model_validate(EXPLORE_RESOURCE)

        results = list(source.yield_dashboard_lineage(resource))

        assert lineage_edges(results) == []
        assert len(errors(results)) == 1
        assert "pull_request_metrics" in errors(results)[0]
        assert "was not found in OpenMetadata" in errors(results)[0]

    def test_dashboard_lineage_is_skipped_when_data_models_are_disabled(self):
        source = make_source("http://localhost:9009")
        source.source_config.includeDataModels = False

        assert list(source.yield_dashboard_lineage(RillResource.model_validate(EXPLORE_RESOURCE))) == []

    def test_bulk_lineage_flushes_then_links_every_model_once(self):
        metrics_view = make_datamodel("pull_request_metrics")
        model = make_model("pull_requests")
        raw_model = make_model("raw_pull_requests")
        source = make_source("http://localhost:9009", entities=[metrics_view, model, raw_model])

        results = list(source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))

        assert isinstance(results[0].right, Barrier)
        assert lineage_edges(results) == [
            (raw_model.fullyQualifiedName.root, model.fullyQualifiedName.root),
            (model.fullyQualifiedName.root, metrics_view.fullyQualifiedName.root),
        ]
        assert errors(results) == []
        # Datamodel lineage no longer depends on any dashboard being processed.
        assert lineage_edges(list(source.yield_dashboard_lineage(RillResource.model_validate(EXPLORE_RESOURCE)))) == []

    def test_bulk_lineage_reports_an_upstream_model_missing_from_openmetadata(self):
        metrics_view = make_datamodel("pull_request_metrics")
        model = make_model("pull_requests")
        source = make_source(
            "http://localhost:9009",
            catalog=[METRICS_VIEW_RESOURCE, MODEL_RESOURCE],
            entities=[metrics_view, model],
        )

        results = list(source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))

        assert lineage_edges(results) == [(model.fullyQualifiedName.root, metrics_view.fullyQualifiedName.root)]
        assert len(errors(results)) == 1
        assert "raw_pull_requests" in errors(results)[0]
        assert "was not found in OpenMetadata" in errors(results)[0]

    def test_bulk_lineage_tolerates_reference_cycles(self):
        cyclic_a = {
            "meta": {
                "name": {"kind": MODEL_KIND, "name": "model_a"},
                "refs": [{"kind": MODEL_KIND, "name": "model_b"}],
            },
            "model": {"spec": {"inputProperties": {"sql": "SELECT * FROM model_b"}}},
        }
        cyclic_b = {
            "meta": {
                "name": {"kind": MODEL_KIND, "name": "model_b"},
                "refs": [{"kind": MODEL_KIND, "name": "model_a"}],
            },
            "model": {"spec": {"inputProperties": {"sql": "SELECT * FROM model_a"}}},
        }
        model_a = make_model("model_a")
        model_b = make_model("model_b")
        source = make_source("http://localhost:9009", catalog=[cyclic_a, cyclic_b], entities=[model_a, model_b])

        results = list(source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))

        assert lineage_edges(results) == [
            (model_b.fullyQualifiedName.root, model_a.fullyQualifiedName.root),
            (model_a.fullyQualifiedName.root, model_b.fullyQualifiedName.root),
        ]
        source.metadata.search_in_any_service.assert_not_called()

    def test_two_dashboards_sharing_a_metrics_view_each_get_their_own_edge(self):
        velocity = make_dashboard("pull_request_velocity")
        overview = make_dashboard("engineering_overview")
        metrics_view = make_datamodel("pull_request_metrics")
        source = make_source("http://localhost:9009", entities=[velocity, overview, metrics_view])

        results = [
            *source.yield_dashboard_lineage(RillResource.model_validate(EXPLORE_RESOURCE)),
            *source.yield_dashboard_lineage(RillResource.model_validate(CANVAS_RESOURCE)),
        ]

        assert lineage_edges(results) == [
            (metrics_view.fullyQualifiedName.root, velocity.fullyQualifiedName.root),
            (metrics_view.fullyQualifiedName.root, overview.fullyQualifiedName.root),
        ]

    def test_external_metrics_view_table_creates_physical_table_lineage(self):
        metrics_view = make_datamodel("auction_metrics")
        table = make_table("Clickhouse.default.rill_data.auctions")
        source = make_source(
            "http://localhost:9009",
            catalog=[EXTERNAL_METRICS_VIEW_RESOURCE],
            entities=[metrics_view],
        )
        source.source_config.lineageInformation = SimpleNamespace(dbServicePrefixes=["Clickhouse"])
        source.metadata.search_in_any_service.return_value = [table]

        results = list(source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))

        assert lineage_edges(results) == [(table.fullyQualifiedName.root, metrics_view.fullyQualifiedName.root)]
        source.metadata.search_in_any_service.assert_called_once_with(
            entity_type=Table,
            fqn_search_string="Clickhouse.*.rill_data.auctions",
            fetch_multiple_entities=True,
        )
        assert results[1].right.lineage_request.edge.lineageDetails.sqlQuery is None

    def test_external_metrics_view_naming_its_table_via_model_gets_physical_lineage(self):
        druid_metrics_view = {
            "meta": {
                "name": {"kind": METRICS_VIEW_KIND, "name": "druid_metrics"},
                "refs": [{"kind": "rill.runtime.v1.Connector", "name": "druid"}],
            },
            "metricsView": {"spec": {"connector": "druid", "model": "druid-metrics", "table": "druid-metrics"}},
        }
        metrics_view = make_datamodel("druid_metrics")
        table = make_table("Druid.default.druid.druid-metrics")
        source = make_source("http://localhost:9009", catalog=[druid_metrics_view], entities=[metrics_view])
        source.source_config.lineageInformation = SimpleNamespace(dbServicePrefixes=["Druid"])
        source.metadata.search_in_any_service.return_value = [table]

        results = list(source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))

        assert lineage_edges(results) == [(table.fullyQualifiedName.root, metrics_view.fullyQualifiedName.root)]

    def test_rill_table_target_stays_internal_when_it_resolves_to_a_model(self):
        metrics_view = make_datamodel("pull_request_table_metrics")
        model = make_model("pull_requests")
        source = make_source(
            "http://localhost:9009",
            catalog=[RILL_TABLE_METRICS_VIEW_RESOURCE, MODEL_RESOURCE],
            entities=[metrics_view, model, make_model("raw_pull_requests")],
        )
        source.source_config.lineageInformation = SimpleNamespace(dbServicePrefixes=["Clickhouse"])

        results = list(source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))

        assert (model.fullyQualifiedName.root, metrics_view.fullyQualifiedName.root) in lineage_edges(results)
        source.metadata.search_in_any_service.assert_not_called()

    def test_sql_model_creates_lineage_from_non_rill_source_tables(self):
        model = make_model("auction_rollup")
        table = make_table("Clickhouse.default.rill_data.auctions")
        source = make_source("http://localhost:9009", catalog=[EXTERNAL_MODEL_RESOURCE], entities=[model])
        source.source_config.lineageInformation = SimpleNamespace(dbServicePrefixes=["Clickhouse"])
        source.metadata.search_in_any_service.return_value = [table]

        results = list(source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))

        assert lineage_edges(results) == [(table.fullyQualifiedName.root, model.fullyQualifiedName.root)]
        source.metadata.search_in_any_service.assert_called_once_with(
            entity_type=Table,
            fqn_search_string="Clickhouse.*.rill_data.auctions",
            fetch_multiple_entities=True,
        )
        assert results[1].right.lineage_request.edge.lineageDetails.sqlQuery.root == "SELECT * FROM rill_data.auctions"

    def test_sql_model_source_table_that_is_a_rill_model_is_not_searched(self):
        model = make_model("pull_requests")
        source = make_source(
            "http://localhost:9009",
            catalog=[MODEL_RESOURCE, RAW_MODEL_RESOURCE],
            entities=[model, make_model("raw_pull_requests")],
        )
        source.source_config.lineageInformation = SimpleNamespace(dbServicePrefixes=["Clickhouse"])

        list(source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))

        source.metadata.search_in_any_service.assert_not_called()

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
            assert RillSource._get_chart_type(renderer).value == expected_type
