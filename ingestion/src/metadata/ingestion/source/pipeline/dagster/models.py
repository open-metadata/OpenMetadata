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
Dagster Source Model module
"""

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from metadata.generated.schema.entity.data.table import Table

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


class AssetKey(BaseModel):
    path: List[str]

    def to_string(self) -> str:
        """Convert asset key path to dot-separated string"""
        return ".".join(self.path)

    def normalize(self, strip_prefix: int = 0) -> "AssetKey":
        """
        Return a new AssetKey with N leading segments removed.

        Args:
            strip_prefix: Number of leading segments to remove

        Returns:
            New AssetKey with normalized path
        """
        if strip_prefix <= 0:
            return self

        if strip_prefix >= len(self.path):
            from metadata.utils.logger import ingestion_logger

            logger = ingestion_logger()
            logger.warning(
                f"stripAssetKeyPrefixLength ({strip_prefix}) is >= asset key length "
                f"({len(self.path)}). Asset key: {self.to_string()}"
            )
            return self

        return AssetKey(path=self.path[strip_prefix:])


class DagsterAssetReference(BaseModel):
    assetKey: AssetKey


class AssetDependency(BaseModel):
    asset: Optional[DagsterAssetReference] = None


class MetadataEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    typename: str = Field(alias="__typename")
    label: str
    text: Optional[str] = None
    path: Optional[str] = None
    jsonString: Optional[str] = None


class AssetMaterialization(BaseModel):
    runId: str
    timestamp: Optional[float] = None
    metadataEntries: Optional[List[MetadataEntry]] = None


class JobReference(BaseModel):
    name: str
    id: str


class DagsterAssetNode(BaseModel):
    id: str
    assetKey: AssetKey
    description: Optional[str] = None
    computeKind: Optional[str] = None
    opNames: Optional[List[str]] = None
    dependencies: Optional[List[AssetDependency]] = None
    assetMaterializations: Optional[List[AssetMaterialization]] = None
    jobs: Optional[List[JobReference]] = None


class AssetRepository(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    typename: str = Field(alias="__typename")
    id: Optional[str] = None
    name: Optional[str] = None
    assetNodes: Optional[List[DagsterAssetNode]] = None


class AssetsQueryResponse(BaseModel):
    repositoryOrError: AssetRepository


class TableResolutionResult(BaseModel):
    """Result of resolving a Dagster asset to an OpenMetadata table"""

    table_fqn: Optional[str] = None
    table_entity: Optional[Table] = None

    @property
    def is_resolved(self) -> bool:
        """Check if the asset was successfully resolved to a table"""
        return self.table_entity is not None
