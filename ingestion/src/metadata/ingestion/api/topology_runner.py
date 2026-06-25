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
from typing import Any, Generic, Iterable, List, Optional, TypeVar, cast  # noqa: UP035

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
    get_topology_root,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.custom_thread_pool import CustomThreadPoolExecutor
from metadata.utils.logger import ingestion_logger
from metadata.utils.operation_metrics import OperationMetricsState
from metadata.utils.progress_tracker import ProgressTrackerState
from metadata.utils.source_hash import generate_source_hash

logger = ingestion_logger()

C = TypeVar("C", bound=BaseModel)


class MissingExpectedEntityAckException(Exception):  # noqa: N818
    """
    After running the ack to the sink, we got no
    Entity back
    """


class TopologyRunnerMixin(Generic[C]):
    """
    Prepares the _run function
    dynamically based on the source topology
    """

    topology: ServiceTopology
    context: TopologyContextManager
    metadata: OpenMetadata

    queue = Queue()

    def _get_entity_type_for_node(self, node: TopologyNode) -> Optional[str]:  # noqa: UP045
        """
        Get the entity type name for a topology node.
        Used for progress tracking by entity type.
        """
        for stage in node.stages:
            if stage.type_:
                return stage.type_.__name__
        return None

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

    def _multithread_process_node(self, node: TopologyNode, threads: int) -> Iterable[Entity]:
        """Multithread Processing of a Node with progress tracking"""
        child_nodes = self._get_child_nodes(node)
        entity_type_name = self._get_entity_type_for_node(node)
        progress_tracker = ProgressTrackerState()
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

        if entity_type_name and node_entities_length > 0:
            progress_tracker.set_total(entity_type_name, node_entities_length)

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
        """Processing of a Node in a single thread with progress tracking.

        Uses lazy iteration to preserve the producer contract where connectors
        set up state (e.g., database inspectors, session tags) before each yield.
        Eager materialization with list() would break 12+ database connectors
        (Postgres, Snowflake, Redshift, etc.) that rely on this pattern.

        Progress totals are tracked incrementally via add_to_total. For nodes
        needing upfront totals (e.g., tables), _multithread_process_node is used.
        """
        child_nodes = self._get_child_nodes(node)
        entity_type_name = self._get_entity_type_for_node(node)
        progress_tracker = ProgressTrackerState()

        for node_entity in self._run_node_producer(node) or []:
            start_time = perf_counter()

            if entity_type_name:
                progress_tracker.add_to_total(entity_type_name, 1)

            for stage in node.stages:
                yield from self._process_stage(stage=stage, node_entity=node_entity)

            # Once we are done processing all the stages,
            for stage in node.stages:
                if stage.clear_context:
                    self.context.get().clear_stage(stage=stage)

            if entity_type_name:
                processing_time = perf_counter() - start_time
                progress_tracker.increment_processed(entity_type_name, processing_time)

            # process all children from the node being run
            yield from self.process_nodes(child_nodes)

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
    ):
        """Multithread processing of a Node Entity with progress tracking"""
        # Generates a new context based on the parent thread.
        self.context.copy_from(parent_thread_id)

        progress_tracker = ProgressTrackerState()
        operation_metrics = OperationMetricsState()

        for node_entity in node_entities:
            start_time = perf_counter()

            # For each stage, we get all the stage results and one by one yield them by adding them to the Queue.
            for stage in node.stages:
                for stage_result in self._process_stage(stage=stage, node_entity=node_entity):
                    self.queue.put(stage_result)

            # After all the stages are done, we clear the context if needed.
            for stage in node.stages:
                if stage.clear_context:
                    self.context.get().clear_stage(stage=stage)

            if entity_type_name:
                processing_time = perf_counter() - start_time
                progress_tracker.increment_processed(entity_type_name, processing_time)

            # If the Entity has child nodes that need processing we proceed to processing them with the same logic as above.

            for child_result in self.process_nodes(child_nodes):
                self.queue.put(child_result)

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
        yield from self.process_nodes(get_topology_root(self.topology))

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
