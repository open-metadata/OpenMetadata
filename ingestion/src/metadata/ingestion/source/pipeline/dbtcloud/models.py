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

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, Field


class DBTSchedule(BaseModel):
    cron: Optional[str] = None  # noqa: UP045


class DBTJob(BaseModel):
    id: int
    name: str
    description: Optional[str] = None  # noqa: UP045
    created_at: str
    updated_at: Optional[str] = None  # noqa: UP045
    state: int
    job_type: Optional[str] = None  # noqa: UP045
    schedule: Optional[DBTSchedule] = None  # noqa: UP045
    project_id: int
    environment_id: Optional[int] = None  # noqa: UP045


class Pagination(BaseModel):
    count: int
    total_count: int


class Extra(BaseModel):
    pagination: Optional[Pagination] = None  # noqa: UP045


class DBTJobList(BaseModel):
    Jobs: List[DBTJob] = Field(alias="data")  # noqa: UP006
    extra: Optional[Extra] = None  # noqa: UP045


class DBTRun(BaseModel):
    id: Optional[int] = None  # noqa: UP045
    status: int
    status_message: Optional[str] = None  # noqa: UP045
    state: Optional[str] = Field(None, alias="status_humanized")  # noqa: UP045
    href: Optional[str] = None  # noqa: UP045
    started_at: Optional[str] = None  # noqa: UP045
    finished_at: Optional[str] = None  # noqa: UP045
    duration: Optional[str] = None  # noqa: UP045


class DBTRunList(BaseModel):
    Runs: Optional[List[DBTRun]] = Field([], alias="data")  # noqa: UP006, UP045
    extra: Optional[Extra] = None  # noqa: UP045


class DBTSources(BaseModel):
    uniqueId: Optional[str] = None  # noqa: N815, UP045
    name: Optional[str] = None  # noqa: UP045
    dbtschema: Optional[str] = Field(None, alias="schema")  # noqa: UP045
    database: Optional[str] = None  # noqa: UP045
    runGeneratedAt: Optional[str] = None  # noqa: N815, UP045
    extra: Optional[Extra] = None  # noqa: UP045


class DBTModel(BaseModel):
    uniqueId: Optional[str] = None  # noqa: N815, UP045
    name: Optional[str] = None  # noqa: UP045
    dbtschema: Optional[str] = Field(None, alias="schema")  # noqa: UP045
    database: Optional[str] = None  # noqa: UP045
    runGeneratedAt: Optional[str] = None  # noqa: N815, UP045
    dependsOn: Optional[List[str]] = None  # noqa: N815, UP006, UP045
    compiledCode: Optional[str] = None  # noqa: N815, UP045


class DBTModelList(BaseModel):
    models: Optional[List[DBTModel]] = []  # noqa: UP006, UP045
    seeds: Optional[List[DBTModel]] = []  # noqa: UP006, UP045
    sources: Optional[List[DBTModel]] = []  # noqa: UP006, UP045
    extra: Optional[Extra] = None  # noqa: UP045
