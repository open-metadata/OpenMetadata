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
Metabase Models
"""
from typing import List, Optional

from pydantic import BaseModel, BeforeValidator, Field
from typing_extensions import Annotated

MetabaseStrId = Annotated[str, BeforeValidator(lambda x: str(x))]


class MetabaseUser(BaseModel):
    """
    Metabase user model
    """

    id: MetabaseStrId
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    common_name: Optional[str] = None
    email: Optional[str] = None
    is_superuser: Optional[bool] = False
    last_edit_timestamp: Optional[str] = Field(None, alias="timestamp")


class MetabaseDashboard(BaseModel):
    """
    Metabase dashboard model
    """

    description: Optional[str] = None
    name: str
    id: MetabaseStrId
    collection_id: Optional[MetabaseStrId] = None


class MetabaseCollection(BaseModel):
    """
    Metabase dashboard model
    """

    name: str
    id: MetabaseStrId


class MetabaseDashboardList(BaseModel):
    data: List[MetabaseDashboard] = []


class MetabaseCollectionList(BaseModel):
    collections: List[MetabaseCollection] = []


class Native(BaseModel):
    query: Optional[str] = None


class DatasetQuery(BaseModel):
    type: Optional[str] = None
    native: Optional[Native] = None


class MetabaseChart(BaseModel):
    """
    Metabase card model
    """

    description: Optional[str] = None
    table_id: Optional[MetabaseStrId] = None
    database_id: Optional[MetabaseStrId] = None
    name: Optional[str] = None
    dataset_query: Optional[DatasetQuery] = None
    id: Optional[MetabaseStrId] = None
    display: Optional[str] = None
    dashboard_ids: List[str] = []


class DashCard(BaseModel):
    card: MetabaseChart


class MetabaseDashboardDetails(BaseModel):
    """
    Metabase dashboard details model
    """

    description: Optional[str] = None
    card_ids: List[str] = []
    name: Optional[str] = None
    id: MetabaseStrId
    creator_id: Optional[MetabaseStrId] = None
    collection_id: Optional[MetabaseStrId] = None


class MetabaseDatabaseDetails(BaseModel):
    db: Optional[str] = None


class MetabaseDatabase(BaseModel):
    """
    Metabase database model
    """

    details: Optional[MetabaseDatabaseDetails] = None


class MetabaseTable(BaseModel):
    table_schema: Optional[str] = Field(None, alias="schema")
    db: Optional[MetabaseDatabase] = None
    name: Optional[str] = None
    id: Optional[MetabaseStrId] = None
    display_name: Optional[str] = None
