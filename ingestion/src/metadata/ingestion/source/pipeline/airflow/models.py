#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Tableau Source Model module
"""

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Extra, Field


class AirflowBaseModel(BaseModel):
    """
    Tableau basic configurations
    """

    class Config:
        extra = Extra.allow
        arbitrary_types_allowed = True

    dag_id: str


class Task(BaseModel):
    pool: Optional[str]
    doc_md: Optional[str]
    inlets: Optional[List[Any]] = Field(alias="_inlets")
    task_id: str
    outlets: Optional[List[Any]] = Field(alias="_outlets")
    task_type: Optional[Any] = Field(alias="_task_type")
    downstream_task_ids: List[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]


class TaskList(BaseModel):
    __root__: List[Task]


class Dag(BaseModel):
    fileloc: str
    tags: Optional[List[str]]
    start_date: float
    _processor_dags_folder: str


class AirflowDag(BaseModel):
    dag: Optional[Dag]


class AirflowDagDetails(AirflowBaseModel):
    fileloc: str
    data: AirflowDag
    max_active_runs: Optional[int]
    description: Optional[str]
    start_date: Optional[datetime] = None
    tasks: List[Task]
    owners: Any
