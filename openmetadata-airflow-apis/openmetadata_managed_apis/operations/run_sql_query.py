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
Run SQL query against a source system
"""

import json
from typing import Tuple, cast

import sqlparse
from flask import Response
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.workflows.ingestion.common import (
    ClientInitializationError,
)
from sqlalchemy import column, func, select, text
from sqlalchemy.engine.cursor import CursorResult
from sqlalchemy.exc import DatabaseError, OperationalError, ProgrammingError
from sqlalchemy.orm import Session, sessionmaker
from sqlparse.sql import Statement

from metadata.generated.schema.entity.automations.runQueryRequest import (
    QueryTypes,
    RunQueryRequest,
)
from metadata.generated.schema.entity.automations.runQueryResponse import (
    Data,
    RunQueryResponse,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.ingestion.models.custom_types import ServiceWithConnectionType
from metadata.ingestion.ometa.ometa_api import OpenMetadata, OpenMetadataConnection
from metadata.ingestion.source.connections import get_connection
from metadata.profiler.orm.registry import Dialects
from metadata.utils.class_helper import get_service_class_from_service_type
from metadata.utils.dispatch import valuedispatch

FORBIDDEN_TOKENS = {
    "CREATE",
    "ALTER",
    "DROP",
    "TRUNCATE",
    "COMMENT",
    "RENAME",
    "INSERT",
    "UPDATE",
    "DELETE",
    "MERGE",
    "CALL",
    "EXPLAIN PLAN",
    "LOCK TABLE",
    "GRANT",
    "REVOKE",
    "COMMIT",
    "ROLLBACK",
    "SAVEPOINT",
    "SET TRANSACTION",
}


def is_safe_sql_query(sql_query: str) -> bool:
    """Validate SQL query

    Args:
        sql_query (str): SQL query

    Returns:
        bool
    """
    parsed_queries: Tuple[Statement] = sqlparse.parse(sql_query)
    for parsed_query in parsed_queries:
        validation = [
            token.normalized in FORBIDDEN_TOKENS for token in parsed_query.tokens
        ]
        if any(validation):
            return False
    return True


def get_service_connection(
    om_server_connection: OpenMetadataConnection,
    service_type: ServiceType,
    service_name: str,
) -> ServiceConnection:
    """get service connection

    Args:
        om_server_connection (OpenMetadataConnection): OM connection
        service_type (ServiceType): service type
        service_name (str): service name

    Raises:
        ClientInitializationError:
        RuntimeError:

    Returns:
        ServiceConnection: a service connection
    """

    try:
        metadata = OpenMetadata(config=om_server_connection)
    except Exception as exc:
        raise ClientInitializationError(f"Failed to initialized client: {exc}")

    service_class = get_service_class_from_service_type(service_type)

    service = metadata.get_by_name(service_class, service_name)
    if not service:
        raise RuntimeError(f"No service found with service name {service_name}.")

    service = cast(ServiceWithConnectionType, service)

    return ServiceConnection(__root__=service.connection)


def get_row_count(cursor: CursorResult) -> RunQueryResponse:
    """Return a simple row count

    Args:
        query (str): query string

    Returns:
        int: count of rows
    """
    rowcount = cursor.rowcount
    if rowcount < 0:
        # certain dialect will not get the actual rowcount
        rowcount = len(cursor.fetchall())

    return RunQueryResponse(
        queryType=QueryTypes.TEST.value,
        data=Data(columnNames=["rowCount"], rowValues=[[rowcount]]),
        error=None,
        offset=None,
        limit=None,
    )


def get_subquery_wrapper(session: Session, query: str):
    """

    Args:
        session (Session): session object
        query (str): query to be executed
    """
    return (
        session.query().from_statement(text(query)).subquery().alias("subqueryWrapper")
    )


def get_res_for_rownum_offset(
    subquery_offset, offset, limit, session
) -> RunQueryResponse:
    """Get query results for query using row number offset

    Args:
        subquery_offset (_type_): subquery wrapping the original query
        offset (_type_): offset to apply
        limit (_type_): limit to apply
        session (_type_): session object

    Returns:
        RunQueryResponse:
    """
    query_to_exec = (
        select(["*"])
        .select_from(subquery_offset)
        .where(column("rank") > offset)
        .limit(limit)
    )
    curs = session.get_bind().execute(query_to_exec)
    columns = [col for col in curs.keys()[:-1]]  # remove the row number column
    rows = [list(row)[:-1] for row in curs.fetchall()]  # remove the row number column

    return RunQueryResponse(
        queryType=QueryTypes.RUN.value,
        data=Data(columnNames=columns, rowValues=rows),
        error=None,
        offset=offset
        + limit,  # the next offset will be the current offset + limit (e.g. 0+100=100)
        limit=limit,
    )


@valuedispatch
def execute_sql_query(
    dialect: str,
    session: Session,
    query: str,
    query_type: QueryTypes,
    limit: int,
    offset: int,
):
    """Generic query execution

    Args:
        dialect (str): dialect
        session (Session): session object
        query (str): query to be executed
        query_type (QueryTypes): query type

    Returns:
        _type_: _description_
    """
    if query_type is QueryTypes.TEST:
        cursor = session.get_bind().execute(query)
        return get_row_count(cursor)

    subquery = get_subquery_wrapper(session, query)
    query_to_exec = select(["*"]).select_from(subquery).limit(limit).offset(offset)
    curs = session.get_bind().execute(query_to_exec)
    columns = [col for col in curs.keys()]
    rows = [list(row) for row in curs.fetchall()]

    return RunQueryResponse(
        queryType=query_type.value,
        data=Data(columnNames=columns, rowValues=rows),
        error=None,
        offset=offset
        + limit,  # the next offset will be the current offset + limit (e.g. 0+100=100)
        limit=limit,
    )


@execute_sql_query.register(Dialects.Presto)
@execute_sql_query.register(Dialects.Trino)
def _(
    dialect: str,
    session: Session,
    query: str,
    query_type: QueryTypes,
    limit: int,
    offset: int,
):
    """Query execution for Presto and Trino

    Args:
        dialect (str): dialect
        session (Session): session object
        query (str): query to be executed
        query_type (QueryTypes): query type

    Returns:
        _type_: _description_
    """
    if query_type is QueryTypes.TEST:
        cursor = session.get_bind().execute(query)
        return get_row_count(cursor)

    subquery = get_subquery_wrapper(session, query)
    subquery_offset = (
        select(
            ["*", func.row_number().over().label("rank")]  # add a row number for offset
        )
        .select_from(subquery)
        .subquery()
        .alias("subqueryOffsetWrapper")
    )

    return get_res_for_rownum_offset(subquery_offset, offset, limit, session)


@execute_sql_query.register(Dialects.Oracle)
def _(
    dialect: str,
    session: Session,
    query: str,
    query_type: QueryTypes,
    limit: int,
    offset: int,
):
    """Query execution for Oracle

    Args:
        dialect (str): dialect
        session (Session): session object
        query (str): query to be executed
        query_type (QueryTypes): query type

    Returns:
        _type_: _description_
    """
    if query_type is QueryTypes.TEST:
        cursor = session.get_bind().execute(query)
        return get_row_count(cursor)

    subquery = get_subquery_wrapper(session, query)
    subquery_offset = (
        select(["*", func.rowNum.label("rank")])  # add a row number for offset
        .select_from(subquery)
        .subquery()
        .alias("subqueryOffsetWrapper")
    )

    return get_res_for_rownum_offset(subquery_offset, offset, limit, session)


@execute_sql_query.register(str(Dialects.Hive))
def _(
    dialect: str,
    session: Session,
    query: str,
    query_type: QueryTypes,
    offset: int,
    limit: int,
):
    """Query execution for Hive

    Args:
        dialect (str): dialect
        session (Session): session object
        query (str): query to be executed
        query_type (QueryTypes): query type

    Returns:
        _type_: _description_
    """
    if query_type is QueryTypes.TEST:
        cursor = session.get_bind().execute(query)
        return get_row_count(cursor)

    subquery = get_subquery_wrapper(session, query)
    subquery_offset = (
        select(
            ["*", func.row_number.over().label("rank")]  # add a row number for offset
        )
        .select_from(subquery)
        .subquery()
        .alias("subqueryOffsetWrapper")
    )

    query_to_exec = (
        select(["*"])
        .select_from(subquery_offset)
        .where(column("rank").between(offset + 1, offset + limit))
    )
    curs = session.get_bind().execute(query_to_exec)
    columns = [col for col in curs.keys()[:-1]]  # remove the row number column
    rows = [list(row)[:-1] for row in curs.fetchall()]  # remove the row number column

    return RunQueryResponse(
        queryType=QueryTypes.RUN.value,
        data=Data(columnNames=columns, rowValues=rows),
        error=None,
        offset=offset
        + limit,  # the next offset will be the current offset + limit (e.g. 0+100=100)
        limit=limit,
    )


def run_sql_query(run_query_config: RunQueryRequest) -> Response:
    """Run SQL query against database source and return paginated results

    Args:
        run_query_config (RunQueryRequest): config file
    """
    if run_query_config.serviceType != ServiceType.Database:
        raise RuntimeError(
            f"{run_query_config.serviceType} service is not supported."
            "Only Database service can run SQL query."
        )

    if not is_safe_sql_query(run_query_config.query):
        raise RuntimeError(
            f"Query {run_query_config.query} does not seem to be"
            " a `SELECT` statement. Safely stopping execution."
        )

    service_connection = get_service_connection(
        run_query_config.openMetadataServerConnection,
        run_query_config.serviceType,
        run_query_config.serviceName.__root__,
    )

    engine = get_connection(service_connection.__root__.config)  # type: ignore
    Session = sessionmaker()
    session = Session(bind=engine)

    try:
        run_resp = execute_sql_query(
            engine.dialect.name,
            session,
            run_query_config.query,
            run_query_config.queryType,
            run_query_config.limit,
            run_query_config.offset,
        )

        # we need to serialize the response to convert the types
        # that are not JSON serializable to string
        serealize = json.dumps(run_resp.dict(), default=str)
        deserialize = json.loads(serealize)
        resp = ApiResponse.success(deserialize)

    except (ProgrammingError, OperationalError, DatabaseError) as exc:
        resp = ApiResponse.error(
            status=ApiResponse.STATUS_BAD_REQUEST,
            error=str(exc),
        )
    except Exception as exc:
        resp = ApiResponse.error(
            status=ApiResponse.STATUS_SERVER_ERROR,
            error=f"Uncaught  exception: {exc}",
        )

    finally:
        session.close()
        engine.dispose()

    return resp
