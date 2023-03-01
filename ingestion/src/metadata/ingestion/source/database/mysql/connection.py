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

from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
    init_empty_connection_options,
)
from metadata.ingestion.connections.test_connections import (
    TestConnectionResult,
    TestConnectionStep,
    test_connection_db_common,
)


def get_connection(connection: MysqlConnection) -> Engine:
    """
    Create connection
    """
    if connection.sslCA or connection.sslCert or connection.sslKey:
        if not connection.connectionOptions:
            connection.connectionOptions = init_empty_connection_options()
        if connection.sslCA:
            connection.connectionOptions.__root__["ssl_ca"] = connection.sslCA
        if connection.sslCert:
            connection.connectionOptions.__root__["ssl_cert"] = connection.sslCert
        if connection.sslKey:
            connection.connectionOptions.__root__["ssl_key"] = connection.sslKey

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(engine: Engine, _) -> TestConnectionResult:
    """
    Test connection
    """
    inspector = inspect(engine)

    def custom_executor():
        schema_name = inspector.get_schema_names()
        if schema_name:
            for schema in schema_name:
                if schema not in ("information_schema", "performance_schema"):
                    table_name = inspector.get_table_names(schema)
                    return table_name
        return None

    steps = [
        TestConnectionStep(
            function=inspector.get_schema_names,
            name="Get Schemas",
        ),
        TestConnectionStep(
            function=partial(custom_executor),
            name="Get Tables",
        ),
        TestConnectionStep(
            function=inspector.get_view_names,
            name="Get Views",
            mandatory=False,
        ),
    ]
    return test_connection_db_common(engine, steps)
