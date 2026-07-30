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

from typing import TYPE_CHECKING, List, Optional  # noqa: UP035

if TYPE_CHECKING:
    from metadata.ingestion.progress.registry import ProgressNodeSnapshot


def render_progress_tree(root: "Optional[ProgressNodeSnapshot]") -> str:  # noqa: UP045
    """Active-scope tree: the run rollup, then one indented line per in-flight
    branch. Known counts render ``processed/expected``; lazy counts render a
    bare ``processed``."""
    lines: List[str] = []  # noqa: UP006
    if root is not None:
        _render_node(root, 0, lines)
    return "\n".join(lines)


def _render_node(node: "ProgressNodeSnapshot", depth: int, lines: List[str]) -> None:  # noqa: UP006
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


def snapshot_to_progress_payload(root: "Optional[ProgressNodeSnapshot]") -> Optional[dict]:  # noqa: UP045
    """Map a snapshot tree to the ProgressUpdate.progress (progressNode) shape."""
    return _node_to_payload(root) if root is not None else None


def format_eta(seconds: int) -> str:
    """Human ``~45s`` / ``~6m`` / ``~1h 20m`` from a rounded seconds count."""
    if seconds < 60:
        result = f"~{seconds}s"
    elif seconds < 3600:
        result = f"~{seconds // 60}m"
    else:
        result = f"~{seconds // 3600}h {(seconds % 3600) // 60}m"
    return result


def _render_joined(node: "ProgressNodeSnapshot", ancestors: "List[str]", lines: "List[str]") -> None:  # noqa: UP006
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


def _node_to_payload(node: "ProgressNodeSnapshot") -> dict:
    return {
        "label": node.label,
        "entityType": node.child_type,
        "processed": node.processed,
        "expected": node.expected,
        "active": node.active,
        "overflow": node.overflow,
        "children": [_node_to_payload(child) for child in node.children],
    }
