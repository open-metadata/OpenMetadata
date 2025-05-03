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
from typing import List, Optional

from pydantic import BaseModel, Field


class ExecutionEvent(BaseModel):
    executionEventId: Optional[str] = None
    executionPlanId: Optional[str] = None
    applicationName: Optional[str] = None


class ExecutionEvents(BaseModel):
    items: Optional[List[ExecutionEvent]] = []
    totalCount: Optional[int] = 0
    pageNum: Optional[int] = 0
    pageSize: Optional[int] = 0


class Inputs(BaseModel):
    source: Optional[str] = None


class Output(BaseModel):
    source: Optional[str] = None


class AttributesNames(BaseModel):
    id: Optional[str] = None


class Extra(BaseModel):
    attributes: Optional[List[AttributesNames]] = []


class ExecutionPlan(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: Optional[str] = None
    inputs: Optional[List[Inputs]] = []
    output: Optional[Output] = None
    extra: Optional[Extra] = None


class ExecutionDetail(BaseModel):
    executionPlan: Optional[ExecutionPlan] = None


class ColNodes(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: Optional[str] = None


class ColLineage(BaseModel):
    source: Optional[str] = None
    target: Optional[str] = None


class Lineage(BaseModel):
    edges: Optional[List[ColLineage]] = []
    nodes: Optional[List[ColNodes]] = []


class AttributeDetail(BaseModel):
    lineage: Optional[Lineage] = None
