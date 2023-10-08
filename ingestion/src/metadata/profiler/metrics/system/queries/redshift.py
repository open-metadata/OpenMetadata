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
Redshift System Metric Queries and queries operations
"""

from typing import List

from sqlalchemy import text
from sqlalchemy.orm import Session

from metadata.utils.profiler_utils import QueryResult

STL_QUERY = """
    with data as (
        select
            {alias}.*
        from 
            pg_catalog.stl_insert si
            {join_type} join pg_catalog.stl_delete sd on si.query = sd.query
        where 
            {condition}
    )
	SELECT
        SUM(data."rows") AS "rows",
        sti."database",
        sti."schema",
        sti."table",
        DATE_TRUNC('second', data.starttime) AS starttime
    FROM
        data
        INNER JOIN  pg_catalog.svv_table_info sti ON data.tbl = sti.table_id
    where
        sti."database" = '{database}' AND
       	sti."schema" = '{schema}' AND
        "rows" != 0 AND
        DATE(data.starttime) >= CURRENT_DATE - 1
    GROUP BY 2,3,4,5
    ORDER BY 5 DESC
"""


def get_query_results(
    session: Session,
    query,
    operation,
) -> List[QueryResult]:
    """get query results either from cache or from the database

    Args:
        cache (Optional[List[QueryResult]]): cache results
        session (Session): session
        query (_type_): query
        operation (_type_): operation

    Returns:
        List[QueryResult]:
    """
    cursor = session.execute(text(query))
    results = [
        QueryResult(
            database_name=row.database,
            schema_name=row.schema,
            table_name=row.table,
            query_text=None,
            query_type=operation,
            timestamp=row.starttime,
            rows=row.rows,
        )
        for row in cursor
    ]

    return results


def get_metric_result(ddls: List[QueryResult], table_name: str) -> List:
    """Given query results, retur the metric result

    Args:
        ddls (List[QueryResult]): list of query results
        table_name (str): table name

    Returns:
        List:
    """
    return [
        {
            "timestamp": int(ddl.timestamp.timestamp() * 1000),
            "operation": ddl.query_type,
            "rowsAffected": ddl.rows,
        }
        for ddl in ddls
        if ddl.table_name == table_name
    ]
