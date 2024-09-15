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
Looker pydantic models
"""

from typing import List, NewType, Optional

from pydantic import BaseModel, Field

Includes = NewType("Includes", str)
ViewName = NewType("ViewName", str)


class LookMlField(BaseModel):
    description: Optional[str] = Field(None, description="Field description")
    label: Optional[str] = Field(None, description="Field display name")
    type: Optional[str] = Field(None, description="Field type to be mapped to OM")
    name: str = Field(..., description="Field name")


class LookMlDerivedTableField(BaseModel):
    sql: Optional[str] = Field(
        None, description="Declares the SQL query for a derived table."
    )
    sql_create: Optional[str] = Field(
        None,
        description="Defines a SQL CREATE statement",
    )


class LookMlView(BaseModel):
    name: ViewName = Field(..., description="View name")
    description: Optional[str] = Field(None, description="View description")
    sql_table_name: Optional[str] = Field(
        None, description="To track lineage with the source"
    )
    measures: List[LookMlField] = Field([], description="Measures to ingest as cols")
    dimensions: List[LookMlField] = Field(
        [], description="Dimensions to ingest as cols"
    )
    source_file: Optional[Includes] = Field(None, description="lkml file path")
    derived_table: Optional[LookMlDerivedTableField] = Field(
        None, description="To track lineage with the source"
    )


class LkmlFile(BaseModel):
    """
    it might also have explores, but we don't care.
    We'll pick explores from the API
    """

    includes: List[Includes] = Field([], description="Full include list")
    views: List[LookMlView] = Field([], description="Views we want to parse")


class LookMLRepo(BaseModel):
    name: str = Field(None, description="Repository name")
    path: str = Field(None, description="RepositoryPath")


class LookMLManifest(BaseModel):
    project_name: str = Field(None, description="LookML project name")
    remote_dependency: dict = Field(None, description="Remote dependency information")
