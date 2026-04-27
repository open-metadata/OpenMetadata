from sqlalchemy.engine import reflection

from metadata.ingestion.source.database.exasol.queries import EXASOL_GET_TABLE_COMMENTS
from metadata.utils.sqlalchemy_utils import get_table_comment_wrapper


@reflection.cache
def get_table_comment(self, connection, table_name, schema=None, **kw):
    return get_table_comment_wrapper(
        self,
        connection,
        query=EXASOL_GET_TABLE_COMMENTS,
        table_name=table_name.upper(),
        schema=schema.upper() if schema else None,
    )
