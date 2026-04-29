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
        self._fqn = table_fqn
        self._eventually = EventuallyRunner()

    def eventually(self, timeout: int = 60) -> "LineageAssert":
        self._eventually.arm(timeout)
        return self

    def _lineage(self) -> dict:
        return self._om.get_lineage_by_name(entity=Table, fqn=self._fqn) or {}

    def _check_edge(self, direction: _Direction, fqn: str) -> None:
        """Match direction-typed edges; resolve UUID-only Edge endpoints via nodes/entity FQN map."""
        data = self._lineage()
        nodes = data.get("nodes") or []
        central = data.get("entity") or {}
        uuid_to_fqn: dict[str, str] = {}
        for n in [*nodes, central]:
            uid, ref_fqn = n.get("id"), n.get("fullyQualifiedName")
            if uid and ref_fqn:
                uuid_to_fqn[uid] = ref_fqn
        counterpart_field = "fromEntity" if direction == "upstream" else "toEntity"
        self_field = "toEntity" if direction == "upstream" else "fromEntity"
        matched: set[str] = set()
        for e in data.get(f"{direction}Edges") or []:
            if uuid_to_fqn.get(e.get(self_field)) == self._fqn:
                cp = uuid_to_fqn.get(e.get(counterpart_field))
                if cp:
                    matched.add(cp)
        if fqn in matched:
            return
        nodes_fqns = sorted(uuid_to_fqn.values())
        raise AssertionError(
            f"Table {self._fqn} has no {direction} {fqn!r}. "
            f"{direction}Edges resolved to FQNs={sorted(matched)} nodes={nodes_fqns}"
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
            raise AssertionError(f"No column lineage {source!r} -> {target!r} on table {self._fqn}")

        self._eventually.run(_check, name=f"has_column_lineage({source}->{target})")
        return self
