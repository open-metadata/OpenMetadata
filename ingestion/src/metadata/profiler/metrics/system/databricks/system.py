import textwrap
from typing import List

from pydantic import TypeAdapter
from sqlalchemy.orm import Session

from metadata.generated.schema.entity.data.table import SystemProfile
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

SYSTEM_QUERY = textwrap.dedent(
    """
    SELECT
        timestamp AS starttime,
        COALESCE(CAST({column1} AS BIGINT), 0) + COALESCE(CAST({column2} AS BIGINT), 0) AS rows,
        '{database}' AS database,
        '{schema}' AS schema,
        '{table}' AS table
    FROM (DESCRIBE HISTORY {database}.{schema}.{table})
    WHERE operation IN ({operations}) AND timestamp > DATEADD(day, -1, CURRENT_TIMESTAMP())
    """
)


@register_system_metrics(PythonDialects.Databricks)
class DatabricksSystemMetricsComputer(SystemMetricsComputer, CacheProvider):
    """Databricks system metrics computer"""

    def __init__(self, session: Session, runner: QueryRunner, catalog: str):
        self.session = session
        self.table = runner.table_name
        self.database = catalog
        self.schema = runner.schema_name

    def _get_metrics_from_queries(
        self, ddls: List[QueryResult], operation: str
    ) -> List[SystemProfile]:
        return TypeAdapter(List[SystemProfile]).validate_python(
            [
                {
                    "timestamp": datetime_to_timestamp(
                        ddl.start_time, milliseconds=True
                    ),
                    "operation": operation,
                    "rowsAffected": ddl.rows,
                }
                for ddl in ddls
            ]
        )

    def get_inserts(self) -> List[SystemProfile]:
        operations = ", ".join(
            [
                f"'{DatabaseDMLOperations.WRITE.value}'",
                f"'{DatabaseDMLOperations.MERGE.value}'",
            ]
        )
        queries = self.get_or_update_cache(
            f"{self.database}.{self.schema}.{self.table}.{DatabaseDMLOperations.INSERT.value}",
            self._get_query_results,
            self.session,
            SYSTEM_QUERY.format(
                column1="operationMetrics.numOutputRows",
                column2="operationMetrics.numTargetRowsInserted",
                database=self.database,
                schema=self.schema,
                table=self.table,
                operations=operations,
            ),
            DatabaseDMLOperations.INSERT.value,
        )
        return self._get_metrics_from_queries(
            queries, DatabaseDMLOperations.INSERT.value
        )

    def get_deletes(self) -> List[SystemProfile]:
        operations = ", ".join(
            [
                f"'{DatabaseDMLOperations.DELETE.value}'",
                f"'{DatabaseDMLOperations.MERGE.value}'",
            ]
        )
        queries = self.get_or_update_cache(
            f"{self.database}.{self.schema}.{self.table}.{DatabaseDMLOperations.DELETE.value}",
            self._get_query_results,
            self.session,
            SYSTEM_QUERY.format(
                column1="operationMetrics.numDeletedRows",
                column2="operationMetrics.numTargetRowsDeleted",
                database=self.database,
                schema=self.schema,
                table=self.table,
                operations=operations,
            ),
            DatabaseDMLOperations.DELETE.value,
        )
        return self._get_metrics_from_queries(
            queries, DatabaseDMLOperations.DELETE.value
        )

    def get_updates(self) -> List[SystemProfile]:
        operations = ", ".join(
            [
                f"'{DatabaseDMLOperations.UPDATE.value}'",
                f"'{DatabaseDMLOperations.MERGE.value}'",
            ]
        )
        queries = self.get_or_update_cache(
            f"{self.database}.{self.schema}.{self.table}.{DatabaseDMLOperations.UPDATE.value}",
            self._get_query_results,
            self.session,
            SYSTEM_QUERY.format(
                column1="operationMetrics.numUpdatedRows",
                column2="operationMetrics.numTargetRowsUpdated",
                database=self.database,
                schema=self.schema,
                table=self.table,
                operations=operations,
            ),
            DatabaseDMLOperations.UPDATE.value,
        )
        return self._get_metrics_from_queries(
            queries, DatabaseDMLOperations.UPDATE.value
        )
