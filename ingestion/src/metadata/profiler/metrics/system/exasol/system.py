"""
Exasol system metrics implementation.
"""

import re
from typing import List  # noqa: UP035

from pydantic import TypeAdapter
from sqlalchemy import text
from sqlalchemy.orm import Session

from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.ingestion.source.database.exasol.queries import EXASOL_SYSTEM_METRICS_QUERY
from metadata.profiler.metrics.system.dml_operation import DatabaseDMLOperations
from metadata.profiler.metrics.system.system import (
    CacheProvider,
    SystemMetricsComputer,
    register_system_metrics,
)
from metadata.profiler.orm.registry import PythonDialects
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.profiler_utils import QueryResult
from metadata.utils.time_utils import datetime_to_timestamp

DEFAULT_EXASOL_DATABASE = "DEFAULT"

# Exasol currently does not have a fine grain separation for
# DatabaseDMLOperations.MERGE.value into inserts, updates, & deletes.
# To prevent miscalculations, it is not mapped to these operations.


@register_system_metrics(PythonDialects.Exasol)
class ExasolSystemMetricsComputer(SystemMetricsComputer, CacheProvider):
    """Exasol system metrics computer."""

    def __init__(
        self,
        session: Session,
        runner: QueryRunner,
    ):
        self.session = session
        self.database = DEFAULT_EXASOL_DATABASE
        self.schema = runner.schema_name
        self.table = runner.table_name

    def get_inserts(self) -> List[SystemProfile]:  # noqa: UP006
        queries = self.get_or_update_cache(
            f"{self.database}.{self.schema}.{self.table}.{DatabaseDMLOperations.INSERT.value}",
            self._get_queries,
            operation=DatabaseDMLOperations.INSERT.value,
        )
        return get_metric_result(queries, self.table)

    def get_deletes(self) -> List[SystemProfile]:  # noqa: UP006
        queries = self.get_or_update_cache(
            f"{self.database}.{self.schema}.{self.table}.{DatabaseDMLOperations.DELETE.value}",
            self._get_queries,
            operation=DatabaseDMLOperations.DELETE.value,
        )
        return get_metric_result(queries, self.table)

    def get_updates(self) -> List[SystemProfile]:  # noqa: UP006
        queries = self.get_or_update_cache(
            f"{self.database}.{self.schema}.{self.table}.{DatabaseDMLOperations.UPDATE.value}",
            self._get_queries,
            operation=DatabaseDMLOperations.UPDATE.value,
        )
        return get_metric_result(queries, self.table)

    def _get_queries(self, operation: str) -> List[QueryResult]:  # noqa: UP006
        if not self.schema or not self.table:
            return []

        schema_name = self.schema.upper()
        table_name = self.table.upper()
        table_match_pattern = self._get_table_match_pattern(schema_name, table_name)
        params = {
            "database_name": self.database,
            "schema": schema_name,
            "table": table_name,
            "operation": operation,
            "table_match_pattern": table_match_pattern,
        }
        cursor = self.session.execute(text(EXASOL_SYSTEM_METRICS_QUERY), params)

        return [
            QueryResult(
                database_name=row.database,
                schema_name=row.schema,
                table_name=row.table,
                query_text=None,
                query_type=operation,
                start_time=row.starttime,
                rows=row.rows,
            )
            for row in cursor
            if (row.rows is not None) and (row.rows > 0)
        ]

    def _get_table_match_pattern(self, schema_name: str, table_name: str) -> str:
        """Build a regex that matches the target schema.table as a bounded token."""
        escaped_schema_name = re.escape(schema_name)
        escaped_table_name = re.escape(table_name)
        return rf"(?s).*\b{escaped_schema_name}\.{escaped_table_name}\b.*"


def get_metric_result(ddls: List[QueryResult], table_name: str) -> List[SystemProfile]:  # noqa: UP006
    """Convert audit log rows into system profiles."""
    return TypeAdapter(List[SystemProfile]).validate_python(  # noqa: UP006
        [
            {
                "timestamp": datetime_to_timestamp(ddl.start_time, milliseconds=True),
                "operation": ddl.query_type,
                "rowsAffected": ddl.rows,
            }
            for ddl in ddls
            if ddl.table_name.upper() == table_name.upper()
        ]
    )
