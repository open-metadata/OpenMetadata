#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""LineageAssert — polling-friendly lineage edge and column-lineage checks."""

from __future__ import annotations

from typing import Literal

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from .eventually import EventuallyRunner

_Direction = Literal["upstream", "downstream"]


class LineageAssert:
    """Lineage namespace — reached via TableAssert.lineage.

    Lineage propagation is eventually-consistent; all terminals accept
    `.eventually(timeout)` one-shot arming.
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

    def _check_edge(self, direction: _Direction, fqn: str) -> None:
        data = self._lineage()
        edges = {
            n.get("fullyQualifiedName")
            for n in (data.get(f"{direction}Edges") or [])
        }
        if fqn in edges:
            return
        # Fallback: some responses put participants in `nodes` instead of
        # `<direction>Edges`. Accept either so we don't over-fit the shape.
        nodes = {n.get("fullyQualifiedName") for n in (data.get("nodes") or [])}
        if fqn not in nodes:
            raise AssertionError(
                f"Table {self._table_fqn} has no {direction} {fqn!r}. "
                f"{direction}s={sorted(edges)} nodes={sorted(nodes)}"
            )

    def has_upstream(self, fqn: str) -> "LineageAssert":
        self._eventually.run(
            lambda: self._check_edge("upstream", fqn),
            name=f"has_upstream({fqn})",
        )
        return self

    def has_downstream(self, fqn: str) -> "LineageAssert":
        self._eventually.run(
            lambda: self._check_edge("downstream", fqn),
            name=f"has_downstream({fqn})",
        )
        return self

    def has_column_lineage(self, source: str, target: str) -> "LineageAssert":
        def _check() -> None:
            data = self._lineage()
            edges = (data.get("upstreamEdges") or []) + (data.get("downstreamEdges") or [])
            for edge in edges:
                lineage_details = edge.get("lineageDetails") or {}
                for col_edge in lineage_details.get("columnsLineage") or []:
                    froms = col_edge.get("fromColumns") or []
                    to = col_edge.get("toColumn") or ""
                    if any(source in f for f in froms) and target in to:
                        return
            raise AssertionError(
                f"No column lineage {source!r} -> {target!r} on table {self._table_fqn}"
            )
        self._eventually.run(_check, name=f"has_column_lineage({source}->{target})")
        return self
