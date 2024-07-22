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
Domo Database Source Model module
"""

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class DomoDatabaseBaseModel(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    name: str


class User(DomoDatabaseBaseModel):
    id: int
    email: str
    role: str


class SchemaColumn(BaseModel):
    type: str
    name: str
    description: Optional[str] = None


class Schema(BaseModel):
    columns: List[SchemaColumn]


class Owner(DomoDatabaseBaseModel):
    id: int
    name: str


class OutputDataset(DomoDatabaseBaseModel):
    rows: int
    columns: int
    schemas: Optional[Schema] = Field(None, alias="schema")
    owner: Owner
    description: Optional[str] = None
