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
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.services.connections.database.prestoConnection import (
    PrestoConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.test_connections import (
    TestConnectionResult,
    TestConnectionStep,
    test_connection_db_common,
)


def get_connection_url(connection: PrestoConnection) -> str:
    url = f"{connection.scheme.value}://"
    if connection.username:
        url += f"{quote_plus(connection.username)}"
        if connection.password:
            url += f":{quote_plus(connection.password.get_secret_value())}"
        url += "@"
    url += f"{connection.hostPort}"
    if connection.catalog:
        url += f"/{connection.catalog}"
    if connection.databaseSchema:
        url += f"?schema={quote_plus(connection.databaseSchema)}"
    return url


def get_connection(connection: PrestoConnection) -> Engine:
    """
    Create connection
    """
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(engine: Engine, _) -> TestConnectionResult:
    """
    Test connection
    """
    inspector = inspect(engine)

    def custom_executor(engine, statement):
        cursor = engine.execute(statement)
        return list(cursor.all())

    def custom_executor_for_table():
        schema_name = inspector.get_schema_names()
        if schema_name:
            for schema in schema_name:
                table_name = inspector.get_table_names(schema)
                return table_name
        return None

    steps = [
        TestConnectionStep(
            function=partial(
                custom_executor,
                statement="SHOW CATALOGS",
                engine=engine,
            ),
            name="Get Databases",
        ),
        TestConnectionStep(
            function=inspector.get_schema_names,
            name="Get Schemas",
        ),
        TestConnectionStep(
            function=partial(custom_executor_for_table),
            name="Get Tables",
        ),
    ]
    return test_connection_db_common(engine, steps)
