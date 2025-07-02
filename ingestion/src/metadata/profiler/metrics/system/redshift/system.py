"""
Implemetation for the redshift system metrics source
"""

from typing import List

from pydantic import TypeAdapter
from sqlalchemy.orm import Session

from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.ingestion.source.database.redshift.queries import STL_QUERY
from metadata.profiler.metrics.system.dml_operation import DatabaseDMLOperations
from metadata.profiler.metrics.system.system import (
    CacheProvider,
    SystemMetricsComputer,
    register_system_metrics,
)
from metadata.profiler.orm.registry import PythonDialects
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import profiler_logger
from metadata.utils.profiler_utils import QueryResult
from metadata.utils.time_utils import datetime_to_timestamp

logger = profiler_logger()


@register_system_metrics(PythonDialects.Redshift)
class RedshiftSystemMetricsComputer(SystemMetricsComputer, CacheProvider):
    """Redshift system metrics source class"""

    def __init__(
        self,
        session: Session,
        runner: QueryRunner,
    ):
        self.session = session
        self.table = runner.table_name
        self.database = runner.session.get_bind().url.database
        self.schema = runner.schema_name

    def get_inserts(self) -> List[SystemProfile]:
        queries = self.get_or_update_cache(
            f"{self.database}.{self.schema}.{DatabaseDMLOperations.INSERT.value}",
            self._get_insert_queries,
            database=self.database,
            schema=self.schema,
        )
        return get_metric_result(queries, self.table)

    def get_deletes(self) -> List[SystemProfile]:
        queries = self.get_or_update_cache(
            f"{self.database}.{self.schema}.{DatabaseDMLOperations.DELETE.value}",
            self._get_delete_queries,
            database=self.database,
            schema=self.schema,
        )
        return get_metric_result(queries, self.table)

    def get_updates(self) -> List[SystemProfile]:
        queries = self.get_or_update_cache(
            f"{self.database}.{self.schema}.{DatabaseDMLOperations.UPDATE.value}",
            self._get_update_queries,
            database=self.database,
            schema=self.schema,
        )
        return get_metric_result(queries, self.table)

    def _get_insert_queries(self, database: str, schema: str) -> List[QueryResult]:
        insert_query = STL_QUERY.format(
            alias="si",
            join_type="LEFT",
            condition="sd.query is null",
            database=database,
            schema=schema,
        )
        return self._get_query_results(
            self.session,
            insert_query,
            DatabaseDMLOperations.INSERT.value,
        )

    def _get_delete_queries(self, database: str, schema: str) -> List[QueryResult]:
        delete_query = STL_QUERY.format(
            alias="sd",
            join_type="RIGHT",
            condition="si.query is null",
            database=database,
            schema=schema,
        )
        return self._get_query_results(
            self.session,
            delete_query,
            DatabaseDMLOperations.DELETE.value,
        )

    def _get_update_queries(self, database: str, schema: str) -> List[QueryResult]:
        update_query = STL_QUERY.format(
            alias="si",
            join_type="INNER",
            condition="sd.query is not null",
            database=database,
            schema=schema,
        )
        return self._get_query_results(
            self.session,
            update_query,
            DatabaseDMLOperations.UPDATE.value,
        )


def get_metric_result(ddls: List[QueryResult], table_name: str) -> List[SystemProfile]:
    """Given query results, retur the metric result

    Args:
        ddls (List[QueryResult]): list of query results
        table_name (str): table name

    Returns:
        List:
    """
    return TypeAdapter(List[SystemProfile]).validate_python(
        [
            {
                "timestamp": datetime_to_timestamp(ddl.start_time, milliseconds=True),
                "operation": ddl.query_type,
                "rowsAffected": ddl.rows,
            }
            for ddl in ddls
            if ddl.table_name == table_name
        ]
    )
