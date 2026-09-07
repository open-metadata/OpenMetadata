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
Domo Database Source Model module
"""

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
    description: str | None = None


class Schema(BaseModel):
    columns: list[SchemaColumn]


class Owner(DomoDatabaseBaseModel):
    id: int
    name: str


class OutputDataset(DomoDatabaseBaseModel):
    rows: int
    columns: int
    schemas: Schema | None = Field(None, alias="schema")
    owner: Owner
    description: str | None = None
