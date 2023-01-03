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
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.dashboard.powerbi.client import PowerBiApiClient


def get_connection(connection: PowerBIConnection) -> PowerBiApiClient:
    """
    Create connection
    """
    return PowerBiApiClient(connection)


def test_connection(client: PowerBiApiClient) -> None:
    """
    Test connection
    """
    try:
        client.fetch_dashboards()
    except Exception as exc:
        msg = f"Unknown error connecting with {client}: {exc}."
        raise SourceConnectionException(msg)
