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

from typing import Dict, List, Optional, Set, Union

from pydantic import BaseModel, ConfigDict, Field, validator

from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.table import Table


class TableauBaseModel(BaseModel):
    """
    Tableau basic configurations
    """

    model_config = ConfigDict(extra="allow")

    id: str
    name: Optional[str] = None

    def __hash__(self):
        return hash(self.id)

    def __eq__(self, other):
        return isinstance(other, type(self)) and self.id == other.id


class ChartUrl:
    workbook_name: str
    sheets: str
    chart_url_name: str

    def __init__(self, context_url: str) -> None:
        self.workbook_name, self.sheets, self.chart_url_name = (
            context_url.split("/") if "/" in context_url else ["", "", ""]
        )


class TableauTag(BaseModel):
    """
    Aux class for Tag object of the tableau_api_lib response
    """

    model_config = ConfigDict(frozen=True)

    label: str


class TableauDataModelTag(BaseModel):
    """
    Aux class for Tag object for Tableau Data Model
    """

    name: str


class TableauOwner(TableauBaseModel):
    """
    Aux class for Owner object of the tableau_api_lib response
    """

    email: Optional[str] = None


class TableauDatasource(BaseModel):
    """
    Model for downstream datasource information
    """

    id: Optional[str] = None
    name: Optional[str] = None


class CustomSQLTable(TableauBaseModel):
    """
    GraphQL API CustomSQLTable schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/customsqltable.doc.html
    """

    downstreamDatasources: Optional[List[TableauDatasource]] = None
    query: Optional[str] = None


class CustomSQLTablesResponse(BaseModel):
    """
    Model for the custom SQL tables response
    """

    data: Dict[str, List[CustomSQLTable]]


class UpstreamColumn(BaseModel):
    id: str
    name: Optional[str] = None
    remoteType: Optional[str] = None


class DatasourceField(BaseModel):
    id: str
    name: Optional[str] = None
    upstreamColumns: Optional[List[Union[UpstreamColumn, None]]] = None
    description: Optional[str] = None


class UpstreamTableColumn(BaseModel):
    id: str
    name: Optional[str] = None


class TableauDatabase(BaseModel):
    id: str
    name: Optional[str] = None


class UpstreamTable(BaseModel):
    id: str
    luid: str
    name: Optional[str] = None
    fullName: Optional[str] = None
    schema_: Optional[str] = Field(None, alias="schema")
    columns: Optional[List[UpstreamTableColumn]] = None
    database: Optional[TableauDatabase] = None
    referencedByQueries: Optional[List[CustomSQLTable]] = None

    @validator("referencedByQueries", pre=True)
    @classmethod
    def filter_none_queries(cls, v):
        """Filter out CustomSQLTable items where query==None."""
        if v is None:
            return None
        return [item for item in v if item.get("query") is not None]


class DataSource(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[TableauDataModelTag]] = []
    fields: Optional[List[DatasourceField]] = None
    upstreamTables: Optional[List[UpstreamTable]] = None
    upstreamDatasources: Optional[List["DataSource"]] = None


class TableauDatasources(BaseModel):
    nodes: Optional[List[DataSource]] = None
    totalCount: Optional[int] = None


class TableauDatasourcesConnection(BaseModel):
    embeddedDatasourcesConnection: Optional[TableauDatasources] = None


class TableauChart(TableauBaseModel):
    """
    Aux class for Chart object of the tableau_api_lib response
    """

    owner: Optional[TableauOwner] = None
    tags: Optional[Set] = []
    contentUrl: Optional[str] = ""
    sheetType: Optional[str] = ChartType.Other.value


class TableauDashboard(TableauBaseModel):
    """
    Aux class for Dashboard object of the tableau_api_lib response
    """

    model_config = ConfigDict(extra="allow")

    project: Optional[TableauBaseModel] = None
    description: Optional[str] = None
    owner: Optional[TableauOwner] = None
    tags: Optional[Set] = []
    webpageUrl: Optional[str] = None
    charts: Optional[List[TableauChart]] = None
    dataModels: Optional[List[DataSource]] = []
    custom_sql_queries: Optional[List[str]] = None
    user_views: Optional[int] = None


class TableAndQuery(BaseModel):
    """
    Wrapper class for Table entity and associated Query for lineage
    """

    table: Table
    query: Optional[str] = None
