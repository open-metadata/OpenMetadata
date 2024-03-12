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
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

"""
"run": {
      "runId": "59fc8906-4a4a-45ab-9a54-9cc2d399e10e",
      "facets": {
        "parent": {
          "_producer": "https://github.com/OpenLineage/OpenLineage/tree/1.5.0/integration/spark",
          "_schemaURL": "https://openlineage.io/spec/facets/1-0-0/ParentRunFacet.json#/$defs/ParentRunFacet",
          "run": {
            "runId": "daf8bcc1-cc3c-41bb-9251-334cacf698fa"
          },
          "job": {
"""


class OpenLineageJob(BaseModel):
    namespace: str
    name: Optional[str]


class ParentFacet(BaseModel):
    job: OpenLineageJob


class OLFacets(BaseModel):
    parent: ParentFacet


class RunFacet(BaseModel):
    facets: OLFacets


class OpenLineageEvent(BaseModel):
    """
    An object containing data extracted from raw OpenLineage event. Used as a basis for all abstract methods of
    OpenlineageSource connector.
    """

    run: RunFacet
    job: Dict
    eventType: str
    inputs: List[Any]
    outputs: List[Any]


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

    uuid: str
    fqn: TableFQN
    node_type: str = "table"


class LineageEdge(BaseModel):
    """
    An object describing connection of two nodes in the Lineage information.
    """

    from_node: LineageNode
    to_node: LineageNode


class TableDetails(BaseModel):
    """
    Minimal table information.
    """

    schema_name: str
    name: str


class EventType(str, Enum):
    """
    List of used OpenLineage event types.
    """

    COMPLETE = "COMPLETE"
