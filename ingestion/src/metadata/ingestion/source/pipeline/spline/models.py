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
Spline connector API response models
"""

from pydantic import BaseModel, Field


class ExecutionEvent(BaseModel):
    executionEventId: str | None = None  # noqa: N815
    executionPlanId: str | None = None  # noqa: N815
    applicationName: str | None = None  # noqa: N815


class ExecutionEvents(BaseModel):
    items: list[ExecutionEvent] | None = []
    totalCount: int | None = 0  # noqa: N815
    pageNum: int | None = 0  # noqa: N815
    pageSize: int | None = 0  # noqa: N815


class Inputs(BaseModel):
    source: str | None = None


class Output(BaseModel):
    source: str | None = None


class AttributesNames(BaseModel):
    id: str | None = None


class Extra(BaseModel):
    attributes: list[AttributesNames] | None = []


class ExecutionPlan(BaseModel):
    id: str | None = Field(None, alias="_id")
    name: str | None = None
    inputs: list[Inputs] | None = []
    output: Output | None = None
    extra: Extra | None = None


class ExecutionDetail(BaseModel):
    executionPlan: ExecutionPlan | None = None  # noqa: N815


class ColNodes(BaseModel):
    id: str | None = Field(None, alias="_id")
    name: str | None = None


class ColLineage(BaseModel):
    source: str | None = None
    target: str | None = None


class Lineage(BaseModel):
    edges: list[ColLineage] | None = []
    nodes: list[ColNodes] | None = []


class AttributeDetail(BaseModel):
    lineage: Lineage | None = None
