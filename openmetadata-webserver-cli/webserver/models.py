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
Local webserver pydantic models
"""
from pydantic import BaseModel, Field
from pydantic_core import Url
from typing_extensions import Annotated


class OMetaServerModel(BaseModel):
    """Init request to start the local server instance"""

    server_url: Annotated[
        Url,
        Field(
            description="OpenMetadata or Collate server instance URL. E.g., http://localhost:8585/api"
        ),
    ]
    token: Annotated[str, Field(description="Token to authenticate the server")]
