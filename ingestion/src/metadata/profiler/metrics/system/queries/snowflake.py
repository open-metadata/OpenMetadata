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
import traceback
from typing import Optional, Tuple

from sqlalchemy.engine.row import Row

from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.lineage.sql_lineage import search_table_entities
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import profiler_logger
from metadata.utils.profiler_utils import (
    SnowflakeQueryResult,
    get_identifiers_from_string,
)

logger = profiler_logger()

INFORMATION_SCHEMA_QUERY = """
    SELECT
        QUERY_ID,
        QUERY_TEXT,
        QUERY_TYPE,
        START_TIME,
        ROWS_INSERTED,
        ROWS_UPDATED,
        ROWS_DELETED
    FROM "SNOWFLAKE"."ACCOUNT_USAGE"."QUERY_HISTORY"
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


QUERY_PATTERN = r"(?:(INSERT\s*INTO\s*|INSERT\s*OVERWRITE\s*INTO\s*|UPDATE\s*|MERGE\s*INTO\s*|DELETE\s*FROM\s*))([\w._\"\'()]+)(?=[\s*\n])"  # pylint: disable=line-too-long
IDENTIFIER_PATTERN = r"(IDENTIFIER\(\')([\w._\"]+)(\'\))"


def _parse_query(query: str) -> Optional[str]:
    """Parse snowflake queries to extract the identifiers"""
    match = re.match(QUERY_PATTERN, query, re.IGNORECASE)
    try:
        # This will match results like `DATABASE.SCHEMA.TABLE1` or IDENTIFIER('TABLE1')
        # If we have `IDENTIFIER` type of queries coming from Stored Procedures, we'll need to further clean it up.
        identifier = match.group(2)

        match_internal_identifier = re.match(
            IDENTIFIER_PATTERN, identifier, re.IGNORECASE
        )
        internal_identifier = (
            match_internal_identifier.group(2) if match_internal_identifier else None
        )
        if internal_identifier:
            return internal_identifier

        return identifier
    except (IndexError, AttributeError):
        logger.debug("Could not find identifier in query. Skipping row.")
        return None


def get_identifiers(
    identifier: str, ometa_client: OpenMetadata, db_service: DatabaseService
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Get query identifiers and if needed, fetch them from ES"""
    database_name, schema_name, table_name = get_identifiers_from_string(identifier)

    if not table_name:
        logger.debug("Could not extract the table name. Skipping operation.")
        return database_name, schema_name, table_name

    if not all([database_name, schema_name]):
        logger.debug(
            "Missing database or schema info from the query. We'll look for it in ES."
        )
        es_tables = search_table_entities(
            metadata=ometa_client,
            service_name=db_service.fullyQualifiedName.root,
            database=database_name,
            database_schema=schema_name,
            table=table_name,
        )

        if not es_tables:
            logger.debug("No tables match the search criteria.")
            return database_name, schema_name, table_name

        if len(es_tables) > 1:
            logger.debug(
                "Found more than 1 table matching the search criteria."
                " Skipping the computation to not mix system data."
            )
            return database_name, schema_name, table_name

        matched_table = es_tables[0]
        database_name = matched_table.database.name
        schema_name = matched_table.databaseSchema.name

    return database_name, schema_name, table_name


def get_snowflake_system_queries(
    row: Row,
    database: str,
    schema: str,
    ometa_client: OpenMetadata,
    db_service: DatabaseService,
) -> Optional[SnowflakeQueryResult]:
    """
    Run a regex lookup on the query to identify which operation ran against the table.

    If the query does not have the complete set of `database.schema.table` when it runs,
    we'll use ES to pick up the table, if we find it.

    Args:
        row (dict): row from the snowflake system queries table
        database (str): database name
        schema (str): schema name
        ometa_client (OpenMetadata): OpenMetadata client to search against ES
        db_service (DatabaseService): DB service where the process is running against
    Returns:
        QueryResult: namedtuple with the query result
    """

    try:
        dict_row = dict(row)
        query_text = dict_row.get("QUERY_TEXT", dict_row.get("query_text"))
        logger.debug(f"Trying to parse query:\n{query_text}\n")

        identifier = _parse_query(query_text)
        if not identifier:
            return None

        database_name, schema_name, table_name = get_identifiers(
            identifier=identifier,
            ometa_client=ometa_client,
            db_service=db_service,
        )

        if not all([database_name, schema_name, table_name]):
            return None

        if (
            database.lower() == database_name.lower()
            and schema.lower() == schema_name.lower()
        ):
            return SnowflakeQueryResult(
                query_id=dict_row.get("QUERY_ID", dict_row.get("query_id")),
                database_name=database_name.lower(),
                schema_name=schema_name.lower(),
                table_name=table_name.lower(),
                query_text=query_text,
                query_type=dict_row.get("QUERY_TYPE", dict_row.get("query_type")),
                timestamp=dict_row.get("START_TIME", dict_row.get("start_time")),
                rows_inserted=dict_row.get(
                    "ROWS_INSERTED", dict_row.get("rows_inserted")
                ),
                rows_updated=dict_row.get("ROWS_UPDATED", dict_row.get("rows_updated")),
                rows_deleted=dict_row.get("ROWS_DELETED", dict_row.get("rows_deleted")),
            )
    except Exception:
        logger.debug(traceback.format_exc())
        return None

    return None
