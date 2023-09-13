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
Snowflake models
"""
from typing import Optional

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.storedProcedure import Language

STORED_PROC_LANGUAGE_MAP = {
    "PYTHON": Language.Python,
    "SQL": Language.SQL,
    "JAVA": Language.Java,
    "JAVASCRIPT": Language.JavaScript,
}


class SnowflakeStoredProcedure(BaseModel):
    """Snowflake stored procedure list query results"""

    name: str = Field(..., alias="NAME")
    owner: Optional[str] = Field(..., alias="OWNER")
    language: str = Field(..., alias="LANGUAGE")
    definition: str = Field(..., alias="DEFINITION")
    signature: Optional[str] = Field(..., alias="SIGNATURE")
    comment: Optional[str] = Field(..., alias="COMMENT")
