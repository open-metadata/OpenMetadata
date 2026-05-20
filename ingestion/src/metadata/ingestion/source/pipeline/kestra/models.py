#  Copyright 2025 Collate
#  Licensed under the Collate License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Pydantic models for Kestra REST API responses.
"""
from typing import List, Optional

from pydantic import BaseModel


class KestraTask(BaseModel):
    """Represents a single task step within a Kestra Flow."""

    id: str
    type: Optional[str] = None


class KestraExecutionState(BaseModel):
    """Represents the state of a Kestra Execution."""

    # e.g. "SUCCESS", "FAILED", "RUNNING", "CREATED", "PAUSED",
    # "QUEUED", "RESTARTED", "KILLING", "KILLED", "WARNING"
    current: str


class KestraLabel(BaseModel):
    """
    Represents a single Kestra flow label.

    The Kestra REST API returns labels as a list of {"key": ..., "value": ...}
    objects, NOT as a flat dict. This model captures that structure.
    Use KestraFlow.get_labels_dict() to convert to a key→value mapping.
    """

    key: str
    value: str


class KestraFlow(BaseModel):
    """Represents a Kestra Flow (pipeline definition)."""

    id: str
    namespace: str
    description: Optional[str] = None
    # Kestra API returns labels as a list of {key, value} objects.
    # Use get_labels_dict() to access them as a flat mapping.
    labels: Optional[List[KestraLabel]] = None
    tasks: Optional[List[KestraTask]] = None

    def get_labels_dict(self) -> dict:
        """Return labels as a flat {key: value} dict for easy lookup."""
        return {lbl.key: lbl.value for lbl in (self.labels or [])}


class KestraFlowList(BaseModel):
    """Wraps a paginated /flows/search API response."""

    results: List[KestraFlow] = []
    total: Optional[int] = None


class KestraExecution(BaseModel):
    """Represents a single execution (run) of a Kestra Flow."""

    id: str
    namespace: str
    flowId: str
    state: KestraExecutionState
    startDate: Optional[str] = None  # ISO 8601 string
    endDate: Optional[str] = None  # ISO 8601 string


class KestraExecutionList(BaseModel):
    """Wraps a paginated /executions API response."""

    results: List[KestraExecution] = []
    total: Optional[int] = None
