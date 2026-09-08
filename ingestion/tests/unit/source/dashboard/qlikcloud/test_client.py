#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Unit tests for the Qlik Cloud API client."""

import ssl
from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.dashboard.qlikCloudConnection import (
    QlikCloudConnection,
)
from metadata.ingestion.source.dashboard.qlikcloud.client import QlikCloudClient

CLIENT_MODULE = "metadata.ingestion.source.dashboard.qlikcloud.client"


def test_websocket_requires_certificate_verification():
    config = QlikCloudConnection(
        hostPort="https://tenant.qlikcloud.com", token="secret"
    )

    with (
        patch(f"{CLIENT_MODULE}.TrackedREST"),
        patch("websocket.create_connection") as create_connection,
    ):
        client = QlikCloudClient(config)
        client.connect_websocket("dashboard-id")

    create_connection.assert_called_once_with(
        "wss://tenant.qlikcloud.com/app/dashboard-id",
        sslopt={"cert_reqs": ssl.CERT_REQUIRED},
        header={"Authorization": "Bearer secret"},
    )
    create_connection.return_value.recv.assert_called_once_with()
