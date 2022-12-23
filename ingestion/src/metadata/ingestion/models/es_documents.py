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
ES Document definitions for Entities
"""
from typing import List, Optional

from pydantic import BaseModel

from metadata.generated.schema.entity.data.mlmodel import (
    MlFeature,
    MlHyperParameter,
    MlStore,
)
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.type import schema
from metadata.generated.schema.type.entityReference import (
    EntityReference,
    EntityReferenceList,
)
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.generated.schema.type.usageDetails import (
    TypeUsedToReturnUsageDetailsOfAnEntity,
)


class ESEntityReference(BaseModel):
    """JsonSchema generated pydantic contains many unnecessary fields its not one-to-one representation of JsonSchema
    Example all the "__root__" fields. This will not index into ES elegantly hence we are creating special class
    for EntityReference
    """

    id: str
    name: str
    displayName: str
    description: str = ""
    type: str
    fullyQualifiedName: str
    deleted: bool
    href: str


class TableESDocument(BaseModel):
    """ElasticSearch Mapping doc"""

    entityType: str = "table"
    id: str
    name: str
    fullyQualifiedName: str
    description: Optional[str] = None
    displayName: str
    version: float
    updatedAt: Optional[int]
    updatedBy: Optional[str]
    href: Optional[str]
    columns: List[Column]
    databaseSchema: EntityReference
    database: EntityReference
    service: EntityReference
    owner: EntityReference = None
    location: Optional[EntityReference] = None
    usageSummary: TypeUsedToReturnUsageDetailsOfAnEntity = None
    deleted: bool
    serviceType: str
    tags: List[TagLabel]
    tier: Optional[TagLabel] = None
    followers: List[str]
    suggest: List[dict]
    column_suggest: List[dict]
    database_suggest: List[dict]
    schema_suggest: List[dict]
    service_suggest: List[dict]
    doc_as_upsert: bool = True


class TopicESDocument(BaseModel):
    """Topic ElasticSearch Mapping doc"""

    entityType: str = "topic"
    id: str
    name: str
    displayName: str
    fullyQualifiedName: str
    description: Optional[str] = None
    version: float
    updatedAt: Optional[int]
    updatedBy: Optional[str]
    href: Optional[str]
    deleted: bool
    service: EntityReference
    messageSchema: Optional[schema.Topic] = None
    schemaText: Optional[str] = None
    schemaType: Optional[str] = None
    cleanupPolicies: List[str] = None
    replicationFactor: Optional[int] = None
    maximumMessageSize: Optional[int] = None
    retentionSize: Optional[int] = None
    suggest: List[dict]
    service_suggest: List[dict]
    tags: List[TagLabel]
    tier: Optional[TagLabel] = None
    owner: EntityReference = None
    followers: List[str]
    doc_as_upsert: bool = True


class DashboardESDocument(BaseModel):
    """ElasticSearch Mapping doc for Dashboards"""

    entityType: str = "dashboard"
    id: str
    name: str
    displayName: str
    fullyQualifiedName: str
    description: Optional[str] = None
    version: float
    updatedAt: Optional[int]
    updatedBy: Optional[str]
    dashboardUrl: Optional[str]
    charts: List[EntityReference]
    href: Optional[str]
    owner: EntityReference = None
    followers: List[str]
    service: EntityReference
    serviceType: str
    usageSummary: TypeUsedToReturnUsageDetailsOfAnEntity = None
    deleted: bool
    tags: List[TagLabel]
    tier: Optional[TagLabel] = None
    suggest: List[dict]
    chart_suggest: List[dict]
    service_suggest: List[dict]
    doc_as_upsert: bool = True


class PipelineESDocument(BaseModel):
    """ElasticSearch Mapping doc for Pipelines"""

    entityType: str = "pipeline"
    id: str
    name: str
    displayName: str
    fullyQualifiedName: str
    description: Optional[str] = None
    version: float
    updatedAt: Optional[int]
    updatedBy: Optional[str]
    pipelineUrl: Optional[str]
    tasks: List[Task]
    deleted: bool
    href: Optional[str]
    owner: EntityReference = None
    followers: List[str]
    tags: List[TagLabel]
    tier: Optional[TagLabel] = None
    service: EntityReference
    serviceType: str
    suggest: List[dict]
    task_suggest: List[dict]
    service_suggest: List[dict]
    doc_as_upsert: bool = True


class MlModelESDocument(BaseModel):
    """ElasticSearch Mapping doc for MlModels"""

    entityType: str = "mlmodel"
    id: str
    name: str
    displayName: str
    fullyQualifiedName: str
    description: Optional[str] = None
    version: float
    updatedAt: Optional[int]
    updatedBy: Optional[str]
    algorithm: str
    mlFeatures: Optional[List[MlFeature]] = None
    mlHyperParameters: Optional[List[MlHyperParameter]] = None
    target: str
    dashboard: Optional[EntityReference] = None
    mlStore: Optional[MlStore] = None
    server: Optional[str] = None
    usageSummary: TypeUsedToReturnUsageDetailsOfAnEntity = None
    tags: List[TagLabel]
    tier: Optional[TagLabel] = None
    owner: ESEntityReference = None
    followers: List[str]
    href: Optional[str]
    deleted: bool
    suggest: List[dict]
    service_suggest: List[dict] = None
    doc_as_upsert: bool = True


class UserESDocument(BaseModel):
    """ElasticSearch Mapping doc for Users"""

    entityType: str = "user"
    id: str
    name: str
    fullyQualifiedName: str
    displayName: str
    description: str
    version: float
    updatedAt: Optional[int]
    updatedBy: Optional[str]
    email: str
    href: Optional[str]
    isAdmin: bool
    teams: EntityReferenceList
    roles: EntityReferenceList
    inheritedRoles: EntityReferenceList
    deleted: bool
    suggest: List[dict]
    doc_as_upsert: bool = True


class TeamESDocument(BaseModel):
    """ElasticSearch Mapping doc for Teams"""

    entityType: str = "team"
    id: str
    name: str
    fullyQualifiedName: str
    displayName: str
    description: str
    teamType: str
    version: float
    updatedAt: Optional[int]
    updatedBy: Optional[str]
    href: Optional[str]
    suggest: List[dict]
    users: EntityReferenceList
    defaultRoles: EntityReferenceList
    parents: EntityReferenceList
    isJoinable: bool
    deleted: bool
    doc_as_upsert: bool = True


class GlossaryTermESDocument(BaseModel):
    """ElasticSearch Mapping doc for Glossary Term"""

    entityType: str = "glossaryTerm"
    id: str
    name: str
    fullyQualifiedName: str
    displayName: str
    description: str
    version: float
    updatedAt: Optional[int]
    updatedBy: Optional[str]
    href: Optional[str]
    synonyms: Optional[List[str]]
    glossary: EntityReference
    children: Optional[List[EntityReference]]
    relatedTerms: Optional[List[EntityReference]]
    reviewers: Optional[List[EntityReference]]
    usageCount: Optional[int]
    tags: List[TagLabel]
    status: str
    suggest: List[dict]
    deleted: bool
    doc_as_upsert: bool = True


class TagESDocument(BaseModel):
    """ElasticSearch Mapping doc for Tag"""

    entityType: str = "tag"
    id: str
    name: str
    fullyQualifiedName: str
    description: str
    version: float
    updatedAt: Optional[int]
    updatedBy: Optional[str]
    href: Optional[str]
    suggest: List[dict]
    deleted: bool
    deprecated: bool
    doc_as_upsert: bool = True
