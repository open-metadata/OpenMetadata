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

from typing import Any, Generic, List, Optional, Type, TypeVar

from pydantic import BaseModel, Extra, create_model

T = TypeVar("T", bound=BaseModel)


class NodeStage(BaseModel, Generic[T]):
    """
    Handles the processing stages of each node.
    Each stage is equipped with a processing function
    and a context key, which will be updated at the
    source.
    """

    class Config:
        extra = Extra.forbid

    type_: Type[T]  # Entity type
    processor: str  # has the producer results as an argument. Here is where filters happen
    context: Optional[str] = None  # context key storing stage state, if needed
    ack_sink: bool = True  # Validate that the request is present in OM and update the context with the results
    nullable: bool = False  # The yielded value can be null
    cache_all: bool = (
        False  # If we need to cache all values being yielded in the context
    )
    clear_cache: bool = False  # If we need to clean cache values  in the context for each produced element
    consumer: Optional[
        List[str]
    ] = None  # keys in the source context to fetch state from the parent's context


class TopologyNode(BaseModel):
    """
    Each node has a producer function, which will
    yield an Entity to be passed to the Sink. Afterwards,
    the producer function will update the Source context
    with the updated element from the OM API.
    """

    class Config:
        extra = Extra.forbid

    # method name in the source to use to generate the data to process
    # does not accept input parameters
    producer: str

    # list of functions to execute - in order - for each element produced by the producer
    # each stage accepts the producer results as an argument
    stages: List[NodeStage]

    children: Optional[List[str]] = None  # nodes to call execute next
    post_process: Optional[
        str
    ] = None  # Method to be run after the node has been fully processed


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

    def __repr__(self):
        ctx = {key: value.name.__root__ for key, value in self.__dict__.items()}
        return f"TopologyContext({ctx})"


def get_topology_nodes(topology: ServiceTopology) -> List[TopologyNode]:
    """
    Fetch all nodes from a ServiceTopology
    :param topology: ServiceTopology
    :return: List of nodes
    """
    return [value for key, value in topology.__dict__.items()]


def node_has_no_consumers(node: TopologyNode) -> bool:
    """
    Validate if a node has no consumers
    :param node:
    :return:
    """
    stage_consumers = [stage.consumer for stage in node.stages]
    return all(consumer is None for consumer in stage_consumers)


def get_topology_root(topology: ServiceTopology) -> List[TopologyNode]:
    """
    Fetch the roots from a ServiceTopology.

    A node is root if it has no consumers, i.e., can be
    computed at the top of the Tree.
    :param topology: ServiceTopology
    :return: List of nodes that can be roots
    """
    nodes = get_topology_nodes(topology)
    return [node for node in nodes if node_has_no_consumers(node)]


def get_ctx_default(stage: NodeStage) -> Optional[List[Any]]:
    """
    If we cache all, default value is an empty list
    :param stage: Node Stage
    :return: None or []
    """
    return [] if stage.cache_all else None


def create_source_context(topology: ServiceTopology) -> TopologyContext:
    """
    Dynamically build a context based on the topology nodes.

    Builds a Pydantic BaseModel class.

    :param topology: ServiceTopology
    :return: TopologyContext
    """
    nodes = get_topology_nodes(topology)
    ctx_fields = {
        stage.context: (Optional[stage.type_], get_ctx_default(stage))
        for node in nodes
        for stage in node.stages
        if stage.context
    }
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
