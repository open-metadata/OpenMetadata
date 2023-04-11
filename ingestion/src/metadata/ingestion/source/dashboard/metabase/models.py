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
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class Creator(BaseModel):
    email: str
    first_name: str
    last_login: str
    is_qbnewb: bool
    is_superuser: bool
    id: int
    last_name: str
    date_joined: str
    common_name: str


class LastEditInfo(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    timestamp: str


class MetabaseDashboard(BaseModel):
    """
    Metabase dashboard model
    """

    description: Optional[str]
    archived: bool
    collection_position: Optional[str]
    creator: Creator
    enable_embedding: bool
    collection_id: Optional[int]
    show_in_getting_started: bool
    name: str
    caveats: Optional[str]
    is_app_page: bool
    creator_id: int
    updated_at: str
    made_public_by_id: Optional[int]
    embedding_params: Optional[str]
    cache_ttl: Optional[str]
    id: int
    position: Optional[str]
    entity_id: str
    last_edit_info: Optional[LastEditInfo]
    parameters: List[str]
    created_at: str
    public_uuid: Optional[str]
    points_of_interest: Optional[str]


class MetabaseDashboardList(BaseModel):
    dashboards: Optional[List[MetabaseDashboard]]


class Global(BaseModel):
    distinct_count: Optional[int] = Field(..., alias="distinct-count")
    nil_: Optional[float] = Field(..., alias="nil%")


class TypeNumber(BaseModel):
    min: int
    q1: float
    q3: float
    max: int
    sd: float
    avg: float


class TypeText(BaseModel):
    percent_json: int = Field(..., alias="percent-json")
    percent_url: int = Field(..., alias="percent-url")
    percent_email: int = Field(..., alias="percent-email")
    percent_state: float = Field(..., alias="percent-state")
    average_length: float = Field(..., alias="average-length")


class TypeDateTime(BaseModel):
    earliest: str
    latest: str


class Type(BaseModel):
    type_Number: Optional[TypeNumber] = Field(None, alias="type/Number")
    type_Text: Optional[TypeText] = Field(None, alias="type/Text")
    type_DateTime: Optional[TypeDateTime] = Field(None, alias="type/DateTime")


class Fingerprint(BaseModel):
    global_: Optional[Global] = Field(..., alias="global")
    type: Optional[Type]


class ResultMetadatum(BaseModel):
    display_name: Optional[str]
    field_ref: Any
    name: Optional[str]
    base_type: Optional[str]
    effective_type: Optional[str]
    semantic_type: Optional[str]
    fingerprint: Optional[Fingerprint]


class Native(BaseModel):
    query: Optional[str]
    template_tags: Optional[Dict[str, Any]] = Field(..., alias="template-tags")


class DatasetQuery(BaseModel):
    type: str
    native: Optional[Native]
    database: int


class VisualizationSettings(BaseModel):
    table_pivot_column: str = Field(..., alias="table.pivot_column")
    table_cell_column: str = Field(..., alias="table.cell_column")


class Card(BaseModel):
    """
    Metabase card model
    """

    description: Optional[str]
    archived: Optional[bool]
    collection_position: Optional[str]
    table_id: Optional[str]
    result_metadata: Optional[List[ResultMetadatum]]
    database_id: Optional[int]
    enable_embedding: Optional[bool]
    collection_id: Optional[str]
    query_type: Optional[str]
    name: Optional[str]
    query_average_duration: Optional[int]
    creator_id: Optional[int]
    moderation_reviews: Optional[List]
    updated_at: Optional[str]
    made_public_by_id: Optional[str]
    embedding_params: Optional[str]
    cache_ttl: Optional[str]
    dataset_query: Optional[DatasetQuery]
    id: Optional[int]
    parameter_mappings: Optional[List]
    display: str
    entity_id: Optional[str]
    collection_preview: Optional[bool]
    visualization_settings: Optional[VisualizationSettings]
    is_write: Optional[bool]
    parameters: Optional[List]
    dataset: Optional[bool]
    created_at: Optional[str]
    public_uuid: Optional[str]


class OrderedCard(BaseModel):
    size_x: Optional[int]
    series: Optional[List]
    action_id: Optional[str]
    collection_authority_level: Optional[str]
    card: Card
    updated_at: Optional[str]
    col: Optional[int]
    id: Optional[int]
    parameter_mappings: Optional[List]
    card_id: Optional[int]
    entity_id: Optional[str]
    visualization_settings: Optional[Dict[str, Any]]
    size_y: Optional[int]
    dashboard_id: Optional[int]
    created_at: Optional[str]
    row: Optional[int]


class MetabaseDashboardDetails(BaseModel):
    """
    Metabase dashboard details model
    """

    description: Optional[str]
    archived: Optional[bool]
    collection_position: Optional[str]
    ordered_cards: List[OrderedCard]
    can_write: Optional[bool]
    enable_embedding: Optional[bool]
    collection_id: Optional[str]
    show_in_getting_started: Optional[bool]
    name: str
    caveats: Optional[str]
    is_app_page: Optional[bool]
    collection_authority_level: Optional[str]
    creator_id: Optional[int]
    updated_at: Optional[str]
    made_public_by_id: Optional[str]
    embedding_params: Optional[str]
    cache_ttl: Optional[str]
    id: int
    position: Optional[str]
    entity_id: Optional[str]
    param_fields: Optional[str]
    last_edit_info: Optional[LastEditInfo] = Field(..., alias="last-edit-info")
    parameters: Optional[List]
    created_at: Optional[str]
    public_uuid: Optional[str]
    points_of_interest: Optional[str]


class MetabaseDatabaseDetails(BaseModel):
    db: Optional[str]


class MetabaseSchedules(BaseModel):
    schedule_minute: int
    schedule_day: Optional[int]
    schedule_frame: Optional[str]
    schedule_hour: Optional[int]
    schedule_type: str


class MetabaseDatabase(BaseModel):
    """
    Metabase database model
    """

    description: Optional[str]
    features: Optional[List[str]]
    cache_field_values_schedule: Optional[str]
    timezone: Optional[str]
    auto_run_queries: Optional[bool]
    metadata_sync_schedule: Optional[str]
    name: Optional[str]
    settings: Optional[Dict[str, Any]]
    caveats: Optional[str]
    can_manage: Optional[bool]
    creator_id: Optional[int]
    is_full_sync: Optional[bool]
    updated_at: Optional[datetime]
    cache_ttl: Optional[int]
    details: Optional[MetabaseDatabaseDetails]
    is_sample: Optional[bool]
    id: Optional[int]
    is_on_demand: Optional[bool]
    options: Optional[Dict[str, Any]]
    schedules: Optional[Dict[str, MetabaseSchedules]]
    engine: Optional[str]
    initial_sync_status: Optional[str]
    refingerprint: Optional[str]
    created_at: Optional[datetime]
    points_of_interest: Any


class MetabaseTable(BaseModel):
    description: Optional[str]
    entity_type: Optional[str]
    table_schema: Optional[str] = Field(..., alias="schema")
    db: Optional[MetabaseDatabase]
    show_in_getting_started: Optional[bool]
    name: Optional[str]
    caveats: Optional[str]
    updated_at: Optional[str]
    pk_field: Optional[int]
    active: Optional[bool]
    id: Optional[int]
    db_id: Optional[int]
    visibility_type: Optional[str]
    field_order: Optional[str]
    initial_sync_status: Optional[str]
    display_name: Optional[str]
    created_at: Optional[str]
    points_of_interest: Any
