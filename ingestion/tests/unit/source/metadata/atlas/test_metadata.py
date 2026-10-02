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
"""Unit tests for the Atlas source topic flow (``AtlasSource._parse_topic_entity``)."""

import uuid as _uuid
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.ingestion.source.metadata.atlas.metadata import AtlasSource

SERVICE_NAME = "kafka"
TOPIC_NAME = "sales_events"
EXPECTED_TOPIC_FQN = f"{SERVICE_NAME}.{TOPIC_NAME}"


def _message_service() -> MessagingService:
    """A real MessagingService so ``.id`` (Uuid) and ``.name.root`` (str) are genuine."""
    return MessagingService.model_validate(
        {
            "id": str(_uuid.uuid4()),
            "name": SERVICE_NAME,
            "serviceType": "Kafka",
        }
    )


def _make_source():
    """Build an AtlasSource (a dataclass) without running ``__init__``.

    The OpenMetadata and Atlas clients are created as local MagicMocks and
    returned alongside the source, so callers set up mocks and assert on the
    MagicMocks directly (typed as such) rather than through the dataclass fields
    (which basedpyright types as ``OpenMetadata`` / ``AtlasClient``).
    """
    metadata = MagicMock()
    atlas_client = MagicMock()
    source = AtlasSource.__new__(AtlasSource)
    source.metadata = metadata
    source.atlas_client = atlas_client
    source.topics = {"Topic": ["guid-1"]}
    source.message_service = _message_service()
    source.entity_types = {
        "Table": {"hive_table": {"db": "db", "column": "columns"}},
        "Topic": {"Topic": {"schema": "schema"}},
    }
    source.service = None
    return source, metadata, atlas_client


def _topic_entity_payload(description: str | None = "Atlas-side description") -> dict:
    return {
        "entities": [
            {
                "guid": "guid-1",
                "attributes": {
                    "name": TOPIC_NAME,
                    "description": description,
                },
            },
        ]
    }


def test_parse_topic_entity_builds_topic_fqn_from_service_name():
    """The topic FQN must be built from the MessagingService name (a ``str``),
    not its id (a ``Uuid`` that ``fqn.build`` rejects with
    ``FQNBuildingException``). ``fqn.build`` runs unmocked so the produced FQN
    is asserted end-to-end."""
    source, metadata, atlas_client = _make_source()
    atlas_client.get_entity.return_value = _topic_entity_payload(description=None)

    with patch.object(source, "ingest_lineage", return_value=iter([])):
        results = list(source._parse_topic_entity("Topic"))

    metadata.get_by_name.assert_called_once()
    assert metadata.get_by_name.call_args.kwargs["fqn"] == EXPECTED_TOPIC_FQN
    assert metadata.get_by_name.call_args.kwargs["entity"] is Topic
    assert not [r for r in results if r.left is not None and r.left.name == "Topic"]


def test_parse_topic_entity_patches_description_when_topic_exists():
    """Description enrichment runs: when the Atlas entity has a description and
    ``get_by_name`` resolves the topic, ``patch_description`` is invoked with the
    Atlas description (the path the ``Uuid``-as-``service_name`` bug skipped)."""
    source, metadata, atlas_client = _make_source()
    atlas_client.get_entity.return_value = _topic_entity_payload(description="Sales events topic from Atlas")
    topic_object = MagicMock()
    metadata.get_by_name.return_value = topic_object

    with patch.object(source, "ingest_lineage", return_value=iter([])):
        list(source._parse_topic_entity("Topic"))

    metadata.patch_description.assert_called_once()
    kwargs = metadata.patch_description.call_args.kwargs
    assert kwargs["entity"] is Topic
    assert kwargs["source"] is topic_object
    assert kwargs["description"] == "Sales events topic from Atlas"
    assert kwargs["force"] is True
