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
from typing import Annotated, Any

from pydantic import ConfigDict, Field

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
    RecognizerFeedbackApproval = "RecognizerFeedbackApproval"
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
    externalUrl: basic.Href | None = None  # noqa: N815
    syncStatus: str | None = None  # noqa: N815
    lastSyncedAt: basic.Timestamp | None = None  # noqa: N815


class TaskResolution(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: TaskResolutionType | None = None
    resolvedBy: entityReference.EntityReference | None = None  # noqa: N815
    resolvedAt: basic.Timestamp | None = None  # noqa: N815
    comment: str | None = None
    newValue: str | None = None  # noqa: N815


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
    resolutionType: TaskResolutionType | None = None  # noqa: N815
    formRef: str | None = None  # noqa: N815
    requiresComment: bool | None = None  # noqa: N815


class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: basic.Uuid
    taskId: str | None = None  # noqa: N815
    name: basic.EntityName | None = None
    displayName: str | None = None  # noqa: N815
    fullyQualifiedName: basic.FullyQualifiedEntityName | None = None  # noqa: N815
    description: basic.Markdown | None = None
    category: TaskCategory
    type: TaskEntityType
    status: TaskEntityStatus | None = None
    priority: TaskPriority | None = None
    about: entityReference.EntityReference | None = None
    aboutFqnHash: str | None = None  # noqa: N815
    domains: list[entityReference.EntityReference] | None = None
    createdBy: entityReference.EntityReference | None = None  # noqa: N815
    createdById: str | None = None  # noqa: N815
    assignees: list[entityReference.EntityReference] | None = None
    reviewers: list[entityReference.EntityReference] | None = None
    watchers: list[entityReference.EntityReference] | None = None
    payload: dict[str, Any] | None = None
    dueDate: basic.Timestamp | None = None  # noqa: N815
    externalReference: TaskExternalReference | None = None  # noqa: N815
    tags: list[tagLabel.TagLabel] | None = None
    comments: list[TaskComment] | None = None
    resolution: TaskResolution | None = None
    workflowDefinitionId: basic.Uuid | None = None  # noqa: N815
    workflowInstanceId: basic.Uuid | None = None  # noqa: N815
    workflowStageId: str | None = None  # noqa: N815
    availableTransitions: list[TaskAvailableTransition] | None = None  # noqa: N815
    createdAt: basic.Timestamp | None = None  # noqa: N815
    updatedAt: basic.Timestamp | None = None  # noqa: N815
    updatedBy: str | None = None  # noqa: N815
    version: float | None = None
    href: basic.Href | None = None
    deleted: bool | None = None


class CreateTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: basic.EntityName | None = None
    displayName: str | None = None  # noqa: N815
    description: basic.Markdown | None = None
    category: TaskCategory
    type: TaskEntityType
    priority: TaskPriority | None = None
    about: basic.EntityLink | None = None
    domain: str | None = None
    assignees: list[str] | None = None
    reviewers: list[str] | None = None
    payload: dict[str, Any] | None = None
    dueDate: basic.Timestamp | None = None  # noqa: N815
    externalReference: TaskExternalReference | None = None  # noqa: N815
    tags: list[tagLabel.TagLabel] | None = None


class ResolveTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transitionId: str | None = None  # noqa: N815
    resolutionType: TaskResolutionType | None = None  # noqa: N815
    comment: str | None = None
    newValue: str | None = None  # noqa: N815
    payload: dict[str, Any] | None = None


class BulkTaskOperationType(str, Enum):
    Approve = "Approve"
    Reject = "Reject"
    Assign = "Assign"
    UpdatePriority = "UpdatePriority"
    Cancel = "Cancel"


class BulkTaskOperationParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    comment: str | None = None
    assignees: list[str] | None = None
    priority: TaskPriority | None = None


class BulkTaskOperationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taskIds: Annotated[list[str], Field(min_length=1)]  # noqa: N815
    operation: BulkTaskOperationType
    params: BulkTaskOperationParams | None = None


class BulkTaskOperationResultItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    taskId: str | None = None  # noqa: N815
    status: str | None = None
    error: str | None = None


class BulkTaskOperationResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    totalRequested: int | None = None  # noqa: N815
    successful: int | None = None
    failed: int | None = None
    results: list[BulkTaskOperationResultItem] | None = None
