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
import json
from typing import Any, Dict

import requests

from metadata.generated.schema.entity.services.connections.dashboard.metabaseConnection import (
    MetabaseConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException


def get_connection(connection: MetabaseConnection) -> Dict[str, Any]:
    """
    Create connection
    """
    try:
        params = {}
        params["username"] = connection.username
        params["password"] = connection.password.get_secret_value()

        headers = {"Content-Type": "application/json", "Accept": "*/*"}

        resp = requests.post(  # pylint: disable=missing-timeout
            connection.hostPort + "/api/session/",
            data=json.dumps(params),
            headers=headers,
        )

        session_id = resp.json()["id"]
        metabase_session = {"X-Metabase-Session": session_id}
        conn = {"connection": connection, "metabase_session": metabase_session}
        return conn

    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


def test_connection(client) -> None:
    """
    Test connection
    """
    try:
        requests.get(  # pylint: disable=missing-timeout
            client["connection"].hostPort + "/api/dashboard",
            headers=client["metabase_session"],
        )
    except Exception as exc:
        msg = f"Unknown error connecting with {client}: {exc}."
        raise SourceConnectionException(msg) from exc
