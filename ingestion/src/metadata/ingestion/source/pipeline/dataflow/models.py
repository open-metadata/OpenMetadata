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
Dataflow models
"""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DataflowJob(BaseModel):
    """Dataflow job details"""

    id: str
    name: str
    project_id: str
    location: str
    current_state: str
    type: str
    create_time: Optional[str] = None
    start_time: Optional[str] = None
    labels: Optional[Dict[str, str]] = None


class DataflowStep(BaseModel):
    """Dataflow pipeline step"""

    name: str
    kind: str
    properties: Optional[Dict[str, Any]] = Field(default_factory=dict)


class DataflowIO(BaseModel):
    """Dataflow input/output details"""

    type: str
    table: Optional[str] = None
    dataset: Optional[str] = None
    project: Optional[str] = None
    bucket: Optional[str] = None
    path: Optional[str] = None
    paths: Optional[List[str]] = None


class DataflowLineage(BaseModel):
    """Dataflow lineage information"""

    sources: List[DataflowIO] = Field(default_factory=list)
    sinks: List[DataflowIO] = Field(default_factory=list)
