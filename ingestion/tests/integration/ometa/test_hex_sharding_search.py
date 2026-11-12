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
"""Unscoped Hex resolution against the real table search mappings."""

import json
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import pytest
import requests
from tenacity import retry, stop_after_delay, wait_fixed
from testcontainers.core.container import DockerContainer

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.ingestion.ometa.mixins.es_mixin import ESMixin
from metadata.ingestion.source.dashboard.hex.cell_lineage import HexCellLineage
from metadata.ingestion.source.dashboard.hex.metadata import HexSource, TableSearchError


@pytest.fixture(scope="module", params=["elasticsearch", "opensearch"])
def search_backend(request):
    engine = request.param
    image = (
        "docker.elastic.co/elasticsearch/elasticsearch:9.3.0"
        if engine == "elasticsearch"
        else "opensearchproject/opensearch:3.4.0"
    )
    container = DockerContainer(image).with_env("discovery.type", "single-node")
    container.with_env("ES_JAVA_OPTS" if engine == "elasticsearch" else "OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m")
    if engine == "elasticsearch":
        container.with_env("xpack.security.enabled", "false")
    else:
        container.with_env("DISABLE_SECURITY_PLUGIN", "true").with_env("DISABLE_INSTALL_DEMO_CONFIG", "true")
    container.with_bind_ports(9200, ("127.0.0.1", None))
    with container:
        base = f"http://{container.get_container_host_ip()}:{container.get_exposed_port(9200)}"

        @retry(stop=stop_after_delay(120), wait=wait_fixed(1), reraise=True)
        def ready():
            response = requests.get(base + "/_cluster/health?wait_for_status=yellow&timeout=1s", timeout=3)
            response.raise_for_status()
            assert response.json()["status"] in ("yellow", "green")

        ready()
        yield engine, base


class SearchCatalog(ESMixin):
    def __init__(self, base, index):
        self.base, self.index = base, index
        self.tables = {}
        self.searches = 0
        self.client = SimpleNamespace(get=self.search)

    def search(self, path):
        params = parse_qs(urlsplit(path).query)
        assert params["deleted"] == ["false"]
        self.searches += 1
        if urlsplit(path).path == "/search/query":
            query = json.loads(params["query_filter"][0])["query"]
        else:
            assert urlsplit(path).path == "/search/fieldQuery"
            query = {"wildcard": {params["fieldName"][0]: params["fieldValue"][0]}}
        response = requests.post(
            f"{self.base}/{self.index}/_search",
            json={
                "query": {"bool": {"filter": [query, {"term": {"deleted": False}}]}},
                "size": int(params["size"][0]),
                "track_total_hits": params.get("track_total_hits", ["true"])[0] == "true",
                "_source": params.get("include_source_fields", ["*"]),
            },
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    def get_by_name(self, entity, fqn, fields=None):
        return self.tables.get(fqn)

    def add(
        self,
        service="warehouse",
        name="events_yyyymmdd",
        service_type="BigQuery",
        family=True,
        schema="analytics",
        deleted=False,
        database="demo_db",
    ):
        fqn = f"{service}.{database}.{schema}.{name}"
        table = Table(
            id=uuid4(),
            name=name,
            fullyQualifiedName=fqn,
            columns=[],
            serviceType=service_type,
            tableType="Sharded" if family else "Regular",
            deleted=deleted,
            tableSharding={
                "prefix": name.removesuffix("yyyymmdd"),
                "suffixFormat": "YYYYMMDD",
                "shardCount": 1,
                "firstShardDate": "2026-11-01",
                "lastShardDate": "2026-11-01",
                "representative": {
                    "databaseName": "demo_db",
                    "schemaName": schema,
                    "tableName": name.replace("yyyymmdd", "20261101"),
                    "shardDate": "2026-11-01",
                },
            }
            if family
            else None,
        )
        doc = table.model_dump(mode="json", exclude_none=True)
        doc.update(database={"name": database}, databaseSchema={"name": schema})
        response = requests.put(f"{self.base}/{self.index}/_doc/{table.id.root}?refresh=true", json=doc, timeout=10)
        response.raise_for_status()
        self.tables[fqn] = table
        return table


@pytest.fixture
def source(search_backend):
    _, base = search_backend
    root = Path(__file__).resolve().parents[4]
    mapping = json.loads(
        (root / "openmetadata-spec/src/main/resources/elasticsearch/en/table_index_mapping.json").read_text()
    )
    index = "hex_unscoped_" + uuid4().hex
    response = requests.put(f"{base}/{index}", json=mapping, timeout=10)
    response.raise_for_status()
    source = HexSource.__new__(HexSource)
    source.metadata = SearchCatalog(base, index)
    source.source_config = DashboardServiceMetadataPipeline()
    yield source


def test_combined_search_preserves_cross_service_ambiguity(source):
    family = source.metadata.add()
    source.metadata.add("other", name="events_extra_yyyymmdd")
    source.metadata.add("postgres", service_type="Postgres")
    source.metadata.add("other_schema", schema="elsewhere")
    source.metadata.add("retired", deleted=True)
    assert source._resolve_table("DEMO_DB", "ANALYTICS", "events_20261101", "bigquery")[0].id == family.id
    assert source.metadata.searches == 1
    physical = source.metadata.add("other", name="events_20261101", family=False, service_type="Postgres")
    assert source._resolve_table("demo_db", "analytics", "events_20261101", "bigquery") is None
    assert source.metadata.searches == 2
    assert physical.id != family.id


def test_physical_precedence_and_decorator(source):
    family = source.metadata.add()
    assert source._resolve_table("demo_db", "analytics", "events_20261101$20261101", "bigquery")[0].id == family.id
    physical = source.metadata.add(name="events_20261101", family=False)
    assert source._resolve_table("demo_db", "analytics", "events_20261101$20261101", "bigquery")[0].id == physical.id
    assert source.metadata.searches == 2


def test_wildcard_complete_within_bound_and_overflow_reported(source):
    first = source.metadata.add()
    second = source.metadata.add(name="events_extra_yyyymmdd")
    lineage = HexCellLineage(name="cell", label="cell", sql="select * from demo_db.analytics.events_*")
    source._add_wildcard_tables(lineage, "demo_db", "analytics", "events_*", "bigquery")
    assert set(lineage.tables) == {str(first.id.root), str(second.id.root)}
    for number in range(99):
        source.metadata.add(name=f"events_family_{number}_yyyymmdd")
    with pytest.raises(TableSearchError, match="exceeds"):
        source._add_wildcard_tables(lineage, "demo_db", "analytics", "events_*", "bigquery")
    assert source.metadata.searches == 2


@pytest.mark.parametrize("has_match", [False, True])
def test_clickhouse_unscoped_reference_preserves_database_constraint(source, has_match):
    source.metadata.add("warehouse", name="orders", service_type="Clickhouse", family=False, database="default")
    source.metadata.add("unrelated", name="orders", service_type="Postgres", family=False, database="elsewhere")
    matching = (
        source.metadata.add("warehouse", name="orders", service_type="Clickhouse", family=False) if has_match else None
    )
    result = source._resolve_table("demo_db", "analytics", "orders", "clickhouse")
    if matching:
        assert result[0].id == matching.id
    else:
        assert result is None
    assert source.metadata.searches == 1
