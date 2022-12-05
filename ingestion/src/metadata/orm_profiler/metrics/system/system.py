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

from metadata.orm_profiler.metrics.core import SystemtMetric
from metadata.orm_profiler.orm.registry import Dialects
from metadata.utils.dispatch import valuedispatch
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


@valuedispatch
def get_system_metrics_for_dialect(
    dialect: str,
    session: Session,
    table: DeclarativeMeta,
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


@get_system_metrics_for_dialect.register(Dialects.Snowflake)
def _(
    dialect: str,
    session: Session,
    table: DeclarativeMeta,
) -> List[Dict]:
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

    information_schema_query_history = dedent(
        """
    SELECT * FROM table(information_schema.query_history_by_warehouse(
        warehouse_name=>CURRENT_WAREHOUSE(),
        end_time_range_start=>to_timestamp_ltz(DATEADD(HOUR, -24, CURRENT_TIMESTAMP())),
        end_time_range_end=>to_timestamp_ltz(CURRENT_TIMESTAMP()),
        result_limit=>10000
    ))
    WHERE QUERY_TYPE IN ('INSERT', 'MERGE', 'DELETE', 'UPDATE')
    order by start_time DESC;
    """
    )

    result_scan = """
    SELECT *
    FROM TABLE(RESULT_SCAN('{query_id}'));
    """

    QueryResult = namedtuple(
        "QueryResult",
        "query_id,database_name,schema_name,query_text,query_type,timestamp",
    )

    cursor = session.execute(text(information_schema_query_history))
    rows = cursor.fetchall()
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
        if identifier:
            values = identifier.value.split(".")
            database_name, schema_name, table_name = (
                [None] * (3 - len(values))
            ) + values

            database_name = (
                database_name.lower().strip('"')
                if database_name
                else query_result.database_name
            )
            schema_name = (
                schema_name.lower().strip('"')
                if schema_name
                else query_result.schema_name
            )

            if (
                session.get_bind().url.database.lower() == database_name
                and table.__table_args__["schema"].lower() == schema_name
                and table.__tablename__.lower() == table_name
            ):
                cursor_for_result_scan = session.execute(
                    text(dedent(result_scan.format(query_id=query_result.query_id)))
                )
                row_for_result_scan = cursor_for_result_scan.first()

                metric_results.append(
                    {
                        "timestamp": int(query_result.timestamp.timestamp() * 1000),
                        "operation": "UPDATE"
                        if query_result.query_type == "MERGE"
                        else query_result.query_type,
                        "rowsAffected": row_for_result_scan[0]
                        if row_for_result_scan
                        else None,
                    }
                )

    return metric_results


class System(SystemtMetric):
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

    def sql(self, session: Session):
        """Implements the SQL logic to fetch system data"""
        if not hasattr(self, "table"):
            raise AttributeError(
                "System requires a table to be set: add_props(table=...)(Metrics.COLUMN_COUNT)"
            )

        system_metrics = get_system_metrics_for_dialect(
            session.get_bind().dialect.name,
            session,
            self.table,
        )

        return system_metrics
