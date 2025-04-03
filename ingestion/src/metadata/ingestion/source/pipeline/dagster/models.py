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

from typing import List, Optional

from pydantic import BaseModel

# Models for get_task_runs


class RunStepStats(BaseModel):
    runId: str
    startTime: Optional[float] = None
    endTime: Optional[float] = None
    status: Optional[str] = None


class SolidStepStatsConnection(BaseModel):
    nodes: Optional[List[RunStepStats]] = None


class TaskSolidHandle(BaseModel):
    stepStats: Optional[SolidStepStatsConnection] = None


class DagsterPipeline(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    solidHandle: Optional[TaskSolidHandle] = None


class PipelineOrErrorModel(BaseModel):
    pipelineOrError: DagsterPipeline


# Models for get_run_list
class DagsterLocation(BaseModel):
    id: str
    name: str


class Node(BaseModel):
    id: str
    name: str
    location: Optional[DagsterLocation] = None
    pipelines: List[DagsterPipeline]


class RepositoryConnection(BaseModel):
    nodes: List[Node]


class RepositoriesOrErrorModel(BaseModel):
    repositoriesOrError: RepositoryConnection


# Models for get_jobs
class SolidName(BaseModel):
    name: str


class DependsOnSolid(BaseModel):
    solid: Optional[SolidName] = None


class SolidInput(BaseModel):
    dependsOn: Optional[List[DependsOnSolid]] = None


class Solid(BaseModel):
    name: str
    inputs: Optional[List[SolidInput]] = None


class SolidHandle(BaseModel):
    handleID: str
    solid: Optional[Solid] = None


class GraphOrError(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    solidHandles: Optional[List[SolidHandle]] = None


class GraphOrErrorModel(BaseModel):
    graphOrError: GraphOrError
