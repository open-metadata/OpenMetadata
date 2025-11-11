#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Source connection handler
"""
from functools import partial
from typing import Optional

from sqlalchemy.engine import Engine
from sqlalchemy.sql import text

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    execute_inspector_func,
    test_connection_engine_step,
    test_connection_steps,
    test_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections_utils import kill_active_connections
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_ALL_RELATIONS,
    REDSHIFT_GET_DATABASE_NAMES,
    REDSHIFT_TEST_GET_QUERIES,
    REDSHIFT_TEST_PARTITION_DETAILS,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_connection(connection: RedshiftConnection) -> Engine:
    """
    Create connection with configurable connection pooling

    Pool settings can be configured via connectionArguments:
    - pool_size: Number of persistent connections to maintain (default: 5)
    - max_overflow: Additional temporary connections beyond pool_size (default: 10)
    - pool_timeout: Seconds to wait for available connection (default: 30)
    - pool_recycle: Seconds before recycling connections (default: 3600)
    - pool_pre_ping: Test connections before using them (default: True)
    """
    pool_config = {}

    # Pool parameter names that should be extracted for SQLAlchemy engine,
    # not passed to the database driver
    pool_param_names = {
        "pool_size",
        "max_overflow",
        "pool_timeout",
        "pool_recycle",
        "pool_pre_ping",
    }

    if connection.connectionArguments and connection.connectionArguments.root:
        args = connection.connectionArguments.root

        # Extract pool configuration
        if "pool_size" in args:
            pool_config["pool_size"] = int(args["pool_size"])

        if "max_overflow" in args:
            pool_config["max_overflow"] = int(args["max_overflow"])

        if "pool_timeout" in args:
            pool_config["pool_timeout"] = int(args["pool_timeout"])

        if "pool_recycle" in args:
            pool_config["pool_recycle"] = int(args["pool_recycle"])

        if "pool_pre_ping" in args:
            pool_config["pool_pre_ping"] = args["pool_pre_ping"] in (
                "true",
                "True",
                True,
            )

        # Remove pool parameters from connectionArguments so they don't get passed to the driver
        # Create a new dict without pool parameters
        filtered_args = {k: v for k, v in args.items() if k not in pool_param_names}

        # Update connection.connectionArguments with filtered args
        from metadata.generated.schema.entity.services.connections.connectionBasicType import (
            ConnectionArguments,
        )

        connection.connectionArguments = ConnectionArguments(root=filtered_args)

    if pool_config:
        logger.info(f"Redshift connection pooling configured: {pool_config}")

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
        **pool_config,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: RedshiftConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    table_and_view_query = text(
        REDSHIFT_GET_ALL_RELATIONS.format(
            schema_clause="", table_clause="", limit_clause="LIMIT 1"
        )
    )

    def test_get_queries_permissions(engine_: Engine):
        """Check if we have the right permissions to list queries"""
        with engine_.connect() as conn:
            res = conn.execute(REDSHIFT_TEST_GET_QUERIES).fetchone()
            if not all(res):
                raise SourceConnectionException(
                    f"We don't have the right permissions to list queries - {res}"
                )

    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, engine),
        "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
        "GetTables": partial(test_query, statement=table_and_view_query, engine=engine),
        "GetViews": partial(test_query, statement=table_and_view_query, engine=engine),
        "GetQueries": partial(test_get_queries_permissions, engine),
        "GetDatabases": partial(
            test_query, statement=REDSHIFT_GET_DATABASE_NAMES, engine=engine
        ),
        "GetPartitionTableDetails": partial(
            test_query, statement=REDSHIFT_TEST_PARTITION_DETAILS, engine=engine
        ),
    }

    result = test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )

    kill_active_connections(engine)

    return result
