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

import uuid
from typing import Dict, List, Optional, Set, Union  # noqa: UP035

from pydantic import BaseModel, ConfigDict, Field, field_validator

from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.table import Table


class TableauBaseModel(BaseModel):
    """
    Tableau basic configurations
    """

    model_config = ConfigDict(extra="allow")

    # in case of personal space workbooks, the project id is returned as a UUID
    id: Union[str, uuid.UUID]  # noqa: UP007
    name: Optional[str] = None  # noqa: UP045

    # pylint: disable=no-self-argument
    @field_validator("id", mode="before")
    def coerce_uuid_to_string(cls, value):  # noqa: N805
        """Ensure id is always stored as a string internally"""
        if isinstance(value, uuid.UUID):
            return str(value)
        return value

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

    email: Optional[str] = None  # noqa: UP045


class TableauDatasource(BaseModel):
    """
    Model for downstream datasource information
    """

    id: Optional[str] = None  # noqa: UP045
    name: Optional[str] = None  # noqa: UP045


class CustomSQLTable(TableauBaseModel):
    """
    GraphQL API CustomSQLTable schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/customsqltable.doc.html
    """

    downstreamDatasources: Optional[List[TableauDatasource]] = None  # noqa: N815, UP006, UP045
    query: Optional[str] = None  # noqa: UP045


class CustomSQLTablesResponse(BaseModel):
    """
    Model for the custom SQL tables response
    """

    data: Dict[str, List[CustomSQLTable]]  # noqa: UP006


class UpstreamColumn(BaseModel):
    id: str
    name: Optional[str] = None  # noqa: UP045
    remoteType: Optional[str] = None  # noqa: N815, UP045


class DatasourceField(BaseModel):
    id: str
    name: Optional[str] = None  # noqa: UP045
    upstreamColumns: Optional[List[Union[UpstreamColumn, None]]] = None  # noqa: N815, UP006, UP007, UP045
    description: Optional[str] = None  # noqa: UP045
    formula: Optional[str] = None  # noqa: UP045


class UpstreamTableColumn(BaseModel):
    id: str
    name: Optional[str] = None  # noqa: UP045


class TableauDatabase(BaseModel):
    id: str
    name: Optional[str] = None  # noqa: UP045


class UpstreamTable(BaseModel):
    id: str
    luid: str
    name: Optional[str] = None  # noqa: UP045
    fullName: Optional[str] = None  # noqa: N815, UP045
    schema_: Optional[str] = Field(None, alias="schema")  # noqa: UP045
    columns: Optional[List[UpstreamTableColumn]] = None  # noqa: UP006, UP045
    database: Optional[TableauDatabase] = None  # noqa: UP045
    referencedByQueries: Optional[List[CustomSQLTable]] = None  # noqa: N815, UP006, UP045

    @field_validator("referencedByQueries", mode="before")
    @classmethod
    def filter_none_queries(cls, v):
        """Filter out CustomSQLTable items where query==None."""
        if v is None:
            return None
        return [item for item in v if item.get("query") is not None]


class DataSource(BaseModel):
    id: str
    name: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    projectName: Optional[str] = None  # noqa: N815, UP045
    tags: Optional[List[TableauDataModelTag]] = []  # noqa: UP006, UP045
    fields: Optional[List[DatasourceField]] = None  # noqa: UP006, UP045
    upstreamTables: Optional[List[UpstreamTable]] = None  # noqa: N815, UP006, UP045
    upstreamDatasources: Optional[List["DataSource"]] = None  # noqa: N815, UP006, UP045


class TableauDatasources(BaseModel):
    nodes: Optional[List[DataSource]] = None  # noqa: UP006, UP045
    totalCount: Optional[int] = None  # noqa: N815, UP045


class TableauDatasourcesConnection(BaseModel):
    embeddedDatasourcesConnection: Optional[TableauDatasources] = None  # noqa: N815, UP045


class TableauChart(TableauBaseModel):
    """
    Aux class for Chart object of the tableau_api_lib response
    """

    owner: Optional[TableauOwner] = None  # noqa: UP045
    tags: Optional[Set] = []  # noqa: UP006, UP045
    contentUrl: Optional[str] = ""  # noqa: N815, UP045
    sheetType: Optional[str] = ChartType.Other.value  # noqa: N815, UP045


class TableauDashboard(TableauBaseModel):
    """
    Aux class for Dashboard object of the tableau_api_lib response
    """

    model_config = ConfigDict(extra="allow")

    project: Optional[TableauBaseModel] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    owner: Optional[TableauOwner] = None  # noqa: UP045
    tags: Optional[Set] = []  # noqa: UP006, UP045
    webpageUrl: Optional[str] = None  # noqa: N815, UP045
    charts: Optional[List[TableauChart]] = None  # noqa: UP006, UP045
    dataModels: Optional[List[DataSource]] = []  # noqa: N815, UP006, UP045
    custom_sql_queries: Optional[List[str]] = None  # noqa: UP006, UP045
    user_views: Optional[int] = None  # noqa: UP045


class TableAndQuery(BaseModel):
    """
    Wrapper class for Table entity and associated Query for lineage
    """

    table: Table
    query: Optional[str] = None  # noqa: UP045
