from typing import Any

from sqlalchemy.engine import Connection, reflection

from metadata.ingestion.source.database.exasol.queries import EXASOL_GET_TABLE_COMMENTS
from metadata.utils.sqlalchemy_utils import get_table_comment_wrapper


@reflection.cache
def get_table_comment(self, connection: Connection, table_name: str, schema: str | None = None, **kw: Any):  # pylint: disable=unused-argument
    return get_table_comment_wrapper(
        self,
        connection,
        query=EXASOL_GET_TABLE_COMMENTS,
        table_name=table_name.upper(),
        schema=schema.upper() if schema else None,
    )
