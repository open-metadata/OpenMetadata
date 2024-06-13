"""
Teradata models
"""
from typing import Optional

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.storedProcedure import Language

STORED_PROC_LANGUAGE_MAP = {
    "SQL": Language.SQL,
    "EXTERNAL": Language.External,
}


class TeradataStoredProcedure(BaseModel):
    """Teradata stored procedure list query results"""

    procedure_name: str = Field(...)
    database_schema: Optional[str] = Field(None)
    procedure_type: str = Field(Language.SQL)
    definition: str = Field(None)
