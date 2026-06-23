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
Per-Source hierarchical progress registry.

Every node counts its direct children: the root counts databases, a database
counts its schemas, a schema counts its tables/procedures. The walk records
only two things, both free (no COUNT queries):

* ``open(path, child_type, expected)`` — when a producer materializes its child
  list of length ``expected`` (``None`` when the list is iterated lazily).
* ``advance(path)`` — once per leaf entity processed.

Leaf ``processed`` is authoritative; container progress is *derived* at
``snapshot()`` time (a container is complete when all its children are). There
is no global total and no ETA — a drifting denominator reads as broken.
"""

import threading
from dataclasses import dataclass, field
from typing import Dict, List, Mapping, Optional, Tuple  # noqa: UP035

DEFAULT_ACTIVE_LEAF_CAP = 20


@dataclass
class ProgressNode:
    """Mutable tree node. ``expected_by_type``/``processed_by_type`` keep one entry
    per producer that targets this node (a schema is opened once for tables and once
    for stored procedures); the node's expected/processed are their sums."""

    label: str
    child_type: Optional[str] = None  # noqa: UP045
    expected_by_type: Dict[str, Optional[int]] = field(default_factory=dict)  # noqa: UP006,UP045
    processed_by_type: Dict[str, int] = field(default_factory=dict)  # noqa: UP006
    children: "Dict[str, ProgressNode]" = field(default_factory=dict)  # noqa: UP006


@dataclass(frozen=True)
class ProgressNodeSnapshot:
    """Immutable read-model emitted to the CLI renderer and the SSE payload.
    ``expected_by_type``/``processed_by_type`` carry generic per-edge detail; the
    generic renderer ignores them and the DB two-tier projection reads them."""

    label: str
    child_type: Optional[str]  # noqa: UP045
    expected: Optional[int]  # noqa: UP045
    processed: int
    active: bool
    overflow: int
    children: "Tuple[ProgressNodeSnapshot, ...]"  # noqa: UP006
    expected_by_type: "Mapping[str, Optional[int]]" = field(default_factory=dict)  # noqa: UP045
    processed_by_type: "Mapping[str, int]" = field(default_factory=dict)


class ProgressRegistry:
    """Per-Source generic progress tree. One lock guards every mutation and the
    snapshot; each operation is O(path depth)."""

    def __init__(self, active_leaf_cap: int = DEFAULT_ACTIVE_LEAF_CAP) -> None:
        self._lock = threading.Lock()
        self._root = ProgressNode(label="")
        self._active_leaf_cap = active_leaf_cap
        self._global_expected: Dict[str, Optional[int]] = {}  # noqa: UP006,UP045

    def open(self, path: List[str], child_type: str, expected: Optional[int]) -> None:  # noqa: UP006,UP045
        with self._lock:
            node = self._navigate(path)
            if node.child_type is None:
                node.child_type = child_type
            node.expected_by_type[child_type] = expected

    def advance(self, path: List[str], child_type: Optional[str] = None) -> None:  # noqa: UP006,UP045
        with self._lock:
            node = self._navigate(path)
            key = child_type or node.child_type or ""
            node.processed_by_type[key] = node.processed_by_type.get(key, 0) + 1

    def set_global_expected(self, child_type: str, expected: Optional[int]) -> None:  # noqa: UP045
        with self._lock:
            self._global_expected[child_type] = expected

    @property
    def global_expected(self) -> Dict[str, Optional[int]]:  # noqa: UP006,UP045
        with self._lock:
            return dict(self._global_expected)

    def completed_at_depth(self, depth: int) -> int:
        with self._lock:
            return self._count_complete(self._root, 0, depth)

    def completed_snapshots_at_depth(
        self,
        depth: int,
        limit: Optional[int] = None,  # noqa: UP045
    ) -> "List[Tuple[Tuple[str, ...], ProgressNodeSnapshot]]":  # noqa: UP006
        """Immutable snapshots of COMPLETE nodes at ``depth`` — the finished work
        the active snapshot prunes — each paired with its ancestor labels below the
        root. Tree (insertion) order, capped to the last ``limit``. Lets callers
        surface, e.g., how many leaves a finished container produced."""
        with self._lock:
            collected: List[Tuple[Tuple[str, ...], ProgressNodeSnapshot]] = []  # noqa: UP006
            self._collect_completed(self._root, (), 0, depth, collected)
            if limit is not None:
                collected = collected[-limit:]
            return collected

    def snapshot(self, active_leaf_cap: Optional[int] = None) -> Optional[ProgressNodeSnapshot]:  # noqa: UP045
        cap = self._active_leaf_cap if active_leaf_cap is None else active_leaf_cap
        with self._lock:
            started, complete, processed, child_snapshots, overflow = self._compute(self._root, cap)
            if not started:
                return None
            return ProgressNodeSnapshot(
                label=self._root.label,
                child_type=self._root.child_type,
                expected=self._node_expected(self._root),
                processed=processed,
                active=not complete,
                overflow=overflow,
                children=tuple(child_snapshots),
                expected_by_type=dict(self._root.expected_by_type),
                processed_by_type=dict(self._root.processed_by_type),
            )

    def _navigate(self, path: List[str]) -> ProgressNode:  # noqa: UP006
        node = self._root
        for segment in path:
            child = node.children.get(segment)
            if child is None:
                child = ProgressNode(label=segment)
                node.children[segment] = child
            node = child
        return node

    def _node_expected(self, node: ProgressNode) -> Optional[int]:  # noqa: UP045
        known = [value for value in node.expected_by_type.values() if value is not None]
        return sum(known) if known else None

    def _leaf_processed(self, node: ProgressNode) -> int:
        return sum(node.processed_by_type.values())

    def _derived_processed(self, node: ProgressNode) -> int:
        if node.children:
            return sum(1 for child in node.children.values() if self._is_complete(child))
        return self._leaf_processed(node)

    def _is_complete(self, node: ProgressNode) -> bool:
        expected = self._node_expected(node)
        return expected is not None and self._derived_processed(node) >= expected

    def _count_complete(self, node: ProgressNode, current: int, target: int) -> int:
        total = 0
        if current == target:
            if self._is_complete(node):
                total = 1
        else:
            for child in node.children.values():
                total += self._count_complete(child, current + 1, target)
        return total

    def _collect_completed(
        self,
        node: ProgressNode,
        ancestors: "Tuple[str, ...]",  # noqa: UP006
        current: int,
        target: int,
        out: "List[Tuple[Tuple[str, ...], ProgressNodeSnapshot]]",  # noqa: UP006
    ) -> None:
        if current == target:
            if self._is_complete(node):
                out.append((ancestors, self._completed_snapshot(node)))
        else:
            child_ancestors = ancestors if current == 0 else (*ancestors, node.label)
            for child in node.children.values():
                self._collect_completed(child, child_ancestors, current + 1, target, out)

    def _completed_snapshot(self, node: ProgressNode) -> ProgressNodeSnapshot:
        return ProgressNodeSnapshot(
            label=node.label,
            child_type=node.child_type,
            expected=self._node_expected(node),
            processed=self._derived_processed(node),
            active=False,
            overflow=0,
            children=(),
            expected_by_type=dict(node.expected_by_type),
            processed_by_type=dict(node.processed_by_type),
        )

    def _compute(self, node: ProgressNode, cap: int) -> "Tuple[bool, bool, int, List[ProgressNodeSnapshot], int]":  # noqa: UP006
        child_states = [(child, self._compute(child, cap)) for child in node.children.values()]
        if child_states:
            derived_processed = sum(1 for _, state in child_states if state[1])
        else:
            derived_processed = self._leaf_processed(node)
        expected = self._node_expected(node)
        complete = expected is not None and derived_processed >= expected
        started = (
            bool(node.expected_by_type)
            or any(node.processed_by_type.values())
            or any(state[0] for _, state in child_states)
        )
        active_child_snapshots: List[ProgressNodeSnapshot] = []  # noqa: UP006
        for child, (child_started, child_complete, child_processed, grandchildren, child_overflow) in child_states:
            if child_started and not child_complete:
                active_child_snapshots.append(
                    ProgressNodeSnapshot(
                        label=child.label,
                        child_type=child.child_type,
                        expected=self._node_expected(child),
                        processed=child_processed,
                        active=True,
                        overflow=child_overflow,
                        children=tuple(grandchildren),
                        expected_by_type=dict(child.expected_by_type),
                        processed_by_type=dict(child.processed_by_type),
                    )
                )
        capped = active_child_snapshots[:cap]
        overflow = len(active_child_snapshots) - len(capped)
        return started, complete, derived_processed, capped, overflow
