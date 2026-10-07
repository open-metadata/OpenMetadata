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
"""Entity listing keeps valid entities while reporting individual parse errors."""

from unittest.mock import Mock

import pytest
from pydantic import ValidationError

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def _sdk(*responses):
    metadata = object.__new__(OpenMetadata)
    metadata.client = Mock()
    metadata.client.get.side_effect = list(responses)
    metadata._use_raw_data = False
    return metadata


def _tag(name):
    return {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": name,
        "fullyQualifiedName": f"Sensitivity.{name}",
        "description": "test",
    }


def test_parse_callback_receives_invalid_entity_from_every_page_without_raw_logging(caplog):
    bad = {**_tag("SPI"), "id": "private-invalid-id"}
    metadata = _sdk(
        {"data": [_tag("PII"), bad], "paging": {"total": 4, "after": "next"}},
        {"data": [bad, _tag("Other")], "paging": {"total": 4}},
    )
    errors = []

    tags = list(
        metadata.list_all_entities(
            Tag, skip_on_failure=True, on_parse_error=lambda entity, raw, exc: errors.append((entity, raw, exc))
        )
    )

    assert [tag.name.root for tag in tags] == ["PII", "Other"]
    assert len(errors) == 2
    assert all(entity is Tag and raw is bad and isinstance(exc, ValidationError) for entity, raw, exc in errors)
    assert "private-invalid-id" not in caplog.text


def test_listing_default_remains_strict():
    metadata = _sdk({"data": [_tag("PII"), {**_tag("SPI"), "id": "bad"}], "paging": {"total": 2}})

    with pytest.raises(ValidationError):
        list(metadata.list_all_entities(Tag))


def test_parse_callback_exception_propagates():
    metadata = _sdk({"data": [{**_tag("SPI"), "id": "bad"}], "paging": {"total": 1}})

    def callback(*_):
        raise RuntimeError("callback failed")

    with pytest.raises(RuntimeError, match="callback failed"):
        list(metadata.list_all_entities(Tag, skip_on_failure=True, on_parse_error=callback))


def test_http_and_paging_errors_propagate_with_parse_callback():
    metadata = _sdk(RuntimeError("http failed"))
    with pytest.raises(RuntimeError, match="http failed"):
        list(metadata.list_all_entities(Tag, skip_on_failure=True, on_parse_error=lambda *_: None))

    metadata = _sdk({"data": [_tag("PII")], "paging": {"total": 1, "after": "next"}}, RuntimeError("page failed"))
    iterator = metadata.list_all_entities(Tag, skip_on_failure=True, on_parse_error=lambda *_: None)
    assert next(iterator).name.root == "PII"
    with pytest.raises(RuntimeError, match="page failed"):
        list(iterator)


def test_all_invalid_middle_page_does_not_hide_later_valid_page():
    bad = {**_tag("SPI"), "id": "bad"}
    metadata = _sdk(
        {"data": [_tag("First")], "paging": {"total": 3, "after": "middle"}},
        {"data": [bad], "paging": {"total": 3, "after": "last"}},
        {"data": [_tag("Last")], "paging": {"total": 3}},
    )
    errors = []

    names = [
        tag.name.root
        for tag in metadata.list_all_entities(
            Tag, skip_on_failure=True, on_parse_error=lambda *args: errors.append(args)
        )
    ]

    assert names == ["First", "Last"]
    assert len(errors) == 1


def test_parent_filter_is_forwarded_on_every_page():
    metadata = _sdk(
        {"data": [_tag("First")], "paging": {"total": 2, "after": "next"}},
        {"data": [_tag("Last")], "paging": {"total": 2}},
    )

    assert len(list(metadata.list_all_entities(Tag, params={"parent": "Sensitivity"}))) == 2
    assert [call.kwargs["data"] for call in metadata.client.get.call_args_list] == [
        {"parent": "Sensitivity"},
        {"parent": "Sensitivity"},
    ]
