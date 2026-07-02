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
Mixin to be used by service sources to dynamically
generate the _run based on their topology.
"""

import math
import time
import traceback
from functools import singledispatchmethod
from time import perf_counter
from typing import Any, ClassVar, Generic, Iterable, List, Optional, TypeVar, cast  # noqa: UP035

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.ingestion.api.models import Either, Entity
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.custom_properties import OMetaCustomProperties
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.ometa_lineage import OMetaFQNLineageRequest
from metadata.ingestion.models.patch_request import PatchRequest
from metadata.ingestion.models.topology import (
    NodeStage,
    Queue,
    ServiceTopology,
    TopologyContextManager,
    TopologyNode,
    get_topology_node,
    get_topology_nodes,
    get_topology_root,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.custom_thread_pool import CustomThreadPoolExecutor
from metadata.utils.logger import ingestion_logger
from metadata.utils.operation_metrics import OperationMetricsState
from metadata.utils.progress_tracking import ProgressTrackingMixin
from metadata.utils.source_hash import generate_source_hash

logger = ingestion_logger()

C = TypeVar("C", bound=BaseModel)


class MissingExpectedEntityAckException(Exception):  # noqa: N818
    """
    After running the ack to the sink, we got no
    Entity back
    """


class TopologyRunnerMixin(ProgressTrackingMixin, Generic[C]):
    """
    Prepares the _run function
    dynamically based on the source topology
    """

    topology: ServiceTopology
    context: TopologyContextManager
    metadata: OpenMetadata

    queue = Queue()

    _SIDE_OUTPUT_STAGE_TYPES: ClassVar[set[str]] = {
        "OMetaTagAndClassification",
        "OMetaLifeCycleData",
        "AddLineageRequest",
    }

    progress_tracking_enabled: ClassVar[bool] = False
    """Master gate for hierarchical progress tracking. Off for every connector
    by default: when False the runner makes zero progress calls, the registry
    is never created, and there is no per-entity overhead. A connector opts in
    by setting this True on its source class."""

    def _node_primary_stage(self, node: TopologyNode) -> Optional[NodeStage]:  # noqa: UP045
        """The node's primary, non-side-output stage — the stage whose entity is
        the node's real entity (Table, Database, ...). Falls back to the first
        typed stage when every stage is a side output. ``None`` only when the
        node has no typed stage at all."""
        fallback = None
        for stage in node.stages:
            if stage.type_:
                if fallback is None:
                    fallback = stage
                if stage.type_.__name__ not in self._SIDE_OUTPUT_STAGE_TYPES:
                    return stage
        return fallback

    def _get_entity_type_for_node(self, node: TopologyNode) -> Optional[str]:  # noqa: UP045
        """The primary entity type name for a topology node, used as the
        progress-tracking key. Derived from the node's primary stage."""
        stage = self._node_primary_stage(node)
        return stage.type_.__name__ if stage is not None else None

    def _run_node_producer(self, node: TopologyNode) -> Iterable[Entity]:
        """Run the node producer"""
        try:
            node_producer = getattr(self, node.producer)
            yield from node_producer() or []
        except Exception as exc:
            self.status.failed(
                StackTraceError(
                    name=f"Producer {node.producer}",
                    error=f"Error running node producer: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _root_context_keys(self) -> set[str]:
        """Context keys owned by root topology nodes (the service level). Root
        nodes are those with no consumers — the existing definition of a
        topology root — so the exclusion is derived, never a string literal.
        Cached per source; the topology is static."""
        cached = self.__dict__.get("_root_ctx_keys")
        if cached is None:
            cached = {
                stage.context for node in get_topology_root(self.topology) for stage in node.stages if stage.context
            }
            self.__dict__["_root_ctx_keys"] = cached
        return cached

    def _primary_stage_index(self) -> "dict[str, NodeStage]":
        """Map of entity type name → that node's primary stage, built once from
        the static topology. Entity types are unique per node, so the first
        match wins on the rare collision."""
        cached = self.__dict__.get("_primary_stage_idx")
        if cached is None:
            cached = {}
            for node in get_topology_nodes(self.topology):
                stage = self._node_primary_stage(node)
                if stage is not None:
                    cached.setdefault(stage.type_.__name__, stage)
            self.__dict__["_primary_stage_idx"] = cached
        return cached

    def _primary_entity_stage(self, entity_type_name: Optional[str]) -> Optional[NodeStage]:  # noqa: UP045
        """The primary stage whose entity type is the node's progress key — the
        same stage ``_get_entity_type_for_node`` selects. ``None`` when no node
        produces ``entity_type_name`` (or it is ``None``), so callers can skip
        topology access entirely for the run-grain default."""
        result = None
        if entity_type_name is not None:
            result = self._primary_stage_index().get(entity_type_name)
        return result

    def current_progress_path(self, entity_type_name: Optional[str] = None) -> List[str]:  # noqa: UP006,UP045
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
            ctx = self.context.get()
            for key in stage.consumer or []:
                if key not in root_keys:
                    value = getattr(ctx, key, None)
                    if value is not None:
                        path.append(model_str(value))
        return path

    def _is_root_node(self, node: TopologyNode) -> bool:
        """The topology root (the Service node) is a structural wrapper, not a
        progress level: it always holds a single entity and would otherwise
        collide with the first real level (databases) at the registry root."""
        return id(node) in self.__dict__.get("_root_node_ids", set())

    def _should_track_progress(self, node: TopologyNode, entity_type_name: Optional[str]) -> bool:  # noqa: UP045
        """Progress is recorded only for opted-in sources, for real entity
        nodes, and never for the structural service root."""
        return self.progress_tracking_enabled and bool(entity_type_name) and not self._is_root_node(node)

    def _scope_path_for_node(self, node: TopologyNode, parent_path: List[str]) -> Optional[List[str]]:  # noqa: UP006,UP045
        """The path of the container entity currently in context: its parent
        ancestors plus this node's own context value. Used to prune a scope
        from the progress tree once its children finish. ``None`` when the
        node's context value is not set."""
        result = None
        stage = self._node_primary_stage(node)
        if stage is not None and stage.context and parent_path is not None:
            value = getattr(self.context.get(), stage.context, None)
            if value is not None:
                result = [*parent_path, model_str(value)]
        return result

    def _multithread_process_node(self, node: TopologyNode, threads: int) -> Iterable[Entity]:
        """Multithread Processing of a Node with progress tracking"""
        child_nodes = self._get_child_nodes(node)
        entity_type_name = self._get_entity_type_for_node(node)
        operation_metrics = OperationMetricsState()

        # Track SOURCE time - fetching entities from producer
        source_start = perf_counter()
        node_entities = list(self._run_node_producer(node) or [])
        source_time_ms = (perf_counter() - source_start) * 1000
        node_entities_length = len(node_entities)

        if entity_type_name:
            operation_metrics.record_operation(
                category="source_fetch",
                operation=node.producer,
                duration_ms=source_time_ms,
                entity_type=entity_type_name,
            )

        track_progress = self._should_track_progress(node, entity_type_name)
        parent_path = self.current_progress_path(entity_type_name) if track_progress else None
        if track_progress and parent_path is not None:
            self.progress.open(parent_path, entity_type_name, node_entities_length)
            if self.progress.is_reconcilable(entity_type_name) and parent_path:
                self.progress.reconcile_scope_total(entity_type_name, parent_path[-1], node_entities_length)

        if node_entities_length == 0:
            return
        else:
            chunksize = int(math.ceil(node_entities_length / threads))  # noqa: RUF046
            chunks: list[list[Entity]] = [
                node_entities[i : i + chunksize] for i in range(0, node_entities_length, chunksize)
            ]

            with CustomThreadPoolExecutor(max_workers=threads) as pool:
                futures = [
                    pool.submit(
                        self._multithread_process_entity,
                        node,
                        chunk,
                        child_nodes,
                        self.context.get_current_thread_id(),
                        entity_type_name,
                        parent_path,
                    )
                    for chunk in chunks
                ]

                while True:
                    if self.queue.has_tasks():
                        yield from self.queue.process()

                    else:
                        if not futures:
                            break

                        for i, future in enumerate(futures):
                            if future.done():
                                future.result()
                                futures.pop(i)

                    time.sleep(0.01)

    def _process_node(self, node: TopologyNode) -> Iterable[Entity]:
        """Single-threaded processing of a Node.

        Container producers (database, schema) are iterated lazily so connectors
        can set up per-yield inspector/session state before each child is
        processed. Leaf producers (table, stored procedure) are materialized
        eagerly ONLY when progress tracking is enabled — to record an exact child
        count via ``progress.open``; otherwise they are iterated lazily so
        connectors whose stages depend on per-yield producer state (e.g. PowerBI's
        per-workspace ``state.enter`` / ``finally: state.exit``) are not torn down
        before their stages run.
        """
        child_nodes = self._get_child_nodes(node)
        entity_type_name = self._get_entity_type_for_node(node)
        is_leaf = not child_nodes
        track_progress = self._should_track_progress(node, entity_type_name)
        parent_path = self.current_progress_path(entity_type_name) if track_progress else []

        reconcilable = track_progress and not is_leaf and self.progress.is_reconcilable(entity_type_name)
        if track_progress and (is_leaf or reconcilable):
            node_entities = list(self._run_node_producer(node) or [])
            self.progress.open(parent_path, entity_type_name, len(node_entities))
            if reconcilable and parent_path:
                self.progress.reconcile_scope_total(entity_type_name, parent_path[-1], len(node_entities))
        else:
            node_entities = self._run_node_producer(node) or []
            if track_progress:
                self.progress.open(parent_path, entity_type_name, None)

        for node_entity in node_entities:
            for stage in node.stages:
                yield from self._process_stage(stage=stage, node_entity=node_entity)

            for stage in node.stages:
                if stage.clear_context:
                    self.context.get().clear_stage(stage=stage)

            if track_progress and is_leaf:
                self.progress.advance(parent_path, entity_type_name)

            scope_path = self._scope_path_for_node(node, parent_path) if track_progress and not is_leaf else None
            yield from self.process_nodes(child_nodes)
            if scope_path is not None:
                self.progress.close(scope_path)
                self.progress.track(entity_type_name)

    def process_nodes(self, nodes: List[TopologyNode]) -> Iterable[Entity]:  # noqa: UP006
        """
        Given a list of nodes, either roots or children,
        yield from its producers and process the children.

        The execution tree is created in a depth-first fashion.

        Note that this is used to handle the metadata ingestion for all our services. Therefore,
        the first Node is always expected to be a Service. This is important because:
        - Services (root Nodes) are flagged with `overwrite=False` -> In `yield_and_update_context` if
          the stage is flagged as `overwrite=False`, we won't send any PUT/PATCH request to the API if
          the service already exists.
        - Then, when we iterate over Services' children (databases, pipelines, dashboards,...), we will
          initialize a cache listing its children. This is used to to compare the fingerprint of the
          stored entity vs. incoming entity and see if we need to:
          1. Create a new entity (PUT) - if no fingerprint is found for the given name
          2. Update some fields from the entity (PATCH) - if there's a fingerprint mismatch
          3. Do nothing - if the fingerprints are the same.

        The fingerprint is stored in the db in the field `sourceHash` in each entity.

        :param nodes: Topology Nodes to process
        :return: recursively build the execution tree
        """

        for node in nodes:
            logger.debug(f"Processing node {node}")

            # Each node producer will give us a list of entities that we need
            # to process. Each of the internal stages will sink result to OM API.
            # E.g., in the DB topology, at the Table TopologyNode, the node_entity
            # will be each `table`
            if node.threads and self.context.threads > 1:
                yield from self._multithread_process_node(node, self.context.threads)
            else:
                yield from self._process_node(node)

            yield from self._run_node_post_process(node=node)

    def _multithread_process_entity(
        self,
        node: TopologyNode,
        node_entities: List[Any],  # noqa: UP006
        child_nodes: List[TopologyNode],  # noqa: UP006
        parent_thread_id: int,
        entity_type_name: Optional[str] = None,  # noqa: UP045
        parent_path: Optional[List[str]] = None,  # noqa: UP006,UP045
    ):
        """Multithread processing of a Node Entity with progress tracking"""
        # Generates a new context based on the parent thread.
        self.context.copy_from(parent_thread_id)

        operation_metrics = OperationMetricsState()

        for node_entity in node_entities:
            # For each stage, we get all the stage results and one by one yield them by adding them to the Queue.
            for stage in node.stages:
                for stage_result in self._process_stage(stage=stage, node_entity=node_entity):
                    self.queue.put(stage_result)

            # After all the stages are done, we clear the context if needed.
            for stage in node.stages:
                if stage.clear_context:
                    self.context.get().clear_stage(stage=stage)

            if parent_path is not None and entity_type_name and not child_nodes:
                self.progress.advance(parent_path, entity_type_name)

            scope_path = (
                self._scope_path_for_node(node, parent_path) if parent_path is not None and child_nodes else None
            )
            for child_result in self.process_nodes(child_nodes):
                self.queue.put(child_result)
            if scope_path is not None:
                self.progress.close(scope_path)
                self.progress.track(entity_type_name)

        # Merge thread-local metrics into global state before thread exits
        operation_metrics.merge_thread_metrics()

        # Finally we pop the context and finish the thread
        self.context.pop()

    def _get_child_nodes(self, node: TopologyNode) -> List[TopologyNode]:  # noqa: UP006
        """Compute children nodes if any"""
        return [get_topology_node(child, self.topology) for child in node.children] if node.children else []

    def _run_stage_processor(self, stage: NodeStage, node_entity: Any) -> Iterable[Entity]:
        """Run the stage processor"""
        try:
            stage_fn = getattr(self, stage.processor)
            yield from stage_fn(node_entity) or []
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error running stage processor: {exc}")

    def _process_stage(self, stage: NodeStage, node_entity: Any) -> Iterable[Entity]:
        """
        For each entity produced in the Node Producer, iterate over all the Node's Stages and
        yield the assets to pass down the workflow.

        Each produced entity is yielded straight to the sink. Change detection (skip unchanged
        entities by comparing ``sourceHash``) is handled server-side by the bulk endpoint, so the
        connector no longer pre-fetches existing entities to build a local cache.
        """
        logger.debug(f"Processing stage: {stage}")
        operation_metrics = OperationMetricsState()
        stage_start = perf_counter()

        for entity_request in self._run_stage_processor(stage=stage, node_entity=node_entity) or []:
            try:
                # yield and make sure the data is updated
                yield from self.sink_request(stage=stage, entity_request=entity_request)
            except ValueError as err:
                logger.debug(traceback.format_exc())
                logger.warning(f"Unexpected value error when processing stage: [{stage}]: {err}")

        # Track STAGE time - processing and sinking entities
        stage_time_ms = (perf_counter() - stage_start) * 1000
        entity_type_name = stage.type_.__name__ if stage.type_ else "Unknown"
        operation_metrics.record_operation(
            category="stage_process",
            operation=stage.processor,
            duration_ms=stage_time_ms,
            entity_type=entity_type_name,
        )

    def _run_node_post_process(self, node: TopologyNode) -> Iterable[Entity]:
        """
        If the node has post_process steps, iterate over them and yield the result
        """
        if node.post_process:
            logger.debug(f"Post processing node {node}")
            for process in node.post_process:
                try:
                    node_post_process = getattr(self, process)
                    for entity_request in node_post_process() or []:  # noqa: UP028
                        yield entity_request
                except Exception as exc:
                    self.status.failed(
                        StackTraceError(
                            name=f"Post Process {process}",
                            error=f"Error running node post process: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def _iter(self) -> Iterable[Either]:
        """
        This is the implementation for the entrypoint of our Source classes, which
        are an IterStep

        Based on a ServiceTopology, find the root node
        and fetch all source methods in the required order
        to yield data to the sink
        :return: Iterable of the Entities yielded by all nodes in the topology
        """
        root_nodes = get_topology_root(self.topology)
        self.__dict__["_root_node_ids"] = {id(node) for node in root_nodes}
        yield from self.process_nodes(root_nodes)

    def create_patch_request(self, original_entity: Entity, create_request: C) -> PatchRequest:
        """
        Method to get the PatchRequest object
        To be overridden by the process if any custom logic is to be applied
        """
        return PatchRequest(
            original_entity=original_entity,
            new_entity=original_entity.model_copy(update=create_request.__dict__),
            override_metadata=self.source_config.overrideMetadata,
        )

    @singledispatchmethod
    def yield_and_update_context(
        self,
        right: C,
        stage: NodeStage,
        entity_request: Either[C],
    ) -> Iterable[Either[Entity]]:
        """
        Handle the process of yielding the request and validating
        that everything was properly updated.

        Every produced entity is stamped with its ``sourceHash`` and yielded straight to the
        sink. The server's bulk endpoint owns change detection: it compares the incoming
        ``sourceHash`` against the stored one and skips unchanged entities, so the connector no
        longer fetches existing entities or builds patch requests here.

        The only entity we still fetch is a non-overwritable one (a service): when ``overwrite``
        is False and the entity already exists we return it as-is instead of writing.
        """
        entity = None
        entity_name = model_str(right.name)
        entity_fqn = self.context.get().fqn_from_stage(stage=stage, entity_name=entity_name)

        # If we don't want to write data in OM, we'll return what we fetch from the API.
        # This is applicable for service entities since we do not want to overwrite the data.
        if not stage.overwrite and not self._is_force_overwrite_enabled():
            entity = self.metadata.get_by_name(
                entity=stage.type_,
                fqn=entity_fqn,
                fields=["*"],
            )

        # Stamp the source hash so the server-side bulk endpoint can skip unchanged entities.
        if entity_request.right is not None and hasattr(entity_request.right, "sourceHash"):
            entity_request.right.sourceHash = generate_source_hash(
                create_request=cast("BaseModel", entity_request.right),
            )

        # When the entity is not already present (or is overwritable) we yield the request to
        # the sink. The server decides create vs update vs skip from the sourceHash.
        if entity is None:
            yield entity_request

        # We have ack the sink waiting for a response, but got nothing back
        if stage.must_return and entity is None:
            # we'll only check the get by name for entities like database service
            # without which we cannot proceed ahead in the ingestion
            tries = 3
            while not entity and tries > 0:
                entity = self.metadata.get_by_name(
                    entity=stage.type_,
                    fqn=entity_fqn,
                    fields=["*"],  # Get all the available data from the Entity
                )
                tries -= 1

            if not entity:
                # Safe access to Entity Request name
                raise MissingExpectedEntityAckException(
                    f"We are trying to create a [{stage.type_.__name__}] with FQN [{entity_fqn}],"
                    " but we got no Entity back from the API. Checking for errors in the OpenMetadata Sink could help"
                    " validate if the Entity was properly created or not."
                )

        self.context.get().update_context_name(stage=stage, right=right)

    @yield_and_update_context.register
    def _(
        self,
        right: AddLineageRequest,
        stage: NodeStage,
        entity_request: Either[C],
    ) -> Iterable[Either[Entity]]:
        """
        Lineage Implementation for the context information.

        There is no simple (efficient) validation to make sure that this specific
        lineage has been properly drawn. We'll skip the process for now.
        """
        yield entity_request
        self.context.get().update_context_name(stage=stage, right=right.edge.fromEntity)

    @yield_and_update_context.register
    def _(
        self,
        right: OMetaFQNLineageRequest,
        stage: NodeStage,
        entity_request: Either[C],
    ) -> Iterable[Either[C]]:
        yield entity_request
        self.context.get().update_context_value(stage=stage, value=right.from_entity_fqn)

    @yield_and_update_context.register
    def _(
        self,
        right: OMetaTagAndClassification,
        stage: NodeStage,
        entity_request: Either[C],
    ) -> Iterable[Either[Entity]]:
        """
        Tag implementation for the context information.

        We need the full OMetaTagAndClassification in the context
        to build the TagLabels during the ingestion. We need to bundle
        both CreateClassificationRequest and CreateTagRequest.
        """
        yield entity_request

        self.context.get().update_context_value(stage=stage, value=right)

    @yield_and_update_context.register
    def _(
        self,
        right: OMetaCustomProperties,
        stage: NodeStage,
        entity_request: Either[C],
    ) -> Iterable[Either[C]]:
        """Custom Property implementation for the context information"""
        yield entity_request

        self.context.get().update_context_value(stage=stage, value=right)

    @yield_and_update_context.register
    def _(
        self,
        right: Barrier,
        stage: NodeStage,
        entity_request: Either[C],
    ) -> Iterable[Either[Entity]]:
        """Forward Barrier records without touching the context.

        Defensive: a Barrier yielded from a context-bearing stage would
        otherwise reach the default handler, which assumes the record has a
        ``.name`` attribute.
        """
        yield entity_request  # pyright: ignore

    def sink_request(self, stage: NodeStage, entity_request: Either[C]) -> Iterable[Either[Entity]]:
        """
        Validate that the entity was properly updated or retry if
        ack_sink is flagged.

        If we get the Entity back, update the context with it.

        :param stage: Node stage being processed
        :param entity_request: Request to pass
        :return: Entity generator
        """

        # Either use the received request or the acknowledged Entity
        entity = entity_request.right if entity_request else None

        if not stage.nullable and entity is None and entity_request.left is None:
            raise ValueError("Value unexpectedly None")

        if entity_request is not None:
            # Check that we properly received a Right response to process
            if entity_request.right is not None:
                # We need to acknowledge that the Entity has been properly sent to the server
                # to update the context
                if stage.context:
                    yield from self.yield_and_update_context(entity, stage=stage, entity_request=entity_request)

                else:
                    yield entity_request

            else:
                # if entity_request.right is None, means that we have a Left. We yield the Either and
                # let the step take care of the
                yield entity_request

    def _is_force_overwrite_enabled(self) -> bool:
        return self.metadata.config and self.metadata.config.forceEntityOverwriting
