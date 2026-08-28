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
"""Unit tests for the Looker connection."""

import os
from unittest.mock import patch

import pytest

from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.ingestion.source.dashboard.looker.connection import get_connection


@pytest.mark.parametrize(
    "host",
    [
        "https://looker.example.com",
        "https://looker.example.com/",
        "https://looker.example.com:19999",
    ],
)
def test_get_connection_normalizes_the_sdk_base_url(host):
    connection = LookerConnection(
        hostPort=host,
        clientId="client-id",
        clientSecret="client-secret",
    )

    with (
        patch.dict(os.environ, {}, clear=True),
        patch(
            "metadata.ingestion.source.dashboard.looker.connection.looker_sdk.init40"
        ),
    ):
        get_connection(connection)

        assert os.environ["LOOKERSDK_BASE_URL"] == host.rstrip("/")
