"""
Oracle models
"""

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, Field


class OracleStoredObject(BaseModel):
    """Oracle Stored Procedure list query results"""

    name: str
    definition: str
    language: Optional[str] = Field(None, description="Will only be informed for non-SQL routines.")  # noqa: UP045
    owner: str
    procedure_type: Optional[str] = Field(None, alias="procedure_type")  # noqa: UP045


class FetchObject(BaseModel):
    """Oracle Fetch Stored Procedure Raw Model"""

    owner: Optional[str] = None  # noqa: UP045
    name: str
    line: int
    text: str


class FetchObjectList(BaseModel):
    __name__: List[FetchObject]  # noqa: UP006
