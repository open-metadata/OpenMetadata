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
Source connection handler
"""
from functools import partial

from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import (
    TestConnectionStep,
    test_connection_db_common,
)
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_DATABASE_NAMES,
    REDSHIFT_GET_STL_QUERY,
    REDSHIFT_GET_STL_QUERYTEXT,
    REDSHIFT_GET_SVV_TABLE_INFO,
)


def get_connection(connection: RedshiftConnection) -> Engine:
    """
    Create connection
    """
    if connection.sslMode:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.__root__["sslmode"] = connection.sslMode
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(engine: Engine) -> None:
    """
    Test connection
    """

    def custom_executor(engine, statement):
        cursor = engine.execute(statement)
        return list(cursor.all())

    inspector = inspect(engine)
    steps = [
        TestConnectionStep(
            function=partial(
                custom_executor,
                statement=REDSHIFT_GET_DATABASE_NAMES,
                engine=engine,
            ),
            name="Get Databases",
        ),
        TestConnectionStep(
            function=inspector.get_schema_names,
            name="Get Schemas",
        ),
        TestConnectionStep(
            function=inspector.get_table_names,
            name="Get Tables",
        ),
        TestConnectionStep(
            function=inspector.get_view_names,
            name="Get Views",
            mandatory=False,
        ),
        TestConnectionStep(
            function=partial(
                custom_executor,
                statement=REDSHIFT_GET_SVV_TABLE_INFO,
                engine=engine,
            ),
            name="Get Usage and Lineage Svv Table Info",
            mandatory=False,
        ),
        TestConnectionStep(
            function=partial(
                custom_executor,
                statement=REDSHIFT_GET_STL_QUERYTEXT,
                engine=engine,
            ),
            name="Get Usage and Lineage Stl Query Text",
            mandatory=False,
        ),
        TestConnectionStep(
            function=partial(
                custom_executor,
                statement=REDSHIFT_GET_STL_QUERY,
                engine=engine,
            ),
            name="Get Usage and Lineage Stl Query",
            mandatory=False,
        ),
    ]

    test_connection_db_common(engine, steps)
