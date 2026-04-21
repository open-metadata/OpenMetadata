#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""LineageAssert — polling-friendly lineage edge and column-lineage checks."""

from __future__ import annotations

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from .eventually import EventuallyRunner


class LineageAssert:
    """Lineage namespace — reached via TableAssert.lineage.

    All terminal assertions dispatch through a single `EventuallyRunner`
    so `.eventually(timeout)` is a one-shot arming on the next check.
    Lineage propagation is eventually-consistent; even a synchronous ingest
    can leave the lineage index temporarily out of sync with primary tables.
    """

    def __init__(self, om: OpenMetadata, table_fqn: str) -> None:
        self._om = om
        self._table_fqn = table_fqn
        self._eventually = EventuallyRunner()

    def eventually(self, timeout: int = 60) -> "LineageAssert":
        self._eventually.arm(timeout)
        return self

    def _lineage(self) -> dict:
        return self._om.get_lineage_by_name(entity=Table, fqn=self._table_fqn) or {}

    def has_upstream(self, fqn: str) -> "LineageAssert":
        def _check() -> None:
            data = self._lineage()
            upstreams = {n.get("fullyQualifiedName") for n in (data.get("upstreamEdges") or [])}
            if fqn in upstreams:
                return
            # Fallback: some responses put participants in `nodes` instead of
            # `upstreamEdges`. Accept either so we don't over-fit the shape.
            nodes = {n.get("fullyQualifiedName") for n in (data.get("nodes") or [])}
            if fqn not in nodes:
                raise AssertionError(
                    f"Table {self._table_fqn} has no upstream {fqn!r}. "
                    f"upstreams={sorted(upstreams)} nodes={sorted(nodes)}"
                )
        self._eventually.run(_check, name=f"has_upstream({fqn})")
        return self

    def has_downstream(self, fqn: str) -> "LineageAssert":
        def _check() -> None:
            data = self._lineage()
            downstreams = {n.get("fullyQualifiedName") for n in (data.get("downstreamEdges") or [])}
            if fqn in downstreams:
                return
            nodes = {n.get("fullyQualifiedName") for n in (data.get("nodes") or [])}
            if fqn not in nodes:
                raise AssertionError(
                    f"Table {self._table_fqn} has no downstream {fqn!r}. "
                    f"downstreams={sorted(downstreams)} nodes={sorted(nodes)}"
                )
        self._eventually.run(_check, name=f"has_downstream({fqn})")
        return self

    def has_column_lineage(self, source: str, target: str) -> "LineageAssert":
        def _check() -> None:
            data = self._lineage()
            edges = (data.get("upstreamEdges") or []) + (data.get("downstreamEdges") or [])
            for edge in edges:
                lineage_details = edge.get("lineageDetails") or {}
                columns = lineage_details.get("columnsLineage") or []
                for col_edge in columns:
                    froms = col_edge.get("fromColumns") or []
                    to = col_edge.get("toColumn") or ""
                    if any(source in f for f in froms) and target in to:
                        return
            raise AssertionError(
                f"No column lineage {source!r} -> {target!r} on table {self._table_fqn}"
            )
        self._eventually.run(_check, name=f"has_column_lineage({source}->{target})")
        return self
