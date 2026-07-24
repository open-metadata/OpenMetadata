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
Tableau Source Model module
"""

from datetime import datetime
from typing import Any, List, Optional  # noqa: UP035

from pydantic import BaseModel, ConfigDict, Field


class AirflowBaseModel(BaseModel):
    """
    Tableau basic configurations
    """

    model_config = ConfigDict(extra="allow", arbitrary_types_allowed=True)

    dag_id: str


class AirflowTask(BaseModel):
    pool: Optional[str] = None  # noqa: UP045
    doc_md: Optional[str] = None  # noqa: UP045
    inlets: Optional[List[Any]] = Field(None, alias="_inlets")  # noqa: UP006, UP045
    task_id: str
    outlets: Optional[List[Any]] = Field(None, alias="_outlets")  # noqa: UP006, UP045
    task_type: Optional[Any] = Field(None, alias="_task_type")  # noqa: UP045
    downstream_task_ids: Optional[List[str]] = None  # noqa: UP006, UP045
    start_date: Optional[datetime] = None  # noqa: UP045
    end_date: Optional[datetime] = None  # noqa: UP045
    owner: Optional[str] = None  # noqa: UP045

    # Allow picking up data from key `inlets` and `_inlets`
    model_config = ConfigDict(populate_by_name=True)


class TaskList(BaseModel):
    root: List[AirflowTask]  # noqa: UP006


class Dag(BaseModel):
    fileloc: str
    tags: Optional[List[str]] = None  # noqa: UP006, UP045
    start_date: Optional[float] = None  # noqa: UP045
    _processor_dags_folder: str


class AirflowDag(BaseModel):
    dag: Optional[Dag] = None  # noqa: UP045


class AirflowDagDetails(AirflowBaseModel):
    fileloc: str
    data: AirflowDag
    max_active_runs: Optional[int] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    start_date: Optional[datetime] = None  # noqa: UP045
    tasks: List[AirflowTask]  # noqa: UP006
    owner: Optional[str] = None  # noqa: UP045
    state: Optional[str] = None  # noqa: UP045
    schedule_interval: Optional[str] = None  # noqa: UP045
