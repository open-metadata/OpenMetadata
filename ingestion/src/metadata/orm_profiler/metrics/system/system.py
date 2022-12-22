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
System Metric
"""

from collections import namedtuple
from textwrap import dedent
from typing import Dict, List, Optional

import sqlparse
from sqlalchemy import text
from sqlalchemy.orm import DeclarativeMeta, Session
from sqlparse.sql import Identifier

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.orm_profiler.metrics.core import SystemMetric
from metadata.orm_profiler.orm.registry import Dialects
from metadata.utils.dispatch import valuedispatch
from metadata.utils.logger import profiler_logger

logger = profiler_logger()

DML_OPERATION_MAP = {
    "INSERT": "INSERT",
    "MERGE": "UPDATE",
    "UPDATE": "UPDATE",
    "DELETE": "DELETE",
}


@valuedispatch
def get_system_metrics_for_dialect(
    dialect: str,
    session: Session,
    table: DeclarativeMeta,
    *args,
    **kwargs,
) -> Optional[Dict]:
    """_summary_

    Args:
        dialect (str): database API dialect
        session (Session): session object

    Returns:
        Optional[Dict]: For BigQuery, Snowflake, Redshift returns
            {
                timestamp: <timestamp>,
                operationType: <Enum: 'INSERT', 'UPDATE', 'DELETE'>
                rowsAffected: <int>,
            } else returns None
    """
    logger.info(f"System metrics not support for {dialect}. Skipping processing.")
    return None


@get_system_metrics_for_dialect.register(Dialects.BigQuery)
def _(
    dialect: str,
    session: Session,
    table: DeclarativeMeta,
    conn_config: BigQueryConnection,
    *args,
    **kwargs,
) -> List[Dict]:
    """Compute system metrics for bigquery

    Args:
        dialect (str): bigqeury
        session (Session): session Object
        table (DeclarativeMeta): orm table

    Returns:
        List[Dict]:
    """
    logger.info(f"Fetching system metrics for {dialect}")

    region = (
        f"region-{conn_config.usageLocation}"
        if conn_config.usageLocation in {"us", "eu"}
        else conn_config.usageLocation
    )

    jobs = dedent(
        f"""
        SELECT 
            statement_type,
            start_time,
            destination_table,
            dml_statistics
        FROM 
            `{region}`.INFORMATION_SCHEMA.JOBS
        WHERE
            DATE(creation_time) = CURRENT_DATE() - 1 AND
            statement_type IN ('INSERT', 'UPDATE', 'INSERT')
        ORDER BY creation_time DESC;
        """
    )

    metric_results: List[Dict] = []
    QueryResult = namedtuple(
        "QueryResult",
        "query_type,timestamp,destination_table,dml_statistics",
    )

    cursor_jobs = session.execute(text(jobs))
    rows_jobs = [
        QueryResult(
            row.statement_type,
            row.start_time,
            row.destination_table,
            row.dml_statistics,
        )
        for row in cursor_jobs.fetchall()
    ]

    for row_jobs in rows_jobs:
        if (
            row_jobs.destination_table.get("project_id") == session.get_bind().url.host
            and row_jobs.destination_table.get("dataset_id")
            == table.__table_args__["schema"]
            and row_jobs.destination_table.get("table_id") == table.__tablename__
        ):
            rows_affected = None
            if row_jobs.query_type == "INSERT":
                rows_affected = row_jobs.dml_statistics.get("inserted_row_count")
            if row_jobs.query_type == "DELETE":
                rows_affected = row_jobs.dml_statistics.get("deleted_row_count")
            if row_jobs.query_type == "UPDATE":
                rows_affected = row_jobs.dml_statistics.get("updated_row_count")

            metric_results.append(
                {
                    "timestamp": int(row_jobs.timestamp.timestamp() * 1000),
                    "operation": row_jobs.query_type,
                    "rowsAffected": rows_affected,
                }
            )

    return metric_results


@get_system_metrics_for_dialect.register(Dialects.Redshift)
def _(
    dialect: str,
    session: Session,
    table: DeclarativeMeta,
    *args,
    **kwargs,
) -> List[Dict]:
    """List all the DML operations for reshifts tables

    Args:
        dialect (str): redshift
        session (Session): session object
        table (DeclarativeMeta): orm table

    Returns:
        List[Dict]:
    """
    logger.info(f"Fetching system metrics for {dialect}")

    stl_deleted = dedent(
        f"""
        SELECT
            SUM(si."rows") AS "rows",
            sti."database",
            sti."schema",
            sti."table",
            sq.text,
            DATE_TRUNC('second', si.starttime) AS starttime
        FROM
            pg_catalog.stl_delete si
            INNER JOIN  pg_catalog.svv_table_info sti ON si.tbl = sti.table_id 
            INNER JOIN pg_catalog.stl_querytext sq ON si.query = sq.query
        WHERE
            sti."database" = '{session.get_bind().url.database}' AND
            sti."schema" = '{table.__table_args__["schema"]}' AND
            sti."table" = '{table.__tablename__}' AND
            "rows" != 0 AND
            DATE(starttime) = CURRENT_DATE - 1
        GROUP BY 2,3,4,5,6
        ORDER BY 6 desc
        """
    )

    stl_insert = dedent(
        f"""
        SELECT
            SUM(si."rows") AS "rows",
            sti."database",
            sti."schema",
            sti."table",
            sq.text,
            DATE_TRUNC('second', si.starttime) AS starttime
        FROM
            pg_catalog.stl_insert si
            INNER JOIN  pg_catalog.svv_table_info sti ON si.tbl = sti.table_id 
            INNER JOIN pg_catalog.stl_querytext sq ON si.query = sq.query
        WHERE
            sti."database" = '{session.get_bind().url.database}' AND
            sti."schema" = '{table.__table_args__["schema"]}' AND
            sti."table" = '{table.__tablename__}' AND
            "rows" != 0 AND
            DATE(starttime) = CURRENT_DATE - 1
        GROUP BY 2,3,4,5,6
        ORDER BY 6 desc
        """
    )

    metric_results: List[Dict] = []
    QueryResult = namedtuple(
        "QueryResult",
        "database_name,schema_name,table_name,query_text,timestamp,rowsAffected",
    )

    cursor_insert = session.execute(text(stl_insert))
    rows_insert = [
        QueryResult(
            row.database,
            row.schema,
            row.table,
            sqlparse.parse(row.text)[0],
            row.starttime,
            row.rows,
        )
        for row in cursor_insert.fetchall()
    ]

    cursor_deleted = session.execute(text(stl_deleted))
    rows_deleted = [
        QueryResult(
            row.database,
            row.schema,
            row.table,
            sqlparse.parse(row.text)[0],
            row.starttime,
            row.rows,
        )
        for row in cursor_deleted.fetchall()
    ]

    for row_insert in rows_insert:
        query_text = row_insert.query_text
        operation = next(
            (
                token.value
                for token in query_text.tokens
                if token.ttype is sqlparse.tokens.DML
            ),
            None,
        )
        if operation:
            metric_results.append(
                {
                    "timestamp": int(row_insert.timestamp.timestamp() * 1000),
                    "operation": operation,
                    "rowsAffected": row_insert.rowsAffected,
                }
            )

    for row_deleted in rows_deleted:
        query_text = row_deleted.query_text
        operation = next(
            (
                token.value
                for token in query_text.tokens
                if token.ttype is sqlparse.tokens.DML and token.value != "UPDATE"
            ),
            None,
        )

        if operation:
            metric_results.append(
                {
                    "timestamp": int(row_deleted.timestamp.timestamp() * 1000),
                    "operation": operation,
                    "rowsAffected": row_deleted.rowsAffected,
                }
            )

    return metric_results


@get_system_metrics_for_dialect.register(Dialects.Snowflake)
def _(
    dialect: str,
    session: Session,
    table: DeclarativeMeta,
    *args,
    **kwargs,
) -> Optional[List[Dict]]:
    """Fetch system metrics for Snowflake. query_history will return maximum 10K rows in one request.
    We'll be fetching all the queries ran for the past 24 hours and filtered on specific query types
    (INSERTS, MERGE, DELETE, UPDATE).

    To get the number of rows affected we'll use the specific query ID.

    Args:
        dialect (str): dialect
        session (Session): session object

    Returns:
        Dict: system metric
    """
    logger.info(f"Fetching system metrics for {dialect}")

    metric_results: List[Dict] = []

    information_schema_query_history = """
    SELECT * FROM table(information_schema.query_history_by_warehouse(
        warehouse_name=>CURRENT_WAREHOUSE(),
        end_time_range_start=>to_timestamp_ltz(DATEADD(HOUR, -{decrement_start}, CURRENT_TIMESTAMP())),
        end_time_range_end=>to_timestamp_ltz(DATEADD(HOUR, -{decrement_end}, CURRENT_TIMESTAMP())),
        result_limit=>10000
    ))
    WHERE QUERY_TYPE IN ('INSERT', 'MERGE', 'DELETE', 'UPDATE')
    order by start_time DESC;
    """

    result_scan = """
    SELECT *
    FROM TABLE(RESULT_SCAN('{query_id}'));
    """

    QueryResult = namedtuple(
        "QueryResult",
        "query_id,database_name,schema_name,query_text,query_type,timestamp",
    )

    rows = []

    # limit of results is 10K. We'll query range of 1 hours to make sure we
    # get all the necessary data.
    for decrement in range(24):
        cursor = session.execute(
            text(
                dedent(
                    information_schema_query_history.format(
                        decrement_start=decrement + 1, decrement_end=decrement
                    )
                )
            )
        )
        rows.extend(cursor.fetchall())

    query_results = [
        QueryResult(
            row.query_id,
            row.database_name.lower() if row.database_name else None,
            row.schema_name.lower() if row.schema_name else None,
            sqlparse.parse(row.query_text)[0],
            row.query_type,
            row.start_time,
        )
        for row in rows
    ]

    for query_result in query_results:
        query_text = query_result.query_text
        identifier = next(
            (
                query_el
                for query_el in query_text.tokens
                if isinstance(query_el, Identifier)
            ),
            None,
        )
        if not identifier:
            continue

        values = identifier.value.split(".")
        database_name, schema_name, table_name = ([None] * (3 - len(values))) + values

        database_name = (
            database_name.lower().strip('"')
            if database_name
            else query_result.database_name
        )
        schema_name = (
            schema_name.lower().strip('"') if schema_name else query_result.schema_name
        )

        if (
            session.get_bind().url.database.lower() == database_name
            and table.__table_args__["schema"].lower() == schema_name
            and table.__tablename__ == table_name
        ):
            cursor_for_result_scan = session.execute(
                text(dedent(result_scan.format(query_id=query_result.query_id)))
            )
            row_for_result_scan = cursor_for_result_scan.first()

            metric_results.append(
                {
                    "timestamp": int(query_result.timestamp.timestamp() * 1000),
                    "operation": DML_OPERATION_MAP.get(query_result.query_type),
                    "rowsAffected": row_for_result_scan[0]
                    if row_for_result_scan
                    else None,
                }
            )

    return metric_results


class System(SystemMetric):
    """System metric class to fetch:
        1. freshness
        2. affected rows

    This is supported only for BigQuery, Snowflake, and Redshift
    """

    @classmethod
    def is_col_metric(cls) -> bool:
        """
        Marks the metric as table or column metric.

        By default, assume that a metric is a column
        metric. Table metrics should override this.
        """
        return False

    @classmethod
    def is_system_metrics(cls) -> bool:
        """True if returns system metrics"""
        return True

    @classmethod
    def name(cls):
        return "system"

    def sql(self, session: Session, **kwargs):
        """Implements the SQL logic to fetch system data"""
        if not hasattr(self, "table"):
            raise AttributeError(
                "System requires a table to be set: add_props(table=...)(Metrics.COLUMN_COUNT)"
            )

        conn_config = kwargs.get("conn_config")

        system_metrics = get_system_metrics_for_dialect(
            session.get_bind().dialect.name,
            session=session,
            table=self.table,
            conn_config=conn_config,
        )

        return system_metrics
