from typing import Any

from sqlalchemy.engine import Connection, reflection
from sqlalchemy.engine.interfaces import ReflectedColumn, ReflectedTableComment
from sqlalchemy.sql import text

from metadata.ingestion.source.database.exasol.queries import (
    EXASOL_GET_COLUMN_COMMENTS,
    EXASOL_GET_TABLE_COMMENTS,
)
from metadata.utils.sqlalchemy_utils import get_table_comment_wrapper


@reflection.cache
def get_table_comment(
    self,
    connection: Connection,
    table_name: str,
    schema: str | None = None,
    **kw: Any,  # pylint: disable=unused-argument
) -> ReflectedTableComment:
    table_comment = get_table_comment_wrapper(
        self,
        connection,
        query=EXASOL_GET_TABLE_COMMENTS,
        table_name=table_name.upper(),
        schema=schema.upper() if schema else None,
    )
    return ReflectedTableComment(text=table_comment.get("text"))


def get_columns(
    self,
    connection: Connection,
    table_name: str,
    schema: str | None = None,
    **kw: Any,
) -> list[ReflectedColumn]:
    """
    Return reflected columns and enrich them with column comments.
    """
    columns = get_columns._original(self, connection, table_name, schema, **kw)  # pylint: disable=protected-access  # pyright: ignore[reportFunctionMemberAccess]

    schema_name = connection.dialect._get_schema_for_input(connection, schema)  # pyright: ignore[reportAttributeAccessIssue]
    normalized_schema_name = connection.dialect.denormalize_name(schema_name)

    normalized_table_name = connection.dialect.denormalize_name(table_name)
    result = connection.execute(
        text(EXASOL_GET_COLUMN_COMMENTS),
        {
            "schema": normalized_schema_name,
            "table_name": normalized_table_name,
        },
    )

    column_comments = {}
    for row in result:
        row_mapping = dict(row._mapping)
        column_comments[row_mapping["column_name"].upper()] = row_mapping["comment"]

    for column in columns:
        column["comment"] = column_comments.get(column["name"].upper())

    return columns
