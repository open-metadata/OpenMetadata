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
Superset source models.
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class SupersetDashboard(BaseModel):
    """Superset dashboard Model"""

    description: Optional[str] = None
    id: Optional[int] = None


class SupersetDashboardList(BaseModel):
    dashboards: Optional[List[SupersetDashboard]] = []


class DashOwner(BaseModel):
    first_name: Optional[str] = None
    id: Optional[int] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None


class DashboardResult(BaseModel):
    dashboard_title: Optional[str] = None
    url: Optional[str] = None
    owners: Optional[List[DashOwner]] = []
    position_json: Optional[str] = None
    id: Optional[int] = None
    email: Optional[str] = None
    published: Optional[bool] = None


class SupersetDashboardCount(BaseModel):
    count: Optional[int] = None
    ids: Optional[List[int]] = []
    dashboard_title: Optional[str] = None
    result: Optional[List[DashboardResult]] = []


# Chart
class ChartTable(BaseModel):
    default_endpoint: Optional[str] = None
    table_name: Optional[str] = None


class ChartResult(BaseModel):
    datasource_id: Optional[int] = None
    datasource_url: Optional[str] = None
    description: Optional[str] = None
    id: Optional[int] = None
    table: Optional[ChartTable] = ChartTable()
    url: Optional[str] = None
    slice_name: Optional[str] = None
    viz_type: Optional[str] = None


class SupersetChart(BaseModel):
    count: Optional[int] = None
    ids: Optional[List[int]] = []
    result: Optional[List[ChartResult]] = []


# DataSource
class DSColumns(BaseModel):
    column_name: Optional[str] = None
    id: Optional[int] = None
    type: Optional[str] = None
    description: Optional[str] = None


class DSDatabase(BaseModel):
    database_name: Optional[str] = None
    id: Optional[int] = None


class DataSourceResult(BaseModel):
    database: Optional[DSDatabase] = DSDatabase()
    datasource_type: Optional[str] = None
    description: Optional[str] = None
    extra: Optional[str] = None
    id: Optional[int] = None
    owners: Optional[list] = []
    table_schema: Optional[str] = Field(None, alias="schema")
    sql: Optional[str] = None
    table_name: Optional[str] = None
    template_params: Optional[str] = None
    url: Optional[str] = None
    columns: Optional[List[DSColumns]] = []


class SupersetDatasource(BaseModel):
    id: Optional[int] = None
    result: Optional[DataSourceResult] = DataSourceResult()
    show_title: Optional[str] = None


# Database


class DbParameter(BaseModel):
    database: Optional[str] = None
    host: Optional[str] = None
    password: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None


class DatabaseResult(BaseModel):
    database_name: Optional[str] = None
    id: Optional[int] = None
    parameters: Optional[DbParameter] = DbParameter()


class ListDatabaseResult(BaseModel):
    count: Optional[int] = None
    id: Optional[int] = None
    result: Optional[DatabaseResult] = DatabaseResult()


class FetchDashboard(BaseModel):
    id: Optional[int] = None
    dashboard_title: Optional[str] = None
    position_json: Optional[str] = None
    published: Optional[bool] = None
    email: Optional[str] = None


class FetchChart(BaseModel):
    id: Optional[int] = None
    slice_name: Optional[str] = None
    description: Optional[str] = None
    table_id: Optional[int] = None
    table_name: Optional[str] = None
    table_schema: Optional[str] = Field(None, alias="schema")
    database_name: Optional[str] = None
    sqlalchemy_uri: Optional[str] = None
    viz_type: Optional[str] = None
    datasource_id: Optional[int] = None
    sql: Optional[str] = None


class FetchColumn(BaseModel):
    id: Optional[int] = None
    type: Optional[str] = None
    column_name: Optional[str] = None
    table_id: Optional[int] = None
    table_name: Optional[str] = None
    description: Optional[str] = None
