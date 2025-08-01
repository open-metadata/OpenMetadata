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
Openlineage Source Model module
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional


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

    name: str
    schema: str
    database: Optional[str] = None


class EventType(str, Enum):
    """
    List of used OpenLineage event types.
    """

    COMPLETE = "COMPLETE"
