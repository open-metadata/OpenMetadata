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
Openlineage Source Model module
"""
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from metadata.generated.schema.type import basic


class TableDetails(BaseModel):
    """
    Table Details containing information relevant to OM operations.
    """

    _schema: str = Field(alias="schema")
    name: str
    fqn: Optional[str]
    raw: Dict
    in_om: bool = False


class OpenLineageEvent(BaseModel):
    """
    An object containing data extracted from raw OpenLineage event. Used as a basis for all abstract methods of
    OpenlineageSource connector.
    """

    run_facet: Dict
    job: Dict
    event_type: str
    inputs: List[Dict]
    outputs: List[Dict]

    input_table_details: Optional[List[TableDetails]] = Field(default_factory=list)
    output_table_details: Optional[List[TableDetails]] = Field(default_factory=list)


class TableFQN(BaseModel):
    """
    Fully Qualified Name of a Table.
    """

    value: str


class ColumnFQN(BaseModel):
    """
    Fully Qualified Name of a Column.
    """

    value: str


class LineageNode(BaseModel):
    """
    A node being a part of Lineage information.
    """

    uuid: basic.Uuid
    fqn: TableFQN
    node_type: str = "table"


class LineageEdge(BaseModel):
    """
    An object describing connection of two nodes in the Lineage information.
    """

    from_node: LineageNode
    to_node: LineageNode


class EventType(str, Enum):
    """
    List of used OpenLineage event types.
    """

    COMPLETE = "COMPLETE"
    FAIL = "FAIL"
    ABORT = "ABORT"
