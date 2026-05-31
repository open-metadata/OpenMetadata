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
from typing import Any, Dict, List, Optional  # noqa: UP035

from pydantic import ConfigDict, Field
from typing_extensions import Annotated  # noqa: UP035

from metadata.generated.schema.type import basic, entityReference, tagLabel  # noqa: TC001
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
    externalId: str  # noqa: N815
    externalUrl: Optional[basic.Href] = None  # noqa: N815, UP045
    syncStatus: Optional[str] = None  # noqa: N815, UP045
    lastSyncedAt: Optional[basic.Timestamp] = None  # noqa: N815, UP045


class TaskResolution(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: Optional[TaskResolutionType] = None  # noqa: UP045
    resolvedBy: Optional[entityReference.EntityReference] = None  # noqa: N815, UP045
    resolvedAt: Optional[basic.Timestamp] = None  # noqa: N815, UP045
    comment: Optional[str] = None  # noqa: UP045
    newValue: Optional[str] = None  # noqa: N815, UP045


class TaskComment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: basic.Uuid
    message: str
    author: entityReference.EntityReference
    createdAt: basic.Timestamp  # noqa: N815


class TaskAvailableTransition(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    label: str
    targetStageId: str  # noqa: N815
    targetTaskStatus: TaskEntityStatus  # noqa: N815
    resolutionType: Optional[TaskResolutionType] = None  # noqa: N815, UP045
    formRef: Optional[str] = None  # noqa: N815, UP045
    requiresComment: Optional[bool] = None  # noqa: N815, UP045


class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: basic.Uuid
    taskId: Optional[str] = None  # noqa: N815, UP045
    name: Optional[basic.EntityName] = None  # noqa: UP045
    displayName: Optional[str] = None  # noqa: N815, UP045
    fullyQualifiedName: Optional[basic.FullyQualifiedEntityName] = None  # noqa: N815, UP045
    description: Optional[basic.Markdown] = None  # noqa: UP045
    category: TaskCategory
    type: TaskEntityType
    status: Optional[TaskEntityStatus] = None  # noqa: UP045
    priority: Optional[TaskPriority] = None  # noqa: UP045
    about: Optional[entityReference.EntityReference] = None  # noqa: UP045
    aboutFqnHash: Optional[str] = None  # noqa: N815, UP045
    domains: Optional[List[entityReference.EntityReference]] = None  # noqa: UP006, UP045
    createdBy: Optional[entityReference.EntityReference] = None  # noqa: N815, UP045
    createdById: Optional[str] = None  # noqa: N815, UP045
    assignees: Optional[List[entityReference.EntityReference]] = None  # noqa: UP006, UP045
    reviewers: Optional[List[entityReference.EntityReference]] = None  # noqa: UP006, UP045
    watchers: Optional[List[entityReference.EntityReference]] = None  # noqa: UP006, UP045
    payload: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045
    dueDate: Optional[basic.Timestamp] = None  # noqa: N815, UP045
    externalReference: Optional[TaskExternalReference] = None  # noqa: N815, UP045
    tags: Optional[List[tagLabel.TagLabel]] = None  # noqa: UP006, UP045
    comments: Optional[List[TaskComment]] = None  # noqa: UP006, UP045
    resolution: Optional[TaskResolution] = None  # noqa: UP045
    workflowDefinitionId: Optional[basic.Uuid] = None  # noqa: N815, UP045
    workflowInstanceId: Optional[basic.Uuid] = None  # noqa: N815, UP045
    workflowStageId: Optional[str] = None  # noqa: N815, UP045
    availableTransitions: Optional[List[TaskAvailableTransition]] = None  # noqa: N815, UP006, UP045
    createdAt: Optional[basic.Timestamp] = None  # noqa: N815, UP045
    updatedAt: Optional[basic.Timestamp] = None  # noqa: N815, UP045
    updatedBy: Optional[str] = None  # noqa: N815, UP045
    version: Optional[float] = None  # noqa: UP045
    href: Optional[basic.Href] = None  # noqa: UP045
    deleted: Optional[bool] = None  # noqa: UP045


class CreateTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[basic.EntityName] = None  # noqa: UP045
    displayName: Optional[str] = None  # noqa: N815, UP045
    description: Optional[basic.Markdown] = None  # noqa: UP045
    category: TaskCategory
    type: TaskEntityType
    priority: Optional[TaskPriority] = None  # noqa: UP045
    about: Optional[basic.EntityLink] = None  # noqa: UP045
    domain: Optional[str] = None  # noqa: UP045
    assignees: Optional[List[str]] = None  # noqa: UP006, UP045
    reviewers: Optional[List[str]] = None  # noqa: UP006, UP045
    payload: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045
    dueDate: Optional[basic.Timestamp] = None  # noqa: N815, UP045
    externalReference: Optional[TaskExternalReference] = None  # noqa: N815, UP045
    tags: Optional[List[tagLabel.TagLabel]] = None  # noqa: UP006, UP045


class ResolveTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transitionId: Optional[str] = None  # noqa: N815, UP045
    resolutionType: Optional[TaskResolutionType] = None  # noqa: N815, UP045
    comment: Optional[str] = None  # noqa: UP045
    newValue: Optional[str] = None  # noqa: N815, UP045
    payload: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045


class BulkTaskOperationType(str, Enum):
    Approve = "Approve"
    Reject = "Reject"
    Assign = "Assign"
    UpdatePriority = "UpdatePriority"
    Cancel = "Cancel"


class BulkTaskOperationParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    comment: Optional[str] = None  # noqa: UP045
    assignees: Optional[List[str]] = None  # noqa: UP006, UP045
    priority: Optional[TaskPriority] = None  # noqa: UP045


class BulkTaskOperationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taskIds: Annotated[List[str], Field(min_length=1)]  # noqa: N815, UP006
    operation: BulkTaskOperationType
    params: Optional[BulkTaskOperationParams] = None  # noqa: UP045


class BulkTaskOperationResultItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    taskId: Optional[str] = None  # noqa: N815, UP045
    status: Optional[str] = None  # noqa: UP045
    error: Optional[str] = None  # noqa: UP045


class BulkTaskOperationResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    totalRequested: Optional[int] = None  # noqa: N815, UP045
    successful: Optional[int] = None  # noqa: UP045
    failed: Optional[int] = None  # noqa: UP045
    results: Optional[List[BulkTaskOperationResultItem]] = None  # noqa: UP006, UP045
