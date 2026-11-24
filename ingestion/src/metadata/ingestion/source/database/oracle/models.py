"""
Oracle models
"""

from pydantic import BaseModel, Field


class OracleStoredObject(BaseModel):
    """Oracle Stored Procedure list query results"""

    name: str
    definition: str
    language: str | None = Field(None, description="Will only be informed for non-SQL routines.")
    owner: str
    procedure_type: str | None = Field(None, alias="procedure_type")


class FetchObject(BaseModel):
    """Oracle Fetch Stored Procedure Raw Model"""

    owner: str | None = None
    name: str
    line: int
    text: str


class FetchObjectList(BaseModel):
    __name__: list[FetchObject]
