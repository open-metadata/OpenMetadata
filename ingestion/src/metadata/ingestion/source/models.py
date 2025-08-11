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
Auxiliary pydantic models used during metadata ingestion
"""
from typing import Optional

from pydantic import BaseModel, Field


class TableView(BaseModel):
    """
    Pydantic model to define a view of a table
    """

    table_name: str = Field(..., description="Name of the table")
    schema_name: str = Field(..., description="Name of the schema")
    db_name: str = Field(..., description="Name of the Database")
    view_definition: Optional[str] = Field(
        None, description="Definition of the view in a specific SQL dialect"
    )
