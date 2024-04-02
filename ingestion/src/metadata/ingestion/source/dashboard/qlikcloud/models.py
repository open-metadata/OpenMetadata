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
QlikCloud Models
"""
from typing import List, Optional

from pydantic import BaseModel, Field


# App Models
class QlikApp(BaseModel):
    """QlikCloud App model"""

    description: Optional[str]
    name: Optional[str]
    id: str
    app_id: Optional[str] = Field(alias="resourceId", default=None)
    published: Optional[bool]


class QlikAppList(BaseModel):
    """QlikCloud Apps List"""

    apps: Optional[List[QlikApp]]
