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
Pydantic Model to validate Quick Sight responses
"""

from typing import List, Optional, Union

from pydantic import BaseModel, Field


class DataSourceResp(BaseModel):
    datasource_arn: str = Field(alias="DataSourceArn")
    schema_name: str = Field(alias="Schema")
    table_name: str = Field(alias="Name")
    columns: Optional[list] = Field(alias="InputColumns")


class DataSourceRespQuery(BaseModel):
    datasource_arn: str = Field(alias="DataSourceArn")
    query: str = Field(alias="SqlQuery")
    table_name: str = Field(alias="Name")
    columns: Optional[list] = Field(alias="Columns")


class DataSourceRespS3(BaseModel):
    datasource_arn: str = Field(alias="DataSourceArn")
    columns: Optional[list] = Field(alias="InputColumns")


class VersionSheet(BaseModel):
    ChartId: Optional[str] = Field(None, alias="SheetId")
    Name: Optional[str] = None


class DashboardVersion(BaseModel):
    Status: Optional[str] = None
    Arn: Optional[str] = None
    SourceEntityArn: Optional[str] = None
    DataSetArns: Optional[List] = None
    Description: Optional[str] = None
    Charts: Optional[List[VersionSheet]] = Field(None, alias="Sheets")


class DashboardDetail(BaseModel):
    DashboardId: str
    Arn: Optional[str] = None
    Name: str
    Version: Optional[DashboardVersion] = None


class DashboardResp(BaseModel):
    Dashboard: DashboardDetail
    Status: Optional[int] = None
    RequestId: Optional[str] = None


class DataSourceModel(BaseModel):
    Name: str
    Type: str
    DataSourceId: str
    DataSourceParameters: Optional[dict] = None
    data_source_resp: Optional[
        Union[DataSourceRespS3, DataSourceRespQuery, DataSourceResp]
    ] = None


class DescribeDataSourceResponse(BaseModel):
    DataSource: Optional[DataSourceModel] = None
    RequestId: Optional[str] = None
    Status: Optional[int] = None
