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
from typing import Dict, List, Optional  # noqa: UP035

from pydantic import BaseModel, ConfigDict


class AirflowApiTask(BaseModel):
    model_config = ConfigDict(extra="allow")

    task_id: str
    downstream_task_ids: Optional[List[str]] = None  # noqa: UP006, UP045
    owner: Optional[str] = None  # noqa: UP045
    doc_md: Optional[str] = None  # noqa: UP045
    start_date: Optional[str] = None  # noqa: UP045
    end_date: Optional[str] = None  # noqa: UP045
    class_ref: Optional[Dict[str, str]] = None  # noqa: UP006, UP045


class AirflowApiDagDetails(BaseModel):
    model_config = ConfigDict(extra="allow")

    dag_id: str
    description: Optional[str] = None  # noqa: UP045
    fileloc: Optional[str] = None  # noqa: UP045
    is_paused: Optional[bool] = None  # noqa: UP045
    owners: Optional[List[str]] = None  # noqa: UP006, UP045
    tags: Optional[List[str]] = None  # noqa: UP006, UP045
    schedule_interval: Optional[str] = None  # noqa: UP045
    max_active_runs: Optional[int] = None  # noqa: UP045
    start_date: Optional[datetime] = None  # noqa: UP045
    tasks: List[AirflowApiTask] = []  # noqa: UP006


class AirflowApiDagRun(BaseModel):
    model_config = ConfigDict(extra="allow")

    dag_run_id: str
    state: Optional[str] = None  # noqa: UP045
    execution_date: Optional[datetime] = None  # noqa: UP045
    start_date: Optional[datetime] = None  # noqa: UP045
    end_date: Optional[datetime] = None  # noqa: UP045


class AirflowApiTaskInstance(BaseModel):
    model_config = ConfigDict(extra="allow")

    task_id: str
    state: Optional[str] = None  # noqa: UP045
    start_date: Optional[datetime] = None  # noqa: UP045
    end_date: Optional[datetime] = None  # noqa: UP045
