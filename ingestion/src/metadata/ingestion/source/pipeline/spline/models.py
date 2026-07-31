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

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, Field


class ExecutionEvent(BaseModel):
    executionEventId: Optional[str] = None  # noqa: N815, UP045
    executionPlanId: Optional[str] = None  # noqa: N815, UP045
    applicationName: Optional[str] = None  # noqa: N815, UP045


class ExecutionEvents(BaseModel):
    items: Optional[List[ExecutionEvent]] = []  # noqa: UP006, UP045
    totalCount: Optional[int] = 0  # noqa: N815, UP045
    pageNum: Optional[int] = 0  # noqa: N815, UP045
    pageSize: Optional[int] = 0  # noqa: N815, UP045


class Inputs(BaseModel):
    source: Optional[str] = None  # noqa: UP045


class Output(BaseModel):
    source: Optional[str] = None  # noqa: UP045


class AttributesNames(BaseModel):
    id: Optional[str] = None  # noqa: UP045


class Extra(BaseModel):
    attributes: Optional[List[AttributesNames]] = []  # noqa: UP006, UP045


class ExecutionPlan(BaseModel):
    id: Optional[str] = Field(None, alias="_id")  # noqa: UP045
    name: Optional[str] = None  # noqa: UP045
    inputs: Optional[List[Inputs]] = []  # noqa: UP006, UP045
    output: Optional[Output] = None  # noqa: UP045
    extra: Optional[Extra] = None  # noqa: UP045


class ExecutionDetail(BaseModel):
    executionPlan: Optional[ExecutionPlan] = None  # noqa: N815, UP045


class ColNodes(BaseModel):
    id: Optional[str] = Field(None, alias="_id")  # noqa: UP045
    name: Optional[str] = None  # noqa: UP045


class ColLineage(BaseModel):
    source: Optional[str] = None  # noqa: UP045
    target: Optional[str] = None  # noqa: UP045


class Lineage(BaseModel):
    edges: Optional[List[ColLineage]] = []  # noqa: UP006, UP045
    nodes: Optional[List[ColNodes]] = []  # noqa: UP006, UP045


class AttributeDetail(BaseModel):
    lineage: Optional[Lineage] = None  # noqa: UP045
