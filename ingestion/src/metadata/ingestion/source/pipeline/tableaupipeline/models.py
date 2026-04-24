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
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class TableauFlowItem(BaseModel):
    """Represents a Tableau Prep flow"""

    model_config = ConfigDict(extra="allow")

    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    owner_id: Optional[str] = None
    webpage_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)


class TableauFlowRunItem(BaseModel):
    """Represents a Tableau Prep flow run"""

    model_config = ConfigDict(extra="allow")

    id: str
    flow_id: Optional[str] = None
    status: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: Optional[str] = None


class TableauTaskType(str, Enum):
    EXTRACT_REFRESH = "extractRefresh"
    FLOW_RUN = "flowRun"


class TableauPipelineDetails(BaseModel):
    """Wrapper for a pipeline entity in Tableau (Prep flow)"""

    model_config = ConfigDict(extra="allow")

    id: str
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    pipeline_type: TableauTaskType
    project_name: Optional[str] = None
    webpage_url: Optional[str] = None
    owner_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class TableauLineageColumn(BaseModel):
    """Column reference in a Tableau Metadata API lineage response."""

    model_config = ConfigDict(extra="allow")

    id: Optional[str] = None
    name: Optional[str] = None


class TableauReferencedQuery(BaseModel):
    """Custom SQL query referenced by an upstream DatabaseTable."""

    model_config = ConfigDict(extra="allow")

    id: Optional[str] = None
    name: Optional[str] = None
    query: Optional[str] = None


class TableauLineageDatabase(BaseModel):
    """Database reference in a Tableau Metadata API lineage response."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    name: Optional[str] = None
    connection_type: Optional[str] = Field(default=None, alias="connectionType")


class TableauLineageTable(BaseModel):
    """DatabaseTable reference in a Tableau Metadata API lineage response."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: Optional[str] = None
    luid: Optional[str] = None
    name: Optional[str] = None
    full_name: Optional[str] = Field(default=None, alias="fullName")
    schema_: Optional[str] = Field(default=None, alias="schema")
    columns: List[TableauLineageColumn] = Field(default_factory=list)
    database: Optional[TableauLineageDatabase] = None
    referenced_by_queries: List[TableauReferencedQuery] = Field(
        default_factory=list, alias="referencedByQueries"
    )


class TableauFlowUpstreamColumn(TableauLineageColumn):
    """Upstream column referencing its source table, used for column-level lineage."""

    table: Optional[TableauLineageTable] = None


class TableauFlowOutputField(BaseModel):
    """Output field on a flow with its upstream columns."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: Optional[str] = None
    name: Optional[str] = None
    upstream_columns: List[TableauFlowUpstreamColumn] = Field(
        default_factory=list, alias="upstreamColumns"
    )


class TableauFlowOutputStep(BaseModel):
    """A single output step in a Tableau Prep flow."""

    model_config = ConfigDict(extra="allow")

    id: Optional[str] = None
    name: Optional[str] = None


class TableauDownstreamFlow(BaseModel):
    """A flow that consumes this flow's output (cross-flow lineage)."""

    model_config = ConfigDict(extra="allow")

    id: Optional[str] = None
    luid: Optional[str] = None
    name: Optional[str] = None


class TableauDownstreamDatasource(BaseModel):
    """A datasource produced by this flow — typically a published
    datasource consumed by Tableau workbooks/dashboards."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: Optional[str] = None
    luid: Optional[str] = None
    name: Optional[str] = None
    project_name: Optional[str] = Field(default=None, alias="projectName")


class TableauFlowLineage(BaseModel):
    """Lineage metadata for a single Tableau Prep flow."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: Optional[str] = None
    luid: Optional[str] = None
    name: Optional[str] = None
    upstream_tables: List[TableauLineageTable] = Field(
        default_factory=list, alias="upstreamTables"
    )
    output_steps: List[TableauFlowOutputStep] = Field(
        default_factory=list, alias="outputSteps"
    )
    output_fields: List[TableauFlowOutputField] = Field(
        default_factory=list, alias="outputFields"
    )
    downstream_flows: List[TableauDownstreamFlow] = Field(
        default_factory=list, alias="downstreamFlows"
    )
    downstream_datasources: List[TableauDownstreamDatasource] = Field(
        default_factory=list, alias="downstreamDatasources"
    )


class TableauFlowLineageResponse(BaseModel):
    """Top-level wrapper for the GraphQL response of the flow lineage query."""

    model_config = ConfigDict(extra="allow")

    data: Optional[Dict[str, Any]] = None
