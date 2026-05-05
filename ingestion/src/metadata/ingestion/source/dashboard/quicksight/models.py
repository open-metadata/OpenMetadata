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

from typing import List, Optional, Union  # noqa: UP035

from pydantic import BaseModel, Field


class DataSourceResp(BaseModel):
    datasource_arn: str = Field(alias="DataSourceArn")
    schema_name: str = Field(alias="Schema")
    table_name: str = Field(alias="Name")
    columns: Optional[list] = Field(alias="InputColumns")  # noqa: UP045


class DataSourceRespQuery(BaseModel):
    datasource_arn: str = Field(alias="DataSourceArn")
    query: str = Field(alias="SqlQuery")
    table_name: str = Field(alias="Name")
    columns: Optional[list] = Field(alias="Columns")  # noqa: UP045


class DataSourceRespS3(BaseModel):
    datasource_arn: str = Field(alias="DataSourceArn")
    columns: Optional[list] = Field(alias="InputColumns")  # noqa: UP045


class VersionSheet(BaseModel):
    ChartId: Optional[str] = Field(None, alias="SheetId")  # noqa: UP045
    Name: Optional[str] = None  # noqa: UP045


class DashboardVersion(BaseModel):
    Status: Optional[str] = None  # noqa: UP045
    Arn: Optional[str] = None  # noqa: UP045
    SourceEntityArn: Optional[str] = None  # noqa: UP045
    DataSetArns: Optional[List] = None  # noqa: UP006, UP045
    Description: Optional[str] = None  # noqa: UP045
    Charts: Optional[List[VersionSheet]] = Field(None, alias="Sheets")  # noqa: UP006, UP045


class DashboardDetail(BaseModel):
    DashboardId: str
    Arn: Optional[str] = None  # noqa: UP045
    Name: str
    Version: Optional[DashboardVersion] = None  # noqa: UP045


class DashboardResp(BaseModel):
    Dashboard: DashboardDetail
    Status: Optional[int] = None  # noqa: UP045
    RequestId: Optional[str] = None  # noqa: UP045


class DataSourceModel(BaseModel):
    Name: str
    Type: str
    DataSourceId: str
    DataSourceParameters: Optional[dict] = None  # noqa: UP045
    data_source_resp: Optional[Union[DataSourceRespS3, DataSourceRespQuery, DataSourceResp]] = None  # noqa: UP007, UP045


class DescribeDataSourceResponse(BaseModel):
    DataSource: Optional[DataSourceModel] = None  # noqa: UP045
    RequestId: Optional[str] = None  # noqa: UP045
    Status: Optional[int] = None  # noqa: UP045
    dataset_id: Optional[str] = None  # noqa: UP045
    dataset_name: Optional[str] = None  # noqa: UP045
