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
Superset source models.
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class SupersetDashboard(BaseModel):
    """Superset dashboard Model"""

    description: Optional[str]
    id: Optional[int]


class SupersetDashboardList(BaseModel):
    dashboards: Optional[List[SupersetDashboard]] = []


class DashOwner(BaseModel):
    first_name: Optional[str]
    id: Optional[int]
    last_name: Optional[str]
    username: Optional[str]
    email: Optional[str]


class DashboardResult(BaseModel):
    dashboard_title: Optional[str]
    url: Optional[str]
    owners: Optional[List[DashOwner]] = []
    position_json: Optional[str]
    id: Optional[int]
    email: Optional[str]


class SupersetDashboardCount(BaseModel):
    count: Optional[int]
    ids: Optional[List[int]] = []
    dashboard_title: Optional[str]
    result: Optional[List[DashboardResult]] = []


# Chart
class ChartTable(BaseModel):
    default_endpoint: Optional[str]
    table_name: Optional[str]


class ChartResult(BaseModel):
    datasource_id: Optional[int]
    datasource_url: Optional[str]
    description: Optional[str]
    id: Optional[int]
    table: Optional[ChartTable] = ChartTable()
    url: Optional[str]
    slice_name: Optional[str]
    viz_type: Optional[str]


class SupersetChart(BaseModel):
    count: Optional[int]
    ids: Optional[List[int]] = []
    result: Optional[List[ChartResult]] = []


# DataSource
class DSColumns(BaseModel):
    column_name: Optional[str]
    id: Optional[int]
    type: Optional[str]
    description: Optional[str]


class DSDatabase(BaseModel):
    database_name: Optional[str]
    id: Optional[int]


class DataSourceResult(BaseModel):
    database: Optional[DSDatabase] = DSDatabase()
    datasource_type: Optional[str]
    description: Optional[str]
    extra: Optional[str]
    id: Optional[int]
    owners: Optional[list] = []
    table_schema: Optional[str] = Field(None, alias="schema")
    sql: Optional[str]
    table_name: Optional[str]
    template_params: Optional[str]
    url: Optional[str]
    columns: Optional[List[DSColumns]] = []


class SupersetDatasource(BaseModel):
    id: Optional[int]
    result: Optional[DataSourceResult] = DataSourceResult()
    show_title: Optional[str]


# Database


class DbParameter(BaseModel):
    database: Optional[str]
    host: Optional[str]
    password: Optional[str]
    port: Optional[int]
    username: Optional[str]


class DatabaseResult(BaseModel):
    database_name: Optional[str]
    id: Optional[int]
    parameters: Optional[DbParameter] = DbParameter()


class ListDatabaseResult(BaseModel):
    count: Optional[int]
    id: Optional[int]
    result: Optional[DatabaseResult] = DatabaseResult()


class FetchDashboard(BaseModel):
    id: Optional[int]
    dashboard_title: Optional[str]
    position_json: Optional[str]
    email: Optional[str]


class FetchChart(BaseModel):
    id: Optional[int]
    slice_name: Optional[str]
    description: Optional[str]
    table_name: Optional[str]
    table_schema: Optional[str] = Field(None, alias="schema")
    database_name: Optional[str]
    sqlalchemy_uri: Optional[str]
    viz_type: Optional[str]
    datasource_id: Optional[int]


class FetchColumn(BaseModel):
    id: Optional[int]
    type: Optional[str]
    column_name: Optional[str]
    table_name: Optional[str]
    description: Optional[str]
