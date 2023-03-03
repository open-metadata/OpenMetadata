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

from botocore.client import ClientError
from sqlalchemy.engine import Engine

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    TestConnectionResult,
    TestConnectionStep,
    test_connection_steps,
)


def get_connection(connection: GlueConnection) -> Engine:
    """
    Create connection
    """
    return AWSClient(connection.awsConfig).get_glue_client()


def test_connection(client, _) -> None:
    """
    Test connection
    """
    try:
        paginator = client.get_paginator("get_databases")
        paginator.paginate()

    except ClientError as err:
        msg = f"Connection error for {client}: {err}. Check the connection details."
        raise SourceConnectionException(msg) from err
    except Exception as exc:
        msg = f"Unknown error connecting with {client}: {exc}."
        raise SourceConnectionException(msg) from exc


def test_connection(client, _) -> TestConnectionResult:
    """
    Test connection
    """

    def custom_executor_for_database():
        paginator = client.get_paginator("get_databases")
        return list(paginator.paginate())

    def custom_executor_for_table():
        paginator = client.get_paginator("get_databases")
        paginator_response = paginator.paginate()
        for page in paginator_response:
            for schema in page["DatabaseList"]:
                database_name = schema["Name"]
                paginator = client.get_paginator("get_tables")
                tables = paginator.paginate(DatabaseName=database_name)
                return list(tables)
        return None

    steps = [
        TestConnectionStep(
            function=partial(custom_executor_for_database),
            name="Get Databases and Schemas",
        ),
        TestConnectionStep(
            function=partial(custom_executor_for_table),
            name="Get Tables",
        ),
    ]

    return test_connection_steps(steps)
