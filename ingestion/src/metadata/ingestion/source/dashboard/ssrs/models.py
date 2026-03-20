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
SSRS Models
"""
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SsrsReport(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="Id")
    name: str = Field(alias="Name")
    description: Optional[str] = Field(None, alias="Description")
    path: str = Field(alias="Path")
    type: Optional[str] = Field(None, alias="Type")
    hidden: bool = Field(False, alias="Hidden")
    has_data_sources: Optional[bool] = Field(None, alias="HasDataSources")


class SsrsFolder(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="Id")
    name: str = Field(alias="Name")
    path: str = Field(alias="Path")


class SsrsODataResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    odata_count: Optional[int] = Field(None, alias="@odata.count")


class SsrsReportListResponse(SsrsODataResponse):
    value: List[SsrsReport] = Field(default_factory=list)


class SsrsFolderListResponse(SsrsODataResponse):
    value: List[SsrsFolder] = Field(default_factory=list)
