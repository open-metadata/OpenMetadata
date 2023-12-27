#  pylint: disable=unused-argument,protected-access
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
Run profiler metrics on the table
"""

import traceback
from typing import Callable, List, Optional, Tuple, cast

from sqlalchemy import Column, MetaData, Table, func, inspect, literal, select
from sqlalchemy.orm import DeclarativeMeta
from sqlalchemy.sql.expression import ColumnOperators, and_, cte
from sqlalchemy.types import String

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()

COLUMN_COUNT = "columnCount"
COLUMN_NAMES = "columnNames"
ROW_COUNT = "rowCount"
SIZE_IN_BYTES = "sizeInBytes"
CREATE_DATETIME = "createDateTime"

ERROR_MSG = (
    "Schema/Table name not found in table args. Falling back to default computation"
)


def _get_table_and_schema_name(table: DeclarativeMeta) -> Tuple[str, str]:
    """get table and schema name from table args

    Args:
        table (DeclarativeMeta): _description_
    """
    schema_name = table.__table_args__.get("schema")
    table_name = table.__tablename__
    return schema_name, table_name


def _build_table(table_name: str, schema_name: Optional[str] = None) -> Table:
    """build table object from table name and schema name

    Args:
        table_name (str): table name
        schema_name (str): schema name

    Returns:
        Table
    """
    if schema_name:
        return Table(table_name, MetaData(), schema=schema_name)
    return Table(table_name, MetaData())


def _get_col_names_and_count(table: DeclarativeMeta) -> Tuple[str, int]:
    """get column names and count from table

    Args:
        table (DeclarativeMeta): table object

    Returns:
        Tuple[str, int]
    """
    col_names = literal(",".join(inspect(table).c.keys()), type_=String).label(
        COLUMN_NAMES
    )
    col_count = literal(len(inspect(table).c)).label(COLUMN_COUNT)
    return col_names, col_count


def _build_query(
    columns: List[Column],
    table: Table,
    where_clause: Optional[List[ColumnOperators]] = None,
):

    query = select(*columns).select_from(table)
    if where_clause:
        query = query.where(*where_clause)

    return query


def base_table_construct(runner: QueryRunner, metrics: List[Metrics], **kwargs):
    """base table construct for table metrics

    Args:
        runner (QueryRunner): runner object to execute query
        metrics (List[Metrics]): list of metrics
    """
    return runner.select_first_from_table(*[metric().fn() for metric in metrics])


def redshift_table_construct(runner: QueryRunner, **kwargs):
    """redshift table construct for table metrics

    Args:
        runner (QueryRunner): runner object to execute query
    """
    try:
        schema_name, table_name = _get_table_and_schema_name(runner.table)
    except AttributeError:
        raise AttributeError(ERROR_MSG)

    columns = [
        Column("estimated_visible_rows").label(ROW_COUNT),
        Column("size").label(SIZE_IN_BYTES),
        Column("create_time").label(CREATE_DATETIME),
        *_get_col_names_and_count(runner.table),
    ]

    where_clause = [
        Column("schema") == schema_name,
        Column("table") == table_name,
    ]

    query = _build_query(
        columns, _build_table("svv_table_info", "pg_catalog"), where_clause
    )
    return runner._session.execute(query).first()


def mysql_table_construct(runner: QueryRunner, **kwargs):
    """MySQL table construct for table metrics

    Args:
        runner (QueryRunner): query runner object
    """
    try:
        schema_name, table_name = _get_table_and_schema_name(runner.table)
    except AttributeError:
        raise AttributeError(ERROR_MSG)

    tables = _build_table("tables", "information_schema")
    col_names, col_count = _get_col_names_and_count(runner.table)

    columns = [
        Column("TABLE_ROWS").label(ROW_COUNT),
        (Column("data_length") + Column("index_length")).label(SIZE_IN_BYTES),
        Column("CREATE_TIME").label(CREATE_DATETIME),
        col_names,
        col_count,
    ]
    where_clause = [
        Column("TABLE_SCHEMA") == schema_name,
        Column("TABLE_NAME") == table_name,
    ]
    query = _build_query(columns, tables, where_clause)

    return runner._session.execute(query).first()


def bigquery_table_construct(runner: QueryRunner, **kwargs):
    """bigquery table construct for table metrics

    Args:
        runner (QueryRunner): query runner object
    """
    try:
        schema_name, table_name = _get_table_and_schema_name(runner.table)
    except AttributeError:
        raise AttributeError(ERROR_MSG)

    conn_config = cast(BigQueryConnection, kwargs.get("conn_config"))

    where_clause = [
        Column("table_id") == table_name,
    ]

    columns = [
        Column("row_count").label("rowCount"),
        Column("size_bytes").label("sizeInBytes"),
        Column("creation_time").label("createDateTime"),
    ]

    table_metadata_deprecated = _build_table("__TABLES__", schema_name)
    query = _build_query(columns, table_metadata_deprecated, where_clause)
    return runner._session.execute(query).first()
    table_storage = _build_table(
        "TABLE_STORAGE", f"region-{conn_config.usageLocation}.INFORMATION_SCHEMA"
    )
    col_names, col_count = _get_col_names_and_count(runner.table)
    columns = [
        Column("total_rows").label("rowCount"),
        Column("total_logical_bytes").label("sizeInBytes"),
        Column("creation_time").label("createDateTime"),
        col_names,
        col_count,
    ]

    where_clause = [
        Column("table_schema") == schema_name,
        Column("table_name") == table_name,
    ]

    query = _build_query(columns, table_storage, where_clause)

    return runner._session.execute(query).first()


def clickhouse_table_construct(runner: QueryRunner, **kwargs):
    """clickhouse table construct for table metrics

    Args:
        runner (QueryRunner): query runner object
    """
    try:
        schema_name, table_name = _get_table_and_schema_name(runner.table)
    except AttributeError:
        raise AttributeError(ERROR_MSG)

    tables = _build_table("tables", "system")
    col_names, col_count = _get_col_names_and_count(runner.table)

    columns = [
        Column("total_rows").label("rowCount"),
        Column("total_bytes").label("sizeInBytes"),
        col_names,
        col_count,
    ]

    where_clause = [
        Column("database") == schema_name,
        Column("name") == table_name,
    ]

    query = _build_query(columns, tables, where_clause)

    return runner._session.execute(query).first()


def oracle_table_construct(runner: QueryRunner, **kwargs):
    """oracle table construct for table metrics

    Args:
        runner (QueryRunner): query runner object
    """
    try:
        schema_name, table_name = _get_table_and_schema_name(runner.table)
    except AttributeError:
        raise AttributeError(ERROR_MSG)

    dba_objects = _build_table("dba_objects", None)
    all_tables = _build_table("all_tables", None)
    col_names, col_count = _get_col_names_and_count(runner.table)

    create_date = cte(
        _build_query(
            [
                Column("owner"),
                Column("object_name").label("table_name"),
                Column("created"),
            ],
            dba_objects,
            [
                func.lower(Column("owner")) == schema_name.lower(),
                func.lower(Column("object_name")) == table_name.lower(),
            ],
        )
    )

    row_count = cte(
        _build_query(
            [
                Column("owner"),
                Column("table_name"),
                Column("NUM_ROWS"),
            ],
            all_tables,
            [
                func.lower(Column("owner")) == schema_name.lower(),
                func.lower(Column("table_name")) == table_name.lower(),
            ],
        )
    )

    columns = [
        Column("NUM_ROWS").label("rowCount"),
        Column("created").label("createDateTime"),
        col_names,
        col_count,
    ]
    query = _build_query(columns, row_count).join(
        create_date,
        and_(
            row_count.c.table_name == create_date.c.table_name,
            row_count.c.owner == create_date.c.owner,
        ),
    )

    return runner._session.execute(query).first()


def snowflake_table_construct(runner: QueryRunner, **kwargs):
    """Snowflake table construct for table metrics

    Args:
        runner (QueryRunner): query runner object
    """
    try:
        schema_name, table_name = _get_table_and_schema_name(runner.table)
    except AttributeError:
        raise AttributeError(ERROR_MSG)

    database = runner._session.get_bind().url.database

    table_storage = _build_table("TABLES", f"{database}.INFORMATION_SCHEMA")
    col_names, col_count = _get_col_names_and_count(runner.table)

    columns = [
        Column("ROW_COUNT").label("rowCount"),
        Column("BYTES").label("sizeInBytes"),
        Column("CREATED").label("createDateTime"),
        col_names,
        col_count,
    ]
    where_clause = [
        func.lower(Column("TABLE_CATALOG")) == database.lower(),
        func.lower(Column("TABLE_SCHEMA")) == schema_name.lower(),
        func.lower(Column("TABLE_NAME")) == table_name.lower(),
    ]
    query = _build_query(columns, table_storage, where_clause)

    return runner._session.execute(query).first()


class TableMetricConstructFactory:
    """Factory returning the correct construct for the table metrics based on dialect"""

    def __init__(self):
        self._constructs = {}

    def register(self, dialect: str, construct: Callable):
        """Register a construct for a dialect"""
        self._constructs[dialect] = construct

    def construct(self, dialect, **kwargs):
        """Construct the query"""

        # check if we have registered a construct for the dialect
        construct = self._constructs.get(dialect)
        if not construct:
            construct = self._constructs["base"]

        try:
            return construct(**kwargs)
        except Exception:
            # if an error occurs, fallback to the base construct
            logger.debug(traceback.format_exc())
            return self._constructs["base"](**kwargs)


table_metric_construct_factory = TableMetricConstructFactory()
table_metric_construct_factory.register("base", base_table_construct)
table_metric_construct_factory.register(Dialects.Redshift, redshift_table_construct)
table_metric_construct_factory.register(Dialects.MySQL, mysql_table_construct)
table_metric_construct_factory.register(Dialects.BigQuery, bigquery_table_construct)
table_metric_construct_factory.register(Dialects.ClickHouse, clickhouse_table_construct)
table_metric_construct_factory.register(Dialects.Oracle, oracle_table_construct)
table_metric_construct_factory.register(Dialects.Snowflake, snowflake_table_construct)
