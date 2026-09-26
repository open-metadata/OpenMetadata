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
Tableau Pipeline Source Model module
"""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ExtractTargetType = Literal["datasource", "workbook"]


class TableauPipelineKind(str, Enum):
    EXTRACT_REFRESH = "extractRefresh"
    FLOW = "flow"


class TableauRunItem(BaseModel):
    """One run of a pipeline: a Prep flow run or an extract refresh job.

    `status` uses Tableau's run vocabulary: Pending, InProgress, Success,
    Cancelled or Failed."""

    id: str
    status: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None


class TableauPipelineDetails(BaseModel):
    """A Tableau Prep flow, or the extract refresh of a published data source
    or workbook (`target_type` says which). `id` is the REST luid of the flow
    or of the refreshed data source / workbook."""

    id: str
    name: str
    display_name: str | None = None
    description: str | None = None
    kind: TableauPipelineKind
    project_name: str | None = None
    webpage_url: str | None = None
    owner_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    target_type: ExtractTargetType | None = None


class TableauReferencedQuery(BaseModel):
    """Custom SQL query referenced by an upstream DatabaseTable."""

    query: str | None = None


class TableauLineageDatabase(BaseModel):
    """Database reference in a Tableau Metadata API lineage response."""

    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    connection_type: str | None = Field(default=None, alias="connectionType")


class TableauLineageTable(BaseModel):
    """DatabaseTable reference in a Tableau Metadata API lineage response."""

    model_config = ConfigDict(populate_by_name=True)

    id: str | None = None
    name: str | None = None
    full_name: str | None = Field(default=None, alias="fullName")
    schema_: str | None = Field(default=None, alias="schema")
    database: TableauLineageDatabase | None = None
    referenced_by_queries: list[TableauReferencedQuery] = Field(default_factory=list, alias="referencedByQueries")


class TableauFlowOutputStep(BaseModel):
    """A single output step in a Tableau Prep flow."""

    id: str | None = None
    name: str | None = None


class TableauLinkedFlow(BaseModel):
    """A flow that consumes this flow's output (cross-flow lineage)."""

    luid: str | None = None
    name: str | None = None


class TableauPublishedDatasource(BaseModel):
    """A published datasource a flow reads from or writes to.

    The dashboard Tableau connector names its DashboardDataModel after the
    Metadata API ``id``, not the REST ``luid``, so ``id`` is the lookup key."""

    model_config = ConfigDict(populate_by_name=True)

    id: str | None = None
    name: str | None = None
    project_name: str | None = Field(default=None, alias="projectName")


class TableauFlowLineage(BaseModel):
    """Inputs and outputs of a single Tableau Prep flow."""

    model_config = ConfigDict(populate_by_name=True)

    upstream_tables: list[TableauLineageTable] = Field(default_factory=list, alias="upstreamTables")
    upstream_datasources: list[TableauPublishedDatasource] = Field(default_factory=list, alias="upstreamDatasources")
    output_steps: list[TableauFlowOutputStep] = Field(default_factory=list, alias="outputSteps")
    downstream_tables: list[TableauLineageTable] = Field(default_factory=list, alias="downstreamTables")
    downstream_datasources: list[TableauPublishedDatasource] = Field(
        default_factory=list, alias="downstreamDatasources"
    )
    next_downstream_flows: list[TableauLinkedFlow] = Field(default_factory=list, alias="nextDownstreamFlows")
