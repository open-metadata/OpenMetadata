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
from dagster_graphql import DagsterGraphQLClient
from gql.transport.requests import RequestsHTTPTransport

from metadata.generated.schema.entity.services.connections.pipeline.dagsterConnection import (
    DagsterConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.pipeline.dagster.queries import TEST_QUERY_GRAPHQL


def get_connection(connection: DagsterConnection) -> DagsterGraphQLClient:
    """
    Create connection
    """
    url = connection.host
    dagster_connection = DagsterGraphQLClient(
        url,
        transport=RequestsHTTPTransport(
            url=f"{url}/graphql",
            headers={"Dagster-Cloud-Api-Token": connection.token.get_secret_value()}
            if connection.token
            else None,
        ),
    )

    return dagster_connection


def test_connection(client: DagsterGraphQLClient) -> None:
    """
    Test connection
    """
    try:
        client._execute(TEST_QUERY_GRAPHQL)  # pylint: disable=protected-access
    except Exception as exc:
        msg = f"Unknown error connecting with {client}: {exc}."
        raise SourceConnectionException(msg) from exc
