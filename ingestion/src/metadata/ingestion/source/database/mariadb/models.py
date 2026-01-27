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
MariaDB models
"""
from typing import Optional

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureType

ROUTINE_TYPE_MAP = {
    "PROCEDURE": StoredProcedureType.StoredProcedure,
    "FUNCTION": StoredProcedureType.Function,
}


class MariaDBStoredProcedure(BaseModel):
    """
    MariaDB stored procedure list query results
    """

    name: str = Field(alias="procedure_name")
    schema_name: str
    definition: str
    language: Optional[str]
    procedure_type: Optional[str]
    description: Optional[str]
