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
Databricks pipeline Source Model module
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class DBRunSchedule(BaseModel):
    cron: Optional[str] = Field(None, alias="quartz_cron_expression")
    timezone_id: Optional[str] = None


class DependentTask(BaseModel):
    name: Optional[str] = Field(None, alias="task_key")


class DBTasks(BaseModel):
    name: Optional[str] = Field(None, alias="task_key")
    description: Optional[str] = None
    depends_on: Optional[List[DependentTask]] = None
    run_page_url: Optional[str] = None


class DBSettings(BaseModel):
    name: Optional[str] = None
    timeout_seconds: Optional[int] = 0
    max_concurrent_runs: Optional[int] = 0
    description: Optional[str] = None
    schedule: Optional[DBRunSchedule] = None
    task_type: Optional[str] = Field(None, alias="format")


class DataBrickPipelineDetails(BaseModel):
    job_id: int
    creator_user_name: Optional[str] = None
    settings: Optional[DBSettings] = None
    created_time: int


class DBRunState(BaseModel):
    life_cycle_state: Optional[str] = None
    result_state: Optional[str] = None
    state_message: Optional[str] = None
    queue_reason: Optional[str] = None


class DBRun(BaseModel):
    job_id: int
    run_id: int
    name: Optional[str] = Field(None, alias="run_name")
    creator_user_name: Optional[str] = None
    state: Optional[DBRunState] = None
    schedule: Optional[DBRunSchedule] = None
    description: Optional[str] = None
    tasks: Optional[List[DBTasks]] = None
    run_type: Optional[str] = None
    start_time: Optional[int] = 0
    end_time: Optional[int] = 0
    run_page_url: Optional[str] = None
