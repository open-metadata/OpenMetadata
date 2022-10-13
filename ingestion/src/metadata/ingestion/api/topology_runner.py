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
generate the next_record based on their topology.
"""
import traceback
from typing import Any, Generic, Iterable, List, TypeVar

from pydantic import BaseModel

from metadata.ingestion.api.common import Entity
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
    Prepares the next_record function
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

    def next_record(self) -> Iterable[Entity]:
        """
        Based on a ServiceTopology, find the root node
        and fetch all source methods in the required order
        to yield data to the sink
        :return: Iterable of the Entities yielded by all nodes in the topology
        """
        yield from self.process_nodes(get_topology_root(self.topology))

    def update_context(self, key: str, value: Any) -> None:
        """
        Update the key of the context with the given value
        :param key: element to update from the source context
        :param value: value to use for the update
        """
        self.context.__dict__[key] = value

    def append_context(self, key: str, value: Any) -> None:
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
            self.context.__dict__[dependency].name.__root__
            for dependency in stage.consumer or []  # root nodes do not have consumers
        ]
        return fqn._build(  # pylint: disable=protected-access
            *context_names, entity_request.name.__root__
        )

    def sink_request(self, stage: NodeStage, entity_request: C) -> Iterable[Entity]:
        """
        Validate that the entity was properly updated or retry if
        ack_sink is flagged.

        If we get the Entity back, update the context with it.

        :param stage: Node stage being processed
        :param entity_request: Request to pass
        :return: Entity generator
        """

        # Either use the received request or the acknowledged Entity
        entity = entity_request

        if stage.nullable and entity is None:
            raise ValueError("Value unexpectedly None")

        if entity is not None:
            if stage.ack_sink:
                entity = None

                entity_fqn = self.fqn_from_context(
                    stage=stage, entity_request=entity_request
                )

                # we get entity from OM if we do not want to overwrite existing data in OM
                if not stage.overwrite and not self._is_force_overwrite_enabled():
                    entity = self.metadata.get_by_name(
                        entity=stage.type_,
                        fqn=entity_fqn,
                        fields=["*"],  # Get all the available data from the Entity
                    )
                # if entity does not exist in OM, or we want to overwrite, we will yield the entity_request
                if entity is None:
                    tries = 3
                    while not entity and tries > 0:
                        yield entity_request
                        # Improve validation logic
                        entity = self.metadata.get_by_name(
                            entity=stage.type_,
                            fqn=entity_fqn,
                            fields=["*"],  # Get all the available data from the Entity
                        )
                        tries -= 1

                # We have ack the sink waiting for a response, but got nothing back
                if stage.must_return and entity is None:
                    # Safe access to Entity Request name
                    raise MissingExpectedEntityAckException(
                        f"Missing ack back from [{stage.type_.__name__}: {getattr(entity_request, 'name')}] - "
                        "Possible causes are changes in the server Fernet key or mismatched JSON Schemas "
                        "for the service connection."
                    )

            else:
                yield entity

            if stage.context and not stage.cache_all:
                self.update_context(key=stage.context, value=entity)
            if stage.context and stage.cache_all:
                self.append_context(key=stage.context, value=entity)
            logger.debug(self.context)

    def _is_force_overwrite_enabled(self) -> bool:
        return self.metadata.config and self.metadata.config.forceEntityOverwriting
