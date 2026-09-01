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

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional  # noqa: UP035

from pydantic import BaseModel, Field


class DBRunSchedule(BaseModel):
    cron: Optional[str] = Field(None, alias="quartz_cron_expression")  # noqa: UP045
    timezone_id: Optional[str] = None  # noqa: UP045


class DependentTask(BaseModel):
    name: Optional[str] = Field(None, alias="task_key")  # noqa: UP045


class PipelineTask(BaseModel):
    pipeline_id: Optional[str] = None  # noqa: UP045
    full_refresh: Optional[bool] = None  # noqa: UP045


class DBTasks(BaseModel):
    name: Optional[str] = Field(None, alias="task_key")  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    depends_on: Optional[List[DependentTask]] = None  # noqa: UP006, UP045
    run_page_url: Optional[str] = None  # noqa: UP045
    pipeline_task: Optional[PipelineTask] = None  # noqa: UP045
    notebook_task: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045
    spark_python_task: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045


class DBSettings(BaseModel):
    name: Optional[str] = None  # noqa: UP045
    timeout_seconds: Optional[int] = 0  # noqa: UP045
    max_concurrent_runs: Optional[int] = 0  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    schedule: Optional[DBRunSchedule] = None  # noqa: UP045
    task_type: Optional[str] = Field(None, alias="format")  # noqa: UP045
    tasks: Optional[List[DBTasks]] = None  # noqa: UP006, UP045


class DataBrickPipelineDetails(BaseModel):
    job_id: Optional[int] = None  # noqa: UP045
    pipeline_id: Optional[str] = None  # noqa: UP045
    creator_user_name: Optional[str] = None  # noqa: UP045
    settings: Optional[DBSettings] = None  # noqa: UP045
    created_time: Optional[int] = None  # noqa: UP045
    name: Optional[str] = None  # noqa: UP045
    pipeline_type: Optional[str] = None  # noqa: UP045

    @property
    def id(self) -> str:
        return str(self.pipeline_id) if self.pipeline_id else str(self.job_id)


class DBRunState(BaseModel):
    life_cycle_state: Optional[str] = None  # noqa: UP045
    result_state: Optional[str] = None  # noqa: UP045
    state_message: Optional[str] = None  # noqa: UP045
    queue_reason: Optional[str] = None  # noqa: UP045


class DBRun(BaseModel):
    job_id: int
    run_id: int
    name: Optional[str] = Field(None, alias="run_name")  # noqa: UP045
    creator_user_name: Optional[str] = None  # noqa: UP045
    state: Optional[DBRunState] = None  # noqa: UP045
    schedule: Optional[DBRunSchedule] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    tasks: Optional[List[DBTasks]] = None  # noqa: UP006, UP045
    run_type: Optional[str] = None  # noqa: UP045
    start_time: Optional[int] = 0  # noqa: UP045
    end_time: Optional[int] = 0  # noqa: UP045
    run_page_url: Optional[str] = None  # noqa: UP045


@dataclass
class KafkaSourceConfig:
    """Kafka source configuration read out of a DLT pipeline's source code"""

    bootstrap_servers: Optional[str] = None  # noqa: UP045
    topics: List[str] = field(default_factory=list)  # noqa: UP006
    group_id_prefix: Optional[str] = None  # noqa: UP045


@dataclass
class DLTLibrarySource:
    """
    One source location a DLT pipeline declares in `spec.libraries`.

    A library is either a concrete file or a directory to expand. The pipelines
    API accepts nothing else, so there is no pattern to carry and a directory is
    always taken in full.
    """

    path: str
    # True and False come from the spec. None means it did not say, which happens
    # for an include carrying neither a `**` nor a trailing slash, and is settled
    # by listing the path rather than by guessing from its shape.
    is_directory: Optional[bool] = False  # noqa: UP045


@dataclass
class DLTTableReference:
    """
    Where a DLT dataset reference points, once resolved.

    A reference is written either bare (`orders`, a sibling dataset in the same
    pipeline) or qualified (`catalog.schema.orders`). Both forms resolve into
    these three named parts, so callers never index into a positional tuple.
    """

    catalog: Optional[str]  # noqa: UP045
    schema: Optional[str]  # noqa: UP045
    table: str


@dataclass
class DLTTableDependency:
    """
    One dataset declared by a DLT pipeline, plus what it reads from.

    `depends_on` entries are returned exactly as the pipeline source spells them.
    A bare name is a sibling dataset in the same pipeline and gets resolved against
    the pipeline's target catalog and schema. A qualified name already says where
    the table lives and is resolved as written.
    """

    table_name: str
    depends_on: List[str] = field(default_factory=list)  # noqa: UP006
    reads_from_kafka: bool = False
    reads_from_s3: bool = False
    s3_locations: List[str] = field(default_factory=list)  # noqa: UP006
