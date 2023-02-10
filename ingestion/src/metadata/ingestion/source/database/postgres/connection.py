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

from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
)
from metadata.ingestion.connections.test_connections import (
    TestConnectionStep,
    test_connection_db_common,
)
from metadata.ingestion.source.database.postgres.queries import (
    POSTGRES_GET_ALL_TABLE_PG_POLICY_TEST,
    POSTGRES_GET_DATABASE,
    POSTGRES_SQL_STATEMENT_TEST,
)


def get_connection(connection: PostgresConnection) -> Engine:
    """
    Create connection
    """
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
                statement=POSTGRES_GET_DATABASE,
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
                statement=POSTGRES_GET_ALL_TABLE_PG_POLICY_TEST,
                engine=engine,
            ),
            name="Get Tags",
            mandatory=False,
        ),
        TestConnectionStep(
            function=partial(
                custom_executor,
                statement=POSTGRES_SQL_STATEMENT_TEST,
                engine=engine,
            ),
            name="Get Usage and Lineage",
            mandatory=False,
        ),
    ]

    return test_connection_db_common(engine, steps)
