"""
Oracle models
"""
from typing import Optional

from pydantic import BaseModel, Field


class OracleStoredProcedure(BaseModel):
    """Oracle Stored Procedure list query results"""

    name: str
    definition: str
    language: Optional[str] = Field(
        None, description="Will only be informed for non-SQL routines."
    )
    owner: str
