"""Models for the TableDiff test case"""
from typing import List, Optional

from pydantic import BaseModel


class TableDiffRuntimeParameters(BaseModel):
    service1Url: str
    service2Url: str
    table1: str
    table2: str
    keyColumns: List[str]
    extraColumns: List[str]
    whereClause: Optional[str]
