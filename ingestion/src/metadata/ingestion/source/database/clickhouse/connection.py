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

from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
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
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_SQL_STATEMENT_TEST,
)


def get_connection(connection: ClickhouseConnection) -> Engine:
    """
    Create Clickhouse connection
    """
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(engine: Engine) -> str:
    """
    Test Clickhouse connection
    """

    def custom_executor(engine, statement):
        cursor = engine.execute(statement)
        return list(cursor.all())

    inspector = inspect(engine)

    def custom_executor_for_tables():
        schema_name = inspector.get_schema_names()

        if schema_name:
            for schema in schema_name:
                if schema not in ("INFORMATION_SCHEMA", "system"):
                    table_name = inspector.get_table_names(schema)
                    return table_name
        return None

    steps = [
        TestConnectionStep(
            function=inspector.get_schema_names,
            name="Get Schemas",
        ),
        TestConnectionStep(
            function=partial(custom_executor_for_tables),
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
                statement=CLICKHOUSE_SQL_STATEMENT_TEST,
                engine=engine,
            ),
            name="Get Usage and Lineage",
            mandatory=False,
        ),
    ]

    return test_connection_db_common(engine, steps)
