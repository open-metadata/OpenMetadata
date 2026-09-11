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
Grafana panel -> database table lineage across datasource types (issue #23997).

The dashboard payloads here are the raw dicts the Grafana HTTP API returns, so the
tests exercise model parsing, SQL extraction, dialect selection, service resolution
and entity lookup as one chain - not the helpers in isolation.

Datasource plugins disagree on how they spell the SQL key in a panel target, so
every SQL path is exercised with both `rawSql` and `rawSQL`.
"""

from fnmatch import fnmatch
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.source.dashboard.grafana.metadata import GrafanaSource
from metadata.ingestion.source.dashboard.grafana.models import (
    GrafanaDashboardResponse,
    GrafanaDatasource,
)

TRINO_SQL = "SELECT order_status, sum(total_price) AS value FROM memory.sales.orders GROUP BY 1"
POSTGRES_SQL = "SELECT count(*) FROM public.orders"
CLICKHOUSE_SQL = "SELECT count() FROM events.hits"
# Elasticsearch also fills `query`, with Lucene - it must never reach the SQL parser
LUCENE_QUERY = "user_location:* AND status:200"

TRINO_TABLE = Table(
    id="b10b4fc8-b7bf-40bc-ac7b-8fdb192d6cdc",
    name="orders",
    fullyQualifiedName="trino_svc.memory.sales.orders",
    columns=[],
)
POSTGRES_TABLE = Table(
    id="d394cf25-ca43-4f71-b5c6-4ea6ba134a7a",
    name="orders",
    fullyQualifiedName="pg_svc.analytics.public.orders",
    columns=[],
)
CLICKHOUSE_TABLE = Table(
    id="7c1f2e90-0000-4000-8000-00000000000c",
    name="hits",
    fullyQualifiedName="ch_svc.default.events.hits",
    columns=[],
)
# Same table name in two services: the search string, not the name, must disambiguate
FAKE_TABLE_INDEX = [TRINO_TABLE, POSTGRES_TABLE, CLICKHOUSE_TABLE]

DASHBOARD_ENTITY = LineageDashboard(
    id="0fbecc47-96a5-441e-b6eb-37ec43195341",
    name="omd-23997",
    service=EntityReference(id="9e2ad13b-92b5-4b3d-8038-239185d28a19", type="dashboardService"),
)

DB_SERVICES = {
    "trino_svc": DatabaseService(
        id="1a3f7f11-0000-4000-8000-000000000001",
        name="trino_svc",
        fullyQualifiedName=FullyQualifiedEntityName("trino_svc"),
        connection=DatabaseConnection(),
        serviceType=DatabaseServiceType.Trino,
    ),
    "pg_svc": DatabaseService(
        id="1a3f7f11-0000-4000-8000-000000000002",
        name="pg_svc",
        fullyQualifiedName=FullyQualifiedEntityName("pg_svc"),
        connection=DatabaseConnection(),
        serviceType=DatabaseServiceType.Postgres,
    ),
    "ch_svc": DatabaseService(
        id="1a3f7f11-0000-4000-8000-000000000003",
        name="ch_svc",
        fullyQualifiedName=FullyQualifiedEntityName("ch_svc"),
        connection=DatabaseConnection(),
        serviceType=DatabaseServiceType.Clickhouse,
    ),
}

# As returned by GET /api/datasources. The Trino datasource exposes no database,
# so the catalog can only come from the SQL itself.
DATASOURCES = [
    GrafanaDatasource(id=2, uid="trino-ds-uid", name="TrinoDS", type="trino-datasource", database=""),
    GrafanaDatasource(
        id=1,
        uid="pg-ds-uid",
        name="PostgresDS",
        type="grafana-postgresql-datasource",
        database="analytics",
    ),
    # Predates the rawSql convention: its SQL lives in the generic `query` field
    GrafanaDatasource(id=3, uid="ch-ds-uid", name="ClickHouseDS", type="vertamedia-clickhouse-datasource"),
    GrafanaDatasource(id=4, uid="es-ds-uid", name="ElasticDS", type="elasticsearch"),
]

DASHBOARD_META = {
    "type": "db",
    "canSave": True,
    "canEdit": True,
    "canAdmin": True,
    "canStar": True,
    "canDelete": True,
    "slug": "omd-23997-trino-lineage",
    "url": "/d/omd-23997/omd-23997-trino-lineage",
}


def _panel(panel_id: int, title: str, ds_type: str, ds_uid: str, sql_field: str, sql: str) -> dict:
    datasource = {"type": ds_type, "uid": ds_uid}
    return {
        "id": panel_id,
        "type": "timeseries",
        "title": title,
        "datasource": datasource,
        "targets": [{"refId": "A", "datasource": datasource, sql_field: sql, "format": 1}],
    }


# Both spellings are in the wild: the Trino plugin persists "rawSQL", the core SQL
# plugins persist "rawSql". Neither may depend on the datasource type to be picked up.
SQL_KEYS = ["rawSql", "rawSQL"]


def trino_panel(sql_key: str = "rawSQL") -> dict:
    return _panel(1, "Trino Orders", "trino-datasource", "trino-ds-uid", sql_key, TRINO_SQL)


def postgres_panel(sql_key: str = "rawSql") -> dict:
    return _panel(2, "Postgres Orders", "grafana-postgresql-datasource", "pg-ds-uid", sql_key, POSTGRES_SQL)


TRINO_PANEL = trino_panel()
POSTGRES_PANEL = postgres_panel()


def dashboard_response(*panels: dict) -> GrafanaDashboardResponse:
    return GrafanaDashboardResponse(
        dashboard={
            "id": 1,
            "uid": "omd-23997",
            "title": "OMD 23997 Trino Lineage",
            "panels": list(panels),
        },
        meta=DASHBOARD_META,
    )


def fake_search_in_any_service(entity_type, fqn_search_string, fetch_multiple_entities=False, **_):
    """Stand-in for the ES lookup: only FQN glob matching, no name-only fallback."""
    assert entity_type is Table
    return [t for t in FAKE_TABLE_INDEX if fnmatch(t.fullyQualifiedName.root, fqn_search_string)]


@pytest.fixture
def grafana_source():
    config = {
        "type": "grafana",
        "serviceName": "grafana_23997",
        "serviceConnection": {
            "config": {
                "type": "Grafana",
                "hostPort": "https://grafana.example.com",
                "apiKey": "test_api_key",
            }
        },
        "sourceConfig": {"config": {"type": "DashboardMetadata"}},
    }
    with (
        patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection"),
        patch("metadata.ingestion.source.dashboard.dashboard_service.run_test_connection"),
    ):
        metadata = MagicMock()
        metadata.get_by_name.side_effect = lambda entity, fqn, **kw: (
            DASHBOARD_ENTITY if entity is LineageDashboard else DB_SERVICES.get(str(fqn))
        )
        metadata.search_in_any_service.side_effect = fake_search_in_any_service
        source = GrafanaSource.create(config, metadata)

    source.client = MagicMock()
    source.datasources = {ds.uid: ds for ds in DATASOURCES} | {ds.name: ds for ds in DATASOURCES}
    source.context.get().__dict__["dashboard_service"] = "grafana_23997"
    source.context.get().__dict__["charts"] = []
    return source


def lineage_targets(source: GrafanaSource, response: GrafanaDashboardResponse, prefix: str) -> list[str]:
    """Run the real lineage step and return the upstream table FQNs it produced."""
    return [
        e.right.edge.fromEntity.fullyQualifiedName
        for e in source.yield_dashboard_lineage_details(response, prefix)
        if e.right is not None
    ]


@pytest.mark.parametrize("sql_key", SQL_KEYS)
def test_postgres_panel_lineage_is_unchanged(grafana_source, sql_key):
    """Control case: the datasource type that already worked keeps working."""
    result = lineage_targets(grafana_source, dashboard_response(postgres_panel(sql_key)), "pg_svc")
    assert result == ["pg_svc.analytics.public.orders"]


@pytest.mark.parametrize("sql_key", SQL_KEYS)
def test_trino_panel_produces_lineage(grafana_source, sql_key):
    """#23997: a Trino-backed panel must reach its Trino table, whichever key holds the SQL."""
    result = lineage_targets(grafana_source, dashboard_response(trino_panel(sql_key)), "trino_svc")
    assert result == ["trino_svc.memory.sales.orders"]


def test_trino_lineage_points_at_the_already_ingested_table(grafana_source):
    """The edge must reuse the existing Trino entity rather than target a look-alike."""
    edges = list(grafana_source.yield_dashboard_lineage_details(dashboard_response(TRINO_PANEL), "trino_svc"))
    assert len(edges) == 1
    edge = edges[0].right.edge
    assert edge.fromEntity.id == TRINO_TABLE.id
    assert edge.fromEntity.type == "table"
    assert edge.toEntity.id == DASHBOARD_ENTITY.id
    assert edge.lineageDetails.sqlQuery.root == TRINO_SQL


def test_trino_panel_uses_the_trino_dialect(grafana_source):
    """dbServicePrefixes drives dialect selection, so the parser must see Trino."""
    with patch("metadata.ingestion.source.dashboard.grafana.metadata.LineageParser") as parser_cls:
        parser_cls.return_value.source_tables = []
        list(grafana_source.yield_dashboard_lineage_details(dashboard_response(TRINO_PANEL), "trino_svc"))
    assert parser_cls.call_args.args[0] == TRINO_SQL
    assert parser_cls.call_args.args[1] == Dialect.TRINO


def test_db_service_prefix_scopes_the_lookup(grafana_source):
    """A prefix naming a different service must not pull the Trino table in."""
    assert lineage_targets(grafana_source, dashboard_response(TRINO_PANEL), "pg_svc") == []


def test_multi_datasource_dashboard_keeps_services_separate(grafana_source):
    """Both panels read a table called `orders`; neither may cross services."""
    response = dashboard_response(TRINO_PANEL, POSTGRES_PANEL)
    assert lineage_targets(grafana_source, response, "trino_svc") == ["trino_svc.memory.sales.orders"]
    assert lineage_targets(grafana_source, response, "pg_svc") == ["pg_svc.analytics.public.orders"]


@pytest.mark.parametrize("sql_key", SQL_KEYS)
def test_panel_sql_survives_model_parsing(sql_key):
    """Either spelling must land on `raw_sql`; dropping one silently kills lineage."""
    response = dashboard_response(trino_panel(sql_key))
    assert response.dashboard.panels[0].targets[0].raw_sql == TRINO_SQL


def test_unknown_sql_key_is_not_silently_accepted():
    """Guards the parametrised cases above: they pass because of the alias, not by default."""
    response = dashboard_response(trino_panel("rawsql"))
    assert response.dashboard.panels[0].targets[0].raw_sql is None


def test_trino_sql_parses_to_the_expected_source_table():
    """The panel SQL itself must yield catalog.schema.table for entity resolution."""
    parser = LineageParser(TRINO_SQL, Dialect.TRINO)
    assert [str(t) for t in parser.source_tables] == ["memory.sales.orders"]


def test_non_sql_datasource_yields_no_lineage(grafana_source):
    """Prometheus panels have no SQL to parse and must stay out of lineage."""
    grafana_source.datasources["prom-ds-uid"] = GrafanaDatasource(
        id=5, uid="prom-ds-uid", name="Prom", type="prometheus"
    )
    panel = {
        "id": 3,
        "type": "stat",
        "title": "Requests",
        "datasource": {"type": "prometheus", "uid": "prom-ds-uid"},
        "targets": [
            {
                "refId": "A",
                "datasource": {"type": "prometheus", "uid": "prom-ds-uid"},
                "expr": "sum(rate(http_requests_total[5m]))",
            }
        ],
    }
    assert lineage_targets(grafana_source, dashboard_response(panel), "trino_svc") == []


def test_legacy_datasource_keeping_sql_in_query_still_resolves(grafana_source):
    """The Altinity ClickHouse plugin predates rawSql and keeps the statement in `query`."""
    panel = _panel(4, "CH Hits", "vertamedia-clickhouse-datasource", "ch-ds-uid", "query", CLICKHOUSE_SQL)
    assert lineage_targets(grafana_source, dashboard_response(panel), "ch_svc") == ["ch_svc.default.events.hits"]


def test_non_sql_query_field_never_reaches_the_parser(grafana_source):
    """Elasticsearch fills the same `query` field with Lucene - parsing it invents lineage."""
    panel = _panel(5, "Hits by location", "elasticsearch", "es-ds-uid", "query", LUCENE_QUERY)
    with patch("metadata.ingestion.source.dashboard.grafana.metadata.LineageParser") as parser_cls:
        assert lineage_targets(grafana_source, dashboard_response(panel), "ch_svc") == []
    parser_cls.assert_not_called()
