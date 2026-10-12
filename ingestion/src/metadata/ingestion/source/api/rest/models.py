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

from pydantic import AnyUrl, BaseModel

from metadata.generated.schema.entity.data.apiEndpoint import ApiRequestMethod
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.apiSchema import APISchema


class RESTCollection(BaseModel):
    """REST colleciton model"""

    name: basic.EntityName
    display_name: str | None = None
    description: basic.Markdown | None = None
    url: AnyUrl | None = None


class RESTEndpoint(BaseModel):
    """REST endpoint model"""

    name: str | None = None
    display_name: str | None = None
    description: basic.Markdown | None = None
    url: AnyUrl | None = None
    operationId: str | None = None  # noqa: N815
    request_method: ApiRequestMethod | None = None
    request_schema: APISchema | None = None
    response_schema: APISchema | None = None
