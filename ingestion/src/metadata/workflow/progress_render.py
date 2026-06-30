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
Render a ProgressRegistry snapshot tree for humans (CLI) and for the server
(nested progressNode payload).

Dependency-free on purpose (stdlib only) so both the workflow base and the
status mixin can import it without a circular dependency.
"""

from typing import List, Optional, Tuple  # noqa: UP035

from metadata.utils.progress_registry import ProgressNodeSnapshot, ProgressRegistry


def render_progress_tree(root: Optional[ProgressNodeSnapshot]) -> str:  # noqa: UP045
    """Active-scope tree: the run rollup, then one indented line per in-flight
    branch. Known counts render ``processed/expected``; lazy counts render a
    bare ``processed``."""
    lines: List[str] = []  # noqa: UP006
    if root is not None:
        _render_node(root, 0, lines)
    return "\n".join(lines)


def _render_node(node: ProgressNodeSnapshot, depth: int, lines: List[str]) -> None:  # noqa: UP006
    prefix = "  " * depth + ("└ " if depth else "")
    label = f"{node.label} " if node.label else ""
    type_ = f"{node.child_type} " if node.child_type else ""
    if node.child_type is None:
        count = ""
    else:
        count = f"{node.processed}/{node.expected}" if node.expected is not None else str(node.processed)
    overflow = f"  (+{node.overflow} more)" if node.overflow else ""
    lines.append(f"{prefix}{label}{type_}{count}{overflow}".rstrip())
    for child in node.children:
        _render_node(child, depth + 1, lines)


def snapshot_to_progress_payload(root: Optional[ProgressNodeSnapshot]) -> Optional[dict]:  # noqa: UP045
    """Map a snapshot tree to the ProgressUpdate.progress (progressNode) shape."""
    return _node_to_payload(root) if root is not None else None


class ProgressReporter:
    """Presentation of a registry's state. The registry stays a pure state
    object; this reporter knows how to render it for CLI and for the SSE
    payload. Connector-agnostic — the rollup header is generic."""

    def __init__(self, registry: ProgressRegistry) -> None:
        self._registry = registry

    def cli(self) -> str:
        snapshot = self._registry.snapshot()
        counters = self._registry.global_counters()
        header = self._header(counters)
        if snapshot is None:
            return header if counters else ""
        lines: List[str] = []  # noqa: UP006
        _render_joined(snapshot, [], lines)
        tree = "\n".join(lines)
        return f"{header}\n{tree}" if tree else header

    def _header(self, counters: "List[Tuple[str, int, Optional[int]]]") -> str:  # noqa: UP006,UP045
        lines: List[str] = []  # noqa: UP006
        for type_, done, total in counters:
            lines.append(f"{type_} {done}/{total}" if total is not None else f"{type_} {done}")
        lines.append(f"Ingested: {self._registry.assets_ingested():,} assets")
        return "\n".join(lines)

    def global_counters(self) -> "List[Tuple[str, int, Optional[int]]]":  # noqa: UP006,UP045
        """Run-level counters ``(type, done, total)`` for the SSE
        ``ProgressUpdate.globalCounters``. Independent of the progress tree, so
        reported even when the active tree is momentarily empty."""
        return self._registry.global_counters()

    def payload(self) -> Optional[dict]:  # noqa: UP045
        """Bare ``progressNode`` tree (validates against ``ProgressUpdate``,
        which is ``extra='forbid'``). The run-root ``processed`` carries the
        monotonic asset total; ``expected`` is unknown (no global count)."""
        snapshot = self._registry.snapshot()
        result = None
        if snapshot is not None:
            tree = snapshot_to_progress_payload(snapshot)
            tree["processed"] = self._registry.assets_ingested()
            tree["expected"] = None
            result = tree
        return result


def _render_joined(node: ProgressNodeSnapshot, ancestors: "List[str]", lines: "List[str]") -> None:  # noqa: UP006
    """Render active nodes with ancestor labels joined by '.' so sibling-level
    hierarchy collapses into a single readable label, e.g. ``sales.public  Table 45/310``."""
    path = [*ancestors, node.label] if node.label else list(ancestors)
    if node.children:
        for child in node.children:
            _render_joined(child, path, lines)
    else:
        joined_label = ".".join(path) if path else ""
        type_ = f"{node.child_type} " if node.child_type else ""
        if node.child_type is None:
            count = ""
        else:
            count = f"{node.processed}/{node.expected}" if node.expected is not None else str(node.processed)
        overflow = f"  (+{node.overflow} more)" if node.overflow else ""
        lines.append(f"{joined_label}  {type_}{count}{overflow}".strip())


def _node_to_payload(node: ProgressNodeSnapshot) -> dict:
    return {
        "label": node.label,
        "entityType": node.child_type,
        "processed": node.processed,
        "expected": node.expected,
        "active": node.active,
        "overflow": node.overflow,
        "children": [_node_to_payload(child) for child in node.children],
    }
