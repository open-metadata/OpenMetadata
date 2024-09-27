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
#  pylint: disable=unused-argument
"""
System Metric
"""

import traceback
from collections import defaultdict
from typing import Dict, List, Optional

from pydantic import TypeAdapter
from sqlalchemy import text
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.ingestion.source.database.snowflake.profiler.system import (
    build_snowflake_query_results,
)
from metadata.profiler.metrics.core import SystemMetric
from metadata.profiler.metrics.system.dml_operation import (
    DML_OPERATION_MAP,
    DatabaseDMLOperations,
)
from metadata.profiler.metrics.system.queries.bigquery import (
    DML_STAT_TO_DML_STATEMENT_MAPPING,
    JOBS,
    BigQueryQueryResult,
)
from metadata.profiler.orm.registry import Dialects
from metadata.utils.dispatch import valuedispatch
from metadata.utils.helpers import deep_size_of_dict
from metadata.utils.logger import profiler_logger
from metadata.utils.profiler_utils import get_value_from_cache, set_cache
from metadata.utils.time_utils import datetime_to_timestamp

logger = profiler_logger()

MAX_SIZE_IN_BYTES = 2 * 1024**3  # 2GB


def recursive_dic():
    """recursive default dict"""
    return defaultdict(recursive_dic)


SYSTEM_QUERY_RESULT_CACHE = recursive_dic()


@valuedispatch
def get_system_metrics_for_dialect(
    dialect: str,
    session: Session,
    table: DeclarativeMeta,
    *args,
    **kwargs,
) -> Optional[List[SystemProfile]]:
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
    logger.debug(f"System metrics not support for {dialect}. Skipping processing.")


@get_system_metrics_for_dialect.register(Dialects.BigQuery)
def _(
    dialect: str,
    session: Session,
    table: DeclarativeMeta,
    conn_config: BigQueryConnection,
    *args,
    **kwargs,
) -> List[SystemProfile]:
    """Compute system metrics for bigquery

    Args:
        dialect (str): bigquery
        session (Session): session Object
        table (DeclarativeMeta): orm table

    Returns:
        List[Dict]:
    """
    logger.debug(f"Fetching system metrics for {dialect}")

    project_id = session.get_bind().url.host
    dataset_id = table.__table_args__["schema"]  # type: ignore

    metric_results: List[Dict] = []

    jobs = get_value_from_cache(
        SYSTEM_QUERY_RESULT_CACHE, f"{Dialects.BigQuery}.{project_id}.{dataset_id}.jobs"
    )

    if not jobs:
        cursor_jobs = session.execute(
            text(
                JOBS.format(
                    usage_location=conn_config.usageLocation,
                    dataset_id=dataset_id,
                    project_id=project_id,
                    insert=DatabaseDMLOperations.INSERT.value,
                    update=DatabaseDMLOperations.UPDATE.value,
                    delete=DatabaseDMLOperations.DELETE.value,
                    merge=DatabaseDMLOperations.MERGE.value,
                )
            )
        )
        jobs = [
            BigQueryQueryResult(
                query_type=row.statement_type,
                timestamp=row.start_time,
                table_name=row.destination_table,
                dml_statistics=row.dml_statistics,
            )
            for row in cursor_jobs
        ]
        set_cache(
            SYSTEM_QUERY_RESULT_CACHE,
            f"{Dialects.BigQuery}.{project_id}.{dataset_id}.jobs",
            jobs,
        )

    for job in jobs:
        if job.table_name.get("table_id") == table.__tablename__:  # type: ignore
            rows_affected = None
            try:
                if job.query_type == DatabaseDMLOperations.INSERT.value:
                    rows_affected = job.dml_statistics.get("inserted_row_count")
                if job.query_type == DatabaseDMLOperations.DELETE.value:
                    rows_affected = job.dml_statistics.get("deleted_row_count")
                if job.query_type == DatabaseDMLOperations.UPDATE.value:
                    rows_affected = job.dml_statistics.get("updated_row_count")
            except AttributeError:
                logger.debug(traceback.format_exc())
                rows_affected = None

            if job.query_type == DatabaseDMLOperations.MERGE.value:
                for indx, key in enumerate(job.dml_statistics):
                    if job.dml_statistics[key] != 0:
                        metric_results.append(
                            {
                                # Merge statement can include multiple DML operations
                                # We are padding timestamps by 0,1,2 millisesond to avoid
                                # duplicate timestamps
                                "timestamp": int(job.timestamp.timestamp() * 1000)
                                + indx,
                                "operation": DML_STAT_TO_DML_STATEMENT_MAPPING.get(key),
                                "rowsAffected": job.dml_statistics[key],
                            }
                        )
                continue

            metric_results.append(
                {
                    "timestamp": int(job.timestamp.timestamp() * 1000),
                    "operation": job.query_type,
                    "rowsAffected": rows_affected,
                }
            )

    return TypeAdapter(List[SystemProfile]).validate_python(metric_results)


@get_system_metrics_for_dialect.register(Dialects.Snowflake)
def _(
    dialect: str,
    session: Session,
    table: DeclarativeMeta,
    *args,
    **kwargs,
) -> Optional[List[Dict]]:
    """Fetch system metrics for Snowflake. query_history will return maximum 10K rows in one request.
    We'll be fetching all the queries ran for the past 24 hours and filtered on specific query types
    (INSERTS, MERGE, DELETE, UPDATE).

    :waring: Unlike redshift and bigquery results are not cached as we'll be looking
    at DDL for each table

    To get the number of rows affected we'll use the specific query ID.

    Args:
        dialect (str): dialect
        session (Session): session object

    Returns:
        Dict: system metric
    """
    logger.debug(f"Fetching system metrics for {dialect}")

    metric_results: List[Dict] = []

    query_results = build_snowflake_query_results(
        session=session,
        table=table,
    )

    for query_result in query_results:
        rows_affected = None
        if query_result.query_type == DatabaseDMLOperations.INSERT.value:
            rows_affected = query_result.rows_inserted
        if query_result.query_type == DatabaseDMLOperations.DELETE.value:
            rows_affected = query_result.rows_deleted
        if query_result.query_type == DatabaseDMLOperations.UPDATE.value:
            rows_affected = query_result.rows_updated
        if query_result.query_type == DatabaseDMLOperations.MERGE.value:
            if query_result.rows_inserted:
                metric_results.append(
                    {
                        "timestamp": datetime_to_timestamp(
                            query_result.start_time, milliseconds=True
                        ),
                        "operation": DatabaseDMLOperations.INSERT.value,
                        "rowsAffected": query_result.rows_inserted,
                    }
                )
            if query_result.rows_updated:
                metric_results.append(
                    {
                        "timestamp": datetime_to_timestamp(
                            query_result.start_time, milliseconds=True
                        ),
                        "operation": DatabaseDMLOperations.UPDATE.value,
                        "rowsAffected": query_result.rows_updated,
                    }
                )
            continue

        metric_results.append(
            {
                "timestamp": datetime_to_timestamp(
                    query_result.start_time, milliseconds=True
                ),
                "operation": DML_OPERATION_MAP.get(query_result.query_type),
                "rowsAffected": rows_affected,
            }
        )


class System(SystemMetric):
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
        return MetricType.system.value

    def _manage_cache(self, max_size_in_bytes: int = MAX_SIZE_IN_BYTES) -> None:
        """manage cache and clears it if it exceeds the max size

        Args:
            max_size_in_bytes (int, optional): max size of cache in bytes. Defaults to 2147483648.
        Returns:
            None
        """
        if deep_size_of_dict(SYSTEM_QUERY_RESULT_CACHE) > max_size_in_bytes:
            logger.debug("Clearing system cache")
            SYSTEM_QUERY_RESULT_CACHE.clear()

    def _validate_attrs(self, attr_list: List[str]) -> None:
        """Validate the necessary attributes given via add_props"""
        for attr in attr_list:
            if not hasattr(self, attr):
                raise AttributeError(
                    f"System requires a table to be set: add_props({attr}=...)(Metrics.SYSTEM.value)"
                )

    def sql(self, session: Session, **kwargs):
        """Implements the SQL logic to fetch system data"""
        self._validate_attrs(["table", "ometa_client", "db_service"])

        conn_config = kwargs.get("conn_config")

        system_metrics = get_system_metrics_for_dialect(
            session.get_bind().dialect.name,
            session=session,
            table=self.table,  # pylint: disable=no-member
            conn_config=conn_config,
            ometa_client=self.ometa_client,  # pylint: disable=no-member
            db_service=self.db_service,  # pylint: disable=no-member
        )
        self._manage_cache()
        return system_metrics
