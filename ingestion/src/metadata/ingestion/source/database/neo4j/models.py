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
Neo4j graph schema models
"""

from pydantic import BaseModel, ConfigDict


class PropertySpec(BaseModel):
    """A property of a node label or relationship type, as reported by db.schema.*TypeProperties()"""

    model_config = ConfigDict(frozen=True)

    name: str
    types: tuple[str, ...]
    mandatory: bool


class GraphElementSpec(BaseModel):
    """A node label or relationship type with the properties observed on it"""

    model_config = ConfigDict(frozen=True)

    name: str
    properties: tuple[PropertySpec, ...]
