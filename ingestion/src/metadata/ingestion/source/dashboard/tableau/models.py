#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Tableau Source Model module
"""

from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, validator

from metadata.generated.schema.entity.data.chart import ChartType


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


def transform_tags(raw: Union[Dict[str, Any], List[TableauTag]]) -> List[TableauTag]:
    if isinstance(raw, List):
        return raw
    tags = []
    for tag in raw.get("tag", []):
        tags.append(TableauTag(**tag))
    return tags


class CustomSQLTable(TableauBaseModel):
    """
    GraphQL API CustomSQLTable schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/customsqltable.doc.html
    """

    query: Optional[str] = None


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
    tags: Optional[List[TableauTag]] = []
    _extract_tags = validator("tags", pre=True, allow_reuse=True)(transform_tags)
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
    tags: Optional[List[TableauTag]] = []
    _extract_tags = validator("tags", pre=True, allow_reuse=True)(transform_tags)
    webpageUrl: Optional[str] = None
    charts: Optional[List[TableauChart]] = None
    dataModels: List[DataSource] = []
