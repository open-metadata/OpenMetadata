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
Databricks Source Model module
"""

from typing import Union

from pydantic import BaseModel


class DatabricksTable(BaseModel):
    name: str | None = None
    catalog_name: str | None = None
    schema_name: str | None = None


class ForeignConstrains(BaseModel):
    child_columns: list[str] | None = []
    parent_columns: list[str] | None = []
    parent_table: str


class Metadata(BaseModel):
    comment: str | None = None


class ColumnJson(BaseModel):
    name: str | None = None
    type: Union["Type", str] | None = None
    metadata: Metadata | None = None


class ElementType(BaseModel):
    type: str | None = None
    fields: list[ColumnJson] | None = None


class Type(BaseModel):
    type: str | None = None
    elementType: ElementType | str | None = None  # noqa: N815
    fields: list[ColumnJson] | None = None


ColumnJson.model_rebuild()
