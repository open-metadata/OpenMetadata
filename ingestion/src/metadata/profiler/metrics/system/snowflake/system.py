"""Snowflake system metrics source"""

import hashlib
import re
import traceback
from typing import List, Optional, Tuple

import sqlalchemy.orm
from pydantic import TypeAdapter
from sqlalchemy.orm import Session

from metadata.generated.schema.entity.data.table import DmlOperationType, SystemProfile
from metadata.ingestion.source.database.snowflake.models import (
    SnowflakeQueryLogEntry,
    SnowflakeQueryResult,
)
from metadata.profiler.metrics.system.dml_operation import DatabaseDMLOperations
from metadata.profiler.metrics.system.system import (
    CacheProvider,
    SystemMetricsComputer,
    register_system_metrics,
)
from metadata.profiler.orm.registry import PythonDialects
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.collections import CaseInsensitiveString
from metadata.utils.logger import profiler_logger
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache
from metadata.utils.profiler_utils import get_identifiers_from_string
from metadata.utils.time_utils import datetime_to_timestamp

PUBLIC_SCHEMA = "PUBLIC"
logger = profiler_logger()
RESULT_SCAN = """
    SELECT *
    FROM TABLE(RESULT_SCAN('{query_id}'));
    """
QUERY_PATTERN = r"(?:(INSERT\s*INTO\s*|INSERT\s*OVERWRITE\s*INTO\s*|UPDATE\s*|MERGE\s*INTO\s*|DELETE\s*FROM\s*))([\w._\"\'()]+)(?=[\s*\n])"  # pylint: disable=line-too-long
IDENTIFIER_PATTERN = r"(IDENTIFIER\(\')([\w._\"]+)(\'\))"


def sha256_hash(text: str) -> str:
    """Return the SHA256 hash of the text"""

    return hashlib.sha256(text.encode()).hexdigest()


cache = LRUCache(LRU_CACHE_SIZE)


@cache.wrap(key_func=lambda query: sha256_hash(query.strip()))
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


class SnowflakeTableResovler:
    """A class the resolves snowflake tables by mimicking snowflake's default resolution logic:
    https://docs.snowflake.com/en/sql-reference/name-resolution

    This default specification searches in the following order:
    - The explicitly provided schema
    - The current schema
    - The public schema

    This can be altered by changing the SEARCH_PATH session parameter. If the users change
    this paramter, this resolver will might return wrong values.

    There is no way to extract the SEARCH_PATH from the query after it has been executed. Hence, we can
    only rely on the default behavior and maybe allow the users to configure the search path
    at the connection level (TODO).
    """

    def __init__(self, session: sqlalchemy.orm.Session):
        self._cache = LRUCache[bool](LRU_CACHE_SIZE)
        self.session = session

    def show_tables(self, db, schema, table):
        return self.session.execute(
            f'SHOW TABLES LIKE \'{table}\' IN SCHEMA "{db}"."{schema}" LIMIT 1;'
        ).fetchone()

    def table_exists(self, db, schema, table):
        """Return True if the table exists in Snowflake. Uses cache to store the results.

        Args:
            db (str): Database name
            schema (str): Schema name
            table (str): Table name

        Returns:
            bool: True if the table exists in Snowflake
        """
        if f"{db}.{schema}.{table}" in self._cache:
            return self._cache.get(f"{db}.{schema}.{table}")
        table = self.show_tables(db, schema, table)
        if table:
            self._cache.put(f"{db}.{schema}.{table}", True)
            return True
        return False

    def resolve_implicit_fqn(
        self,
        context_database: str,
        context_schema: Optional[str],
        table_name: str,
    ) -> Tuple[str, str, str]:
        """Resolve the fully qualified name of the table from snowflake based on the following logic:
        1. If the schema is provided:
            a. search for the table in the schema
            b. if not found, go to (2)
        2. Search for the table in the public schema.

        Args:
            context_database (str): Database name
            context_schema (Optional[str]): Schema name. If not provided, we'll search in the public schema.
            table_name (str): Table name
        Returns:
            tuple: Tuple of database, schema and table names
        Raises:
            RuntimeError: If the table is not found in the metadata or if there are duplicate results
            (there shouldn't be)

        """
        search_paths = []
        if context_schema and self.table_exists(
            context_database, context_schema, table_name
        ):
            search_paths += ".".join([context_database, context_schema, table_name])
            return context_database, context_schema, table_name
        if context_schema != PUBLIC_SCHEMA and self.table_exists(
            context_database, PUBLIC_SCHEMA, table_name
        ):
            search_paths += ".".join([context_database, PUBLIC_SCHEMA, table_name])
            return context_database, PUBLIC_SCHEMA, table_name
        raise RuntimeError(
            "Could not find the table {search_paths}.".format(  # pylint: disable=consider-using-f-string
                search_paths=" OR ".join(map(lambda x: f"[{x}]", search_paths))
            )
        )

    def resolve_snowflake_fqn(
        self,
        context_database: str,
        context_schema: Optional[str],
        identifier: str,
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Get query identifiers from the query text. If the schema is not provided in the query, we'll look for
        the table under "PUBLIC" in Snowflake.
        Database can be retrieved from the query or the query context.
        If the schema doesnt exist in the query but does in the context, we need to check with Snowflake if table
        exists in (1) the context schema or ib (2) the public schema in order to imitate the behavior of the query
        engine. There are edge cases where the table was deleted (and hence not found in the metadata). In such cases,
        the function will raise an error. It is advised to set the profier window such that there will be minimal
        drift between the query execution and the profiler run.

        Args:
            context_database (str): Database name from the query context
            context_schema (Optional[str]): Schema name from the query context
            identifier (str): Identifier string extracted from a query (can be
             'db.schema.table', 'schema.table' or just 'table')
        Returns:
            Tuple[Optional[str], Optional[str], Optional[str]]: Tuple of database, schema and table names
        Raises:
            RuntimeError: If the table name is not found in the query or if fqn resolution fails
        """
        (
            database_identifier,
            schema_identifier,
            table_name,
        ) = get_identifiers_from_string(identifier)
        if not table_name:
            raise RuntimeError("Could not extract the table name.")
        if not context_database and not database_identifier:
            logger.debug(
                f"Could not resolve database name. {identifier=}, {context_database=}"
            )
            raise RuntimeError("Could not resolve database name.")
        if schema_identifier is not None:
            return (
                database_identifier or context_database,
                schema_identifier,
                table_name,
            )
        logger.debug(
            "Missing schema info from the query. We'll look for it in Snowflake for [%s] or [%s]",
            (
                ".".join(
                    [
                        database_identifier or context_database,
                        context_schema,
                        table_name,
                    ]
                )
                if context_schema
                else None
            ),
            ".".join(
                [database_identifier or context_database, PUBLIC_SCHEMA, table_name]
            ),
        )
        # If the schema is not explicitly provided in the query, we'll need to resolve it from OpenMetadata
        # by cascading the search from the context to the public schema.
        result = self.resolve_implicit_fqn(
            context_database=context_database,
            context_schema=context_schema,
            table_name=table_name,
        )
        logger.debug("Resolved table [%s]", ".".join(result))
        return result


def get_snowflake_system_queries(
    query_log_entry: SnowflakeQueryLogEntry,
    resolver: SnowflakeTableResovler,
) -> Optional[SnowflakeQueryResult]:
    """
    Run a regex lookup on the query to identify which operation ran against the table.

    If the query does not have the complete set of `database.schema.table` when it runs,
    we'll use ES to pick up the table, if we find it.

    Args:
        query_log_entry (dict): row from the snowflake system queries table
        resolver (SnowflakeTableResolver): resolver to get the table identifiers
    Returns:
        QueryResult: namedtuple with the query result
    """

    try:
        logger.debug(f"Parsing snowflake query [{query_log_entry.query_id}]")
        identifier = _parse_query(query_log_entry.query_text)
        if not identifier:
            raise RuntimeError("Could not identify the table from the query.")

        database_name, schema_name, table_name = resolver.resolve_snowflake_fqn(
            identifier=identifier,
            context_database=query_log_entry.database_name,
            context_schema=query_log_entry.schema_name,
        )

        if not all([database_name, schema_name, table_name]):
            raise RuntimeError(
                f"Could not extract the identifiers from the query [{query_log_entry.query_id}]."
            )

        return SnowflakeQueryResult(
            query_id=query_log_entry.query_id,
            database_name=database_name.lower(),
            schema_name=schema_name.lower(),
            table_name=table_name.lower(),
            query_text=query_log_entry.query_text,
            query_type=query_log_entry.query_type,
            start_time=query_log_entry.start_time,
            rows_inserted=query_log_entry.rows_inserted,
            rows_updated=query_log_entry.rows_updated,
            rows_deleted=query_log_entry.rows_deleted,
        )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"""Error while processing query with id [{query_log_entry.query_id}]: {exc}\n
            To investigate the query run:
            SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY WHERE query_id = '{query_log_entry.query_id}'
            """
        )
    return None


@register_system_metrics(PythonDialects.Snowflake)
class SnowflakeSystemMetricsComputer(
    SystemMetricsComputer, CacheProvider[SnowflakeQueryLogEntry]
):
    """Snowflake system metrics source"""

    def __init__(self, session: Session, runner: QueryRunner):
        self.session = session
        self.runner = runner
        self.table = runner.table_name
        self.database = runner.session.get_bind().url.database
        self.schema = runner.schema_name
        self.resolver = SnowflakeTableResovler(
            session=session,
        )

    def get_inserts(self) -> List[SystemProfile]:
        return self.get_system_profile(
            self.database,
            self.schema,
            self.table,
            list(
                self.get_queries_by_operation(
                    self.table,
                    [
                        DatabaseDMLOperations.INSERT,
                        DatabaseDMLOperations.MERGE,
                    ],
                )
            ),
            "rows_inserted",
            DmlOperationType.INSERT,
        )

    def get_updates(self) -> List[SystemProfile]:
        return self.get_system_profile(
            self.database,
            self.schema,
            self.table,
            list(
                self.get_queries_by_operation(
                    self.table,
                    [
                        DatabaseDMLOperations.UPDATE,
                        DatabaseDMLOperations.MERGE,
                    ],
                )
            ),
            "rows_updated",
            DmlOperationType.UPDATE,
        )

    def get_deletes(self) -> List[SystemProfile]:
        return self.get_system_profile(
            self.database,
            self.schema,
            self.table,
            list(
                self.get_queries_by_operation(
                    self.table,
                    [
                        DatabaseDMLOperations.DELETE,
                    ],
                )
            ),
            "rows_deleted",
            DmlOperationType.DELETE,
        )

    @staticmethod
    def get_system_profile(
        db: str,
        schema: str,
        table: str,
        query_results: List[SnowflakeQueryResult],
        rows_affected_field: str,
        operation: DmlOperationType,
    ) -> List[SystemProfile]:
        if not SnowflakeQueryResult.model_fields.get(rows_affected_field):
            raise ValueError(
                f"rows_affected_field [{rows_affected_field}] is not a valid field in SnowflakeQueryResult."
            )
        return TypeAdapter(List[SystemProfile]).validate_python(
            [
                {
                    "timestamp": datetime_to_timestamp(q.start_time, milliseconds=True),
                    "operation": operation,
                    "rowsAffected": getattr(q, rows_affected_field),
                }
                for q in query_results
                if getattr(q, rows_affected_field) > 0
                # snowflake SQL identifiers are case insensitive. All identifiers are stored in upper case.
                and (
                    CaseInsensitiveString(db),
                    CaseInsensitiveString(schema),
                    CaseInsensitiveString(table),
                )
                == (
                    q.database_name,
                    q.schema_name,
                    q.table_name,
                )
            ]
        )

    def get_queries_by_operation(
        self, table: str, operations: List[DatabaseDMLOperations]
    ):
        ops = [op.value for op in operations]
        yield from (
            query for query in self.get_queries(table) if query.query_type in ops
        )

    def get_queries(self, table: str) -> List[SnowflakeQueryResult]:
        queries = self.get_or_update_cache(
            table,
            SnowflakeQueryLogEntry.get_for_table,
            session=self.session,
            tablename=table,
        )
        results = [
            get_snowflake_system_queries(
                query_log_entry=row,
                resolver=self.resolver,
            )
            for row in queries
        ]
        return [result for result in results if result is not None]
