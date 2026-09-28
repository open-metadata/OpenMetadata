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

from pydantic import BaseModel, ConfigDict, Field


class AliasedModel(BaseModel):
    """
    Base for the models whose dbt Cloud payload keys collide with Python names.
    Without `populate_by_name` the aliased fields can only be populated by their
    API key, so constructing an instance with the Python field name silently
    leaves the field as None.
    """

    model_config = ConfigDict(populate_by_name=True)


class DBTSchedule(BaseModel):
    cron: str | None = None


class DBTJob(BaseModel):
    id: int
    name: str
    description: str | None = None
    created_at: str
    updated_at: str | None = None
    state: int
    job_type: str | None = None
    schedule: DBTSchedule | None = None
    project_id: int
    environment_id: int | None = None


class Pagination(BaseModel):
    count: int
    total_count: int


class Extra(BaseModel):
    pagination: Pagination | None = None


class DBTJobList(AliasedModel):
    Jobs: list[DBTJob] = Field(alias="data")
    extra: Extra | None = None


class DBTRun(AliasedModel):
    id: int | None = None
    status: int
    status_message: str | None = None
    state: str | None = Field(None, alias="status_humanized")
    href: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    duration: str | None = None


class DBTRunList(AliasedModel):
    Runs: list[DBTRun] | None = Field([], alias="data")
    extra: Extra | None = None


class DBTSources(AliasedModel):
    uniqueId: str | None = None  # noqa: N815
    name: str | None = None
    dbtschema: str | None = Field(None, alias="schema")
    database: str | None = None
    runGeneratedAt: str | None = None  # noqa: N815
    extra: Extra | None = None


class DBTModel(AliasedModel):
    uniqueId: str | None = None  # noqa: N815
    name: str | None = None
    dbtschema: str | None = Field(None, alias="schema")
    database: str | None = None
    runGeneratedAt: str | None = None  # noqa: N815
    dependsOn: list[str] | None = None  # noqa: N815
    compiledCode: str | None = None  # noqa: N815


class DBTModelList(BaseModel):
    models: list[DBTModel] | None = []
    seeds: list[DBTModel] | None = []
    sources: list[DBTModel] | None = []
    extra: Extra | None = None
