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

import traceback
from collections import defaultdict, namedtuple
from enum import Enum
from textwrap import dedent
from typing import Dict, List, Optional

import sqlparse
from sqlalchemy import text
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.generated.schema.entity.data.table import DmlOperationType
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.profiler.metrics.core import SystemMetric
from metadata.profiler.orm.registry import Dialects
from metadata.utils.dispatch import valuedispatch
from metadata.utils.helpers import deep_size_of_dict
from metadata.utils.logger import profiler_logger
from metadata.utils.profiler_utils import clean_up_query, get_snowflake_system_queries

logger = profiler_logger()

MAX_SIZE_IN_BYTES = 2 * 1024**3  # 2GB


def recursive_dic():
    """recursive default dict"""
    return defaultdict(recursive_dic)


class DatabaseDMLOperations(Enum):
    """enum of supported DML operation on database engine side"""

    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    MERGE = "MERGE"


DML_OPERATION_MAP = {
    DatabaseDMLOperations.INSERT.value: DmlOperationType.INSERT.value,
    DatabaseDMLOperations.MERGE.value: DmlOperationType.UPDATE.value,
    DatabaseDMLOperations.UPDATE.value: DmlOperationType.UPDATE.value,
    DatabaseDMLOperations.DELETE.value: DmlOperationType.DELETE.value,
}

SYSTEM_QUERY_RESULT_CACHE = recursive_dic()


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
        dialect (str): bigquery
        session (Session): session Object
        table (DeclarativeMeta): orm table

    Returns:
        List[Dict]:
    """
    logger.debug(f"Fetching system metrics for {dialect}")
    dml_stat_to_dml_statement_mapping = {
        "inserted_row_count": DatabaseDMLOperations.INSERT.value,
        "deleted_row_count": DatabaseDMLOperations.DELETE.value,
        "updated_row_count": DatabaseDMLOperations.UPDATE.value,
    }
    project_id = session.get_bind().url.host
    dataset_id = table.__table_args__["schema"]

    jobs = dedent(
        f"""
        SELECT
            statement_type,
            start_time,
            destination_table,
            dml_statistics
        FROM
            `region-{conn_config.usageLocation}`.INFORMATION_SCHEMA.JOBS
        WHERE
            DATE(creation_time) >= CURRENT_DATE() - 1 AND
            destination_table.dataset_id = '{dataset_id}' AND
            destination_table.project_id = '{project_id}' AND
            statement_type IN (
                '{DatabaseDMLOperations.INSERT.value}',
                '{DatabaseDMLOperations.DELETE.value}',
                '{DatabaseDMLOperations.UPDATE.value}',
                '{DatabaseDMLOperations.MERGE.value}'
            )
        ORDER BY creation_time DESC;
        """
    )

    metric_results: List[Dict] = []
    QueryResult = namedtuple(
        "QueryResult",
        "query_type,timestamp,destination_table,dml_statistics",
    )

    if (
        "query_results"
        in SYSTEM_QUERY_RESULT_CACHE[Dialects.BigQuery][project_id][dataset_id]
    ):
        # we'll try to get the cached data first
        query_results = SYSTEM_QUERY_RESULT_CACHE[Dialects.BigQuery][project_id][
            dataset_id
        ]["query_results"]
    else:
        cursor_jobs = session.execute(text(jobs))
        query_results = [
            QueryResult(
                row.statement_type,
                row.start_time,
                row.destination_table,
                row.dml_statistics,
            )
            for row in cursor_jobs.fetchall()
        ]
        SYSTEM_QUERY_RESULT_CACHE[Dialects.BigQuery][project_id][dataset_id][
            "query_results"
        ] = query_results

    for row_jobs in query_results:
        if row_jobs.destination_table.get("table_id") == table.__tablename__:
            rows_affected = None
            try:
                if row_jobs.query_type == DatabaseDMLOperations.INSERT.value:
                    rows_affected = row_jobs.dml_statistics.get("inserted_row_count")
                if row_jobs.query_type == DatabaseDMLOperations.DELETE.value:
                    rows_affected = row_jobs.dml_statistics.get("deleted_row_count")
                if row_jobs.query_type == DatabaseDMLOperations.UPDATE.value:
                    rows_affected = row_jobs.dml_statistics.get("updated_row_count")
            except AttributeError:
                logger.debug(traceback.format_exc())
                rows_affected = None

            if row_jobs.query_type == DatabaseDMLOperations.MERGE.value:
                for indx, key in enumerate(row_jobs.dml_statistics):
                    if row_jobs.dml_statistics[key] != 0:
                        metric_results.append(
                            {
                                # Merge statement can include multiple DML operations
                                # We are padding timestamps by 0,1,2 millisesond to avoid
                                # duplicate timestamps
                                "timestamp": int(row_jobs.timestamp.timestamp() * 1000)
                                + indx,
                                "operation": dml_stat_to_dml_statement_mapping.get(key),
                                "rowsAffected": row_jobs.dml_statistics[key],
                            }
                        )
                continue

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
    logger.debug(f"Fetching system metrics for {dialect}")
    database = session.get_bind().url.database
    schema = table.__table_args__["schema"]

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
            sti."database" = '{database}' AND
            sti."schema" = '{schema}' AND
            "rows" != 0 AND
            DATE(starttime) >= CURRENT_DATE - 1
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
            sti."database" = '{database}' AND
            sti."schema" = '{schema}' AND
            "rows" != 0 AND
            DATE(starttime) >= CURRENT_DATE - 1
        GROUP BY 2,3,4,5,6
        ORDER BY 6 desc
        """
    )

    metric_results: List[Dict] = []
    QueryResult = namedtuple(
        "QueryResult",
        "database_name,schema_name,table_name,query_text,timestamp,rowsAffected",
    )

    if (
        "query_results_inserted"
        in SYSTEM_QUERY_RESULT_CACHE[Dialects.Redshift][database][schema]
    ):
        # we'll try to get the cached data first
        query_results_inserted = SYSTEM_QUERY_RESULT_CACHE[Dialects.Redshift][database][
            schema
        ]["query_results_inserted"]
    else:
        cursor_insert = session.execute(text(stl_insert))
        query_results_inserted = [
            QueryResult(
                row.database,
                row.schema,
                row.table,
                sqlparse.parse(clean_up_query(row.text))[0],
                row.starttime,
                row.rows,
            )
            for row in cursor_insert.fetchall()
        ]
        SYSTEM_QUERY_RESULT_CACHE[Dialects.Redshift][database][schema][
            "query_results_inserted"
        ] = query_results_inserted

    if (
        "query_results_deleted"
        in SYSTEM_QUERY_RESULT_CACHE[Dialects.Redshift][database][schema]
    ):
        # we'll try to get the cached data first
        query_results_deleted = SYSTEM_QUERY_RESULT_CACHE[Dialects.Redshift][database][
            schema
        ]["query_results_deleted"]
    else:
        cursor_deleted = session.execute(text(stl_deleted))
        query_results_deleted = [
            QueryResult(
                row.database,
                row.schema,
                row.table,
                sqlparse.parse(clean_up_query(row.text))[0],
                row.starttime,
                row.rows,
            )
            for row in cursor_deleted.fetchall()
        ]
        SYSTEM_QUERY_RESULT_CACHE[Dialects.Redshift][database][schema][
            "query_results_deleted"
        ] = query_results_deleted

    for row_inserted in query_results_inserted:
        if row_inserted.table_name == table.__tablename__:
            query_text = row_inserted.query_text
            operation = next(
                (
                    token.value.upper()
                    for token in query_text.tokens
                    if token.ttype is sqlparse.tokens.DML
                    and token.value.upper()
                    in DmlOperationType._member_names_  # pylint: disable=protected-access
                ),
                None,
            )
            if operation:
                metric_results.append(
                    {
                        "timestamp": int(row_inserted.timestamp.timestamp() * 1000),
                        "operation": operation,
                        "rowsAffected": row_inserted.rowsAffected,
                    }
                )

    for row_deleted in query_results_deleted:
        if row_deleted.table_name == table.__tablename__:
            query_text = row_deleted.query_text
            operation = next(
                (
                    token.value.upper()
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
    logger.debug(f"Fetching system metrics for {dialect}")
    database = session.get_bind().url.database
    schema = table.__table_args__["schema"]

    metric_results: List[Dict] = []

    information_schema_query_history = f"""
        SELECT * FROM "SNOWFLAKE"."ACCOUNT_USAGE"."QUERY_HISTORY"
        WHERE
        start_time>= DATEADD('DAY', -1, CURRENT_TIMESTAMP)
        AND QUERY_TYPE IN (
            '{DatabaseDMLOperations.INSERT.value}',
            '{DatabaseDMLOperations.UPDATE.value}',
            '{DatabaseDMLOperations.DELETE.value}',
            '{DatabaseDMLOperations.MERGE.value}'
        )
        AND EXECUTION_STATUS = 'SUCCESS';
    """
    result_scan = """
    SELECT *
    FROM TABLE(RESULT_SCAN('{query_id}'));
    """

    if (
        "query_results"
        in SYSTEM_QUERY_RESULT_CACHE[Dialects.Snowflake][database][schema]
    ):
        # we'll try to get the cached data first
        query_results = SYSTEM_QUERY_RESULT_CACHE[Dialects.Snowflake][database][schema][
            "query_results"
        ]
    else:
        rows = session.execute(text(information_schema_query_history))
        query_results = []
        for row in rows:
            result = get_snowflake_system_queries(row, database, schema)
            if result:
                query_results.append(result)
        SYSTEM_QUERY_RESULT_CACHE[Dialects.Snowflake][database][schema][
            "query_results"
        ] = query_results

    for query_result in query_results:
        if table.__tablename__.lower() == query_result.table_name:
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

    def _manage_cache(self, max_size_in_bytes: int = MAX_SIZE_IN_BYTES) -> None:
        """manage cache and clears it if it exceeds the max size

        Args:
            max_size_in_bytes (int, optional): max size of cache in bytes. Defaults to 2147483648.
        Returns:
            None
        """
        if deep_size_of_dict(SYSTEM_QUERY_RESULT_CACHE) > max_size_in_bytes:
            logger.debug("Clearing system cache")
            SYSTEM_QUERY_RESULT_CACHE.clear()

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
        self._manage_cache()
        return system_metrics
