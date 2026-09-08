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
from typing import Any

from pydantic import BaseModel, Field


class DBRunSchedule(BaseModel):
    cron: str | None = Field(None, alias="quartz_cron_expression")
    timezone_id: str | None = None


class DependentTask(BaseModel):
    name: str | None = Field(None, alias="task_key")


class PipelineTask(BaseModel):
    pipeline_id: str | None = None
    full_refresh: bool | None = None


class DBTasks(BaseModel):
    name: str | None = Field(None, alias="task_key")
    description: str | None = None
    depends_on: list[DependentTask] | None = None
    run_page_url: str | None = None
    pipeline_task: PipelineTask | None = None
    notebook_task: dict[str, Any] | None = None
    spark_python_task: dict[str, Any] | None = None


class DBSettings(BaseModel):
    name: str | None = None
    timeout_seconds: int | None = 0
    max_concurrent_runs: int | None = 0
    description: str | None = None
    schedule: DBRunSchedule | None = None
    task_type: str | None = Field(None, alias="format")
    tasks: list[DBTasks] | None = None


class DataBrickPipelineDetails(BaseModel):
    job_id: int | None = None
    pipeline_id: str | None = None
    creator_user_name: str | None = None
    settings: DBSettings | None = None
    created_time: int | None = None
    name: str | None = None
    pipeline_type: str | None = None

    @property
    def id(self) -> str:
        return str(self.pipeline_id) if self.pipeline_id else str(self.job_id)


class DBRunState(BaseModel):
    life_cycle_state: str | None = None
    result_state: str | None = None
    state_message: str | None = None
    queue_reason: str | None = None


class DBRun(BaseModel):
    job_id: int
    run_id: int
    name: str | None = Field(None, alias="run_name")
    creator_user_name: str | None = None
    state: DBRunState | None = None
    schedule: DBRunSchedule | None = None
    description: str | None = None
    tasks: list[DBTasks] | None = None
    run_type: str | None = None
    start_time: int | None = 0
    end_time: int | None = 0
    run_page_url: str | None = None


@dataclass
class KafkaSourceConfig:
    """Kafka source configuration read out of a DLT pipeline's source code"""

    bootstrap_servers: str | None = None
    topics: list[str] = field(default_factory=list)
    group_id_prefix: str | None = None


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
    is_directory: bool | None = False


@dataclass
class DLTTableReference:
    """
    Where a DLT dataset reference points, once resolved.

    A reference is written either bare (`orders`, a sibling dataset in the same
    pipeline) or qualified (`catalog.schema.orders`). Both forms resolve into
    these three named parts, so callers never index into a positional tuple.
    """

    catalog: str | None
    schema: str | None
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
    depends_on: list[str] = field(default_factory=list)
    reads_from_kafka: bool = False
    reads_from_s3: bool = False
    s3_locations: list[str] = field(default_factory=list)
