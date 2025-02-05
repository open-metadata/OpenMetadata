"""
Oracle models
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class OracleStoredObject(BaseModel):
    """Oracle Stored Procedure list query results"""

    name: str
    definition: str
    language: Optional[str] = Field(
        None, description="Will only be informed for non-SQL routines."
    )
    owner: str
    procedure_type: Optional[str] = Field(None, alias="procedure_type")


class FetchObject(BaseModel):
    """Oracle Fetch Stored Procedure Raw Model"""

    owner: Optional[str] = None
    name: str
    line: int
    text: str


class FetchObjectList(BaseModel):
    __name__: List[FetchObject]
