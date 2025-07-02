"""BigQuery system metric source"""

from typing import List

from pydantic import TypeAdapter
from sqlalchemy.orm import Session

from metadata.generated.schema.entity.data.table import DmlOperationType, SystemProfile
from metadata.ingestion.source.database.bigquery.queries import BigQueryQueryResult
from metadata.profiler.metrics.system.dml_operation import DatabaseDMLOperations
from metadata.profiler.metrics.system.system import (
    CacheProvider,
    SystemMetricsComputer,
    register_system_metrics,
)
from metadata.profiler.orm.registry import PythonDialects
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import profiler_logger
from metadata.utils.time_utils import datetime_to_timestamp

logger = profiler_logger()


@register_system_metrics(PythonDialects.BigQuery)
class BigQuerySystemMetricsComputer(SystemMetricsComputer, CacheProvider):
    """BigQuery system metrics source class"""

    def __init__(
        self,
        session: Session,
        runner: QueryRunner,
        usage_location: str,
    ):
        self.session = session
        self.table = runner.table_name
        self.project_id = runner.session.get_bind().url.host
        self.dataset_id = runner.schema_name
        self.usage_location = usage_location

    def get_deletes(self) -> List[SystemProfile]:
        return self.get_system_profile(
            self.project_id,
            self.dataset_id,
            self.table,
            list(
                self.get_queries_by_operation(
                    self.usage_location,
                    self.project_id,
                    self.dataset_id,
                    [
                        DatabaseDMLOperations.DELETE,
                    ],
                )
            ),
            "deleted_row_count",
            DmlOperationType.DELETE,
        )

    def get_updates(self) -> List[SystemProfile]:
        return self.get_system_profile(
            self.project_id,
            self.dataset_id,
            self.table,
            self.get_queries_by_operation(
                self.usage_location,
                self.project_id,
                self.dataset_id,
                [
                    DatabaseDMLOperations.UPDATE,
                    DatabaseDMLOperations.MERGE,
                ],
            ),
            "updated_row_count",
            DmlOperationType.UPDATE,
        )

    def get_inserts(self) -> List[SystemProfile]:
        return self.get_system_profile(
            self.project_id,
            self.dataset_id,
            self.table,
            self.get_queries_by_operation(
                self.usage_location,
                self.project_id,
                self.dataset_id,
                [
                    DatabaseDMLOperations.INSERT,
                    DatabaseDMLOperations.MERGE,
                ],
            ),
            "inserted_row_count",
            DmlOperationType.INSERT,
        )

    def get_queries_by_operation(
        self,
        usage_location: str,
        project_id: str,
        dataset_id: str,
        operations: List[DatabaseDMLOperations],
    ) -> List[BigQueryQueryResult]:
        ops = {op.value for op in operations}
        yield from (
            query
            for query in self.get_queries(usage_location, project_id, dataset_id)
            if query.statement_type in ops
        )

    def get_queries(
        self, usage_location: str, project_id: str, dataset_id: str
    ) -> List[BigQueryQueryResult]:
        return self.get_or_update_cache(
            f"{project_id}.{dataset_id}",
            BigQueryQueryResult.get_for_table,
            session=self.session,
            usage_location=usage_location,
            project_id=project_id,
            dataset_id=dataset_id,
        )

    @staticmethod
    def get_system_profile(
        project_id: str,
        dataset_id: str,
        table: str,
        query_results: List[BigQueryQueryResult],
        rows_affected_field: str,
        operation: DmlOperationType,
    ) -> List[SystemProfile]:
        if not BigQueryQueryResult.model_fields.get(rows_affected_field):
            raise ValueError(
                f"rows_affected_field [{rows_affected_field}] is not a valid field in BigQueryQueryResult."
            )
        return TypeAdapter(List[SystemProfile]).validate_python(
            [
                {
                    "timestamp": datetime_to_timestamp(q.start_time, milliseconds=True),
                    "operation": operation,
                    "rowsAffected": getattr(q, rows_affected_field),
                }
                for q in query_results
                if getattr(q, rows_affected_field)
                or -1 > 0
                and q.project_id == project_id
                and q.dataset_id == dataset_id
                and q.table_name == table
            ]
        )
