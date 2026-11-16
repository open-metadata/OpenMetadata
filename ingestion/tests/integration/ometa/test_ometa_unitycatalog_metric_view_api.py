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
Round-trip test for the Metric entities the Databricks metric-view adapter builds.

The unit tests prove the YAML maps to the right ``CreateMetricRequest``; this proves
the server accepts that request, stores every field, and gives it back unchanged on a
second unchanged run. It runs against the same live OpenMetadata instance as the rest
of ``tests/integration/ometa``.
"""

import textwrap

import pytest

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.metric import Metric, MetricType, Type
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.unitycatalog.metric_views import (
    build_metric_name,
    build_metric_request,
    parse_metric_view,
)

from ..integration_base import get_create_entity  # noqa: TID252

METRIC_VIEW_YAML = textwrap.dedent(
    """
    version: 1.1
    comment: Order performance metrics
    source: samples.tpch.orders
    filter: o_orderstatus = 'F'
    dimensions:
      - name: order_date
        expr: o_orderdate
        comment: Date the order was placed
      - name: order_status
        expr: o_orderstatus
    measures:
      - name: total_revenue
        expr: SUM(o_totalprice)
        display_name: Total Revenue
        comment: Sum of order totals
        format:
          type: currency
          currency_code: USD
      - name: order_count
        expr: COUNT(1)
    """
)

COLUMN_TYPES = {"order_date": "date", "order_status": "string"}


@pytest.fixture
def metric_view(metadata, database_service, create_table):
    """A Table standing in for the ingested metric view, so the metrics have an asset
    to point at."""
    database: Database = metadata.create_or_update(
        data=get_create_entity(entity=Database, reference=database_service.name.root)
    )
    db_schema: DatabaseSchema = metadata.create_or_update(
        data=get_create_entity(entity=DatabaseSchema, reference=database.fullyQualifiedName)
    )
    return create_table(
        CreateTableRequest(
            name="orders_metrics",
            databaseSchema=db_schema.fullyQualifiedName,
            columns=[
                Column(name=name, dataType=DataType.STRING)
                for name in ("order_date", "order_status", "total_revenue", "order_count")
            ],
        )
    )


@pytest.fixture
def ingest_metrics(metadata, metric_view, request):
    """Run the adapter's output through the Metric API, cleaning up afterwards."""
    # Keyed by id, not a list: the idempotency test ingests twice, and the second run
    # upserts the same entities. A list would queue each id twice and the repeat
    # hard-delete would 404.
    created: dict[str, Metric] = {}

    def _ingest():
        definition = parse_metric_view(METRIC_VIEW_YAML)
        view_ref = EntityReference(id=metric_view.id, type="table")
        entities = []
        for measure in definition.measures:
            create_request = build_metric_request(
                "databricks_svc", "samples", "tpch", "orders_metrics", definition, measure, COLUMN_TYPES, view_ref
            )
            entity = metadata.create_or_update(data=create_request)
            entities.append(entity)
            created[model_str(entity.id)] = entity
        return entities

    def teardown():
        for entity in created.values():
            metadata.delete(entity=Metric, entity_id=entity.id, hard_delete=True)

    request.addfinalizer(teardown)
    return _ingest


class TestUnitycatalogMetricViewRoundTrip:
    def test_every_mapped_field_survives_the_api(self, metadata, ingest_metrics, metric_view):
        ingest_metrics()

        name = build_metric_name("databricks_svc", "samples", "tpch", "orders_metrics", "total_revenue")
        stored = metadata.get_by_name(entity=Metric, fqn=name)

        assert stored is not None
        assert stored.displayName == "Total Revenue"
        assert stored.description.root == "Sum of order totals"
        assert stored.metricType == MetricType.SUM
        assert stored.metricExpression.code == "SUM(o_totalprice)"
        assert [f.where for f in stored.filters] == ["o_orderstatus = 'F'"]
        assert [(d.name, d.type) for d in stored.dimensions] == [
            ("order_date", Type.TIME),
            ("order_status", Type.CATEGORICAL),
        ]
        assert [(m.name, m.aggregation) for m in stored.measures] == [
            ("total_revenue", "SUM"),
            ("order_count", "COUNT"),
        ]
        # assets is not a readable field since #32335; it is served only by the /assets API
        linked = metadata.client.get(f"/metrics/{model_str(stored.id)}/assets")
        assert [row["asset"]["id"] for row in linked["data"]] == [model_str(metric_view.id)]

    def test_names_stay_unique_across_the_views_measures(self, metadata, ingest_metrics):
        entities = ingest_metrics()

        assert len({entity.fullyQualifiedName.root for entity in entities}) == 2
        for entity in entities:
            assert metadata.get_by_name(entity=Metric, fqn=entity.fullyQualifiedName.root) is not None

    def test_a_second_unchanged_run_does_not_bump_the_version(self, metadata, ingest_metrics):
        """Idempotency: re-ingesting the same metric view must be a no-op server-side,
        not a rewrite of every metric on every run."""
        first = ingest_metrics()
        second = ingest_metrics()

        assert [entity.version.root for entity in second] == [entity.version.root for entity in first]
