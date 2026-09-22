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

from pydantic import BaseModel, ConfigDict, Field

from metadata.generated.schema.entity.data.table import Table

# Models for get_task_runs


class RunStepStats(BaseModel):
    runId: str  # noqa: N815
    startTime: float | None = None  # noqa: N815
    endTime: float | None = None  # noqa: N815
    status: str | None = None


class SolidStepStatsConnection(BaseModel):
    nodes: list[RunStepStats] | None = None


class TaskSolidHandle(BaseModel):
    stepStats: SolidStepStatsConnection | None = None  # noqa: N815


class DagsterPipeline(BaseModel):
    id: str
    name: str
    description: str | None = None
    solidHandle: TaskSolidHandle | None = None  # noqa: N815


class PipelineOrErrorModel(BaseModel):
    pipelineOrError: DagsterPipeline  # noqa: N815


# Models for get_run_list
class DagsterLocation(BaseModel):
    id: str
    name: str


class Node(BaseModel):
    id: str
    name: str
    location: DagsterLocation | None = None
    pipelines: list[DagsterPipeline]


class RepositoryConnection(BaseModel):
    nodes: list[Node]


class RepositoriesOrErrorModel(BaseModel):
    repositoriesOrError: RepositoryConnection  # noqa: N815


# Models for get_jobs
class SolidName(BaseModel):
    name: str


class DependsOnSolid(BaseModel):
    solid: SolidName | None = None


class SolidInput(BaseModel):
    dependsOn: list[DependsOnSolid] | None = None  # noqa: N815


class Solid(BaseModel):
    name: str
    inputs: list[SolidInput] | None = None


class SolidHandle(BaseModel):
    handleID: str  # noqa: N815
    solid: Solid | None = None


class GraphOrError(BaseModel):
    id: str
    name: str
    description: str | None = None
    solidHandles: list[SolidHandle] | None = None  # noqa: N815


class GraphOrErrorModel(BaseModel):
    graphOrError: GraphOrError  # noqa: N815


class AssetKey(BaseModel):
    path: list[str]

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
    assetKey: AssetKey  # noqa: N815


class AssetDependency(BaseModel):
    asset: DagsterAssetReference | None = None


class MetadataEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    typename: str = Field(alias="__typename")
    label: str
    text: str | None = None
    path: str | None = None
    jsonString: str | None = None  # noqa: N815


class AssetMaterialization(BaseModel):
    runId: str  # noqa: N815
    timestamp: float | None = None
    metadataEntries: list[MetadataEntry] | None = None  # noqa: N815


class JobReference(BaseModel):
    name: str
    id: str


class DagsterAssetNode(BaseModel):
    id: str
    assetKey: AssetKey  # noqa: N815
    description: str | None = None
    computeKind: str | None = None  # noqa: N815
    opNames: list[str] | None = None  # noqa: N815
    dependencies: list[AssetDependency] | None = None
    assetMaterializations: list[AssetMaterialization] | None = None  # noqa: N815
    jobs: list[JobReference] | None = None


class AssetRepository(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    typename: str = Field(alias="__typename")
    id: str | None = None
    name: str | None = None
    assetNodes: list[DagsterAssetNode] | None = None  # noqa: N815


class AssetsQueryResponse(BaseModel):
    repositoryOrError: AssetRepository  # noqa: N815


class TableResolutionResult(BaseModel):
    """Result of resolving a Dagster asset to an OpenMetadata table"""

    table_fqn: str | None = None
    table_entity: Table | None = None

    @property
    def is_resolved(self) -> bool:
        """Check if the asset was successfully resolved to a table"""
        return self.table_entity is not None
