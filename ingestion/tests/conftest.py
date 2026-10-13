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
"""Shared tag client fixtures."""

from unittest.mock import MagicMock
from uuid import UUID

from pytest import fixture

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.fqn import split


@fixture
def existing_tag_lookup():
    def lookup(*, entity, fqn):
        assert entity is Tag
        classification, name = split(fqn)
        return Tag(
            id=UUID(int=2),
            name=name,
            fullyQualifiedName=fqn,
            description="Native tag",
            classification={"id": str(UUID(int=1)), "type": "classification", "name": classification},
        )

    return lookup


@fixture
def tag_metadata(existing_tag_lookup):
    client = MagicMock(spec=OpenMetadata)
    client.get_by_name.side_effect = existing_tag_lookup
    return client
