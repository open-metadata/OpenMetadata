#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Custom OM connection headers
"""

import json
import re
from functools import singledispatch
from importlib.metadata import version as _pkg_version

from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection,
)

FIRST_WORD = re.compile(r"\w+")


def render_query_header(ometa_version: str) -> str:
    """
    Render the query header for OpenMetadata Queries
    """

    header_obj = {"app": "OpenMetadata", "version": ometa_version}
    return f"/* {json.dumps(header_obj)} */"


@singledispatch
def inject_query_header_by_conn(_, *args, **kwargs):
    """
    The first argument is the `connection`. Only for dispatching.

    This function will be called by the `listen` event api as a partial
    giving us the connection argument for the dispatch.
    """
    return inject_query_header(*args, **kwargs)


@inject_query_header_by_conn.register(VerticaConnection)
def _(_, conn, cursor, statement, parameters, context, executemany):
    """
    If we add the header at the top, E.g., /*...*/SELECT * FROM XYZ,
    then the query history tables don't store it.
    We need a custom logic to pass the statement in the middle of the query.
    To simplify, we are updating the queries as SELECT /*...*/ * FROM XYZ
    """
    version = _pkg_version("openmetadata-ingestion")
    st_list = statement.split(" ")
    statement_with_header = f"{st_list[0]} {render_query_header(version)} {' '.join(st_list[1:])}"
    return statement_with_header, parameters


def _past_block_comment(statement: str, index: int) -> int | None:
    """Index just past the block comment opening at ``index``, or None if unclosed.

    T-SQL nests block comments, so stopping at the first ``*/`` would leave the
    caller inside the outer one: ``/* a /* b */ AND c */ SELECT ...``.
    """
    depth, index, length = 1, index + 2, len(statement)
    while index < length and depth:
        if statement.startswith("/*", index):
            depth, index = depth + 1, index + 2
        elif statement.startswith("*/", index):
            depth, index = depth - 1, index + 2
        else:
            index += 1
    return None if depth else index


def _executable_start(statement: str) -> int | None:
    """Index of the first character outside any leading comment.

    Returns None when there is nothing executable to anchor on: a statement that is
    only whitespace and comments, or one whose block comment is never closed -- a
    header spliced into an unterminated comment would carry a ``*/`` that closes it.
    """
    index, length = 0, len(statement)
    while index < length:
        if statement[index].isspace():
            index += 1
        elif statement.startswith("--", index):
            line_end = statement.find("\n", index)
            index = length if line_end == -1 else line_end + 1
        elif statement.startswith("/*", index):
            past_comment = _past_block_comment(statement, index)
            if past_comment is None:
                return None
            index = past_comment
        else:
            return index
    return None


def inject_inline_query_header(statement: str) -> str:
    """Return the statement with the OpenMetadata header after its first word.

    Query Store drops whatever precedes the statement's first token, so the header
    only survives inside the statement itself. Two things decide where that is:

    * leading comments are skipped rather than treated as the anchor. A statement
      opening with ``-- note`` would otherwise take ``note`` as its first word and
      bury the header in the comment, which Query Store discards with it. Block
      comment nesting is tracked, so the anchor clears the outermost one.
    * the anchor is the first run of word characters, not the first
      whitespace-delimited token: ``SELECT'a b'`` has no space after the keyword, so
      splitting on whitespace lands the header inside the string literal and changes
      the value the statement returns.
    """
    start = _executable_start(statement)
    if start is None:
        return statement
    first_word = FIRST_WORD.search(statement, start)
    if not first_word:
        return statement
    end = first_word.end()
    header = render_query_header(_pkg_version("openmetadata-ingestion"))
    return f"{statement[:end]} {header}{statement[end:]}"


@inject_query_header_by_conn.register(MssqlConnection)
def _(_, conn, cursor, statement, parameters, context, executemany):  # pylint: disable=unused-argument
    """
    Query Store records one row per statement, and a leading comment belongs to
    the batch rather than to the statement, so it is never stored. Placing the
    header after the first token keeps it inside the statement text.
    """
    return inject_inline_query_header(statement), parameters


@inject_query_header_by_conn.register(AzureSQLConnection)
def _(_, conn, cursor, statement, parameters, context, executemany):  # pylint: disable=unused-argument
    """
    Azure SQL shares SQL Server's Query Store behaviour; see the Mssql override.
    """
    return inject_inline_query_header(statement), parameters


def inject_query_header(conn, cursor, statement, parameters, context, executemany):  # pylint: disable=unused-argument
    """
    Inject the query header for OpenMetadata Queries
    """

    version = _pkg_version("openmetadata-ingestion")
    statement_with_header = render_query_header(version) + "\n" + statement
    return statement_with_header, parameters
