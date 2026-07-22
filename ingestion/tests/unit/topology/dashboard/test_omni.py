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
    OmniModel,
    OmniOwner,
    OmniQuery,
    OmniTopic,
    QueryPresentation,
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
    owner=OmniOwner(id="u1", name="Jane", email="jane@acme.co"),
    hasDashboard=True,
    url="https://acme.omniapp.co/dashboards/doc-1",
    deleted=False,
)

MOCK_ARCHIVED_DOCUMENT = OmniDocument(identifier="doc-2", name="Old", hasDashboard=True, deleted=True)
MOCK_WORKBOOK_ONLY = OmniDocument(identifier="doc-3", name="Workbook", hasDashboard=False)

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
    source.client = SimpleNamespace()
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
    omni_source._topic_index = {"orders": [t1, t2]}
    assert omni_source._resolve_topic("orders") is None


def test_resolve_topic_qualified_reference(omni_source):
    """A schema-qualified reference resolves via the qualified index key, in either
    ``.`` or ``/`` form, and never gets stripped to a bare leaf."""
    omni_source.client.get_models = lambda *_: [OmniModel(id="m1", name="sales")]
    omni_source.client.get_model_topics = lambda *_: [MOCK_TOPIC]  # base_schema=ANALYTICS
    omni_source.prepare()
    assert omni_source._resolve_topic("ANALYTICS.orders").base_table == "ORDERS"
    assert omni_source._resolve_topic("ANALYTICS/orders").base_table == "ORDERS"


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
    omni_source._topic_index = {"orders": [MOCK_TOPIC]}

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


def test_list_datamodels_respects_include_flag(omni_source):
    omni_source.topics = [MOCK_TOPIC]
    omni_source.source_config.includeDataModels = True
    produced = list(omni_source.list_datamodels())
    # A trailing sentinel drives the bulk table-lineage emission.
    assert [t.name for t in produced if isinstance(t, OmniTopic)] == ["orders"]
    assert produced[-1] is _DATAMODEL_LINEAGE_SENTINEL

    omni_source.source_config.includeDataModels = False
    assert list(omni_source.list_datamodels()) == []
