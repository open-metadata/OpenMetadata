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


class DatabaseAndTableState(BaseModel):
    database: str
    table: str
    exists: bool


class DeleteTable(BaseModel):
    """Entity Reference of a table to be deleted"""

    table: Table


class TableFQDN(BaseModel):
    """Table Fully Qualified Name"""

    fullyQualifiedName: str


class FieldChange(BaseModel):
    name: str
    newValue: Optional[str]
    oldValue: Optional[str]


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


class ValueFrequency(BaseModel):
    """Profiler ValueFrequency"""

    value: str
    frequency: int


class Histogram(BaseModel):
    """Histogram"""

    boundaries: List[str]
    heights: List[str]


class Quantile(BaseModel):
    """Quantile"""

    quantile: str
    value: str


class DatasetColumnProfile(BaseModel):
    """Dataset Column Profile stats"""

    fqdn: str
    unique_count: int = None
    unique_proportion: int = None
    null_count: int = None
    null_proportion: int = None
    min: str = None
    max: str = None
    mean: str = None
    median: str = None
    stddev: str = None
    quantiles: List[Quantile] = None
    distinct_value_frequencies: List[ValueFrequency] = None
    histogram: List[Histogram] = None
    sample_values: List[str] = None


class DatasetProfile(BaseModel):
    """Dataset(table) stats"""

    timestamp: int
    table_name: str
    row_count: int = None
    col_count: int = None
    col_profiles: List[DatasetColumnProfile] = None
