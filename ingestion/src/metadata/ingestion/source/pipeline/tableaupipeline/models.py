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
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TableauFlowItem(BaseModel):
    """Represents a Tableau Prep flow"""

    model_config = ConfigDict(extra="allow")

    id: str
    name: str | None = None
    description: str | None = None
    project_id: str | None = None
    project_name: str | None = None
    owner_id: str | None = None
    webpage_url: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    tags: list[str] = Field(default_factory=list)


class TableauFlowRunItem(BaseModel):
    """Represents a Tableau Prep flow run"""

    model_config = ConfigDict(extra="allow")

    id: str
    flow_id: str | None = None
    status: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    progress: str | None = None


class TableauTaskType(str, Enum):
    EXTRACT_REFRESH = "extractRefresh"
    FLOW_RUN = "flowRun"


class TableauPipelineDetails(BaseModel):
    """Wrapper for a pipeline entity in Tableau (Prep flow)"""

    model_config = ConfigDict(extra="allow")

    id: str
    name: str
    display_name: str | None = None
    description: str | None = None
    pipeline_type: TableauTaskType
    project_name: str | None = None
    webpage_url: str | None = None
    owner_id: str | None = None
    tags: list[str] = Field(default_factory=list)


class TableauLineageColumn(BaseModel):
    """Column reference in a Tableau Metadata API lineage response."""

    model_config = ConfigDict(extra="allow")

    id: str | None = None
    name: str | None = None


class TableauReferencedQuery(BaseModel):
    """Custom SQL query referenced by an upstream DatabaseTable."""

    model_config = ConfigDict(extra="allow")

    id: str | None = None
    name: str | None = None
    query: str | None = None


class TableauLineageDatabase(BaseModel):
    """Database reference in a Tableau Metadata API lineage response."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    name: str | None = None
    connection_type: str | None = Field(default=None, alias="connectionType")


class TableauLineageTable(BaseModel):
    """DatabaseTable reference in a Tableau Metadata API lineage response."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str | None = None
    luid: str | None = None
    name: str | None = None
    full_name: str | None = Field(default=None, alias="fullName")
    schema_: str | None = Field(default=None, alias="schema")
    columns: list[TableauLineageColumn] = Field(default_factory=list)
    database: TableauLineageDatabase | None = None
    referenced_by_queries: list[TableauReferencedQuery] = Field(default_factory=list, alias="referencedByQueries")


class TableauFlowUpstreamColumn(TableauLineageColumn):
    """Upstream column referencing its source table, used for column-level lineage."""

    table: TableauLineageTable | None = None


class TableauFlowOutputField(BaseModel):
    """Output field on a flow with its upstream columns."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str | None = None
    name: str | None = None
    upstream_columns: list[TableauFlowUpstreamColumn] = Field(default_factory=list, alias="upstreamColumns")


class TableauFlowOutputStep(BaseModel):
    """A single output step in a Tableau Prep flow."""

    model_config = ConfigDict(extra="allow")

    id: str | None = None
    name: str | None = None


class TableauDownstreamFlow(BaseModel):
    """A flow that consumes this flow's output (cross-flow lineage)."""

    model_config = ConfigDict(extra="allow")

    id: str | None = None
    luid: str | None = None
    name: str | None = None


class TableauDownstreamDatasource(BaseModel):
    """A datasource produced by this flow — typically a published
    datasource consumed by Tableau workbooks/dashboards."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str | None = None
    luid: str | None = None
    name: str | None = None
    project_name: str | None = Field(default=None, alias="projectName")


class TableauFlowLineage(BaseModel):
    """Lineage metadata for a single Tableau Prep flow."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str | None = None
    luid: str | None = None
    name: str | None = None
    upstream_tables: list[TableauLineageTable] = Field(default_factory=list, alias="upstreamTables")
    output_steps: list[TableauFlowOutputStep] = Field(default_factory=list, alias="outputSteps")
    output_fields: list[TableauFlowOutputField] = Field(default_factory=list, alias="outputFields")
    downstream_flows: list[TableauDownstreamFlow] = Field(default_factory=list, alias="downstreamFlows")
    downstream_datasources: list[TableauDownstreamDatasource] = Field(
        default_factory=list, alias="downstreamDatasources"
    )


class TableauFlowLineageResponse(BaseModel):
    """Top-level wrapper for the GraphQL response of the flow lineage query."""

    model_config = ConfigDict(extra="allow")

    data: dict[str, Any] | None = None
