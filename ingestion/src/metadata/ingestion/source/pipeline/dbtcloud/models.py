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
DBTCloud Source Model module
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class DBTSchedule(BaseModel):
    cron: Optional[str] = None


class DBTJob(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    state: int
    job_type: Optional[str] = None
    schedule: Optional[DBTSchedule] = None
    project_id: int


class Pagination(BaseModel):
    count: int
    total_count: int


class Extra(BaseModel):
    pagination: Optional[Pagination] = None


class DBTJobList(BaseModel):
    Jobs: List[DBTJob] = Field(alias="data")
    extra: Optional[Extra] = None


class DBTRun(BaseModel):
    id: Optional[int] = None
    status: int
    status_message: Optional[str] = None
    state: Optional[str] = Field(None, alias="status_humanized")
    href: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration: Optional[str] = None


class DBTRunList(BaseModel):
    Runs: Optional[List[DBTRun]] = Field([], alias="data")
    extra: Optional[Extra] = None


class DBTSources(BaseModel):
    name: Optional[str] = None
    dbtschema: Optional[str] = Field(None, alias="schema")
    database: Optional[str] = None
    extra: Optional[Extra] = None


class DBTModel(BaseModel):
    uniqueId: Optional[str] = None
    name: Optional[str] = None
    dbtschema: Optional[str] = Field(None, alias="schema")
    database: Optional[str] = None
    dependsOn: Optional[List[str]] = None


class DBTModelList(BaseModel):
    models: Optional[List[DBTModel]] = []
    seeds: Optional[List[DBTModel]] = []
    extra: Optional[Extra] = None
