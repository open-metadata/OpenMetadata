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
from typing import Any, Generic, Iterable, List, TypeVar

from pydantic import BaseModel

from metadata.ingestion.api.common import Entity
from metadata.ingestion.models.topology import (
    ServiceTopology,
    TopologyContext,
    TopologyNode,
    get_topology_node,
    get_topology_root,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

C = TypeVar("C", bound=BaseModel)


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
            logger.info(f"Processing node {node}")
            node_producer = getattr(self, node.producer)
            child_nodes = (
                [get_topology_node(child, self.topology) for child in node.children]
                if node.children
                else []
            )

            for entity_request in node_producer():
                # yield and make sure the data is updated
                yield from self.acknowledge_sink(
                    node=node, entity_request=entity_request
                )
                # process all children from the node being run
                yield from self.process_nodes(child_nodes)

            if node.post_process:
                node_post_process = getattr(self, node.post_process)
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

    def fqn_from_context(self, node: TopologyNode, entity_request: C) -> str:
        """
        Read the context
        :param node: Topology node being processed
        :param entity_request: Request sent to the sink
        :return: Entity FQN derived from context
        """
        context_names = [
            self.context.__dict__[dependency].name.__root__
            for dependency in node.consumer or []  # root nodes do not have consumers
        ]
        return fqn._build(*context_names, entity_request.name.__root__)

    def acknowledge_sink(
        self, node: TopologyNode, entity_request: C
    ) -> Iterable[Entity]:
        """
        Validate that the entity was properly updated or retry.

        If we get the Entity back, update the context with it.

        :param node: Topology node being processed
        :param entity_request: Request sent to the sink
        :return: updated entity
        """
        tries = 3
        entity = None

        entity_fqn = self.fqn_from_context(node=node, entity_request=entity_request)

        while not entity or tries <= 0:
            yield entity_request
            entity = self.metadata.get_by_name(entity=node.type_, fqn=entity_fqn)
            tries -= 1

        self.update_context(key=node.context, value=entity)
        logger.debug(self.context)
