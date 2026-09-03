#  Copyright 2023 Collate
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
PowerBI Models
"""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator


class Tile(BaseModel):
    """
    PowerBI Tile/Chart Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards/get-tiles-in-group#tile
    """

    id: str
    title: str | None = None
    subTitle: str | None = None  # noqa: N815
    embedUrl: str | None = None  # noqa: N815
    datasetId: str | None = None  # noqa: N815
    reportId: str | None = None  # noqa: N815


class PowerBIUser(BaseModel):
    """
    PowerBI User Model
    """

    displayName: str | None = None  # noqa: N815
    email: str | None = Field(alias="emailAddress", default=None)
    userType: str | None = None  # noqa: N815
    reportUserAccessRight: str | None = None  # noqa: N815
    datasetUserAccessRight: str | None = None  # noqa: N815
    dataflowUserAccessRight: str | None = None  # noqa: N815
    dashboardUserAccessRight: str | None = None  # noqa: N815
    datamartUserAccessRight: str | None = None  # noqa: N815


class PowerBIDashboard(BaseModel):
    """
    PowerBI PowerBIDashboard Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards/get-dashboards-in-group#dashboard
    """

    id: str
    displayName: str | None = None  # noqa: N815
    webUrl: str | None = None  # noqa: N815
    embedUrl: str | None = None  # noqa: N815
    tiles: list[Tile] | None = []
    users: list[PowerBIUser] | None = []


class PowerBIReport(BaseModel):
    """
    PowerBI PowerBIReport Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-report#report
    """

    id: str
    name: str | None = None
    datasetId: str | None = None  # noqa: N815
    users: list[PowerBIUser] | None = []
    modifiedBy: str | None = None  # noqa: N815
    description: str | None = None
    format: str | None = None


class DashboardsResponse(BaseModel):
    """
    PowerBI DashboardsResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards/get-dashboards-in-group
    """

    odata_context: str = Field(alias="@odata.context")
    value: list[PowerBIDashboard]


class ReportsResponse(BaseModel):
    """
    PowerBI ReportsResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-reports-in-group
    """

    odata_context: str = Field(alias="@odata.context")
    value: list[PowerBIReport]


class TilesResponse(BaseModel):
    """
    PowerBI TilesResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards/get-tiles-in-group
    """

    odata_context: str = Field(alias="@odata.context")
    value: list[Tile]


class PowerBiColumns(BaseModel):
    """
    PowerBI Column Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets/datasets-get-tables-in-group#column
    """

    name: str | None = None
    dataType: str | None = None  # noqa: N815
    columnType: str | None = None  # noqa: N815
    description: str | None = None


class PowerBiMeasureModel(BaseModel):
    """
    Represents a Power BI measure, used before converting to a Column instance.
    """

    dataType: str  # noqa: N815
    dataTypeDisplay: str  # noqa: N815
    name: str | None = None
    displayName: str | None = None  # noqa: N815
    description: str


class PowerBiMeasures(BaseModel):
    """
    PowerBI Column Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets/datasets-get-tables-in-group#measure
    """

    name: str | None = None
    expression: str | list[str] | None = None
    description: str | None = None
    isHidden: bool | None = False  # noqa: N815

    @field_validator("expression", mode="before")
    @classmethod
    def normalize_expression(cls, v):
        if isinstance(v, list):
            return "\n".join(v)
        return v


class PowerBITableSource(BaseModel):
    """
    PowerBI Table Source
    """

    expression: str | list[str] | None = None

    @field_validator("expression", mode="before")
    @classmethod
    def normalize_expression(cls, v):
        if isinstance(v, list):
            return "\n".join(v)
        return v


class PowerBIPartition(BaseModel):
    """
    PowerBI Table Partition (.pbit files)
    """

    name: str | None = None
    mode: str | None = None
    source: PowerBITableSource | None = None


class PowerBiTable(BaseModel):
    """
    PowerBI Table Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets/datasets-get-tables-in-group#table
    """

    name: str | None = None
    columns: list[PowerBiColumns] | None = None
    measures: list[PowerBiMeasures] | None = None
    description: str | None = None
    source: list[PowerBITableSource] | None = None
    partitions: list[PowerBIPartition] | None = None

    @model_validator(mode="before")
    @classmethod
    def extract_source_from_partitions(cls, values):
        if isinstance(values, dict):  # noqa: SIM102
            if values.get("source") is None and values.get("partitions"):
                partitions = values.get("partitions", [])
                if partitions and len(partitions) > 0:
                    partition_source = partitions[0].get("source")
                    if partition_source:
                        values["source"] = [partition_source]

        return values


class TablesResponse(BaseModel):
    """
    PowerBI TablesResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets/datasets-get-tables-in-group
    """

    odata_context: str = Field(alias="@odata.context")
    value: list[PowerBiTable]


class DatasetExpression(BaseModel):
    name: str | None = None
    expression: str | list[str] | None = None

    @field_validator("expression", mode="before")
    @classmethod
    def normalize_expression(cls, v):
        if isinstance(v, list):
            return "\n".join(v)
        return v


class UpstreaDataflow(BaseModel):
    groupId: str | None = None  # noqa: N815
    targetDataflowId: str | None = None  # noqa: N815


class UpstreaDataset(BaseModel):
    groupId: str | None = None  # noqa: N815
    targetDatasetId: str | None = None  # noqa: N815


class UpstreamDatamart(BaseModel):
    groupId: str | None = None  # noqa: N815
    targetDatamartId: str | None = None  # noqa: N815


class Dataset(BaseModel):
    """
    PowerBI Dataset Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/get-datasets-in-group#dataset
    """

    id: str
    name: str | None = None
    tables: list[PowerBiTable] | None = []
    description: str | None = None
    users: list[PowerBIUser] | None = []
    expressions: list[DatasetExpression] | None = []
    configuredBy: str | None = None  # noqa: N815
    upstreamDataflows: list[UpstreaDataflow] | None = []  # noqa: N815
    upstreamDatasets: list[UpstreaDataset] | None = []  # noqa: N815


class DatasetResponse(BaseModel):
    """
    PowerBI DatasetResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/get-datasets-in-group
    """

    odata_context: str = Field(alias="@odata.context")
    value: list[Dataset]


class Dataflow(BaseModel):
    id: str = Field(alias="objectId")
    name: str | None = None
    description: str | None = None
    users: list[PowerBIUser] | None = []
    modifiedBy: str | None = None  # noqa: N815
    upstreamDataflows: list[UpstreaDataflow] | None = []  # noqa: N815


class Datamart(BaseModel):
    """
    PowerBI Datamart Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/workspace-info-get-scan-result
    Datamarts appear under the `datamarts[]` array of each workspace/group in the scan response.
    """

    id: str
    name: str | None = None
    description: str | None = None
    users: list[PowerBIUser] | None = []
    modifiedBy: str | None = None  # noqa: N815
    upstreamDatamarts: list[UpstreamDatamart] | None = []  # noqa: N815


class Group(BaseModel):
    """
    PowerBI Group Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/groups/get-groups#group
    """

    id: str
    name: str | None = None
    type: str | None = None
    state: str | None = None
    dashboards: list[PowerBIDashboard] | None = []
    reports: list[PowerBIReport] | None = []
    datasets: list[Dataset] | None = []
    dataflows: list[Dataflow] | None = []
    datamarts: list[Datamart] | None = []


class GroupsResponse(BaseModel):
    """
    PowerBI GroupsResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/groups/get-groups
    """

    odata_context: str = Field(alias="@odata.context")
    odata_count: int = Field(alias="@odata.count")
    value: list[Group]


class WorkSpaceScanResponse(BaseModel):
    """
    PowerBI WorkSpaceScanResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/workspace-info-get-scan-status
    """

    id: str
    createdDateTime: datetime  # noqa: N815
    status: str | None = None


class Workspaces(BaseModel):
    """
    PowerBI Workspaces Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/workspace-info-get-scan-result
    """

    workspaces: list[Group]


class PowerBiToken(BaseModel):
    """
    PowerBI Token Model
    """

    expires_in: int | None = None
    access_token: str | None = None


class RemoteArtifacts(BaseModel):
    """
    PowerBI RemoteArtifacts Model
    """

    DatasetId: str
    ReportId: str


class ConnectionFile(BaseModel):
    """
    PowerBi Connection File Model
    """

    RemoteArtifacts: Annotated[list[RemoteArtifacts] | None, Field(None, description="Remote Artifacts")]


class DataModelSchema(BaseModel):
    """
    PowerBi Data Model Schema Model
    """

    tables: list[PowerBiTable] | None = None
    connectionFile: ConnectionFile | None = None  # noqa: N815


class ReportPage(BaseModel):
    """
    PowerBI report pages API response
    single report Page object
    """

    name: str | None = None
    displayName: str | None = None  # noqa: N815


class ReportPagesAPIResponse(BaseModel):
    """
    PowerBI report pages API response
    """

    odata_context: str = Field(alias="@odata.context")
    value: list[ReportPage] | None = None


class DatasourceConnectionDetails(BaseModel):
    """
    PowerBI Datasource Connection Details
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-datasources-in-group#datasourceconnectiondetails
    """

    server: str | None = None
    database: str | None = None


class Datasource(BaseModel):
    """
    PowerBI Datasource Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-datasources-in-group#datasource
    """

    name: str | None = None
    datasourceType: str | None = None  # noqa: N815
    connectionDetails: DatasourceConnectionDetails | None = None  # noqa: N815
    datasourceId: str | None = None  # noqa: N815
    gatewayId: str | None = None  # noqa: N815


class DatasourcesResponse(BaseModel):
    """
    PowerBI DatasourcesResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-datasources-in-group
    """

    odata_context: str = Field(alias="@odata.context")
    value: list[Datasource]


class DataflowEntityAttribute(BaseModel):
    """
    PowerBI Dataflow Entity Attribute Model
    Represents a column/attribute within a dataflow entity
    API doc: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dataflows-export-dataflow-as-admin
    """

    name: str | None = None
    dataType: str | None = None  # noqa: N815
    description: str | None = None


class DataflowEntity(BaseModel):
    """
    PowerBI Dataflow Entity Model
    Represents a table/entity within a dataflow
    API doc: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dataflows-export-dataflow-as-admin
    """

    name: str | None = None
    description: str | None = None
    attributes: list[DataflowEntityAttribute] | None = []


class DataflowQueryMetadata(BaseModel):
    queryId: str | None = None  # noqa: N815
    queryName: str | None = None  # noqa: N815
    loadEnabled: bool | None = False  # noqa: N815


class DataflowMashup(BaseModel):
    document: str | None = None
    queriesMetadata: dict | None = None  # noqa: N815

    @field_validator("queriesMetadata", mode="before")
    @classmethod
    def parse_queries_metadata(cls, v):
        if isinstance(v, dict):
            return v
        return None


class DataflowExportResponse(BaseModel):
    """
    PowerBI Dataflow Export API Response Model
    API: https://api.powerbi.com/v1.0/myorg/admin/dataflows/{dataflowId}/export
    API doc: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dataflows-export-dataflow-as-admin
    """

    name: str | None = None
    description: str | None = None
    version: str | None = None
    entities: list[DataflowEntity] | None = []
    mashup: DataflowMashup | None = Field(None, alias="pbi:mashup")
