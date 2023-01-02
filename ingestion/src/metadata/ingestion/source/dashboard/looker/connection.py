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
import os

import looker_sdk
from looker_sdk.sdk.api40.methods import Looker40SDK

from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException


def get_connection(connection: LookerConnection) -> Looker40SDK:
    """
    Create connection
    """
    if not os.environ.get("LOOKERSDK_CLIENT_ID"):
        os.environ["LOOKERSDK_CLIENT_ID"] = connection.clientId
    if not os.environ.get("LOOKERSDK_CLIENT_SECRET"):
        os.environ[
            "LOOKERSDK_CLIENT_SECRET"
        ] = connection.clientSecret.get_secret_value()
    if not os.environ.get("LOOKERSDK_BASE_URL"):
        os.environ["LOOKERSDK_BASE_URL"] = connection.hostPort

    return looker_sdk.init40()


def test_connection(client: Looker40SDK) -> None:
    """
    Test connection
    """
    try:
        client.me()
    except Exception as exc:
        msg = f"Unknown error connecting with {client}: {exc}."
        raise SourceConnectionException(msg) from exc
