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
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class AirflowApiTask(BaseModel):
    model_config = ConfigDict(extra="allow")

    task_id: str
    downstream_task_ids: Optional[List[str]] = None
    owner: Optional[str] = None
    doc_md: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    class_ref: Optional[Dict[str, str]] = None


class AirflowApiDagDetails(BaseModel):
    model_config = ConfigDict(extra="allow")

    dag_id: str
    description: Optional[str] = None
    fileloc: Optional[str] = None
    is_paused: Optional[bool] = None
    owners: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    schedule_interval: Optional[str] = None
    max_active_runs: Optional[int] = None
    start_date: Optional[datetime] = None
    tasks: List[AirflowApiTask] = []


class AirflowApiDagRun(BaseModel):
    model_config = ConfigDict(extra="allow")

    dag_run_id: str
    state: Optional[str] = None
    execution_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class AirflowApiTaskInstance(BaseModel):
    model_config = ConfigDict(extra="allow")

    task_id: str
    state: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
