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
import queue
import threading
from functools import singledispatchmethod
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar

from pydantic import BaseModel, ConfigDict, Field, create_model

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.ingestion.ometa.utils import model_str
from metadata.utils import fqn

T = TypeVar("T", bound=BaseModel)
C = TypeVar("C", bound=BaseModel)


class NodeStage(BaseModel, Generic[T]):
    """
    Handles the processing stages of each node.
    Each stage is equipped with a processing function
    and a context key, which will be updated at the
    source.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    # Required fields to define the yielded entity type and the function processing it
    type_: Type[T] = Field(
        ..., description="Entity Type. E.g., DatabaseService, Database or Table"
    )
    processor: str = Field(
        ...,
        description="Has the producer results as an argument. Here is where filters happen. It will yield an Entity.",
    )

    # Topology behavior
    nullable: bool = Field(False, description="Flags if the yielded value can be null")
    must_return: bool = Field(
        False,
        description="The sink MUST return a value back after ack. Useful to validate if services are correct.",
    )
    overwrite: bool = Field(
        True,
        description="If we want to update existing data from OM. E.g., we don't want to overwrite services.",
    )
    consumer: Optional[List[str]] = Field(
        None,
        description="Stage dependency from parent nodes. Used to build the FQN of the processed Entity.",
    )

    # Context-related flags
    context: Optional[str] = Field(
        None, description="Context key storing stage state, if needed"
    )
    store_all_in_context: bool = Field(
        False, description="If we need to store all values being yielded in the context"
    )
    clear_context: bool = Field(
        False,
        description="If we need to clean the values in the context for each produced element",
    )
    store_fqn: bool = Field(
        False,
        description="If true, store the entity FQN in the context instead of just the name",
    )

    # Used to compute the fingerprint
    cache_entities: bool = Field(
        False,
        description="Cache all the entities which have use_cache set as True. Used for fingerprint comparison.",
    )
    use_cache: bool = Field(
        False,
        description="Enable this to get the entity from cached state in the context",
    )


class TopologyNode(BaseModel):
    """
    Each node has a producer function, which will
    yield an Entity to be passed to the Sink. Afterwards,
    the producer function will update the Source context
    with the updated element from the OM API.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    producer: str = Field(
        ...,
        description="Method name in the source called to generate the data. Does not accept input parameters",
    )
    stages: List[NodeStage] = Field(
        ...,
        description=(
            "List of functions to execute - in order - for each element produced by the producer. "
            "Each stage accepts the producer results as an argument"
        ),
    )
    children: Optional[List[str]] = Field(None, description="Nodes to execute next")
    post_process: Optional[List[str]] = Field(
        None, description="Method to be run after the node has been fully processed"
    )
    threads: bool = Field(
        False,
        description="Flag that defines if a node is open to MultiThreading processing.",
    )


class ServiceTopology(BaseModel):
    """
    Bounds all service topologies
    """

    model_config = ConfigDict(extra="allow")


class TopologyContext(BaseModel):
    """
    Bounds all topology contexts
    """

    model_config = ConfigDict(extra="allow")

    def __repr__(self):
        ctx = {key: value.name.root for key, value in self.__dict__.items()}
        return f"TopologyContext({ctx})"

    @classmethod
    def create(cls, topology: ServiceTopology) -> "TopologyContext":
        """
        Dynamically build a context based on the topology nodes.

        Builds a Pydantic BaseModel class.

        :param topology: ServiceTopology
        :return: TopologyContext
        """
        nodes = get_topology_nodes(topology)
        ctx_fields = {
            stage.context: (Optional[stage.type_], None)
            for node in nodes
            for stage in node.stages
            if stage.context
        }
        return create_model(
            "GeneratedContext", **ctx_fields, __base__=TopologyContext
        )()

    def upsert(self, key: str, value: Any) -> None:
        """
        Update the key of the context with the given value
        :param key: element to update from the source context
        :param value: value to use for the update
        """
        self.__dict__[key] = value

    def append(self, key: str, value: Any) -> None:
        """
        Update the key of the context with the given value
        :param key: element to update from the source context
        :param value: value to use for the update
        """
        if self.__dict__.get(key):
            self.__dict__[key].append(value)
        else:
            self.__dict__[key] = [value]

    def clear_stage(self, stage: NodeStage) -> None:
        """
        Clear the available context
        :param stage: Update stage context to the default values
        """
        self.__dict__[stage.context] = None

    def fqn_from_stage(self, stage: NodeStage, entity_name: str) -> str:
        """
        Read the context
        :param stage: Topology node being processed
        :param entity_name: name being stored
        :return: Entity FQN derived from context
        """
        context_names = [
            self.__dict__[dependency]
            for dependency in stage.consumer or []  # root nodes do not have consumers
        ]

        # DashboardDataModel requires extra parameter to build the correct FQN
        if stage.type_ == DashboardDataModel:
            context_names.append("model")

        return fqn._build(  # pylint: disable=protected-access
            *context_names, entity_name
        )

    def update_context_name(self, stage: NodeStage, right: C) -> None:
        """
        Append or update context

        We'll store the entity name or FQN in the topology context.
        If we store the name, the FQN will be built in the source itself when needed.
        """

        if stage.store_fqn:
            new_context = self._build_new_context_fqn(right)
        else:
            new_context = model_str(right.name)

        self.update_context_value(stage=stage, value=new_context)

    def update_context_value(self, stage: NodeStage, value: Any) -> None:
        if stage.context and not stage.store_all_in_context:
            self.upsert(key=stage.context, value=value)
        if stage.context and stage.store_all_in_context:
            self.append(key=stage.context, value=value)

    @singledispatchmethod
    def _build_new_context_fqn(self, right: C) -> str:
        """Build context fqn string"""
        raise NotImplementedError(f"Missing implementation for [{type(C)}]")

    @_build_new_context_fqn.register
    def _(self, right: CreateStoredProcedureRequest) -> str:
        """
        Implement FQN context building for Stored Procedures.

        We process the Stored Procedures lineage at the very end of the service. If we
        just store the SP name, we lose the information of which db/schema the SP belongs to.
        """

        return fqn.build(
            metadata=None,
            entity_type=StoredProcedure,
            service_name=self.__dict__["database_service"],
            database_name=self.__dict__["database"],
            schema_name=self.__dict__["database_schema"],
            procedure_name=right.name.root,
        )


class TopologyContextManager:
    """Manages the Context held for different threads."""

    def __init__(self, topology: ServiceTopology):
        # Due to our code strucutre, the first time the ContextManager is called will be within the MainThread.
        # We can leverage this to guarantee we keep track of the MainThread ID.
        self.main_thread = self.get_current_thread_id()
        self.contexts: Dict[int, TopologyContext] = {
            self.main_thread: TopologyContext.create(topology)
        }

        # Starts with the Multithreading disabled
        self.threads = 0

    def set_threads(self, threads: Optional[int]):
        self.threads = threads or 0

    def get_current_thread_id(self):
        return threading.get_ident()

    def get_global(self) -> TopologyContext:
        return self.contexts[self.main_thread]

    def get(self, thread_id: Optional[int] = None) -> TopologyContext:
        """Returns the TopologyContext of a given thread."""
        if thread_id:
            return self.contexts[thread_id]

        thread_id = self.get_current_thread_id()

        return self.contexts[thread_id]

    def pop(self, thread_id: Optional[int] = None):
        """Cleans the TopologyContext of a given thread in order to lower the Memory Profile."""
        if not thread_id:
            self.contexts.pop(self.get_current_thread_id())
        else:
            self.contexts.pop(thread_id)

    def copy_from(self, parent_thread_id: int):
        """Copies the TopologyContext from a given Thread to the new thread TopologyContext."""
        thread_id = self.get_current_thread_id()

        # If it does not exist yet, copies the Parent Context in order to have all context gathered until this point.
        self.contexts.setdefault(
            thread_id, self.contexts[parent_thread_id].model_copy(deep=True)
        )

    def __getstate__(self):
        """Called when pickling the object."""
        state = self.__dict__.copy()
        return state

    def __setstate__(self, state):
        """Called when unpickling the object."""
        self.__dict__.update(state)


class Queue:
    """Small Queue wrapper"""

    def __init__(self):
        self._queue = queue.Queue()

    def has_tasks(self) -> bool:
        """Checks that the Queue is not Empty."""
        return not self._queue.empty()

    def process(self) -> Any:
        """Yields all the items currently on the Queue."""
        while True:
            try:
                item = self._queue.get_nowait()
                yield item
                self._queue.task_done()
            except queue.Empty:
                break

    def put(self, item: Any):
        """Puts new item in the Queue."""
        self._queue.put(item)


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
