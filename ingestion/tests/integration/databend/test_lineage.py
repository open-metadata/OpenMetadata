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
"""Databend lineage integration tests."""

import copy

import pytest
from sqlalchemy import text

from metadata.generated.schema.entity.data.table import Table
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def databend_connection(databend_connection):
    return databend_connection.model_copy(update={"databaseSchema": None})


def _upstream_edges(metadata, table_fqn: str) -> dict[str, dict]:
    lineage = metadata.get_lineage_by_name(Table, table_fqn, up_depth=1, down_depth=0)
    nodes = {node["id"]: node["fullyQualifiedName"] for node in lineage.get("nodes", [])}
    nodes[lineage["entity"]["id"]] = lineage["entity"]["fullyQualifiedName"]
    return {nodes[edge["fromEntity"]]: edge.get("lineageDetails", {}) for edge in lineage.get("upstreamEdges", [])}


def test_table_and_column_lineage_from_databend(ingest_lineage, db_service, metadata):
    prefix = f"{db_service.fullyQualifiedName.root}.default"

    revenue = _upstream_edges(metadata, f"{prefix}.mart.customer_revenue")
    assert set(revenue) == {f"{prefix}.lineage_demo.customers", f"{prefix}.lineage_demo.customer_sales"}
    details = revenue[f"{prefix}.lineage_demo.customer_sales"]
    assert details["source"] == "QueryLineage"
    assert {(column["toColumn"], tuple(column["fromColumns"])) for column in details.get("columnsLineage", [])} == {
        (f"{prefix}.mart.customer_revenue.total_amount", (f"{prefix}.lineage_demo.customer_sales.total_amount",)),
    }

    sales = _upstream_edges(metadata, f"{prefix}.lineage_demo.customer_sales")
    assert set(sales) == {f"{prefix}.lineage_demo.orders"}


def test_view_lineage_from_databend(ingest_lineage, db_service, metadata):
    prefix = f"{db_service.fullyQualifiedName.root}.default"

    view = _upstream_edges(metadata, f"{prefix}.mart.v_revenue")
    assert set(view) == {f"{prefix}.mart.customer_revenue"}
    assert view[f"{prefix}.mart.customer_revenue"]["source"] == "ViewLineage"


def test_replaced_view_without_upstreams_loses_its_view_lineage(
    ingest_lineage, databend_engine, run_workflow, lineage_config, db_service, metadata
):
    view_fqn = f"{db_service.fullyQualifiedName.root}.default.mart.v_replaced"
    assert set(_upstream_edges(metadata, view_fqn)) == {
        f"{db_service.fullyQualifiedName.root}.default.lineage_demo.customers"
    }

    # The new definition reads no table, so Databend records no lineage for it and keeps the old record.
    with databend_engine.begin() as connection:
        connection.execute(text("CREATE OR REPLACE VIEW mart.v_replaced AS SELECT 1 AS customer_id"))

    run_workflow(MetadataWorkflow, lineage_config)
    assert _upstream_edges(metadata, view_fqn) == {}


def test_replaced_view_with_only_filtered_upstreams_loses_its_view_lineage(
    ingest_lineage, databend_engine, wait_for_databend_lineage, run_workflow, lineage_config, db_service, metadata
):
    prefix = f"{db_service.fullyQualifiedName.root}.default"
    view_fqn = f"{prefix}.mart.v_refiltered"
    assert set(_upstream_edges(metadata, view_fqn)) == {f"{prefix}.lineage_demo.customers"}

    with databend_engine.begin() as connection:
        connection.execute(text("CREATE OR REPLACE VIEW mart.v_refiltered AS SELECT order_id FROM lineage_demo.orders"))
    # The new definition does have a current record; wait for it so the run sees it and filters it out.
    wait_for_databend_lineage({("lineage_demo.orders", "mart.v_refiltered")})

    filtered_config = copy.deepcopy(lineage_config)
    filtered_config["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {"excludes": ["orders"]}
    run_workflow(MetadataWorkflow, filtered_config)
    assert _upstream_edges(metadata, view_fqn) == {}
