#  Copyright 2024 Collate
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
OpenAPI REST API Models
"""
from typing import Optional

from pydantic import AnyUrl, BaseModel

from metadata.generated.schema.entity.data.apiEndpoint import ApiRequestMethod
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.apiSchema import APISchema


class RESTCollection(BaseModel):
    """REST colleciton model"""

    name: basic.EntityName
    display_name: Optional[str] = None
    description: Optional[basic.Markdown] = None
    url: Optional[AnyUrl] = None


class RESTEndpoint(BaseModel):
    """REST endpoint model"""

    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[basic.Markdown] = None
    url: Optional[AnyUrl] = None
    operationId: Optional[str] = None
    request_method: Optional[ApiRequestMethod] = None
    request_schema: Optional[APISchema] = None
    response_schema: Optional[APISchema] = None
