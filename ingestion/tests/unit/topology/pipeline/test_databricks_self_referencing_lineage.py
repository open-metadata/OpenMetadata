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
A table is never linked to itself.

`system.access.table_lineage` records table access rather than derivation, so a
streaming or CDC write legitimately names its target table as its own source.
Carried through as lineage it renders as a loop on the node and tells the reader
nothing, so those rows are dropped before an edge is built.

Rows naming only one side are not dropped: they are routed through the job.
"""

import uuid
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.source.pipeline.databrickspipeline.metadata import (
    DatabrickspipelineSource,
)
from metadata.ingestion.source.pipeline.databrickspipeline.models import (
    DataBrickPipelineDetails,
)
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache

CATALOG, SCHEMA = "analytics", "sales"
EVENT_LOG = f"{CATALOG}.{SCHEMA}.orders_event_log"
SNAPSHOT = f"{CATALOG}.{SCHEMA}.orders_snapshot"


def _table(fqn: str) -> Table:
    table = MagicMock(spec=Table)
    table.id = uuid.uuid4()
    table.fullyQualifiedName = fqn
    table.name = fqn.rsplit(".", 1)[-1]
    table.columns = []
    return table


def _source(table_lineage_rows):
    """The real connector with the Databricks and OpenMetadata sides stubbed."""
    with patch.object(DatabrickspipelineSource, "__init__", lambda s, a, b: None):
        source = DatabrickspipelineSource(None, None)

    source.client = MagicMock()
    source.client.get_table_lineage.return_value = table_lineage_rows
    source.client.get_column_lineage.return_value = []
    source.context = MagicMock()
    source.get_db_service_names = MagicMock(return_value=["unity"])
    # the real cache type, so the test tracks the production lookup path. A stand-in
    # only satisfies whichever calls the implementation makes when it is written, and
    # diverges silently once that implementation changes.
    source._table_lookup_cache = LRUCache(capacity=LRU_CACHE_SIZE)
    source._yield_kafka_lineage = MagicMock(return_value=iter(()))

    pipeline_entity = MagicMock()
    pipeline_entity.id.root = uuid.uuid4()

    def get_by_name(entity=None, fqn=None, **_):
        # every table resolves, so a missing edge can only be the self-reference guard
        return pipeline_entity if entity is not Table else _table(str(fqn))

    source.metadata = MagicMock()
    source.metadata.get_by_name.side_effect = get_by_name
    return source


def _edges(source):
    details = DataBrickPipelineDetails(pipeline_id="11111111-2222-3333-4444-555555555555", name="orders")
    with patch(
        "metadata.ingestion.source.pipeline.databrickspipeline.metadata.fqn.build",
        side_effect=lambda **kwargs: (
            f"{kwargs.get('service_name')}.{kwargs.get('database_name')}."
            f"{kwargs.get('schema_name')}.{kwargs.get('table_name')}"
            if kwargs.get("table_name")
            else "svc.pipeline"
        ),
    ):
        results = list(source.yield_pipeline_lineage_details(details))
    return [r.right for r in results if getattr(r, "right", None) is not None]


class TestSelfReferencingTableLineage:
    def test_a_self_referencing_row_yields_no_edge(self):
        source = _source([{"source_table_full_name": EVENT_LOG, "target_table_full_name": EVENT_LOG}])
        assert _edges(source) == []

    def test_a_normal_row_still_yields_an_edge(self):
        source = _source([{"source_table_full_name": EVENT_LOG, "target_table_full_name": SNAPSHOT}])
        assert len(_edges(source)) == 1

    def test_only_the_self_reference_is_dropped(self):
        """The guard must not suppress real lineage produced by the same pipeline."""
        source = _source(
            [
                {"source_table_full_name": EVENT_LOG, "target_table_full_name": EVENT_LOG},
                {"source_table_full_name": EVENT_LOG, "target_table_full_name": SNAPSHOT},
                {"source_table_full_name": SNAPSHOT, "target_table_full_name": SNAPSHOT},
            ]
        )
        edges = _edges(source)
        assert len(edges) == 1
        edge = edges[0].edge
        assert edge.fromEntity.id != edge.toEntity.id

    def test_rows_naming_no_table_are_skipped(self):
        source = _source([{"source_table_full_name": None, "target_table_full_name": None}])
        assert _edges(source) == []


BRONZE = "uc_core.dfac_agora_bronze.ext_equa_compta_detaillees"
SILVER = "uc_aas.gds_vault_silver.ext_reconciliation_equa_compta_agora"
SILVER_MVT = "uc_aas.gds_vault_silver.ext_reconciliation_mvt_equa_compta_agora"


class TestOneSidedTableLineage:
    """
    A job that reads and writes in separate statements leaves only a read row (no
    target) and a write row (no source). The job is the only thing linking them, so
    it becomes the node between the tables instead of the edge being dropped.
    """

    def test_a_read_links_the_table_to_the_job(self):
        edges = _edges(_source([{"source_table_full_name": BRONZE, "target_table_full_name": None}]))
        assert len(edges) == 1
        edge = edges[0].edge
        assert (edge.fromEntity.type, edge.toEntity.type) == ("table", "pipeline")
        assert edge.lineageDetails.pipeline is None

    def test_a_write_links_the_job_to_the_table(self):
        edges = _edges(_source([{"source_table_full_name": None, "target_table_full_name": SILVER}]))
        assert len(edges) == 1
        edge = edges[0].edge
        assert (edge.fromEntity.type, edge.toEntity.type) == ("pipeline", "table")

    def test_split_read_and_writes_route_through_the_job_without_table_edges(self):
        """The reported shape: one bronze read, two silver writes, no row naming both."""
        edges = _edges(
            _source(
                [
                    {"source_table_full_name": BRONZE, "target_table_full_name": None},
                    {"source_table_full_name": None, "target_table_full_name": SILVER},
                    {"source_table_full_name": None, "target_table_full_name": SILVER_MVT},
                ]
            )
        )
        kinds = sorted((e.edge.fromEntity.type, e.edge.toEntity.type) for e in edges)
        assert kinds == [("pipeline", "table"), ("pipeline", "table"), ("table", "pipeline")]

    def test_tables_already_on_a_table_edge_get_no_hop_through_the_job(self):
        source = _source(
            [
                {"source_table_full_name": BRONZE, "target_table_full_name": SILVER},
                {"source_table_full_name": BRONZE, "target_table_full_name": None},
                {"source_table_full_name": None, "target_table_full_name": SILVER},
                {"source_table_full_name": None, "target_table_full_name": SILVER_MVT},
            ]
        )
        edges = _edges(source)
        kinds = sorted((e.edge.fromEntity.type, e.edge.toEntity.type) for e in edges)
        assert kinds == [("pipeline", "table"), ("table", "table")]
        table_edge = next(
            e.edge for e in edges if e.edge.toEntity.type == "table" and e.edge.fromEntity.type == "table"
        )
        assert table_edge.lineageDetails.pipeline is not None

    def test_an_unresolved_table_yields_no_dangling_job_edge(self):
        source = _source(
            [
                {"source_table_full_name": BRONZE, "target_table_full_name": None},
                {"source_table_full_name": None, "target_table_full_name": SILVER},
            ]
        )
        resolve = source.metadata.get_by_name.side_effect
        source.metadata.get_by_name.side_effect = lambda entity=None, fqn=None, **kw: (
            None if entity is Table and str(fqn).endswith(BRONZE) else resolve(entity=entity, fqn=fqn, **kw)
        )
        edges = _edges(source)
        assert [(e.edge.fromEntity.type, e.edge.toEntity.type) for e in edges] == [("pipeline", "table")]

    def test_a_self_reference_does_not_hide_the_write_through_the_job(self):
        """A streaming job records A -> A next to its write of A; the write must survive."""
        edges = _edges(
            _source(
                [
                    {"source_table_full_name": SILVER, "target_table_full_name": SILVER},
                    {"source_table_full_name": None, "target_table_full_name": SILVER},
                ]
            )
        )
        assert [(e.edge.fromEntity.type, e.edge.toEntity.type) for e in edges] == [("pipeline", "table")]

    def test_an_unresolved_table_edge_does_not_hide_the_read_through_the_job(self):
        """BRONZE -> X never becomes an edge when X is not ingested, so BRONZE -> job must."""
        source = _source(
            [
                {"source_table_full_name": BRONZE, "target_table_full_name": SILVER_MVT},
                {"source_table_full_name": BRONZE, "target_table_full_name": None},
            ]
        )
        resolve = source.metadata.get_by_name.side_effect
        source.metadata.get_by_name.side_effect = lambda entity=None, fqn=None, **kw: (
            None if entity is Table and str(fqn).endswith(SILVER_MVT) else resolve(entity=entity, fqn=fqn, **kw)
        )
        edges = _edges(source)
        assert [(e.edge.fromEntity.type, e.edge.toEntity.type) for e in edges] == [("table", "pipeline")]
