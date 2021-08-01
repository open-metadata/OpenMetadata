from pydantic import BaseModel, Field, constr

from metadata.generated.schema.entity.data.database import DatabaseEntity
from metadata.generated.schema.entity.data.table import TableEntity


class OMetaDatabaseAndTable(BaseModel):
    table: TableEntity
    database: DatabaseEntity
