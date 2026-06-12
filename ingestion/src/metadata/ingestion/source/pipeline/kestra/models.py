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
Pydantic models for Kestra REST payloads consumed by the connector.
"""

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class KestraLabel(BaseModel):
    model_config = ConfigDict(extra="allow")

    key: str
    value: Optional[str] = None


class KestraTrigger(BaseModel):
    """A trigger on a flow: schedule, webhook, or flow-of-flow."""

    model_config = ConfigDict(extra="allow")

    id: str
    type: str
    cron: Optional[str] = None
    conditions: Optional[List[dict]] = None


class KestraTask(BaseModel):
    """A task as it appears nested in flow.tasks[] (includes flowable children)."""

    model_config = ConfigDict(extra="allow")

    id: str
    type: str
    description: Optional[str] = None
    tasks: Optional[List["KestraTask"]] = None
    then: Optional[List["KestraTask"]] = None
    else_: Optional[List["KestraTask"]] = Field(default=None, alias="else")


class KestraFlow(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    namespace: str
    revision: Optional[int] = None
    description: Optional[str] = None
    labels: Optional[List[KestraLabel]] = None
    disabled: Optional[bool] = False
    tasks: List[KestraTask] = Field(default_factory=list)
    triggers: Optional[List[KestraTrigger]] = None


class KestraGraphTask(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: Optional[str] = None
    type: Optional[str] = None


class KestraGraphNode(BaseModel):
    """Node in the /graph endpoint."""

    model_config = ConfigDict(extra="allow")

    uid: str
    type: Optional[str] = None
    task: Optional[KestraGraphTask] = None


class KestraGraphEdge(BaseModel):
    model_config = ConfigDict(extra="allow")

    source: str
    target: str
    relation: Optional[dict] = None


class KestraGraph(BaseModel):
    model_config = ConfigDict(extra="allow")

    nodes: List[KestraGraphNode] = Field(default_factory=list)
    edges: List[KestraGraphEdge] = Field(default_factory=list)


class KestraTaskRunState(BaseModel):
    model_config = ConfigDict(extra="allow")

    current: str
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None


class KestraTaskRun(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    taskId: str
    state: KestraTaskRunState
    timestamp: Optional[datetime] = None
    attempts: Optional[List[dict]] = None


class KestraExecution(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    namespace: str
    flowId: str
    flowRevision: Optional[int] = None
    state: KestraTaskRunState
    taskRunList: Optional[List[KestraTaskRun]] = None


class KestraSearchResult(BaseModel):
    """Generic envelope used by all /search endpoints."""

    model_config = ConfigDict(extra="allow")

    results: List[Any] = Field(default_factory=list)
    total: int = 0


KestraTask.model_rebuild()
