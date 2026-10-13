"""
A table is never emitted as its own upstream.

`system.access.table_lineage` records table access rather than derivation, so a
streaming or CDC write legitimately names its target table as its own source.
Those rows must not become an edge, or the table is sent to OpenMetadata as its
own upstream and renders as a loop on the node.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from cachetools import LRUCache

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.ingestion.source.database.unitycatalog.lineage import (
    UnitycatalogLineageSource,
)

CATALOG, SCHEMA = "analytics", "sales"
EVENT_LOG = f"{CATALOG}.{SCHEMA}.orders_event_log"
SNAPSHOT = f"{CATALOG}.{SCHEMA}.orders_snapshot"


def _table(databricks_table_fqn: str) -> Table:
    return Table(
        id=uuid4(),
        name=EntityName(root=databricks_table_fqn.rsplit(".", maxsplit=1)[-1]),
        fullyQualifiedName=FullyQualifiedEntityName(root=f"svc.{databricks_table_fqn}"),
        columns=[],
    )


def _source(upstreams: dict[str, Table]):
    """The real emitting method, with only the entity lookups stubbed."""
    with patch.object(UnitycatalogLineageSource, "__init__", lambda s: None):
        source = UnitycatalogLineageSource()

    source.config = SimpleNamespace(serviceName="svc")
    source.metadata = MagicMock()
    source._table_cache = LRUCache(maxsize=10)
    source.metadata.get_by_name.side_effect = lambda entity=None, fqn=None, **_: upstreams.get(
        str(fqn).split(".", 1)[1]
    )
    return source


def _edges(source, target: str, upstream_columns: dict[str, dict]):
    return [
        (
            str(result.right.edge.fromEntity.id.root),
            str(result.right.edge.toEntity.id.root),
        )
        for result in source._process_table_lineage(_table(target), target, upstream_columns, {})
    ]


class TestSelfReferencingLineage:
    def test_a_self_referencing_row_is_not_an_edge(self):
        source = _source({EVENT_LOG: _table(EVENT_LOG)})

        assert _edges(source, EVENT_LOG, {EVENT_LOG: {}}) == []

    def test_a_normal_row_is_still_an_edge(self):
        upstream = _table(EVENT_LOG)
        source = _source({EVENT_LOG: upstream})

        edges = _edges(source, SNAPSHOT, {EVENT_LOG: {}})

        assert [source for source, _ in edges] == [str(upstream.id.root)]

    def test_only_the_self_reference_is_dropped(self):
        """The guard must not suppress real upstreams of the same table."""
        upstream = _table(EVENT_LOG)
        source = _source({EVENT_LOG: upstream, SNAPSHOT: _table(SNAPSHOT)})

        edges = _edges(source, SNAPSHOT, {EVENT_LOG: {}, SNAPSHOT: {}})

        assert [source for source, _ in edges] == [str(upstream.id.root)]

    def test_the_columns_of_a_self_reference_are_dropped_with_it(self):
        """A self-pair's mappings are unreachable once its edge is dropped."""
        source = _source({EVENT_LOG: _table(EVENT_LOG)})

        assert _edges(source, EVENT_LOG, {EVENT_LOG: {("id", "id"): None}}) == []
