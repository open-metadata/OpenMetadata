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
Typed models for the Prefect REST API responses. ``PrefectClient`` validates
every response into these at the fetch boundary, so ``metadata.py`` works
with attributes instead of ``dict.get()``/``[...]`` chains on raw JSON.
"""

from pydantic import BaseModel


class PrefectFlow(BaseModel):
    id: str
    name: str


class PrefectState(BaseModel):
    type: str | None = None


class PrefectFlowRun(BaseModel):
    id: str
    state_type: str | None = None
    state: PrefectState | None = None
    start_time: str | None = None
    expected_start_time: str | None = None
    end_time: str | None = None


class TaskInputRef(BaseModel):
    id: str | None = None


class PrefectTaskRun(BaseModel):
    id: str
    flow_run_id: str
    task_key: str | None = None
    name: str | None = None
    tags: list[str] = []
    task_inputs: dict[str, list[TaskInputRef]] = {}
    state_type: str | None = None
    start_time: str | None = None
    expected_start_time: str | None = None
    end_time: str | None = None


class PrefectScheduleDetail(BaseModel):
    cron: str | None = None
    interval: float | None = None
    rrule: str | None = None


class PrefectDeploymentSchedule(BaseModel):
    active: bool = True
    schedule: PrefectScheduleDetail | None = None


class PrefectDeployment(BaseModel):
    tags: list[str] = []
    schedules: list[PrefectDeploymentSchedule] = []


class AssetMaterialization(BaseModel):
    asset_key: str | None = None
    upstream_assets: list[str] = []
