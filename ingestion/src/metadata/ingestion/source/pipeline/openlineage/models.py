"""
Openlineage Source Model module
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List


@dataclass
class OpenLineageEvent:
    """
    An object containing data extracted from raw OpenLineage event. Used as a basis for all abstract methods of
    OpenlineageSource connector.
    """

    run_facet: Dict
    job: Dict
    event_type: str
    inputs: List[Any]
    outputs: List[Any]


@dataclass
class TableFQN:
    """
    Fully Qualified Name of a Table.
    """

    value: str


@dataclass
class ColumnFQN:
    """
    Fully Qualified Name of a Column.
    """

    value: str


@dataclass
class LineageNode:
    """
    A node being a part of Lineage information.
    """

    uuid: str
    fqn: TableFQN
    node_type: str = "table"


@dataclass
class LineageEdge:
    """
    An object describing connection of two nodes in the Lineage information.
    """

    from_node: LineageNode
    to_node: LineageNode


@dataclass
class TableDetails:
    """
    Minimal table information.
    """

    schema: str
    name: str


class EventType(str, Enum):
    """
    List of used OpenLineage event types.
    """

    COMPLETE = "COMPLETE"
