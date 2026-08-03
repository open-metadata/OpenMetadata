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
"""
If-Match validator tests for the column patch helpers.

The client must send the validator the server actually accepts on a conditional write:
``EntityETag.generateWeakETag``'s ``W/"<version>"``, matched by ``isWeakMatch``. The strong
``generateETag`` hashes the serialized entity and is validated against the repository's own
``patchFields`` projection, so it can never match a projection the client fetched — every
conditional patch would 412 and degrade to a non-conditional fallback write.

These tests pin the wire format (so a future server-side rename fails here, loudly, instead of
silently costing every ingestion a rejected round trip) and the retry/fallback behaviour around it.
"""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.mixins.patch_mixin import OMetaPatchMixin, _entity_etag

COLUMN_FQN = "test_service.test_db.test_schema.customers.email"


def _table(version: float) -> Table:
    return Table(
        id=uuid4(),
        name="customers",
        fullyQualifiedName="test_service.test_db.test_schema.customers",
        columns=[
            Column(
                name="email",
                dataType=DataType.STRING,
                fullyQualifiedName=COLUMN_FQN,
                tags=[],
            )
        ],
        version=version,
    )


def _column_tag() -> ColumnTag:
    return ColumnTag(
        column_fqn=COLUMN_FQN,
        tag_label=TagLabel(
            tagFQN="PII.Sensitive",
            source=TagSource.Classification,
            labelType=LabelType.Automated,
            state=State.Suggested,
        ),
    )


def _precondition_failed() -> APIError:
    return APIError({"code": 412, "message": "The entity has been modified."})


class _FakeMetadata(OMetaPatchMixin):
    """Minimal OMetaPatchMixin host exposing only what the column patch path touches."""

    def __init__(self, instances, patch_side_effect):
        self._instances = list(instances)
        self.fetch_count = 0
        self.client = MagicMock()
        self.client.patch.side_effect = patch_side_effect

    @staticmethod
    def get_suffix(entity) -> str:
        return "/tables"

    def get_by_id(self, entity, entity_id, fields=None, **kwargs):
        # Serve the next staged instance, repeating the last one once exhausted, so a test can
        # model either "nothing changed between retries" or "another writer bumped the version".
        index = min(self.fetch_count, len(self._instances) - 1)
        self.fetch_count += 1

        return self._instances[index].model_copy(deep=True)


class TestEntityEtag:
    """The wire format of the If-Match header."""

    @pytest.mark.parametrize(
        "version,expected",
        [
            (0.1, 'W/"0.1"'),
            (0.4, 'W/"0.4"'),
            (1.0, 'W/"1.0"'),
            (2.3, 'W/"2.3"'),
            (10.0, 'W/"10.0"'),
        ],
    )
    def test_weak_validator_matches_server_rendering(self, version, expected):
        # Must render exactly as Java's `WEAK_PREFIX + '"' + Double.toString(version) + '"'`;
        # EntityUtil.nextVersion keeps versions at one decimal place, so `.1f` reproduces it.
        assert _entity_etag(_table(version)) == expected

    def test_is_not_a_strong_etag(self):
        # Guards against reverting to a locally computed hash of version/updatedAt: the server
        # validates strong ETags against a projection the client never sees.
        etag = _entity_etag(_table(0.4))

        assert etag.startswith('W/"')
        assert len(etag) < 20

    def test_none_without_version(self):
        # No version -> no usable precondition; callers fall back to a non-conditional write
        # rather than sending a header the server is guaranteed to reject.
        assert _entity_etag(_table(0.4).model_copy(update={"version": None})) is None


class TestPatchColumnTagsIfMatch:
    """How that validator is used across the retry/fallback cycle."""

    def test_sends_weak_if_match_on_first_attempt(self):
        instance = _table(0.4)
        metadata = _FakeMetadata(
            instances=[instance],
            patch_side_effect=[instance.model_dump(mode="json")],
        )

        result = metadata.patch_column_tags(entity=instance, column_tags=[_column_tag()])

        assert result is not None
        assert metadata.client.patch.call_count == 1
        assert metadata.client.patch.call_args.kwargs["headers"] == {"If-Match": 'W/"0.4"'}

    def test_retries_conditionally_against_the_new_version(self):
        # Genuine concurrent edit: the refetch shows a bumped version, so the retry must stay
        # conditional (with the NEW validator) instead of dropping optimistic locking.
        stale, fresh = _table(0.4), _table(0.5)
        metadata = _FakeMetadata(
            instances=[stale, fresh],
            patch_side_effect=[_precondition_failed(), fresh.model_dump(mode="json")],
        )

        result = metadata.patch_column_tags(entity=stale, column_tags=[_column_tag()])

        assert result is not None
        assert metadata.client.patch.call_count == 2
        sent = [call.kwargs["headers"] for call in metadata.client.patch.call_args_list]
        assert sent == [{"If-Match": 'W/"0.4"'}, {"If-Match": 'W/"0.5"'}]

    def test_falls_back_unconditionally_when_version_did_not_move(self):
        # A 412 on an unchanged version means the precondition itself is unusable (client/server
        # validator mismatch). Retrying would loop to a silent drop, so the change is written
        # without the header instead of being lost.
        instance = _table(0.4)
        metadata = _FakeMetadata(
            instances=[instance],
            patch_side_effect=[_precondition_failed(), instance.model_dump(mode="json")],
        )

        result = metadata.patch_column_tags(entity=instance, column_tags=[_column_tag()])

        assert result is not None
        assert metadata.client.patch.call_count == 2
        assert metadata.client.patch.call_args_list[1].kwargs["headers"] is None
