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
Postgres models
"""
from typing import Optional

from pydantic import BaseModel, Field


class PostgresStoredProcedure(BaseModel):
    """Postgres stored procedure list query results"""

    name: str = Field(alias="procedure_name")
    schema: str = Field(alias="schema_name")
    definition: str
    language: Optional[str] = None
    procedure_type: Optional[str] = Field(None, alias="procedure_type")
    description: Optional[str] = Field(None, alias="description")
