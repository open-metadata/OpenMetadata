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
from typing import List, Optional

from pydantic import BaseModel, Extra


class AirflowBaseModel(BaseModel):
    """
    Tableau basic configurations
    """

    class Config:
        extra = Extra.allow
        arbitrary_types_allowed = True

    dag_id: str


class DagTask(BaseModel):
    doc_md: Optional[str]
    downstream_task_ids: List[str]
    task_id: str
    _task_type: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class Dag(BaseModel):
    fileloc: str
    tags: Optional[List[str]]
    start_date: float
    _processor_dags_folder: str
    tasks: List[DagTask]


class AirflowDag(BaseModel):
    dag: Optional[Dag]


class AirflowDagDetials(AirflowBaseModel):
    fileloc: str
    data: AirflowDag
    max_active_runs: int
    description: Optional[str]
    start_date: Optional[datetime] = None
    tasks: List[DagTask]


class DagModel:
    dag: Optional[List[AirflowDagDetials]] = []
