#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Custom OM connection headers
"""
import json
from functools import singledispatch

import pkg_resources

from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection,
)


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
    version = pkg_resources.require("openmetadata-ingestion")[0].version
    st_list = statement.split(" ")
    statement_with_header = (
        f"{st_list[0]} {render_query_header(version)} {' '.join(st_list[1:])}"
    )
    return statement_with_header, parameters


def inject_query_header(
    conn, cursor, statement, parameters, context, executemany
):  # pylint: disable=unused-argument
    """
    Inject the query header for OpenMetadata Queries
    """

    version = pkg_resources.require("openmetadata-ingestion")[0].version
    statement_with_header = render_query_header(version) + "\n" + statement
    return statement_with_header, parameters
