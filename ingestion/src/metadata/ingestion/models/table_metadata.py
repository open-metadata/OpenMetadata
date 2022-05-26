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


from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.entityReference import EntityReference


class DeleteTable(BaseModel):
    """Entity Reference of a table to be deleted"""

    table: Table


class ChangeDescription(BaseModel):
    updatedBy: str
    updatedAt: int
    fieldsAdded: Optional[str]
    fieldsDeleted: Optional[str]
    fieldsUpdated: Optional[str]


class TableESDocument(BaseModel):
    """Elastic Search Mapping doc"""

    table_id: str
    deleted: bool
    database: str
    database_schema: str
    service: str
    service_type: str
    service_category: str
    entity_type: str = "table"
    name: str
    suggest: List[dict]
    description: Optional[str] = None
    table_type: Optional[str] = None
    last_updated_timestamp: Optional[int]
    column_names: List[str]
    column_descriptions: List[str]
    monthly_stats: int
    monthly_percentile_rank: int
    weekly_stats: int
    weekly_percentile_rank: int
    daily_stats: int
    daily_percentile_rank: int
    tags: List[str]
    fqdn: str
    tier: Optional[str] = None
    owner: EntityReference = None
    followers: List[str]
    change_descriptions: Optional[List[ChangeDescription]] = None
    doc_as_upsert: bool = True


class TopicESDocument(BaseModel):
    """Topic Elastic Search Mapping doc"""

    topic_id: str
    deleted: bool
    service: str
    service_type: str
    service_category: str
    entity_type: str = "topic"
    name: str
    suggest: List[dict]
    description: Optional[str] = None
    last_updated_timestamp: Optional[int]
    tags: List[str]
    fqdn: str
    tier: Optional[str] = None
    owner: EntityReference = None
    followers: List[str]
    change_descriptions: Optional[List[ChangeDescription]] = None
    doc_as_upsert: bool = True


class DashboardESDocument(BaseModel):
    """Elastic Search Mapping doc for Dashboards"""

    dashboard_id: str
    deleted: bool
    service: str
    service_type: str
    service_category: str
    entity_type: str = "dashboard"
    name: str
    suggest: List[dict]
    description: Optional[str] = None
    last_updated_timestamp: Optional[int]
    chart_names: List[str]
    chart_descriptions: List[str]
    tags: List[str]
    fqdn: str
    tier: Optional[str] = None
    owner: EntityReference = None
    followers: List[str]
    monthly_stats: int
    monthly_percentile_rank: int
    weekly_stats: int
    weekly_percentile_rank: int
    daily_stats: int
    daily_percentile_rank: int
    change_descriptions: Optional[List[ChangeDescription]] = None
    doc_as_upsert: bool = True


class PipelineESDocument(BaseModel):
    """Elastic Search Mapping doc for Pipelines"""

    pipeline_id: str
    deleted: bool
    service: str
    service_type: str
    service_category: str
    entity_type: str = "pipeline"
    name: str
    suggest: List[dict]
    description: Optional[str] = None
    last_updated_timestamp: Optional[int]
    task_names: List[str]
    task_descriptions: List[str]
    tags: List[str]
    fqdn: str
    tier: Optional[str] = None
    owner: EntityReference = None
    followers: List[str]
    change_descriptions: Optional[List[ChangeDescription]] = None
    doc_as_upsert: bool = True


class UserESDocument(BaseModel):
    """Elastic Search Mapping doc for Users"""

    user_id: str
    deleted: bool
    entity_type: str = "user"
    name: str
    display_name: str
    email: str
    suggest: List[dict]
    last_updated_timestamp: Optional[int]
    teams: List[str]
    roles: List[str]
    doc_as_upsert: bool = True


class TeamESDocument(BaseModel):
    """Elastic Search Mapping doc for Teams"""

    team_id: str
    deleted: bool
    entity_type: str = "team"
    name: str
    display_name: str
    suggest: List[dict]
    last_updated_timestamp: Optional[int]
    users: List[str]
    owns: List[str]
    doc_as_upsert: bool = True


class GlossaryTermESDocument(BaseModel):
    """Elastic Search Mapping doc for Glossary Term"""

    glossary_term_id: str
    deleted: bool
    entity_type: str = "glossaryTerm"
    name: str
    display_name: str
    fqdn: str
    description: str
    glossary_name: str
    glossary_id: str
    status: str
    suggest: List[dict]
    last_updated_timestamp: Optional[int]
    doc_as_upsert: bool = True


class DashboardOwner(BaseModel):
    """Dashboard owner"""

    username: str
    first_name: str
    last_name: str


class Chart(BaseModel):
    """Chart"""

    name: str
    displayName: str
    description: str
    chart_type: str
    url: str
    owners: List[DashboardOwner] = None
    lastModified: int = None
    datasource_fqn: str = None
    service: EntityReference
    custom_props: Dict[Any, Any] = None


class Dashboard(BaseModel):
    """Dashboard"""

    name: str
    displayName: str
    description: str
    url: str
    owners: List[DashboardOwner] = None
    charts: List[str]
    service: EntityReference
    lastModified: int = None
