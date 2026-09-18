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
"""Unit tests for the Atlas REST client (``AtlasClient``).

These tests pin down the query-string contract of ``get_entity`` against the
Atlas ``/atlas/v2/entity/bulk`` endpoint, which expects a multi-valued ``guid``
query parameter (``?guid=g1&guid=g2``). The topic ingestion flow passes a list
of guids; the table flow passes a single guid string.
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

from metadata.generated.schema.entity.services.connections.metadata.atlasConnection import (
    AtlasConnection,
)
from metadata.ingestion.source.metadata.atlas.client import AtlasClient

CLIENT_MODULE = "metadata.ingestion.source.metadata.atlas.client"


def _build_client() -> AtlasClient:
    config = AtlasConnection.model_validate(
        {
            "username": "user",
            "password": "pass",
            "hostPort": "http://localhost:21000",
            "entity_type": "NotTable",
        }
    )
    return AtlasClient(config)


def _guid_params(path: str) -> list[str]:
    """Return the repeated `guid` query values from a request path, mirroring
    how a server reads the (percent-decoded) query string."""
    return parse_qs(urlparse("http://x" + path).query).get("guid", [])


class TestAtlasClientGetEntity(TestCase):
    """`get_entity` must build repeated `guid=` params for list input and a
    single `guid=` param for scalar input, never the Python list repr."""

    @patch(f"{CLIENT_MODULE}.TrackedREST")
    def test_get_entity_with_list_builds_repeated_guid_params(self, _mock_rest):
        client = _build_client()
        client.client.get = MagicMock(return_value={"entities": []})

        guids = [
            "b233b2ae-8a4a-44a3-b446-4027462b2cc6",
            "eff274ef-f84d-4c58-81d6-c309663b887d",
        ]
        client.get_entity(guids)

        client.client.get.assert_called_once()
        path = client.client.get.call_args.args[0]
        self.assertTrue(path.startswith("/atlas/v2/entity/bulk?"))
        self.assertEqual(_guid_params(path), guids)
        self.assertNotIn("[", path)
        self.assertNotIn("]", path)

    @patch(f"{CLIENT_MODULE}.TrackedREST")
    def test_get_entity_with_single_guid_string_builds_one_param(self, _mock_rest):
        client = _build_client()
        client.client.get = MagicMock(return_value={"entities": []})

        guid = "b233b2ae-8a4a-44a3-b446-4027462b2cc6"
        client.get_entity(guid)

        client.client.get.assert_called_once_with("/atlas/v2/entity/bulk?guid=" + guid)
