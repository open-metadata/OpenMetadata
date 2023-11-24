#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Mixin to be used by service sources to dynamically
generate the _run based on their topology.
"""
import traceback
from functools import singledispatchmethod
from typing import Any, Generic, Iterable, List, TypeVar

from pydantic import BaseModel

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.ingestion.api.models import Either, Entity
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.patch_request import PatchRequest
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyContext,
    TopologyNode,
    get_ctx_default,
    get_topology_node,
    get_topology_root,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

C = TypeVar("C", bound=BaseModel)


class MissingExpectedEntityAckException(Exception):
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
    context: TopologyContext
    metadata: OpenMetadata

    def process_nodes(self, nodes: List[TopologyNode]) -> Iterable[Entity]:
        """
        Given a list of nodes, either roots or children,
        yield from its producers and process the children.

        The execution tree is created in a depth-first fashion.

        :param nodes: Topology Nodes to process
        :return: recursively build the execution tree
        """
        for node in nodes:
            logger.debug(f"Processing node {node}")
            node_producer = getattr(self, node.producer)
            child_nodes = (
                [get_topology_node(child, self.topology) for child in node.children]
                if node.children
                else []
            )

            for element in node_producer() or []:
                for stage in node.stages:
                    logger.debug(f"Processing stage: {stage}")

                    stage_fn = getattr(self, stage.processor)
                    for entity_request in stage_fn(element) or []:
                        try:
                            # yield and make sure the data is updated
                            yield from self.sink_request(
                                stage=stage, entity_request=entity_request
                            )
                        except ValueError as err:
                            logger.debug(traceback.format_exc())
                            logger.warning(
                                f"Unexpected value error when processing stage: [{stage}]: {err}"
                            )

                # processing for all stages completed now cleaning the cache if applicable
                for stage in node.stages:
                    if stage.clear_cache:
                        self.clear_context(stage=stage)

                # process all children from the node being run
                yield from self.process_nodes(child_nodes)

            if node.post_process:
                logger.debug(f"Post processing node {node}")
                for process in node.post_process:
                    try:
                        yield from self.check_context_and_handle(process)
                    except Exception as exc:
                        logger.debug(traceback.format_exc())
                        logger.warning(
                            f"Could not run Post Process `{process}` from Topology Runner -- {exc}"
                        )

    def check_context_and_handle(self, post_process: str):
        """Based on the post_process step, check context and
        evaluate if we can run it based on available class attributes

        Args:
            post_process: the name of the post_process step
        """
        if post_process == "mark_tables_as_deleted" and not self.context.database:
            raise ValueError("No Database found in  `self.context`")

        node_post_process = getattr(self, post_process)
        for entity_request in node_post_process():
            yield entity_request

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

    def _replace_context(self, key: str, value: Any) -> None:
        """
        Update the key of the context with the given value
        :param key: element to update from the source context
        :param value: value to use for the update
        """
        self.context.__dict__[key] = value

    def _append_context(self, key: str, value: Any) -> None:
        """
        Update the key of the context with the given value
        :param key: element to update from the source context
        :param value: value to use for the update
        """
        self.context.__dict__[key].append(value)

    def clear_context(self, stage: NodeStage) -> None:
        """
        Clear the available context
        :param key: element to update from the source context
        """
        self.context.__dict__[stage.context] = get_ctx_default(stage)

    def fqn_from_context(self, stage: NodeStage, entity_request: C) -> str:
        """
        Read the context
        :param stage: Topology node being processed
        :param entity_request: Request sent to the sink
        :return: Entity FQN derived from context
        """
        context_names = [
            self.context.__dict__[dependency]
            for dependency in stage.consumer or []  # root nodes do not have consumers
        ]
        return fqn._build(  # pylint: disable=protected-access
            *context_names, entity_request.name.__root__
        )

    def update_context(self, stage: NodeStage, entity_name: str):
        """Append or update context"""
        if stage.context and not stage.cache_all:
            self._replace_context(key=stage.context, value=entity_name)
        if stage.context and stage.cache_all:
            self._append_context(key=stage.context, value=entity_name)

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

        The default implementation is based on a get_by_name validation
        """

        entity_name = model_str(right.name)
        yield entity_request

        # We have ack the sink waiting for a response, but got nothing back
        if stage.must_return and entity_name is None:
            # Safe access to Entity Request name
            raise MissingExpectedEntityAckException(
                f"Missing ack back from [{stage.type_.__name__}: {entity_name}] - "
                "Possible causes are changes in the server Fernet key or mismatched JSON Schemas "
                "for the service connection."
            )

        self.update_context(stage=stage, entity_name=entity_name)

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
        self.update_context(stage=stage, entity_name=right)

    @yield_and_update_context.register
    def _(
        self,
        right: OMetaTagAndClassification,
        stage: NodeStage,
        entity_request: Either[C],
    ) -> Iterable[Either[Entity]]:
        """Tag implementation for the context information"""
        yield entity_request

        tag = None

        tries = 3
        while not tag and tries > 0:
            yield entity_request
            tag = self.metadata.get_by_name(
                entity=Tag,
                fqn=fqn.build(
                    metadata=self.metadata,
                    entity_type=Tag,
                    classification_name=right.tag_request.classification.__root__,
                    tag_name=right.tag_request.name.__root__,
                ),
            )
            tries -= 1

        # We have ack the sink waiting for a response, but got nothing back
        if stage.must_return and tag is None:
            # Safe access to Entity Request name
            raise MissingExpectedEntityAckException(
                f"Missing ack back from [Tag: {right.tag_request.name}] - "
                "Possible causes are changes in the server Fernet key or mismatched JSON Schemas "
                "for the service connection."
            )

        # We want to keep the full payload in the context
        self.update_context(stage=stage, entity_name=right)

    def sink_request(
        self, stage: NodeStage, entity_request: Either[C]
    ) -> Iterable[Either[Entity]]:
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

        if not stage.nullable and entity is None:
            raise ValueError("Value unexpectedly None")

        if entity_request is not None:
            # Check that we properly received a Right response to process
            if entity_request.right is not None:
                # We need to acknowledge that the Entity has been properly sent to the server
                # to update the context
                if stage.context:
                    yield from self.yield_and_update_context(
                        entity, stage=stage, entity_request=entity_request
                    )

                else:
                    yield entity_request

            else:
                # if entity_request.right is None, means that we have a Left. We yield the Either and
                # let the step take care of the
                yield entity_request

    def _is_force_overwrite_enabled(self) -> bool:
        return self.metadata.config and self.metadata.config.forceEntityOverwriting
