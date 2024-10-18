from typing import List

from sqlalchemy.orm import DeclarativeMeta

from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.ingestion.source.database.redshift.queries import (
    STL_QUERY,
    get_query_results,
)
from metadata.profiler.metrics.system.dml_operation import DatabaseDMLOperations
from metadata.profiler.metrics.system.system import (
    BaseSystemMetricsSource,
    SQASessionProvider,
    CacheProvider,
)
from metadata.utils.logger import profiler_logger
from metadata.utils.profiler_utils import QueryResult
from metadata.utils.time_utils import datetime_to_timestamp

logger = profiler_logger()


class RedshiftSystemMetricsSource(
    SQASessionProvider, BaseSystemMetricsSource, CacheProvider
):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def get_inserts(
        self, database: str, schema: str, table: str
    ) -> List[SystemProfile]:
        queries = self.get_or_update_cache(
            f"{database}.{schema}",
            self._get_insert_queries,
            database=database,
            schema=schema,
        )
        return get_metric_result(queries, table)

    def get_kwargs(self, table: DeclarativeMeta, *args, **kwargs):
        return {
            "table": table.__table__.name,
            "database": self.get_session().get_bind().url.database,
            "schema": table.__table__.schema,
        }

    def get_deletes(
        self, database: str, schema: str, table: str
    ) -> List[SystemProfile]:
        queries = self.get_or_update_cache(
            f"{database}.{schema}",
            self._get_delete_queries,
            database=database,
            schema=schema,
        )
        return get_metric_result(queries, table)

    def get_updates(
        self, database: str, schema: str, table: str
    ) -> List[SystemProfile]:
        queries = self.get_or_update_cache(
            f"{database}.{schema}",
            self._get_update_queries,
            database=database,
            schema=schema,
        )
        return get_metric_result(queries, table)

    def _get_insert_queries(self, database: str, schema: str) -> List[QueryResult]:
        insert_query = STL_QUERY.format(
            alias="si",
            join_type="LEFT",
            condition="sd.query is null",
            database=database,
            schema=schema,
        )
        return get_query_results(
            super().get_session(),
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
        return get_query_results(
            super().get_session(),
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
        return get_query_results(
            super().get_session(),
            update_query,
            DatabaseDMLOperations.UPDATE.value,
        )


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
            "timestamp": datetime_to_timestamp(ddl.start_time, milliseconds=True),
            "operation": ddl.query_type,
            "rowsAffected": ddl.rows,
        }
        for ddl in ddls
        if ddl.table_name == table_name
    ]
