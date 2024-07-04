"""Models for the TableDiff test case"""

from typing import List, Optional

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Column


class TableParameter(BaseModel):
    serviceUrl: str
    path: str
    columns: List[Column]


class TableDiffRuntimeParameters(BaseModel):
    table1: TableParameter
    table2: TableParameter
    keyColumns: List[str]
    extraColumns: List[str]
    whereClause: Optional[str]
