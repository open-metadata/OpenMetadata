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
from typing import Any, Iterable, List

from metadata.ingestion.api.common import Entity
from metadata.ingestion.models.topology import (
    ServiceTopology,
    TopologyContext,
    TopologyNode,
    get_topology_node,
    get_topology_root,
)


class TopologyRunnerMixin:
    """
    Prepares the next_record function
    dynamically based on the source topology
    """

    topology: ServiceTopology
    context: TopologyContext

    def process_nodes(self, nodes: List[TopologyNode]) -> Iterable[Entity]:
        """
        Given a list of nodes, either roots or children,
        yield from its producers and process the children.

        The execution tree is created in a depth-first fashion.

        :param nodes: Topology Nodes to process
        :return: recursively build the execution tree
        """
        for node in nodes:
            node_producer = getattr(self, node.producer)
            yield from node_producer()

            child_nodes = (
                [get_topology_node(child, self.topology) for child in node.children]
                if node.children
                else []
            )
            yield from self.process_nodes(child_nodes)

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
