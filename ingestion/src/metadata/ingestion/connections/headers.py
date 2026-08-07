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

FIRST_TOKEN = re.compile(r"\S+")


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


def inject_inline_query_header(statement: str) -> str:
    """Return the statement with the OpenMetadata header after its first token.

    Statements that already start with a comment are returned unchanged.
    """
    stripped = statement.lstrip()
    first_token = FIRST_TOKEN.match(stripped)
    if not first_token or stripped.startswith("/*"):
        return statement
    leading_whitespace = statement[: len(statement) - len(stripped)]
    token = first_token.group(0)
    header = render_query_header(_pkg_version("openmetadata-ingestion"))
    return f"{leading_whitespace}{token} {header}{stripped[len(token) :]}"


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
