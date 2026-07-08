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
"""Topology-walk progress policy, extracted from the runner.

The runner asks ``for_node`` for a per-node handle and calls it
unconditionally. When the source is not in AUTO mode, the node is the
structural service root, or the node has no typed stage, the handle is a
shared no-op — the walk code carries zero progress conditionals.
"""

from typing import TYPE_CHECKING, Any, Dict, List, Optional, Set  # noqa: UP035

from metadata.ingestion.models.topology import (
    NodeStage,
    TopologyNode,
    get_topology_nodes,
    get_topology_root,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.progress.modes import ProgressMode, TotalsDeclarer

if TYPE_CHECKING:
    from metadata.ingestion.progress.registry import ProgressRegistry


class _NoOpScope:
    """No container scope to retire."""

    def __enter__(self) -> "_NoOpScope":
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        """Nothing to close."""


NO_OP_SCOPE = _NoOpScope()


class _Scope:
    """An open container scope: exiting prunes the subtree from the tree.
    The finished container is counted on its global counter only on a clean
    exit — a failure (or early generator close) mid-subtree prunes without
    claiming the container completed."""

    def __init__(self, registry: "ProgressRegistry", path: List[str], entity_type_name: str) -> None:  # noqa: UP006
        self._registry = registry
        self._path = path
        self._entity_type_name = entity_type_name

    def __enter__(self) -> "_Scope":
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self._registry.close(self._path)
        if exc_type is None:
            self._registry.track(self._entity_type_name)


class _NoOpNodeProgress:
    """Shared do-nothing handle: zero registry calls, zero per-entity overhead."""

    wants_eager_count = False

    def open(self, count: Optional[int]) -> None:  # noqa: UP045
        """No-op."""

    def advance_leaf(self) -> None:
        """No-op."""

    def enter_scope(self) -> _NoOpScope:
        return NO_OP_SCOPE


NO_OP_NODE_PROGRESS = _NoOpNodeProgress()


class NodeProgress:
    """Progress recording for one topology node. The parent path is resolved at
    creation time — before worker threads spawn — so the handle can be shared
    across a node's worker threads; ``enter_scope`` reads the *current thread's*
    context at call time."""

    def __init__(
        self,
        tracker: "TopologyProgressTracker",
        node: TopologyNode,
        entity_type_name: str,
        parent_path: List[str],  # noqa: UP006
        is_leaf: bool,
    ) -> None:
        self._tracker = tracker
        self._node = node
        self._registry = tracker.registry
        self._entity_type_name = entity_type_name
        self._parent_path = parent_path
        self._is_leaf = is_leaf
        self._reconcilable = self._registry.is_reconcilable(entity_type_name)

    @property
    def wants_eager_count(self) -> bool:
        """Materialize the producer for an exact child count only when the node's
        counter is reconcilable (a container whose scope total is nudged toward
        the observed child count). Leaf producers are always iterated lazily:
        their per-leaf ``advance`` already yields an accurate processed count, and
        an eager ``list()``-drain would run the producer to completion before any
        stage sinks an entity — breaking connectors (e.g. S3 storage's
        ``get_containers``) whose producer reads context a stage of the
        just-yielded entity populated."""
        return self._reconcilable

    def open(self, count: Optional[int]) -> None:  # noqa: UP045
        """Open this node's counter under its parent scope. An exact ``count``
        (the runner materialized the producer) additionally reconciles a
        reconcilable container's scope total toward the observed child count;
        a lazy open (``None``) has nothing to reconcile with."""
        self._registry.open(self._parent_path, self._entity_type_name, count)
        if count is not None and self._reconcilable and self._parent_path:
            self._registry.reconcile_scope_total(self._entity_type_name, self._parent_path[-1], count)

    def advance_leaf(self) -> None:
        if self._is_leaf:
            self._registry.advance(self._parent_path, self._entity_type_name)

    def enter_scope(self):
        """Scope handle for the container entity currently in this thread's
        context; NO_OP for a leaf node or when the context value is unset."""
        result = NO_OP_SCOPE
        if not self._is_leaf:
            scope_path = self._tracker.scope_path_for_node(self._node, self._parent_path)
            if scope_path is not None:
                result = _Scope(self._registry, scope_path, self._entity_type_name)
        return result


class TopologyProgressTracker:
    """All topology-walk progress policy for one source: mode gating, ancestor
    path resolution, once-only totals declaration, and handle creation.

    ``source`` is the TopologyRunnerMixin instance; the tracker reads its
    ``topology``, ``context``, ``progress``, ``progress_mode``,
    ``declare_progress_totals`` and primary-stage helpers."""

    def __init__(self, source: Any) -> None:
        self._source = source
        self._root_node_ids: Set[int] = set()  # noqa: UP006
        self._root_ctx_keys: Optional[Set[str]] = None  # noqa: UP006,UP045
        self._primary_stage_idx: Optional[Dict[str, NodeStage]] = None  # noqa: UP006,UP045
        self._totals_declared = False

    @property
    def registry(self) -> "ProgressRegistry":
        return self._source.progress_tracking.registry

    def on_walk_start(self, root_nodes) -> None:
        self._root_node_ids = {id(node) for node in root_nodes}

    def is_root_node(self, node: TopologyNode) -> bool:
        """The topology root (the Service node) is a structural wrapper, not a
        progress level: it always holds a single entity and would otherwise
        collide with the first real level (databases) at the registry root."""
        return id(node) in self._root_node_ids

    def for_node(self, node: TopologyNode, is_leaf: bool):
        """A NodeProgress for AUTO sources on real entity nodes; the shared
        no-op otherwise. Declares connector totals on the first real node —
        after the service root has populated the context the totals code may
        need."""
        result = NO_OP_NODE_PROGRESS
        if self._source.progress_mode is ProgressMode.AUTO and not self.is_root_node(node):
            entity_type_name = self._source._get_entity_type_for_node(node)
            if entity_type_name:
                self._declare_totals_once()
                parent_path = self.current_path(entity_type_name)
                result = NodeProgress(self, node, entity_type_name, parent_path, is_leaf)
        return result

    def _declare_totals_once(self) -> None:
        if not self._totals_declared:
            self._totals_declared = True
            self._source.declare_progress_totals(TotalsDeclarer(self.registry))

    def current_path(self, entity_type_name: Optional[str] = None) -> List[str]:  # noqa: UP006,UP045
        """Ancestor container labels from the node's primary-stage ``consumer``
        chain minus the service-root key, each remaining key resolved to its
        current context value.

        ``consumer`` lists only *ancestors*; a node's own context key is never
        in its own consumer list. In the depth-first walk every ancestor
        container is mid-iteration, so its value is fresh — this is why the
        ``database_schema``-not-cleared-between-siblings bug cannot occur here.
        Returns ``[]`` for the run-grain default (no ``entity_type_name``) or a
        root-level entity (empty consumer)."""
        path: List[str] = []  # noqa: UP006
        stage = self._primary_entity_stage(entity_type_name)
        if stage is not None:
            root_keys = self._root_context_keys()
            ctx = self._source.context.get()
            for key in stage.consumer or []:
                if key not in root_keys:
                    value = getattr(ctx, key, None)
                    if value is not None:
                        path.append(model_str(value))
        return path

    def scope_path_for_node(self, node: TopologyNode, parent_path: List[str]) -> Optional[List[str]]:  # noqa: UP006,UP045
        """The path of the container entity currently in context: its parent
        ancestors plus this node's own context value. Used to prune a scope
        from the progress tree once its children finish. ``None`` when the
        node's context value is not set."""
        result = None
        stage = self._source._node_primary_stage(node)
        if stage is not None and stage.context and parent_path is not None:
            value = getattr(self._source.context.get(), stage.context, None)
            if value is not None:
                result = [*parent_path, model_str(value)]
        return result

    def _root_context_keys(self) -> Set[str]:  # noqa: UP006
        """Context keys owned by root topology nodes (the service level),
        derived from the topology — never a string literal. Cached; the
        topology is static."""
        if self._root_ctx_keys is None:
            self._root_ctx_keys = {
                stage.context
                for node in get_topology_root(self._source.topology)
                for stage in node.stages
                if stage.context
            }
        return self._root_ctx_keys

    def _primary_stage_index(self) -> Dict[str, NodeStage]:  # noqa: UP006
        """Map of entity type name → that node's primary stage, built once from
        the static topology. Entity types are unique per node, so the first
        match wins on the rare collision."""
        if self._primary_stage_idx is None:
            index: Dict[str, NodeStage] = {}  # noqa: UP006
            for node in get_topology_nodes(self._source.topology):
                stage = self._source._node_primary_stage(node)
                if stage is not None:
                    index.setdefault(stage.type_.__name__, stage)
            self._primary_stage_idx = index
        return self._primary_stage_idx

    def _primary_entity_stage(self, entity_type_name: Optional[str]) -> Optional[NodeStage]:  # noqa: UP045
        result = None
        if entity_type_name is not None:
            result = self._primary_stage_index().get(entity_type_name)
        return result
