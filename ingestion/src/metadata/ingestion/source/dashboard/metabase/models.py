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
Metabase Models
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class MetabaseDashboard(BaseModel):
    """
    Metabase dashboard model
    """

    description: Optional[str]
    name: str
    id: int
    collection_id: Optional[str]


class MetabaseCollection(BaseModel):
    """
    Metabase dashboard model
    """

    name: str
    id: str


class MetabaseDashboardList(BaseModel):
    dashboards: Optional[List[MetabaseDashboard]]


class MetabaseCollectionList(BaseModel):
    collections: Optional[List[MetabaseCollection]]


class Native(BaseModel):
    query: Optional[str]


class DatasetQuery(BaseModel):
    type: Optional[str]
    native: Optional[Native]


class MetabaseChart(BaseModel):
    """
    Metabase card model
    """

    description: Optional[str]
    table_id: Optional[str]
    database_id: Optional[int]
    name: Optional[str]
    dataset_query: Optional[DatasetQuery]
    id: Optional[int]
    display: Optional[str]


class DashCard(BaseModel):
    card: MetabaseChart


class MetabaseDashboardDetails(BaseModel):
    """
    Metabase dashboard details model
    """

    description: Optional[str]
    dashcards: List[DashCard]
    name: Optional[str]
    id: int
    collection_id: Optional[str]


class MetabaseDatabaseDetails(BaseModel):
    db: Optional[str]


class MetabaseDatabase(BaseModel):
    """
    Metabase database model
    """

    details: Optional[MetabaseDatabaseDetails]


class MetabaseTable(BaseModel):
    table_schema: Optional[str] = Field(..., alias="schema")
    db: Optional[MetabaseDatabase]
    name: Optional[str]
    id: Optional[int]
    display_name: Optional[str]
