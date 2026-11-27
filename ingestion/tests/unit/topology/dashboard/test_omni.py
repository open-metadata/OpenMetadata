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
"""Unit tests for the Omni dashboard connector."""

import logging
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.omni.metadata import (
    _DATAMODEL_LINEAGE_SENTINEL,
    OmniDashboardDetails,
    OmniSource,
)
from metadata.ingestion.source.dashboard.omni.models import (
    OmniDashboardDocument,
    OmniDocument,
    OmniField,
    OmniFolder,
    OmniLabel,
    OmniModel,
    OmniOwner,
    OmniQuery,
    OmniTopic,
    OmniUser,
    QueryPresentation,
    ScimEmail,
)

MOCK_CONFIG = {
    "source": {
        "type": "omni",
        "serviceName": "mock_omni",
        "serviceConnection": {
            "config": {
                "type": "Omni",
                "hostPort": "https://acme.omniapp.co/api",
                "token": "secret-token",
            }
        },
        "sourceConfig": {
            "config": {
                "dashboardFilterPattern": {},
                "chartFilterPattern": {},
                "dataModelFilterPattern": {},
                "includeOwners": True,
                "includeDataModels": True,
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        },
    },
}

MOCK_TOPIC = OmniTopic(
    model_id="m1",
    model_name="sales",
    name="orders",
    label="Orders",
    description="Order facts",
    base_view="orders",
    base_schema="ANALYTICS",
    base_table="ORDERS",
    fields=[
        OmniField(name="country", label="Country", data_type="string", field_type="dimension"),
        OmniField(name="total", label="Total", data_type="number", field_type="measure"),
    ],
)

MOCK_DOCUMENT = OmniDocument(
    identifier="doc-1",
    name="Sales Overview",
    description="Monthly sales",
    type="document",
    owner=OmniOwner(id="owner-1", name="Jane Doe"),
    hasDashboard=True,
    url="https://acme.omniapp.co/dashboards/doc-1",
    deleted=False,
)

MOCK_ARCHIVED_DOCUMENT = OmniDocument(identifier="doc-2", name="Old", hasDashboard=True, deleted=True)
MOCK_WORKBOOK_ONLY = OmniDocument(identifier="doc-3", name="Workbook", hasDashboard=False)

MOCK_USERS = [
    OmniUser(
        id="scim-1",
        displayName="Jane Doe",
        userName="jane.doe@acme.co",
        emails=[
            ScimEmail(value="jane.old@acme.co", primary=False),
            ScimEmail(value="jane.doe@acme.co", primary=True),
        ],
    ),
    OmniUser(id="scim-2", displayName="John Roe", userName="john.roe@acme.co", emails=[]),
]

MOCK_DASHBOARD_DOC = OmniDashboardDocument(
    identifier="doc-1",
    name="Sales Overview",
    modelId="m1",
    url="https://acme.omniapp.co/dashboards/doc-1",
    queryPresentations=[
        QueryPresentation(name="Revenue", chartType="bar", query=OmniQuery(table="orders", fields=["total"])),
        QueryPresentation(name="Trend", chartType="line", query=OmniQuery(table="orders")),
    ],
)

MOCK_DASHBOARD_DETAILS = OmniDashboardDetails(document=MOCK_DOCUMENT, dashboard=MOCK_DASHBOARD_DOC)


@pytest.fixture()
def omni_source():
    with (
        patch("metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"),
        patch("metadata.ingestion.source.dashboard.omni.connection.get_connection"),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_CONFIG)
        source: OmniSource = OmniSource.create(
            MOCK_CONFIG["source"],
            OpenMetadata(config.workflowConfig.openMetadataServerConfig),
        )
    source.client = SimpleNamespace(get_users=lambda *_: [])
    source.context.get().__dict__["dashboard_service"] = "mock_omni"
    return source


def _rights(results):
    return [res.right for res in results if isinstance(res, Either) and res.right]


def test_dashboard_name(omni_source):
    assert omni_source.get_dashboard_name(MOCK_DOCUMENT) == "Sales Overview"


def test_get_dashboards_list_filters_workbooks_and_archived(omni_source):
    omni_source.client.get_documents = lambda *_: [
        MOCK_DOCUMENT,
        MOCK_ARCHIVED_DOCUMENT,
        MOCK_WORKBOOK_ONLY,
    ]
    dashboards = omni_source.get_dashboards_list()
    assert [d.identifier for d in dashboards] == ["doc-1"]


def test_prepare_indexes_topics(omni_source):
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda *_: [MOCK_TOPIC]
    omni_source.prepare()
    assert len(omni_source.topics) == 1
    assert omni_source._resolve_topic("orders").base_table == "ORDERS"
    assert omni_source._resolve_topic("unknown") is None


def test_resolve_topic_skips_ambiguous_cross_model(omni_source):
    # Two models expose a view with the same name -> must not misroute lineage.
    t1 = MOCK_TOPIC.model_copy(update={"model_id": "m1", "model_name": "a"})
    t2 = MOCK_TOPIC.model_copy(update={"model_id": "m2", "model_name": "b"})
    omni_source._topic_name_index = {"orders": [t1, t2]}
    assert omni_source._resolve_topic("orders") is None


def test_resolve_topic_qualified_reference(omni_source):
    """A schema-qualified reference resolves via the qualified index key, in either
    ``.`` or ``/`` form, and never gets stripped to a bare leaf."""
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda *_: [MOCK_TOPIC]  # base_schema=ANALYTICS
    omni_source.prepare()
    # Omni qualifies references with '.', '/', or '__' (data-lineage docs).
    assert omni_source._resolve_topic("ANALYTICS.orders").base_table == "ORDERS"
    assert omni_source._resolve_topic("ANALYTICS/orders").base_table == "ORDERS"
    assert omni_source._resolve_topic("ANALYTICS__orders").base_table == "ORDERS"


def test_resolve_topic_qualified_reference_never_misroutes(omni_source):
    """A qualified reference whose schema does not match must NOT fall back to a
    lone bare-leaf topic (which would attach lineage to the wrong data model)."""
    # Only an ANALYTICS.orders topic exists; a FINANCE.orders tile must not match it.
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda *_: [MOCK_TOPIC]
    omni_source.prepare()
    assert omni_source._resolve_topic("FINANCE.orders") is None


def test_yield_bulk_datamodel(omni_source):
    results = _rights(omni_source.yield_bulk_datamodel(MOCK_TOPIC))
    assert len(results) == 1
    datamodel = results[0]
    assert isinstance(datamodel, CreateDashboardDataModelRequest)
    assert datamodel.name.root == "sales.orders"
    assert datamodel.dataModelType.value == "OmniDataModel"
    assert datamodel.serviceType.value == "Omni"
    assert datamodel.project == "sales"
    assert [c.name.root for c in datamodel.columns] == ["country", "total"]
    assert datamodel.columns[0].dataType.value == "STRING"
    assert datamodel.columns[1].dataType.value == "DOUBLE"


def test_get_project_name(omni_source):
    """Folder -> project; folderless documents must still get a non-null project
    (otherwise the base class filters them out via an empty projectFilterPattern)."""
    doc_with_folder = MOCK_DOCUMENT.model_copy(
        update={"folder": OmniFolder(name="Marketing Insights", path="marketing-insights")}
    )
    details = OmniDashboardDetails(document=doc_with_folder, dashboard=MOCK_DASHBOARD_DOC)
    assert omni_source.get_project_name(details) == "marketing-insights"

    # MOCK_DOCUMENT has no folder -> must be non-null, not None.
    assert omni_source.get_project_name(MOCK_DASHBOARD_DETAILS) is not None


def test_yield_dashboard(omni_source):
    results = _rights(omni_source.yield_dashboard(MOCK_DASHBOARD_DETAILS))
    assert len(results) == 1
    dashboard = results[0]
    assert isinstance(dashboard, CreateDashboardRequest)
    assert dashboard.name.root == "doc-1"
    assert dashboard.displayName == "Sales Overview"
    assert str(dashboard.sourceUrl.root) == "https://acme.omniapp.co/dashboards/doc-1"


def test_yield_dashboard_chart(omni_source):
    results = _rights(omni_source.yield_dashboard_chart(MOCK_DASHBOARD_DETAILS))
    assert len(results) == 2
    assert all(isinstance(c, CreateChartRequest) for c in results)
    assert [c.name.root for c in results] == ["doc-1.0", "doc-1.1"]
    assert [c.displayName for c in results] == ["Revenue", "Trend"]
    assert results[0].chartType.value == "Bar"
    assert results[1].chartType.value == "Line"


def test_yield_dashboard_lineage_details(omni_source):
    """table -> data model (bulk) and dashboard <- data model (per tile)."""
    omni_source.topics = [MOCK_TOPIC]
    omni_source._topic_name_index = {"orders": [MOCK_TOPIC]}

    datamodel_entity = DashboardDataModel(
        id="550e8400-e29b-41d4-a716-446655440010",
        name="sales.orders",
        dataModelType="OmniDataModel",
        columns=[],
    )
    table_entity = Table(id="550e8400-e29b-41d4-a716-446655440011", name="ORDERS", columns=[])
    dashboard_entity = Dashboard(
        id="550e8400-e29b-41d4-a716-446655440012",
        name="doc-1",
        service=EntityReference(id="550e8400-e29b-41d4-a716-446655440013", type="dashboardService"),
    )

    omni_source._get_datamodel_entity = lambda topic: datamodel_entity
    omni_source._get_table_entity = lambda topic, db_service_prefix=None: table_entity
    omni_source.metadata.get_by_name = MagicMock(return_value=dashboard_entity)

    # MOCK_DASHBOARD_DETAILS has two tiles, both referencing the "orders" view.
    # Per-dashboard lineage now only draws dashboard <- data-model edges; the
    # table -> data-model edges are emitted from the bulk data-model stage.
    edges = [
        r
        for r in _rights(omni_source.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS))
        if isinstance(r, AddLineageRequest)
    ]
    assert len(edges) == 1
    pairs = {(e.edge.fromEntity.type, e.edge.toEntity.type) for e in edges}
    assert pairs == {("dashboardDataModel", "dashboard")}


def test_yield_bulk_datamodel_lineage_without_dashboards(omni_source):
    """The sentinel row flushes a Barrier and draws table -> data-model lineage,
    so lineage is produced even for models that have no dashboards."""
    omni_source.topics = [MOCK_TOPIC]

    datamodel_entity = DashboardDataModel(
        id="550e8400-e29b-41d4-a716-446655440010",
        name="sales.orders",
        dataModelType="OmniDataModel",
        columns=[],
    )
    table_entity = Table(id="550e8400-e29b-41d4-a716-446655440011", name="ORDERS", columns=[])
    omni_source._get_datamodel_entity = lambda topic: datamodel_entity
    omni_source._get_table_entity = lambda topic, db_service_prefix=None: table_entity

    results = list(omni_source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))
    rights = [r.right for r in results if isinstance(r, Either) and r.right is not None]
    assert any(isinstance(r, Barrier) for r in rights)
    lineage = [r for r in rights if isinstance(r, OMetaLineageRequest)]
    assert len(lineage) == 1
    edge = lineage[0].lineage_request.edge
    assert (edge.fromEntity.type, edge.toEntity.type) == ("table", "dashboardDataModel")


@pytest.mark.parametrize(
    "host",
    [
        "https://acme.omniapp.co",
        "https://acme.omniapp.co/",
        "https://acme.omniapp.co/api",
        "https://acme.omniapp.co/api/v1",
        "https://acme.omniapp.co/api/v2/",
    ],
)
def test_client_base_url_normalized_to_api(host):
    """The client should hit exactly <org>/api regardless of what the user enters."""
    from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
        OmniConnection as OmniConnectionConfig,
    )
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    client = OmniApiClient(OmniConnectionConfig(hostPort=host, token="secret-token"))
    base_url = client.client._base_url.rstrip("/")
    assert base_url == "https://acme.omniapp.co/api"


def test_get_dashboard_document_graceful_when_tiles_unavailable():
    """A tile-fetch failure must still yield a dashboard doc (no charts), not drop it."""
    from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
        OmniConnection as OmniConnectionConfig,
    )
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    client = OmniApiClient(OmniConnectionConfig(hostPort="https://acme.omniapp.co", token="t"))
    client.client = MagicMock()
    client.client.get.side_effect = Exception("400 Client Error: Workbook needs to be migrated")

    doc = client.get_dashboard_document("doc-x")
    assert doc.identifier == "doc-x"
    assert doc.queryPresentations == []


def test_parse_model_yaml_dedupes_topic_and_view_same_name():
    """A topic and a view sharing a name must produce a single data model."""
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    files = {
        "model": "",
        "ANALYTICS/orders.view": "label: Orders View\nschema: ANALYTICS\ntable_name: ORDERS\ndimensions:\n  id:\n    label: ID\n",
        "orders.topic": "base_view: orders\nlabel: Orders Topic\n",
    }
    result = OmniApiClient._parse_model_yaml(OmniModel(id="m1", name="sales"), files)
    names = [t.name for t in result]
    assert names.count("orders") == 1
    topic = next(t for t in result if t.name == "orders")
    # Topic takes precedence (curated label) but inherits the base view's table.
    assert topic.label == "Orders Topic"
    assert topic.base_table == "ORDERS"
    assert topic.base_schema == "ANALYTICS"


def test_get_connection_validate_ssl_writes_ca_to_file(monkeypatch):
    """verifySSL=validate must pass requests a CA-bundle *path*, not raw PEM."""
    import metadata.ingestion.source.dashboard.omni.connection as conn_mod
    from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
        OmniConnection as OmniConnectionConfig,
    )
    from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL

    captured = {}
    monkeypatch.setattr(
        conn_mod,
        "OmniApiClient",
        lambda connection, verify_ssl=None: captured.update(verify_ssl=verify_ssl),
    )
    pem = "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----"
    cfg = OmniConnectionConfig(
        hostPort="https://acme.omniapp.co",
        token="t",
        verifySSL=VerifySSL.validate,
        sslConfig={"caCertificate": pem},
    )
    conn_mod.get_connection(cfg)
    path = captured["verify_ssl"]
    assert isinstance(path, str) and Path(path).exists()
    assert "BEGIN CERTIFICATE" in Path(path).read_text(encoding="utf-8")


def test_parse_model_yaml_ambiguous_leaf_no_misroute():
    """Two view files share a leaf name: a bare base_view must be left unresolved
    (no misroute), while a schema-qualified base_view still resolves correctly."""
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    files = {
        "ANALYTICS/orders.view": "schema: ANALYTICS\ntable_name: ANALYTICS.ORDERS\n",
        "FINANCE/orders.view": "schema: FINANCE\ntable_name: FINANCE.ORDERS\n",
        "bare.topic": "base_view: orders\n",
        "qualified.topic": "base_view: FINANCE/orders\n",
    }
    result = OmniApiClient._parse_model_yaml(OmniModel(id="m1", name="m"), files)
    bare = next(t for t in result if t.name == "bare")
    qualified = next(t for t in result if t.name == "qualified")
    # Ambiguous bare leaf -> unresolved rather than bound to the wrong table.
    assert bare.base_table is None
    # Qualified reference resolves to the matching physical view.
    assert qualified.base_table == "FINANCE.ORDERS"


def test_prepare_filters_datamodels(omni_source):
    """The data-model filter pattern is applied once in prepare(), so a filtered
    topic is absent from both the topic list and the lineage index."""
    from metadata.generated.schema.type.filterPattern import FilterPattern

    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda *_: [MOCK_TOPIC]  # -> "sales.orders"
    omni_source.source_config.dataModelFilterPattern = FilterPattern(excludes=["sales.orders"])
    omni_source.prepare()
    assert omni_source.topics == []
    assert omni_source._resolve_topic("orders") is None


def test_list_datamodels_respects_include_flag(omni_source):
    omni_source.topics = [MOCK_TOPIC]
    omni_source.source_config.includeDataModels = True
    produced = list(omni_source.list_datamodels())
    # A trailing sentinel drives the bulk table-lineage emission.
    assert [t.name for t in produced if isinstance(t, OmniTopic)] == ["orders"]
    assert produced[-1] is _DATAMODEL_LINEAGE_SENTINEL

    omni_source.source_config.includeDataModels = False
    assert list(omni_source.list_datamodels()) == []


def test_parse_model_yaml_base_view_handle_is_case_insensitive():
    """Omni spells a base_view handle in lower case (``revenues__all_revenues``)
    while the model YAML path keeps the warehouse casing (``REVENUES/...``)."""
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    files = {
        "REVENUES/all_revenues.view": "schema: REVENUES\ntable_name: ALL_REVENUES\ndimensions:\n  amount:\n    label: Amount\n",
        "Company North Star/revenue.topic": "base_view: revenues__all_revenues\nlabel: Revenue\n",
    }
    result = OmniApiClient._parse_model_yaml(OmniModel(id="m1", name="sales"), files)
    topic = next(t for t in result if t.name == "revenue")
    assert topic.base_schema == "REVENUES"
    assert topic.base_table == "ALL_REVENUES"
    assert [f.name for f in topic.fields] == ["amount"]


def test_resolve_topic_is_case_insensitive(omni_source):
    """A tile reference must resolve regardless of the casing of the schema part."""
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda *_: [MOCK_TOPIC]  # base_schema=ANALYTICS
    omni_source.prepare()
    assert omni_source._resolve_topic("analytics__orders").base_table == "ORDERS"
    assert omni_source._resolve_topic("Analytics.Orders").base_table == "ORDERS"
    assert omni_source._resolve_topic("ORDERS").base_table == "ORDERS"


def test_resolve_topic_prefers_the_data_model_named_by_the_reference(omni_source):
    """A curated topic and the view it sits on are both ingested as data models, so
    a reference naming that view belongs to the view -- not ambiguous between them."""
    view = OmniTopic(
        model_id="m1",
        model_name="sales",
        name="clients__fact_lifecycle",
        base_view="clients__fact_lifecycle",
        base_schema="CLIENTS",
        base_table="FACT_LIFECYCLE",
    )
    topic = OmniTopic(
        model_id="m1",
        model_name="sales",
        name="Post-Acquisition Lifecycle",
        base_view="clients__fact_lifecycle",
        base_schema="CLIENTS",
        base_table="FACT_LIFECYCLE",
    )
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda *_: [topic, view]
    omni_source.prepare()

    resolved = omni_source._resolve_topic("clients__fact_lifecycle")
    assert resolved is not None
    assert resolved.name == "clients__fact_lifecycle"
    assert omni_source._resolve_topic("Post-Acquisition Lifecycle").name == "Post-Acquisition Lifecycle"


def test_dashboard_lineage_when_topic_name_differs_from_its_base_view(omni_source, caplog):
    """Regression for #32597: topic ``orders`` sits on base view
    ``schema__orders__fact_orders`` and the view file is present in the same model,
    so both become data models. A tile queries the topic through its base view, so
    its table is the view name; that must resolve to the view's data model instead
    of being skipped as ambiguous between the topic and the view."""
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    files = {
        "model": "",
        "schema__orders__fact_orders.view": (
            "schema: SCHEMA\ntable_name: FACT_ORDERS\ndimensions:\n  order_id:\n    label: Order ID\n"
        ),
        "orders.topic": "base_view: schema__orders__fact_orders\nlabel: Orders\n",
    }
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda model: OmniApiClient._parse_model_yaml(model, files)
    omni_source.prepare()
    assert sorted(omni_source._datamodel_name(topic) for topic in omni_source.topics) == [
        "sales.orders",
        "sales.schema__orders__fact_orders",
    ]

    datamodel_entity = DashboardDataModel(
        id="550e8400-e29b-41d4-a716-446655440040",
        name="sales.schema__orders__fact_orders",
        dataModelType="OmniDataModel",
        columns=[],
    )
    dashboard_entity = Dashboard(
        id="550e8400-e29b-41d4-a716-446655440041",
        name="doc-1",
        service=EntityReference(id="550e8400-e29b-41d4-a716-446655440042", type="dashboardService"),
    )
    datamodel_fqns = []

    def get_by_name(entity, fqn, **_):
        if entity is Dashboard:
            return dashboard_entity
        datamodel_fqns.append(fqn)
        return datamodel_entity

    omni_source.metadata.get_by_name = MagicMock(side_effect=get_by_name)
    details = OmniDashboardDetails(
        document=MOCK_DOCUMENT,
        dashboard=OmniDashboardDocument(
            identifier="doc-1",
            queryPresentations=[
                QueryPresentation(
                    name="Orders",
                    query=OmniQuery(
                        table="schema__orders__fact_orders",
                        fields=["schema__orders__fact_orders.order_id"],
                    ),
                )
            ],
        ),
    )

    with caplog.at_level(logging.WARNING):
        edges = [
            r for r in _rights(omni_source.yield_dashboard_lineage_details(details)) if isinstance(r, AddLineageRequest)
        ]

    assert datamodel_fqns == ['mock_omni.model."sales.schema__orders__fact_orders"']
    assert [(e.edge.fromEntity.type, e.edge.toEntity.type) for e in edges] == [("dashboardDataModel", "dashboard")]
    assert edges[0].edge.fromEntity.id == datamodel_entity.id
    assert "Ambiguous tile reference" not in caplog.text


def test_resolve_topic_names_the_colliding_data_models_when_ambiguous(omni_source, caplog):
    """Two topics of one model share a base view that has no data model of its own,
    so a tile naming that view cannot be routed. The warning must name the data
    models that collide; counting them as models is wrong when they belong to one
    model (#32597)."""
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    files = {
        "model": "",
        "orders.topic": "base_view: schema__shared__fact_orders\n",
        "returns.topic": "base_view: schema__shared__fact_orders\n",
    }
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda model: OmniApiClient._parse_model_yaml(model, files)
    omni_source.prepare()

    with caplog.at_level(logging.WARNING):
        assert omni_source._resolve_topic("schema__shared__fact_orders") is None

    warnings = [record.getMessage() for record in caplog.records if record.levelno >= logging.WARNING]
    assert warnings == [
        "Ambiguous tile reference 'schema__shared__fact_orders' matches data models sales.orders, sales.returns; "
        "skipping lineage"
    ]


def test_get_owner_ref_resolves_via_user_directory(omni_source):
    """The documents API carries no owner email, so the owner is matched on the
    display name it does carry against the SCIM user directory."""
    omni_source.client.get_models = lambda *_: []
    omni_source.client.get_model_topics = lambda *_: []
    omni_source.client.get_users = lambda *_: MOCK_USERS
    omni_source.prepare()

    reference = EntityReferenceList(root=[EntityReference(id="550e8400-e29b-41d4-a716-446655440020", type="user")])
    omni_source.metadata.get_reference_by_email = MagicMock(return_value=reference)

    assert omni_source.get_owner_ref(MOCK_DASHBOARD_DETAILS) is reference
    omni_source.metadata.get_reference_by_email.assert_called_once_with("jane.doe@acme.co")

    # A second lookup for the same owner is served from cache.
    omni_source.get_owner_ref(MOCK_DASHBOARD_DETAILS)
    assert omni_source.metadata.get_reference_by_email.call_count == 1


def test_get_owner_ref_ignores_display_name_shared_by_several_users(omni_source):
    """Two users with the same display name cannot be told apart, so neither is used."""
    omni_source.client.get_models = lambda *_: []
    omni_source.client.get_model_topics = lambda *_: []
    omni_source.client.get_users = lambda *_: [
        OmniUser(id="a", displayName="Jane Doe", emails=[ScimEmail(value="jane1@acme.co", primary=True)]),
        OmniUser(id="b", displayName="Jane Doe", emails=[ScimEmail(value="jane2@acme.co", primary=True)]),
    ]
    omni_source.prepare()
    omni_source.metadata.get_reference_by_email = MagicMock()

    assert omni_source.get_owner_ref(MOCK_DASHBOARD_DETAILS) is None
    omni_source.metadata.get_reference_by_email.assert_not_called()


def test_get_owner_ref_skipped_when_include_owners_disabled(omni_source):
    omni_source.source_config.includeOwners = False
    omni_source.client.get_models = lambda *_: []
    omni_source.client.get_model_topics = lambda *_: []
    omni_source.client.get_users = MagicMock(return_value=MOCK_USERS)
    omni_source.prepare()

    omni_source.client.get_users.assert_not_called()
    assert omni_source.get_owner_ref(MOCK_DASHBOARD_DETAILS) is None


def test_yield_dashboard_chart_inherits_the_document_owner(omni_source):
    omni_source.client.get_models = lambda *_: []
    omni_source.client.get_model_topics = lambda *_: []
    omni_source.client.get_users = lambda *_: MOCK_USERS
    omni_source.prepare()

    reference = EntityReferenceList(root=[EntityReference(id="550e8400-e29b-41d4-a716-446655440021", type="user")])
    omni_source.metadata.get_reference_by_email = MagicMock(return_value=reference)

    charts = _rights(omni_source.yield_dashboard_chart(MOCK_DASHBOARD_DETAILS))
    assert len(charts) == 2
    assert all(c.owners is reference for c in charts)


def test_get_users_follows_scim_index_pagination():
    """SCIM pages by startIndex/itemsPerPage rather than a cursor."""
    from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
        OmniConnection as OmniConnectionConfig,
    )
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    client = OmniApiClient(OmniConnectionConfig(hostPort="https://acme.omniapp.co", token="t"))
    pages = [
        {
            "Resources": [{"id": "1", "displayName": "A", "emails": [{"value": "a@acme.co", "primary": True}]}],
            "totalResults": 2,
            "itemsPerPage": 1,
            "startIndex": 1,
        },
        {
            "Resources": [{"id": "2", "displayName": "B", "emails": [{"value": "b@acme.co", "primary": True}]}],
            "totalResults": 2,
            "itemsPerPage": 1,
            "startIndex": 2,
        },
    ]
    client.scim_client = MagicMock()
    client.scim_client.get.side_effect = pages

    users = client.get_users()
    assert [u.id for u in users] == ["1", "2"]
    assert [u.primary_email for u in users] == ["a@acme.co", "b@acme.co"]
    assert client.scim_client.get.call_args_list[0].kwargs["data"]["startIndex"] == 1
    assert client.scim_client.get.call_args_list[1].kwargs["data"]["startIndex"] == 2


def test_get_users_uses_the_scim_mount_point():
    """SCIM sits next to the versioned API, not under it."""
    from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
        OmniConnection as OmniConnectionConfig,
    )
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    client = OmniApiClient(OmniConnectionConfig(hostPort="https://acme.omniapp.co", token="t"))
    assert client.client._api_version == "v1"
    assert client.scim_client._api_version == "scim/v2"
    assert client.scim_client._base_url.rstrip("/") == "https://acme.omniapp.co/api"


def test_primary_email_falls_back_to_username():
    assert OmniUser(id="x", displayName="X", userName="x@acme.co").primary_email == "x@acme.co"
    assert (
        OmniUser(id="x", displayName="X", userName="x@acme.co", emails=[ScimEmail(value="y@acme.co")]).primary_email
        == "y@acme.co"
    )


def test_tile_topics_reads_field_references_as_well_as_the_table(omni_source):
    """A tile's query.table may name a workbook-local query view absent from the
    shared model, while its field references still name real views."""
    accounts = OmniTopic(
        model_id="m1",
        model_name="sales",
        name="clients__accounts",
        base_view="clients__accounts",
        base_schema="CLIENTS",
        base_table="ACCOUNTS",
    )
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda *_: [MOCK_TOPIC, accounts]
    omni_source.prepare()

    tile = QueryPresentation(
        name="Transactions",
        query=OmniQuery(
            table="monthly_active_customers",
            fields=[
                "clients__accounts.legal_country",
                "clients__accounts.count",
                "monthly_active_customers.total",
                "omni_period_pivot",
                "calc_1",
            ],
        ),
    )
    # The unresolvable table is skipped; the field prefix resolves, once, to its view.
    assert [t.name for t in omni_source._tile_topics(tile)] == ["clients__accounts"]

    # A resolvable table is still returned, and is not duplicated by its own fields.
    tile = QueryPresentation(
        name="Orders", query=OmniQuery(table="orders", fields=["orders.total", "ANALYTICS__orders.country"])
    )
    assert [t.name for t in omni_source._tile_topics(tile)] == ["orders"]


def test_tile_topics_handles_a_tile_without_a_query(omni_source):
    assert list(omni_source._tile_topics(QueryPresentation(name="Text tile"))) == []


def test_yield_dashboard_lineage_details_uses_field_references(omni_source):
    """A dashboard whose tiles only reference views through fields still gets edges."""
    accounts = OmniTopic(
        model_id="m1",
        model_name="sales",
        name="clients__accounts",
        base_view="clients__accounts",
        base_schema="CLIENTS",
        base_table="ACCOUNTS",
    )
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda *_: [accounts]
    omni_source.prepare()

    document = MOCK_DOCUMENT.model_copy()
    dashboard_doc = OmniDashboardDocument(
        identifier="doc-1",
        queryPresentations=[
            QueryPresentation(
                name="Tile",
                query=OmniQuery(table="workbook_only_view", fields=["clients__accounts.legal_country"]),
            )
        ],
    )
    details = OmniDashboardDetails(document=document, dashboard=dashboard_doc)

    datamodel_entity = DashboardDataModel(
        id="550e8400-e29b-41d4-a716-446655440030",
        name="sales.clients__accounts",
        dataModelType="OmniDataModel",
        columns=[],
    )
    dashboard_entity = Dashboard(
        id="550e8400-e29b-41d4-a716-446655440031",
        name="doc-1",
        service=EntityReference(id="550e8400-e29b-41d4-a716-446655440032", type="dashboardService"),
    )
    omni_source._get_datamodel_entity = lambda topic: datamodel_entity
    omni_source.metadata.get_by_name = MagicMock(return_value=dashboard_entity)

    edges = [
        r for r in _rights(omni_source.yield_dashboard_lineage_details(details)) if isinstance(r, AddLineageRequest)
    ]
    assert len(edges) == 1
    assert (edges[0].edge.fromEntity.type, edges[0].edge.toEntity.type) == ("dashboardDataModel", "dashboard")


def test_get_users_pages_on_when_total_results_is_absent():
    """``totalResults`` is optional in a SCIM ListResponse; a server that omits it
    must not have its later pages silently dropped."""
    from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
        OmniConnection as OmniConnectionConfig,
    )
    from metadata.ingestion.source.dashboard.omni.client import SCIM_PAGE_SIZE, OmniApiClient

    client = OmniApiClient(OmniConnectionConfig(hostPort="https://acme.omniapp.co", token="t"))
    full = [{"id": str(i), "displayName": f"U{i}"} for i in range(SCIM_PAGE_SIZE)]
    client.scim_client = MagicMock()
    client.scim_client.get.side_effect = [
        {"Resources": full},
        {"Resources": [{"id": "last", "displayName": "Last"}]},
    ]

    users = client.get_users()
    assert len(users) == SCIM_PAGE_SIZE + 1
    assert users[-1].id == "last"
    assert [c.kwargs["data"]["startIndex"] for c in client.scim_client.get.call_args_list] == [
        1,
        1 + SCIM_PAGE_SIZE,
    ]


def test_get_users_stops_on_an_empty_page():
    from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
        OmniConnection as OmniConnectionConfig,
    )
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    client = OmniApiClient(OmniConnectionConfig(hostPort="https://acme.omniapp.co", token="t"))
    client.scim_client = MagicMock()
    client.scim_client.get.side_effect = [{"Resources": [], "totalResults": 0}]
    assert client.get_users() == []
    assert client.scim_client.get.call_count == 1


def test_documents_response_accepts_object_shaped_labels():
    """The documents API reports labels as objects. Typing them as plain strings
    made one labelled document invalidate its whole page, and `get_documents`
    turns a page failure into an empty list -- dropping every dashboard."""
    from metadata.ingestion.source.dashboard.omni.models import DocumentsResponse

    page = {
        "records": [
            {"identifier": "a", "name": "Unlabelled", "hasDashboard": True, "labels": []},
            {
                "identifier": "b",
                "name": "Company North Star Metrics Executive Overview",
                "hasDashboard": True,
                "labels": [{"name": "Company North Star", "verified": True}, {"name": "Executive"}],
            },
        ],
        "pageInfo": {"hasNextPage": False},
    }
    response = DocumentsResponse.model_validate(page)
    assert [d.identifier for d in response.records] == ["a", "b"]
    assert response.records[0].label_names == []
    assert response.records[1].label_names == ["Company North Star", "Executive"]


def test_yield_tags_emits_document_labels(omni_source):
    labelled = MOCK_DOCUMENT.model_copy(
        update={"labels": [OmniLabel(name="Company North Star", verified=True), OmniLabel(name="Executive")]}
    )
    details = OmniDashboardDetails(document=labelled, dashboard=MOCK_DASHBOARD_DOC)
    tags = _rights(omni_source.yield_tags(details))
    names = {tag.tag_request.name.root for tag in tags}
    assert names == {"Company North Star", "Executive"}
    assert all(tag.classification_request.name.root == "OmniLabels" for tag in tags)


def test_yield_tags_skipped_when_include_tags_disabled(omni_source):
    labelled = MOCK_DOCUMENT.model_copy(update={"labels": [OmniLabel(name="Company North Star")]})
    details = OmniDashboardDetails(document=labelled, dashboard=MOCK_DASHBOARD_DOC)
    omni_source.source_config.includeTags = False
    assert list(omni_source.yield_tags(details)) == []


def test_yield_dashboard_attaches_label_tags(omni_source, tag_metadata):
    omni_source.metadata = tag_metadata
    labelled = MOCK_DOCUMENT.model_copy(update={"labels": [OmniLabel(name="Shared.Tag")]})
    details = OmniDashboardDetails(document=labelled, dashboard=MOCK_DASHBOARD_DOC)
    dashboard = _rights(omni_source.yield_dashboard(details))[0]
    assert [t.tagFQN.root for t in dashboard.tags] == ['OmniLabels."Shared.Tag"']


ORDERS_TOPIC = OmniTopic(
    model_id="m1", model_name="sales", name="Orders", base_view="analytics__orders", base_schema="ANALYTICS"
)
ORDERS_VIEW = OmniTopic(model_id="m1", model_name="sales", name="orders", base_view="orders", base_schema="ANALYTICS")


def _index(source, *topics):
    for topic in topics:
        for key in source._topic_name_keys(topic):
            source._topic_name_index[key].append(topic)
        for key in source._topic_alias_keys(topic):
            source._topic_alias_index[key].append(topic)


def test_resolve_topic_view_handle_picks_the_view_over_a_same_named_topic(omni_source):
    _index(omni_source, ORDERS_TOPIC, ORDERS_VIEW)
    assert omni_source._resolve_topic("analytics__orders") is ORDERS_VIEW
    assert omni_source._resolve_topic("ANALYTICS/orders") is ORDERS_VIEW


def test_resolve_topic_topic_name_picks_the_topic_over_a_same_named_view(omni_source):
    _index(omni_source, ORDERS_TOPIC, ORDERS_VIEW)
    assert omni_source._resolve_topic("Orders") is ORDERS_TOPIC


def test_resolve_topic_same_named_views_across_models_stay_ambiguous(omni_source):
    _index(omni_source, ORDERS_VIEW, ORDERS_VIEW.model_copy(update={"model_id": "m2", "model_name": "finance"}))
    assert omni_source._resolve_topic("analytics__orders") is None


def test_resolve_topic_same_model_collision_without_exact_spelling_stays_ambiguous(omni_source):
    _index(omni_source, ORDERS_TOPIC, ORDERS_VIEW)
    assert omni_source._resolve_topic("ORDERS") is None


def test_resolve_topic_shared_base_view_named_like_a_topic_stays_ambiguous(omni_source):
    """A reference that only matches a shared base view names the view, not a topic,
    so a topic spelled like the view's leaf must not win the tie."""
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    files = {
        "model": "",
        "orders.topic": "base_view: schema__shared__orders\n",
        "returns.topic": "base_view: schema__shared__orders\n",
    }
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda model: OmniApiClient._parse_model_yaml(model, files)
    omni_source.prepare()

    assert omni_source._resolve_topic("schema__shared__orders") is None


MOCK_APP = OmniDocument(
    identifier="doc-4",
    name="Sales App",
    hasDashboard=False,
    hasApp=True,
    url="https://acme.omniapp.co/apps/doc-4",
)


def test_get_dashboards_list_includes_apps(omni_source):
    archived_app = MOCK_APP.model_copy(update={"identifier": "doc-5", "deleted": True})
    omni_source.client.get_documents = lambda *_: [MOCK_DOCUMENT, MOCK_APP, archived_app, MOCK_WORKBOOK_ONLY]
    assert [d.identifier for d in omni_source.get_dashboards_list()] == ["doc-1", "doc-4"]


def test_documents_response_reads_has_app():
    from metadata.ingestion.source.dashboard.omni.models import DocumentsResponse

    page = {"records": [{"identifier": "doc-4", "hasDashboard": False, "hasApp": True}], "pageInfo": {}}
    assert DocumentsResponse.model_validate(page).records[0].hasApp is True


SEMANTIC_VIEW_TOPIC = """
semantic_view: MY_DB.SEMANTIC_VIEWS.SV_ORDERS
label: Orders
description: Orders semantic view
views:
  semantic_views__sv_orders__dim_customers:
    label: Dim Customers
    schema: INFO_GENERAL
    table_name: DIM_CUSTOMERS
    dimensions:
      customer_id:
        type: string
    measures: {}
  semantic_views__sv_orders__fact_orders:
    label: Fact Orders
    schema: BIZ_GENERAL
    table_name: FACT_ORDERS_ENRICHED
    dimensions:
      order_id:
        type: string
    measures:
      amount:
        type: number
"""


def _parse(files):
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    return {t.name: t for t in OmniApiClient._parse_model_yaml(OmniModel(id="m1", name="sales"), files)}


def test_parse_model_yaml_semantic_view_topic():
    """A semantic-view topic resolves to the semantic view, and each inline view is a
    data model backed by its own table."""
    parsed = _parse({"Sales/semantic_views__sv_orders.topic": SEMANTIC_VIEW_TOPIC})

    assert set(parsed) == {
        "semantic_views__sv_orders",
        "semantic_views__sv_orders__dim_customers",
        "semantic_views__sv_orders__fact_orders",
    }
    topic = parsed["semantic_views__sv_orders"]
    assert (topic.base_database, topic.base_schema, topic.base_table) == ("MY_DB", "SEMANTIC_VIEWS", "SV_ORDERS")
    assert [f.name for f in topic.fields] == [
        "semantic_views__sv_orders__dim_customers.customer_id",
        "semantic_views__sv_orders__fact_orders.order_id",
        "semantic_views__sv_orders__fact_orders.amount",
    ]

    customers = parsed["semantic_views__sv_orders__dim_customers"]
    assert (customers.label, customers.base_schema, customers.base_table) == (
        "Dim Customers",
        "INFO_GENERAL",
        "DIM_CUSTOMERS",
    )
    assert [f.name for f in customers.fields] == ["customer_id"]
    orders = parsed["semantic_views__sv_orders__fact_orders"]
    assert (orders.base_schema, orders.base_table) == ("BIZ_GENERAL", "FACT_ORDERS_ENRICHED")
    assert [(f.name, f.field_type) for f in orders.fields] == [("order_id", "dimension"), ("amount", "measure")]


def test_parse_model_yaml_semantic_view_topic_leaves_ordinary_topics_and_views_alone():
    files = {
        "semantic_views__sv_orders.topic": SEMANTIC_VIEW_TOPIC,
        "ANALYTICS/orders.view": "schema: ANALYTICS\ntable_name: ORDERS\ndimensions:\n  id: {}\n",
        "order_summary.topic": "base_view: analytics__orders\nlabel: Order Summary\n",
        "monthly_orders.view": "sql: select 1 as n\ndimensions:\n  n: {}\n",
    }
    parsed = _parse(files)

    summary = parsed["order_summary"]
    assert (summary.base_schema, summary.base_table, [f.name for f in summary.fields]) == (
        "ANALYTICS",
        "ORDERS",
        ["id"],
    )
    assert summary.base_database is None
    assert (parsed["orders"].base_table, parsed["orders"].base_database) == ("ORDERS", None)
    query_view = parsed["monthly_orders"]
    assert (query_view.base_table, [f.name for f in query_view.fields]) == (None, ["n"])
    assert len(parsed) == 6


def test_parse_model_yaml_standalone_view_wins_over_inline_view():
    """An inline view never replaces the model's own view file of the same name."""
    files = {
        "semantic_views/sv_orders__fact_orders.view": "schema: BIZ_GENERAL\ntable_name: FACT_ORDERS\ndimensions:\n  id: {}\n",
        "semantic_views__sv_orders.topic": SEMANTIC_VIEW_TOPIC,
    }
    parsed = _parse(files)

    assert "semantic_views__sv_orders__fact_orders" not in parsed
    standalone = parsed["sv_orders__fact_orders"]
    assert (standalone.base_table, [f.name for f in standalone.fields]) == ("FACT_ORDERS", ["id"])
    assert "semantic_views__sv_orders__dim_customers" in parsed


def test_tile_reference_to_a_replaced_inline_view_resolves_to_the_view_file(omni_source):
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    files = {
        "semantic_views/sv_orders__fact_orders.view": "schema: BIZ_GENERAL\ntable_name: FACT_ORDERS\n",
        "semantic_views__sv_orders.topic": SEMANTIC_VIEW_TOPIC,
        "order_summary.topic": "base_view: semantic_views__sv_orders__fact_orders\n",
    }
    model = OmniModel(id="m1", name="sales")
    omni_source.client.get_models = lambda *_: [model]
    omni_source.client.get_model_topics = lambda *_: OmniApiClient._parse_model_yaml(model, files)
    omni_source.prepare()

    tile = QueryPresentation(
        name="Orders",
        query=OmniQuery(
            table="semantic_views__sv_orders",
            fields=["semantic_views__sv_orders__fact_orders.amount"],
        ),
    )
    assert [t.name for t in omni_source._tile_topics(tile)] == [
        "semantic_views__sv_orders",
        "sv_orders__fact_orders",
    ]


def test_tile_reference_to_a_replaced_inline_view_resolves_to_a_topic_of_the_same_name(omni_source):
    """A curated topic that takes the view file's name also takes the inline name it answered to."""
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    files = {
        "semantic_views/sv_orders__fact_orders.view": "schema: BIZ_GENERAL\ntable_name: FACT_ORDERS\n",
        "sv_orders__fact_orders.topic": "base_view: sv_orders__fact_orders\nlabel: Fact Orders\n",
        "semantic_views__sv_orders.topic": SEMANTIC_VIEW_TOPIC,
    }
    model = OmniModel(id="m1", name="sales")
    omni_source.client.get_models = lambda *_: [model]
    omni_source.client.get_model_topics = lambda *_: OmniApiClient._parse_model_yaml(model, files)
    omni_source.prepare()

    tile = QueryPresentation(
        name="Orders",
        query=OmniQuery(
            table="semantic_views__sv_orders",
            fields=["semantic_views__sv_orders__fact_orders.amount"],
        ),
    )
    resolved = list(omni_source._tile_topics(tile))
    assert [(t.name, t.label) for t in resolved] == [
        ("semantic_views__sv_orders", "Orders"),
        ("sv_orders__fact_orders", "Fact Orders"),
    ]


@pytest.mark.parametrize("broken", ["dimensions: [id]", "dimensions: {id: 3}", "label: {text: Orders}"])
def test_parse_model_yaml_malformed_inline_view_is_skipped_alone(broken):
    """One inline view that cannot be parsed does not cost the model its other views."""
    indented = "\n".join(f"    {line}" for line in broken.splitlines())
    files = {
        "ANALYTICS/orders.view": "schema: ANALYTICS\ntable_name: ORDERS\n",
        "order_summary.topic": f"base_view: analytics__orders\nviews:\n  analytics__orders:\n{indented}\n",
        "sv_orders.topic": (
            "semantic_view: MY_DB.SEMANTIC_VIEWS.SV_ORDERS\n"
            "views:\n"
            f"  sv_orders__broken:\n    schema: BIZ_GENERAL\n    table_name: BROKEN\n{indented}\n"
            "  sv_orders__dim_customers:\n    schema: INFO_GENERAL\n    table_name: DIM_CUSTOMERS\n"
        ),
    }
    parsed = _parse(files)

    assert set(parsed) == {"order_summary", "orders", "sv_orders", "sv_orders__dim_customers"}
    assert parsed["order_summary"].base_table == "ORDERS"
    assert parsed["sv_orders__dim_customers"].base_table == "DIM_CUSTOMERS"


def test_parse_model_yaml_inline_override_without_table_is_not_a_data_model():
    """An ordinary topic's inline entry that only overrides fields of a view neither
    becomes a data model nor changes the view it overrides."""
    files = {
        "ANALYTICS/orders.view": "schema: ANALYTICS\ntable_name: ORDERS\ndimensions:\n  id: {}\n  total: {}\n",
        "order_summary.topic": (
            "base_view: analytics__orders\n"
            "views:\n"
            "  analytics__orders:\n    dimensions:\n      total:\n        hidden: true\n"
            "  customers:\n    label: Customers\n"
        ),
    }
    parsed = _parse(files)

    assert set(parsed) == {"order_summary", "orders"}
    assert (parsed["orders"].base_table, [f.name for f in parsed["orders"].fields]) == ("ORDERS", ["id", "total"])
    assert parsed["order_summary"].base_table == "ORDERS"


@pytest.mark.parametrize(
    ("topic_yaml", "expected"),
    [
        ("semantic_view: ''\nviews: not-a-mapping\n", (None, None, None)),
        ("semantic_view: SV_ORDERS\nviews:\n  - a\n", (None, None, "SV_ORDERS")),
        ("semantic_view: SEMANTIC_VIEWS.SV_ORDERS\nviews:\n  broken: 3\n", (None, "SEMANTIC_VIEWS", "SV_ORDERS")),
        ("semantic_view: MY_DB.SEMANTIC_VIEWS.SV_ORDERS\nviews: {}\n", ("MY_DB", "SEMANTIC_VIEWS", "SV_ORDERS")),
        ('semantic_view: MY_DB."MY.SCHEMA"."SV.ORDERS"\n', ("MY_DB", '"MY.SCHEMA"', '"SV.ORDERS"')),
    ],
)
def test_parse_model_yaml_semantic_view_topic_with_malformed_input(topic_yaml, expected):
    parsed = _parse({"sv_orders.topic": topic_yaml})

    assert list(parsed) == ["sv_orders"]
    topic = parsed["sv_orders"]
    assert (topic.base_database, topic.base_schema, topic.base_table) == expected
    assert topic.fields == []


def test_semantic_view_topic_lineage(omni_source):
    """The topic's upstream is the semantic view, each inline view's upstream is its
    own table, and a tile reading an inline view's fields links that view."""
    from metadata.ingestion.source.dashboard.omni.client import OmniApiClient

    files = {"Sales/semantic_views__sv_orders.topic": SEMANTIC_VIEW_TOPIC}
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda model: OmniApiClient._parse_model_yaml(model, files)
    omni_source.prepare()

    tables = {
        "MY_DB.SEMANTIC_VIEWS.SV_ORDERS": "550e8400-e29b-41d4-a716-446655440041",
        "INFO_GENERAL.DIM_CUSTOMERS": "550e8400-e29b-41d4-a716-446655440042",
        "BIZ_GENERAL.FACT_ORDERS_ENRICHED": "550e8400-e29b-41d4-a716-446655440043",
    }
    searches = []

    def search_in_any_service(entity_type, fqn_search_string):
        searches.append(fqn_search_string)
        for suffix, table_id in tables.items():
            if fqn_search_string.endswith(suffix) and fqn_search_string.count(".") == 3:
                return Table(id=table_id, name=suffix.split(".")[-1], columns=[])
        return None

    datamodel_ids = {
        "sales.semantic_views__sv_orders": "550e8400-e29b-41d4-a716-446655440051",
        "sales.semantic_views__sv_orders__dim_customers": "550e8400-e29b-41d4-a716-446655440052",
        "sales.semantic_views__sv_orders__fact_orders": "550e8400-e29b-41d4-a716-446655440053",
    }
    omni_source.metadata.search_in_any_service = search_in_any_service
    omni_source._get_datamodel_entity = lambda topic: DashboardDataModel(
        id=datamodel_ids[omni_source._datamodel_name(topic)],
        name=omni_source._datamodel_name(topic),
        dataModelType="OmniDataModel",
        columns=[],
    )

    results = _rights(omni_source.yield_bulk_datamodel(_DATAMODEL_LINEAGE_SENTINEL))
    edges = {
        (str(r.lineage_request.edge.fromEntity.id.root), str(r.lineage_request.edge.toEntity.id.root))
        for r in results
        if isinstance(r, OMetaLineageRequest)
    }
    assert edges == {
        (tables["MY_DB.SEMANTIC_VIEWS.SV_ORDERS"], datamodel_ids["sales.semantic_views__sv_orders"]),
        (tables["INFO_GENERAL.DIM_CUSTOMERS"], datamodel_ids["sales.semantic_views__sv_orders__dim_customers"]),
        (tables["BIZ_GENERAL.FACT_ORDERS_ENRICHED"], datamodel_ids["sales.semantic_views__sv_orders__fact_orders"]),
    }
    assert "*.MY_DB.SEMANTIC_VIEWS.SV_ORDERS" in searches

    dashboard_entity = Dashboard(
        id="550e8400-e29b-41d4-a716-446655440054",
        name="doc-1",
        service=EntityReference(id="550e8400-e29b-41d4-a716-446655440055", type="dashboardService"),
    )
    omni_source.metadata.get_by_name = MagicMock(return_value=dashboard_entity)
    tile = QueryPresentation(
        name="Revenue",
        query=OmniQuery(
            table="semantic_views__sv_orders",
            fields=["semantic_views__sv_orders__fact_orders.amount"],
        ),
    )
    details = OmniDashboardDetails(
        document=MOCK_DOCUMENT, dashboard=OmniDashboardDocument(identifier="doc-1", queryPresentations=[tile])
    )
    dashboard_edges = {
        str(r.edge.fromEntity.id.root)
        for r in _rights(omni_source.yield_dashboard_lineage_details(details))
        if isinstance(r, AddLineageRequest)
    }
    assert dashboard_edges == {
        datamodel_ids["sales.semantic_views__sv_orders"],
        datamodel_ids["sales.semantic_views__sv_orders__fact_orders"],
    }


def test_parse_model_yaml_inline_view_shared_by_two_topics_is_one_data_model():
    other = SEMANTIC_VIEW_TOPIC.replace("SV_ORDERS", "SV_RETURNS").replace("FACT_ORDERS_ENRICHED", "FACT_RETURNS")
    parsed = _parse({"a.topic": SEMANTIC_VIEW_TOPIC, "b.topic": other})

    assert len(parsed) == 4
    assert parsed["semantic_views__sv_orders__fact_orders"].base_table == "FACT_ORDERS_ENRICHED"
    assert parsed["b"].base_table == "SV_RETURNS"
