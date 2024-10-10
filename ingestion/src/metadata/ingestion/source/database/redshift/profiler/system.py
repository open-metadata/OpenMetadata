from typing import Dict, List

from pydantic import TypeAdapter
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.ingestion.source.database.redshift.queries import (
    STL_QUERY,
    get_metric_result,
    get_query_results,
)
from metadata.profiler.metrics.system.dml_operation import DatabaseDMLOperations
from metadata.profiler.metrics.system.system import (
    SYSTEM_QUERY_RESULT_CACHE,
    get_system_metrics_for_dialect,
)
from metadata.profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger
from metadata.utils.profiler_utils import get_value_from_cache, set_cache

logger = profiler_logger()


@get_system_metrics_for_dialect.register(Dialects.Redshift)
def _(
    dialect: str,
    session: Session,
    table: DeclarativeMeta,
    *args,
    **kwargs,
) -> List[SystemProfile]:
    """List all the DML operations for reshifts tables

    Args:
        dialect (str): redshift
        session (Session): session object
        table (DeclarativeMeta): orm table

    Returns:
        List[Dict]:
    """
    logger.debug(f"Fetching system metrics for {dialect}")
    database = session.get_bind().url.database
    schema = table.__table_args__["schema"]  # type: ignore

    metric_results: List[Dict] = []

    # get inserts ddl queries
    inserts = get_value_from_cache(
        SYSTEM_QUERY_RESULT_CACHE, f"{Dialects.Redshift}.{database}.{schema}.inserts"
    )
    if not inserts:
        insert_query = STL_QUERY.format(
            alias="si",
            join_type="LEFT",
            condition="sd.query is null",
            database=database,
            schema=schema,
        )
        inserts = get_query_results(
            session,
            insert_query,
            DatabaseDMLOperations.INSERT.value,
        )
        set_cache(
            SYSTEM_QUERY_RESULT_CACHE,
            f"{Dialects.Redshift}.{database}.{schema}.inserts",
            inserts,
        )
    metric_results.extend(get_metric_result(inserts, table.__tablename__))

    # get deletes ddl queries
    deletes = get_value_from_cache(
        SYSTEM_QUERY_RESULT_CACHE, f"{Dialects.Redshift}.{database}.{schema}.deletes"
    )
    if not deletes:
        delete_query = STL_QUERY.format(
            alias="sd",
            join_type="RIGHT",
            condition="si.query is null",
            database=database,
            schema=schema,
        )
        deletes = get_query_results(
            session,
            delete_query,
            DatabaseDMLOperations.DELETE.value,
        )
        set_cache(
            SYSTEM_QUERY_RESULT_CACHE,
            f"{Dialects.Redshift}.{database}.{schema}.deletes",
            deletes,
        )
    metric_results.extend(get_metric_result(deletes, table.__tablename__))  # type: ignore

    # get updates ddl queries
    updates = get_value_from_cache(
        SYSTEM_QUERY_RESULT_CACHE, f"{Dialects.Redshift}.{database}.{schema}.updates"
    )
    if not updates:
        update_query = STL_QUERY.format(
            alias="si",
            join_type="INNER",
            condition="sd.query is not null",
            database=database,
            schema=schema,
        )
        updates = get_query_results(
            session,
            update_query,
            DatabaseDMLOperations.UPDATE.value,
        )
        set_cache(
            SYSTEM_QUERY_RESULT_CACHE,
            f"{Dialects.Redshift}.{database}.{schema}.updates",
            updates,
        )
    metric_results.extend(get_metric_result(updates, table.__tablename__))  # type: ignore

    return TypeAdapter(List[SystemProfile]).validate_python(metric_results)
