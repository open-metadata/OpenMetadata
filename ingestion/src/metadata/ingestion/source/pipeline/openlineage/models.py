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


class OpenLineageJob(BaseModel):
    namespace: str
    name: str


class ParentFacet(BaseModel):
    job: OpenLineageJob


class RunFacet(BaseModel):
    parent: ParentFacet


class RunFacets(BaseModel):
    facets: RunFacet


class SchemaField(BaseModel):
    name: str
    type_: str = Field(alias="type")


class LineageSchemaField(SchemaField):
    inputFields: List[SchemaField]


class Fields(BaseModel):
    fields: Optional[List[SchemaField]]


class TableIdentifier(BaseModel):
    name: str


class TableSymlinks(BaseModel):
    identifiers: Optional[List[TableIdentifier]]


class InputField(BaseModel):
    namespace: str
    name: str
    field: str


class InputFieldList(BaseModel):
    inputFields: List[InputField]


class TableColumnLineage(BaseModel):
    fields: Dict[str, InputFieldList]


class TableFacet(BaseModel):
    schema_: Optional[Fields] = Field(alias="schema")
    symlinks: Optional[TableSymlinks]
    columnLineage: Optional[TableColumnLineage]


class Dataset(BaseModel):
    facets: Optional[TableFacet]
    name: str
    namespace: str


class RunEvent(BaseModel):
    """
    An object containing data extracted from raw OpenLineage event. Used as a basis for all abstract methods of
    OpenlineageSource connector.
    """

    run: RunFacets
    job: Dict
    eventType: str
    inputs: List[Dataset]
    outputs: List[Dataset]


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

    schema_: str
    name: str


class EventType(str, Enum):
    """
    List of used OpenLineage event types.
    """

    COMPLETE = "COMPLETE"
