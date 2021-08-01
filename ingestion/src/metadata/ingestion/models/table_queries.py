from typing import List, Dict, Optional

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import ColumnJoins
from metadata.ingestion.models.json_serializable import JsonSerializable


class TableQuery(JsonSerializable):
    """
    """

    def __init__(self,
                 query: str,
                 label: str,
                 userid: int,
                 xid: int,
                 pid: int,
                 starttime: str,
                 endtime: str,
                 analysis_date: str,
                 duration: int,
                 database: str,
                 aborted: bool,
                 sql: str,
                 ) -> None:
        """
        """
        self.query = query
        self.label = label
        self.userid = userid
        self.xid = xid
        self.pid = pid
        self.starttime = starttime
        self.endtime = endtime
        self.analysis_date = analysis_date
        self.duration = duration
        self.database = database
        self.aborted = aborted
        self.sql = sql


class TableColumn(BaseModel):
    table: str
    column: str


class TableColumnJoin(BaseModel):
    table_column: Optional[TableColumn] = None
    joined_with: Optional[List[TableColumn]] = None


TableColumnJoins = List[TableColumnJoin]


class TableUsageCount(BaseModel):
    table: str
    date: str
    database: str
    count: int = 1
    joins: TableColumnJoins


class QueryParserData(BaseModel):
    tables: List[str]
    tables_aliases: Dict[str, str]
    columns: Dict[str, List[str]]
    date: str
    database: str
    sql: str


class TableUsageRequest(BaseModel):
    date: str
    count: int


class ColumnJoinsList(BaseModel):
    __root__: List[ColumnJoins]


class ColumnJoinedWith(BaseModel):
    fullyQualifiedName: str
    joinCount: int


TablesUsage = List[TableUsageCount]
