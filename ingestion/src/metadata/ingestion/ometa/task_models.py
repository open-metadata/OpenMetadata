#  Copyright 2026 Collate
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
Task models for the Python OMeta fluent client.

The task JSON schemas are available on the server/spec side, but Python generated
models are not currently emitted for this branch. These local models provide the
client-facing task API surface without reviving the removed legacy suggestions API.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import ConfigDict, Field
from typing_extensions import Annotated

from metadata.generated.schema.type import basic, entityReference, tagLabel
from metadata.ingestion.models.custom_pydantic import BaseModel


class TaskCategory(str, Enum):
    Approval = "Approval"
    DataAccess = "DataAccess"
    MetadataUpdate = "MetadataUpdate"
    Incident = "Incident"
    Review = "Review"
    Custom = "Custom"


class TaskEntityType(str, Enum):
    GlossaryApproval = "GlossaryApproval"
    RequestApproval = "RequestApproval"
    DataAccessRequest = "DataAccessRequest"
    DescriptionUpdate = "DescriptionUpdate"
    TagUpdate = "TagUpdate"
    OwnershipUpdate = "OwnershipUpdate"
    TierUpdate = "TierUpdate"
    DomainUpdate = "DomainUpdate"
    Suggestion = "Suggestion"
    TestCaseResolution = "TestCaseResolution"
    IncidentResolution = "IncidentResolution"
    PipelineReview = "PipelineReview"
    DataQualityReview = "DataQualityReview"
    CustomTask = "CustomTask"


class TaskEntityStatus(str, Enum):
    Open = "Open"
    InProgress = "InProgress"
    Pending = "Pending"
    Approved = "Approved"
    Rejected = "Rejected"
    Completed = "Completed"
    Cancelled = "Cancelled"
    Failed = "Failed"


class TaskPriority(str, Enum):
    Critical = "Critical"
    High = "High"
    Medium = "Medium"
    Low = "Low"


class TaskResolutionType(str, Enum):
    Approved = "Approved"
    Rejected = "Rejected"
    Completed = "Completed"
    Cancelled = "Cancelled"
    TimedOut = "TimedOut"
    AutoApproved = "AutoApproved"
    AutoRejected = "AutoRejected"


class TaskExternalReference(BaseModel):
    model_config = ConfigDict(extra="ignore")

    system: str
    externalId: str
    externalUrl: Optional[basic.Href] = None
    syncStatus: Optional[str] = None
    lastSyncedAt: Optional[basic.Timestamp] = None


class TaskResolution(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: Optional[TaskResolutionType] = None
    resolvedBy: Optional[entityReference.EntityReference] = None
    resolvedAt: Optional[basic.Timestamp] = None
    comment: Optional[str] = None
    newValue: Optional[str] = None


class TaskComment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: basic.Uuid
    message: str
    author: entityReference.EntityReference
    createdAt: basic.Timestamp


class TaskAvailableTransition(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    label: str
    targetStageId: str
    targetTaskStatus: TaskEntityStatus
    resolutionType: Optional[TaskResolutionType] = None
    formRef: Optional[str] = None
    requiresComment: Optional[bool] = None


class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: basic.Uuid
    taskId: Optional[str] = None
    name: Optional[basic.EntityName] = None
    displayName: Optional[str] = None
    fullyQualifiedName: Optional[basic.FullyQualifiedEntityName] = None
    description: Optional[basic.Markdown] = None
    category: TaskCategory
    type: TaskEntityType
    status: Optional[TaskEntityStatus] = None
    priority: Optional[TaskPriority] = None
    about: Optional[entityReference.EntityReference] = None
    aboutFqnHash: Optional[str] = None
    domains: Optional[List[entityReference.EntityReference]] = None
    createdBy: Optional[entityReference.EntityReference] = None
    createdById: Optional[str] = None
    assignees: Optional[List[entityReference.EntityReference]] = None
    reviewers: Optional[List[entityReference.EntityReference]] = None
    watchers: Optional[List[entityReference.EntityReference]] = None
    payload: Optional[Dict[str, Any]] = None
    dueDate: Optional[basic.Timestamp] = None
    externalReference: Optional[TaskExternalReference] = None
    tags: Optional[List[tagLabel.TagLabel]] = None
    comments: Optional[List[TaskComment]] = None
    resolution: Optional[TaskResolution] = None
    workflowDefinitionId: Optional[basic.Uuid] = None
    workflowInstanceId: Optional[basic.Uuid] = None
    workflowStageId: Optional[str] = None
    availableTransitions: Optional[List[TaskAvailableTransition]] = None
    createdAt: Optional[basic.Timestamp] = None
    updatedAt: Optional[basic.Timestamp] = None
    updatedBy: Optional[str] = None
    version: Optional[float] = None
    href: Optional[basic.Href] = None
    deleted: Optional[bool] = None


class CreateTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[basic.EntityName] = None
    displayName: Optional[str] = None
    description: Optional[basic.Markdown] = None
    category: TaskCategory
    type: TaskEntityType
    priority: Optional[TaskPriority] = None
    about: Optional[str] = None
    aboutType: Optional[str] = None
    domain: Optional[str] = None
    assignees: Optional[List[str]] = None
    reviewers: Optional[List[str]] = None
    payload: Optional[Dict[str, Any]] = None
    dueDate: Optional[basic.Timestamp] = None
    externalReference: Optional[TaskExternalReference] = None
    tags: Optional[List[tagLabel.TagLabel]] = None


class ResolveTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transitionId: Optional[str] = None
    resolutionType: Optional[TaskResolutionType] = None
    comment: Optional[str] = None
    newValue: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


class BulkTaskOperationType(str, Enum):
    Approve = "Approve"
    Reject = "Reject"
    Assign = "Assign"
    UpdatePriority = "UpdatePriority"
    Cancel = "Cancel"


class BulkTaskOperationParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    comment: Optional[str] = None
    assignees: Optional[List[str]] = None
    priority: Optional[TaskPriority] = None


class BulkTaskOperationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taskIds: Annotated[List[str], Field(min_length=1)]
    operation: BulkTaskOperationType
    params: Optional[BulkTaskOperationParams] = None


class BulkTaskOperationResultItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    taskId: Optional[str] = None
    status: Optional[str] = None
    error: Optional[str] = None


class BulkTaskOperationResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    totalRequested: Optional[int] = None
    successful: Optional[int] = None
    failed: Optional[int] = None
    results: Optional[List[BulkTaskOperationResultItem]] = None
