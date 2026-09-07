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
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AirflowBaseModel(BaseModel):
    """
    Tableau basic configurations
    """

    model_config = ConfigDict(extra="allow", arbitrary_types_allowed=True)

    dag_id: str


class AirflowTask(BaseModel):
    pool: Optional[str] = None
    doc_md: Optional[str] = None
    inlets: Optional[List[Any]] = Field(None, alias="_inlets")
    task_id: str
    outlets: Optional[List[Any]] = Field(None, alias="_outlets")
    task_type: Optional[Any] = Field(None, alias="_task_type")
    downstream_task_ids: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    owner: Optional[str] = None

    # Allow picking up data from key `inlets` and `_inlets`
    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def lift_mapped_xlets(cls, data: Any) -> Any:
        """
        A dynamically mapped task (`.partial(...).expand(...)`) serializes its
        inlets and outlets inside `partial_kwargs` instead of at the top level.
        """
        if not isinstance(data, dict):
            return data
        partial_kwargs = data.get("partial_kwargs")
        if not isinstance(partial_kwargs, dict):
            return data
        lifted = dict(data)
        for key in ("inlets", "outlets"):
            if (
                not lifted.get(key)
                and not lifted.get(f"_{key}")
                and partial_kwargs.get(key)
            ):
                lifted[key] = partial_kwargs[key]
        return lifted


class TaskList(BaseModel):
    root: List[AirflowTask]


class Dag(BaseModel):
    fileloc: str
    tags: Optional[List[str]] = None
    start_date: Optional[float] = None
    _processor_dags_folder: str


class AirflowDag(BaseModel):
    dag: Optional[Dag] = None


class AirflowDagDetails(AirflowBaseModel):
    fileloc: str
    data: AirflowDag
    max_active_runs: Optional[int] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    tasks: List[AirflowTask]
    owner: Optional[str] = None
    state: Optional[str] = None
    schedule_interval: Optional[str] = None
