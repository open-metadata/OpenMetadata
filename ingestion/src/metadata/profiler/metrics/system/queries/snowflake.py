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
Snowflake System Metric Queries and query operations
"""

import re
from typing import Optional

from sqlalchemy.engine.row import Row

from metadata.utils.logger import profiler_logger
from metadata.utils.profiler_utils import QueryResult, get_identifiers_from_string

logger = profiler_logger()

INFORMATION_SCHEMA_QUERY = """
    SELECT * FROM "SNOWFLAKE"."ACCOUNT_USAGE"."QUERY_HISTORY"
    WHERE
    start_time>= DATEADD('DAY', -1, CURRENT_TIMESTAMP)
    AND QUERY_TEXT ILIKE '%{tablename}%'
    AND QUERY_TYPE IN (
        '{insert}',
        '{update}',
        '{delete}',
        '{merge}'
    )
    AND EXECUTION_STATUS = 'SUCCESS';
"""

RESULT_SCAN = """
    SELECT *
    FROM TABLE(RESULT_SCAN('{query_id}'));
    """


def get_snowflake_system_queries(
    row: Row, database: str, schema: str
) -> Optional[QueryResult]:
    """get snowflake system queries for a specific database and schema. Parsing the query
    is the only reliable way to get the DDL operation as fields in the table are not. If parsing
    fails we'll fall back to regex lookup

    1. Parse the query and check if we have an Identifier
    2.

    Args:
        row (dict): row from the snowflake system queries table
        database (str): database name
        schema (str): schema name
    Returns:
        QueryResult: namedtuple with the query result
    """

    try:
        logger.debug(f"Trying to parse query:\n{row.QUERY_TEXT}\n")

        pattern = r"(?:(INSERT\s*INTO\s*|INSERT\s*OVERWRITE\s*INTO\s*|UPDATE\s*|MERGE\s*INTO\s*|DELETE\s*FROM\s*))([\w._\"]+)(?=[\s*\n])"  # pylint: disable=line-too-long
        match = re.match(pattern, row.QUERY_TEXT, re.IGNORECASE)
        try:
            identifier = match.group(2)
        except (IndexError, AttributeError):
            logger.debug("Could not find identifier in query. Skipping row.")
            return None

        database_name, schema_name, table_name = get_identifiers_from_string(identifier)

        if not all([database_name, schema_name, table_name]):
            logger.debug(
                "Missing database, schema, or table. Can't link operation to table entity in OpenMetadata."
            )
            return None

        if (
            database.lower() == database_name.lower()
            and schema.lower() == schema_name.lower()
        ):
            return QueryResult(
                query_id=row.QUERY_ID,
                database_name=database_name.lower(),
                schema_name=schema_name.lower(),
                table_name=table_name.lower(),
                query_text=row.QUERY_TEXT,
                query_type=row.QUERY_TYPE,
                timestamp=row.START_TIME,
            )
    except Exception:
        return None

    return None
