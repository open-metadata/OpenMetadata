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
Glue Pipeline Source Model module
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class EntityDetails(BaseModel):
    Value: str


class SourceDetails(BaseModel):
    schema_details: EntityDetails = Field(alias="Schema")
    table_details: EntityDetails = Field(alias="Table")


class AmazonRedshift(BaseModel):
    Name: str
    Data: SourceDetails
    database_name: Optional[str] = None

    @property
    def table_name(self):
        if self.Data:
            return self.Data.table_details.Value
        return None

    @property
    def schema_name(self):
        if self.Data:
            return self.Data.schema_details.Value
        return None


class CatalogSource(BaseModel):
    Name: str
    database_name: str = Field(alias="Database")
    schema_name: Optional[str] = None
    table_name: str = Field(alias="Table")


class JDBCSource(BaseModel):
    Name: str
    schema_name: Optional[str] = Field(default=None, alias="SchemaName")
    database_name: Optional[str] = None
    table_name: str = Field(alias="ConnectionTable")


class S3Source(BaseModel):
    Name: str
    Paths: List[str]


class S3Target(BaseModel):
    Name: str
    Path: str
    Paths: Optional[str] = None


class JobNodes(BaseModel):
    config_nodes: Optional[dict] = Field(alias="CodeGenConfigurationNodes")


class JobNodeResponse(BaseModel):
    Job: Optional[JobNodes] = None
