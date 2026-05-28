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

from typing import Dict, List, NewType, Optional  # noqa: UP035

from pydantic import BaseModel, Field

Includes = NewType("Includes", str)
ViewName = NewType("ViewName", str)


class LookMlField(BaseModel):
    description: Optional[str] = Field(None, description="Field description")  # noqa: UP045
    label: Optional[str] = Field(None, description="Field display name")  # noqa: UP045
    type: Optional[str] = Field(None, description="Field type to be mapped to OM")  # noqa: UP045
    name: str = Field(..., description="Field name")
    sql: Optional[str] = Field(None, description="Field SQL")  # noqa: UP045


class LookMlDerivedTableField(BaseModel):
    sql: Optional[str] = Field(None, description="Declares the SQL query for a derived table.")  # noqa: UP045
    sql_create: Optional[str] = Field(  # noqa: UP045
        None,
        description="Defines a SQL CREATE statement",
    )


class LookMlView(BaseModel):
    name: ViewName = Field(..., description="View name")
    description: Optional[str] = Field(None, description="View description")  # noqa: UP045
    sql_table_name: Optional[str] = Field(None, description="To track lineage with the source")  # noqa: UP045
    measures: List[LookMlField] = Field([], description="Measures to ingest as cols")  # noqa: UP006
    dimensions: List[LookMlField] = Field([], description="Dimensions to ingest as cols")  # noqa: UP006
    source_file: Optional[Includes] = Field(None, description="lkml file path")  # noqa: UP045
    derived_table: Optional[LookMlDerivedTableField] = Field(None, description="To track lineage with the source")  # noqa: UP045
    tags: Optional[List[str]] = Field(None, description="Tags for the view")  # noqa: UP006, UP045
    extends__all: Optional[List[List[str]]] = Field(  # noqa: UP006, UP045
        None, alias="extends__all", description="List of views this view extends"
    )


class LkmlFile(BaseModel):
    """
    it might also have explores, but we don't care.
    We'll pick explores from the API
    """

    includes: List[Includes] = Field([], description="Full include list")  # noqa: UP006
    views: List[LookMlView] = Field([], description="Views we want to parse")  # noqa: UP006


class LookMLRepo(BaseModel):
    name: str = Field(None, description="Repository name")
    path: str = Field(None, description="RepositoryPath")


class LookMLManifest(BaseModel):
    project_name: str = Field(None, description="LookML project name")
    remote_dependency: dict = Field(None, description="Remote dependency information")
    constants: Optional[List[Dict[str, str]]] = Field(None, description="LookML constants defined in the manifest")  # noqa: UP006, UP045
