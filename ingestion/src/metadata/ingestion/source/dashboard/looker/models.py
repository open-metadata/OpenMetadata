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
Looker pydantic models
"""

from typing import NewType

from pydantic import BaseModel, Field

Includes = NewType("Includes", str)
ViewName = NewType("ViewName", str)


class LookMlField(BaseModel):
    description: str | None = Field(None, description="Field description")
    label: str | None = Field(None, description="Field display name")
    type: str | None = Field(None, description="Field type to be mapped to OM")
    name: str = Field(..., description="Field name")
    sql: str | None = Field(None, description="Field SQL")


class LookMlDerivedTableField(BaseModel):
    sql: str | None = Field(None, description="Declares the SQL query for a derived table.")
    sql_create: str | None = Field(
        None,
        description="Defines a SQL CREATE statement",
    )


class LookMlView(BaseModel):
    name: ViewName = Field(..., description="View name")
    description: str | None = Field(None, description="View description")
    sql_table_name: str | None = Field(None, description="To track lineage with the source")
    measures: list[LookMlField] = Field([], description="Measures to ingest as cols")
    dimensions: list[LookMlField] = Field([], description="Dimensions to ingest as cols")
    source_file: Includes | None = Field(None, description="lkml file path")
    derived_table: LookMlDerivedTableField | None = Field(None, description="To track lineage with the source")
    tags: list[str] | None = Field(None, description="Tags for the view")
    extends__all: list[list[str]] | None = Field(
        None, alias="extends__all", description="List of views this view extends"
    )


class LkmlFile(BaseModel):
    """
    it might also have explores, but we don't care.
    We'll pick explores from the API
    """

    includes: list[Includes] = Field([], description="Full include list")
    views: list[LookMlView] = Field([], description="Views we want to parse")


class LookMLRepo(BaseModel):
    name: str = Field(None, description="Repository name")
    path: str = Field(None, description="RepositoryPath")


class LookMLManifest(BaseModel):
    project_name: str = Field(None, description="LookML project name")
    remote_dependency: dict = Field(None, description="Remote dependency information")
    constants: list[dict[str, str]] | None = Field(None, description="LookML constants defined in the manifest")
