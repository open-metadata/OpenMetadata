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
Pydantic models for Airflow REST API responses
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AirflowApiTask(BaseModel):
    model_config = ConfigDict(extra="allow")

    task_id: str
    downstream_task_ids: list[str] | None = None
    owner: str | None = None
    doc_md: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    class_ref: dict[str, str] | None = None


class AirflowApiDagDetails(BaseModel):
    model_config = ConfigDict(extra="allow")

    dag_id: str
    description: str | None = None
    fileloc: str | None = None
    is_paused: bool | None = None
    owners: list[str] | None = None
    tags: list[str] | None = None
    schedule_interval: str | None = None
    max_active_runs: int | None = None
    start_date: datetime | None = None
    tasks: list[AirflowApiTask] = []


class AirflowApiDagRun(BaseModel):
    model_config = ConfigDict(extra="allow")

    dag_run_id: str
    state: str | None = None
    execution_date: datetime | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class AirflowApiTaskInstance(BaseModel):
    model_config = ConfigDict(extra="allow")

    task_id: str
    state: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
