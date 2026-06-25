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
from typing import List, Optional, Union  # noqa: UP035

from pydantic import BaseModel, Field, field_validator, model_validator
from typing_extensions import Annotated  # noqa: UP035


class Tile(BaseModel):
    """
    PowerBI Tile/Chart Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards/get-tiles-in-group#tile
    """

    id: str
    title: Optional[str] = None  # noqa: UP045
    subTitle: Optional[str] = None  # noqa: N815, UP045
    embedUrl: Optional[str] = None  # noqa: N815, UP045
    datasetId: Optional[str] = None  # noqa: N815, UP045
    reportId: Optional[str] = None  # noqa: N815, UP045


class PowerBIUser(BaseModel):
    """
    PowerBI User Model
    """

    displayName: Optional[str] = None  # noqa: N815, UP045
    email: Optional[str] = Field(alias="emailAddress", default=None)  # noqa: UP045
    userType: Optional[str] = None  # noqa: N815, UP045
    reportUserAccessRight: Optional[str] = None  # noqa: N815, UP045
    datasetUserAccessRight: Optional[str] = None  # noqa: N815, UP045
    dataflowUserAccessRight: Optional[str] = None  # noqa: N815, UP045
    dashboardUserAccessRight: Optional[str] = None  # noqa: N815, UP045
    datamartUserAccessRight: Optional[str] = None  # noqa: N815, UP045


class PowerBIDashboard(BaseModel):
    """
    PowerBI PowerBIDashboard Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards/get-dashboards-in-group#dashboard
    """

    id: str
    displayName: str | None = None  # noqa: N815
    webUrl: Optional[str] = None  # noqa: N815, UP045
    embedUrl: Optional[str] = None  # noqa: N815, UP045
    tiles: Optional[List[Tile]] = []  # noqa: UP006, UP045
    users: Optional[List[PowerBIUser]] = []  # noqa: UP006, UP045


class PowerBIReport(BaseModel):
    """
    PowerBI PowerBIReport Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-report#report
    """

    id: str
    name: str | None = None
    datasetId: Optional[str] = None  # noqa: N815, UP045
    users: Optional[List[PowerBIUser]] = []  # noqa: UP006, UP045
    modifiedBy: Optional[str] = None  # noqa: N815, UP045
    description: Optional[str] = None  # noqa: UP045
    format: Optional[str] = None  # noqa: UP045


class DashboardsResponse(BaseModel):
    """
    PowerBI DashboardsResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards/get-dashboards-in-group
    """

    odata_context: str = Field(alias="@odata.context")
    value: List[PowerBIDashboard]  # noqa: UP006


class ReportsResponse(BaseModel):
    """
    PowerBI ReportsResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-reports-in-group
    """

    odata_context: str = Field(alias="@odata.context")
    value: List[PowerBIReport]  # noqa: UP006


class TilesResponse(BaseModel):
    """
    PowerBI TilesResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/dashboards/get-tiles-in-group
    """

    odata_context: str = Field(alias="@odata.context")
    value: List[Tile]  # noqa: UP006


class PowerBiColumns(BaseModel):
    """
    PowerBI Column Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets/datasets-get-tables-in-group#column
    """

    name: str | None = None
    dataType: Optional[str] = None  # noqa: N815, UP045
    columnType: Optional[str] = None  # noqa: N815, UP045
    description: Optional[str] = None  # noqa: UP045


class PowerBiMeasureModel(BaseModel):
    """
    Represents a Power BI measure, used before converting to a Column instance.
    """

    dataType: str  # noqa: N815
    dataTypeDisplay: str  # noqa: N815
    name: str | None = None
    displayName: Optional[str] = None  # noqa: N815, UP045
    description: str


class PowerBiMeasures(BaseModel):
    """
    PowerBI Column Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets/datasets-get-tables-in-group#measure
    """

    name: str | None = None
    expression: Optional[Union[str, List[str]]] = None  # noqa: UP006, UP007, UP045
    description: Optional[str] = None  # noqa: UP045
    isHidden: Optional[bool] = False  # noqa: N815, UP045

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

    expression: Optional[Union[str, List[str]]] = None  # noqa: UP006, UP007, UP045

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

    name: Optional[str] = None  # noqa: UP045
    mode: Optional[str] = None  # noqa: UP045
    source: Optional[PowerBITableSource] = None  # noqa: UP045


class PowerBiTable(BaseModel):
    """
    PowerBI Table Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/push-datasets/datasets-get-tables-in-group#table
    """

    name: str | None = None
    columns: Optional[List[PowerBiColumns]] = None  # noqa: UP006, UP045
    measures: Optional[List[PowerBiMeasures]] = None  # noqa: UP006, UP045
    description: Optional[str] = None  # noqa: UP045
    source: Optional[List[PowerBITableSource]] = None  # noqa: UP006, UP045
    partitions: Optional[List[PowerBIPartition]] = None  # noqa: UP006, UP045

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
    value: List[PowerBiTable]  # noqa: UP006


class DatasetExpression(BaseModel):
    name: str | None = None
    expression: Optional[Union[str, List[str]]] = None  # noqa: UP006, UP007, UP045

    @field_validator("expression", mode="before")
    @classmethod
    def normalize_expression(cls, v):
        if isinstance(v, list):
            return "\n".join(v)
        return v


class UpstreaDataflow(BaseModel):
    groupId: Optional[str] = None  # noqa: N815, UP045
    targetDataflowId: Optional[str] = None  # noqa: N815, UP045


class UpstreaDataset(BaseModel):
    groupId: Optional[str] = None  # noqa: N815, UP045
    targetDatasetId: Optional[str] = None  # noqa: N815, UP045


class UpstreamDatamart(BaseModel):
    groupId: Optional[str] = None  # noqa: N815, UP045
    targetDatamartId: Optional[str] = None  # noqa: N815, UP045


class Dataset(BaseModel):
    """
    PowerBI Dataset Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/get-datasets-in-group#dataset
    """

    id: str
    name: str | None = None
    tables: Optional[List[PowerBiTable]] = []  # noqa: UP006, UP045
    description: Optional[str] = None  # noqa: UP045
    users: Optional[List[PowerBIUser]] = []  # noqa: UP006, UP045
    expressions: Optional[List[DatasetExpression]] = []  # noqa: UP006, UP045
    configuredBy: Optional[str] = None  # noqa: N815, UP045
    upstreamDataflows: Optional[List[UpstreaDataflow]] = []  # noqa: N815, UP006, UP045
    upstreamDatasets: Optional[List[UpstreaDataset]] = []  # noqa: N815, UP006, UP045


class DatasetResponse(BaseModel):
    """
    PowerBI DatasetResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/get-datasets-in-group
    """

    odata_context: str = Field(alias="@odata.context")
    value: List[Dataset]  # noqa: UP006


class Dataflow(BaseModel):
    id: str = Field(alias="objectId")
    name: str | None = None
    description: Optional[str] = None  # noqa: UP045
    users: Optional[List[PowerBIUser]] = []  # noqa: UP006, UP045
    modifiedBy: Optional[str] = None  # noqa: N815, UP045
    upstreamDataflows: Optional[List[UpstreaDataflow]] = []  # noqa: N815, UP006, UP045


class Datamart(BaseModel):
    """
    PowerBI Datamart Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/workspace-info-get-scan-result
    Datamarts appear under the `datamarts[]` array of each workspace/group in the scan response.
    """

    id: str
    name: str | None = None
    description: Optional[str] = None  # noqa: UP045
    users: Optional[List[PowerBIUser]] = []  # noqa: UP006, UP045
    modifiedBy: Optional[str] = None  # noqa: N815, UP045
    upstreamDatamarts: Optional[List[UpstreamDatamart]] = []  # noqa: N815, UP006, UP045


class Group(BaseModel):
    """
    PowerBI Group Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/groups/get-groups#group
    """

    id: str
    name: Optional[str] = None  # noqa: UP045
    type: Optional[str] = None  # noqa: UP045
    state: Optional[str] = None  # noqa: UP045
    dashboards: Optional[List[PowerBIDashboard]] = []  # noqa: UP006, UP045
    reports: Optional[List[PowerBIReport]] = []  # noqa: UP006, UP045
    datasets: Optional[List[Dataset]] = []  # noqa: UP006, UP045
    dataflows: Optional[List[Dataflow]] = []  # noqa: UP006, UP045
    datamarts: Optional[List[Datamart]] = []  # noqa: UP006, UP045


class GroupsResponse(BaseModel):
    """
    PowerBI GroupsResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/groups/get-groups
    """

    odata_context: str = Field(alias="@odata.context")
    odata_count: int = Field(alias="@odata.count")
    value: List[Group]  # noqa: UP006


class WorkSpaceScanResponse(BaseModel):
    """
    PowerBI WorkSpaceScanResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/workspace-info-get-scan-status
    """

    id: str
    createdDateTime: datetime  # noqa: N815
    status: Optional[str] = None  # noqa: UP045


class Workspaces(BaseModel):
    """
    PowerBI Workspaces Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/workspace-info-get-scan-result
    """

    workspaces: List[Group]  # noqa: UP006


class PowerBiToken(BaseModel):
    """
    PowerBI Token Model
    """

    expires_in: Optional[int] = None  # noqa: UP045
    access_token: Optional[str] = None  # noqa: UP045


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

    RemoteArtifacts: Annotated[Optional[List[RemoteArtifacts]], Field(None, description="Remote Artifacts")]  # noqa: UP006, UP045


class DataModelSchema(BaseModel):
    """
    PowerBi Data Model Schema Model
    """

    tables: Optional[List[PowerBiTable]] = None  # noqa: UP006, UP045
    connectionFile: Optional[ConnectionFile] = None  # noqa: N815, UP045


class ReportPage(BaseModel):
    """
    PowerBI report pages API response
    single report Page object
    """

    name: str | None = None
    displayName: Optional[str] = None  # noqa: N815, UP045


class ReportPagesAPIResponse(BaseModel):
    """
    PowerBI report pages API response
    """

    odata_context: str = Field(alias="@odata.context")
    value: Optional[List[ReportPage]] = None  # noqa: UP006, UP045


class DatasourceConnectionDetails(BaseModel):
    """
    PowerBI Datasource Connection Details
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-datasources-in-group#datasourceconnectiondetails
    """

    server: Optional[str] = None  # noqa: UP045
    database: Optional[str] = None  # noqa: UP045


class Datasource(BaseModel):
    """
    PowerBI Datasource Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-datasources-in-group#datasource
    """

    name: Optional[str] = None  # noqa: UP045
    datasourceType: Optional[str] = None  # noqa: N815, UP045
    connectionDetails: Optional[DatasourceConnectionDetails] = None  # noqa: N815, UP045
    datasourceId: Optional[str] = None  # noqa: N815, UP045
    gatewayId: Optional[str] = None  # noqa: N815, UP045


class DatasourcesResponse(BaseModel):
    """
    PowerBI DatasourcesResponse Model
    Definition: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-datasources-in-group
    """

    odata_context: str = Field(alias="@odata.context")
    value: List[Datasource]  # noqa: UP006


class DataflowEntityAttribute(BaseModel):
    """
    PowerBI Dataflow Entity Attribute Model
    Represents a column/attribute within a dataflow entity
    API doc: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dataflows-export-dataflow-as-admin
    """

    name: str | None = None
    dataType: Optional[str] = None  # noqa: N815, UP045
    description: Optional[str] = None  # noqa: UP045


class DataflowEntity(BaseModel):
    """
    PowerBI Dataflow Entity Model
    Represents a table/entity within a dataflow
    API doc: https://learn.microsoft.com/en-us/rest/api/power-bi/admin/dataflows-export-dataflow-as-admin
    """

    name: str | None = None
    description: Optional[str] = None  # noqa: UP045
    attributes: Optional[List[DataflowEntityAttribute]] = []  # noqa: UP006, UP045


class DataflowQueryMetadata(BaseModel):
    queryId: Optional[str] = None  # noqa: N815, UP045
    queryName: Optional[str] = None  # noqa: N815, UP045
    loadEnabled: Optional[bool] = False  # noqa: N815, UP045


class DataflowMashup(BaseModel):
    document: Optional[str] = None  # noqa: UP045
    queriesMetadata: Optional[dict] = None  # noqa: N815, UP045

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

    name: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    version: Optional[str] = None  # noqa: UP045
    entities: Optional[List[DataflowEntity]] = []  # noqa: UP006, UP045
    mashup: Optional[DataflowMashup] = Field(None, alias="pbi:mashup")  # noqa: UP045
