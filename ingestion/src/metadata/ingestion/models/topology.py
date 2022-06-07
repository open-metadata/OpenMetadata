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
Defines the topology for ingesting sources
"""

from typing import Generic, List, Optional, Type, TypeVar

from pydantic import BaseModel, Extra, create_model

T = TypeVar("T", bound=BaseModel)


class TopologyNode(BaseModel, Generic[T]):
    """
    Each node has a producer function, which will
    yield an Entity to be passed to the Sink. Afterwards,
    the producer function will update the Source context
    with the updated element from the OM API.
    """

    class Config:
        extra = Extra.forbid

    type_: Type[T]  # Entity type
    context: str  # context key storing node state
    producer: str  # method name in the source to use to generate the data

    children: Optional[List[str]] = None  # nodes to call execute next
    consumer: Optional[
        List[str]
    ] = None  # keys in the source context to fetch state from the parent's context


class ServiceTopology(BaseModel):
    """
    Bounds all service topologies
    """

    class Config:
        extra = Extra.allow


class TopologyContext(BaseModel):
    """
    Bounds all topology contexts
    """

    class Config:
        extra = Extra.allow


def get_topology_nodes(topology: ServiceTopology) -> List[TopologyNode]:
    """
    Fetch all nodes from a ServiceTopology
    :param topology: ServiceTopology
    :return: List of nodes
    """
    return [value for key, value in topology.__dict__.items()]


def get_topology_root(topology: ServiceTopology) -> List[TopologyNode]:
    """
    Fetch the roots from a ServiceTopology.

    A node is root if it has no consumers, i.e., can be
    computed at the top of the Tree.
    :param topology: ServiceTopology
    :return: List of nodes that can be roots
    """
    nodes = get_topology_nodes(topology)
    return [node for node in nodes if node.consumer is None]


def create_source_context(topology: ServiceTopology) -> TopologyContext:
    """
    Dynamically build a context based on the topology nodes
    :param topology: ServiceTopology
    :return: TopologyContext
    """
    nodes = get_topology_nodes(topology)
    ctx_fields = {node.context: (Optional[node.type_], None) for node in nodes}
    return create_model("GeneratedContext", **ctx_fields, __base__=TopologyContext)()


def get_topology_node(name: str, topology: ServiceTopology) -> TopologyNode:
    """
    Fetch a topology node by name
    :param name: node name
    :param topology: service topology with all nodes
    :return: TopologyNode
    """
    node = topology.__dict__.get(name)
    if not node:
        raise ValueError(f"{name} node not found in {topology}")

    return node
