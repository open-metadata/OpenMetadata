#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Native Drive registration, separate tag stages, and batch scope cleanup."""

from unittest.mock import MagicMock

import pytest

from metadata.domain.tags import TagDefinition
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from ....utils.drive_tags import drive_stages, make_drive_source  # noqa: TID252


@pytest.fixture
def source():
    instance = make_drive_source(MagicMock(spec=OpenMetadata))
    instance.catalog = set()
    instance.metadata.get_by_name.side_effect = lambda **kwargs: object() if kwargs["fqn"] in instance.catalog else None
    return instance


def definition(name):
    return TagDefinition("DriveTags", name, "Native Drive tags", "Native tag")


def consume(source, stream, *, persist=True):
    assets = []
    definitions = []
    errors = []
    for record in stream:
        if record.left:
            errors.append(record.left)
        elif isinstance(record.right, OMetaTagAndClassification):
            name = record.right.tag_request.name.root
            definitions.append(name)
            if persist:
                source.catalog.add(f"DriveTags.{name}")
        else:
            assets.append(record.right)
    return definitions, assets, errors


ASSETS = [
    ("directory", "my_service.my_directory", {"name": "my_directory", "service": "my_service"}),
    (
        "file",
        'my_service.my_directory."my_file.csv"',
        {"name": "my_file.csv", "service": "my_service", "directory": "my_service.my_directory"},
    ),
    ("spreadsheet", "my_service.my_sheet", {"name": "my_sheet", "service": "my_service"}),
    (
        "worksheet",
        "my_service.my_sheet.my_tab",
        {"name": "my_tab", "service": "my_service", "spreadsheet": "my_service.my_sheet"},
    ),
]


@pytest.mark.parametrize("kind,entity_fqn,payload", ASSETS)
def test_each_asset_hook_publishes_definitions_before_attaching_labels(source, kind, entity_fqn, payload):
    source.native_assets[kind] = [(entity_fqn, payload)]
    source.native_tags[kind] = [(entity_fqn, definition("Shared"))]
    published, assets, errors = consume(source, drive_stages(source, kind))
    assert published == ["Shared"]
    assert errors == []
    assert len(assets) == 1
    assert [label.tagFQN.root for label in assets[0].tags] == ["DriveTags.Shared"]
    assert source.tags_registry.stats()["live_entities"] == 0
    assert getattr(source.context.get(), "tags", None) is None


@pytest.mark.parametrize("kind,entity_fqn,payload", ASSETS)
def test_missing_tags_do_not_prevent_asset_creation(source, kind, entity_fqn, payload):
    source.native_assets[kind] = [(entity_fqn, payload)]
    source.native_tags[kind] = [(entity_fqn, definition("Missing"))]
    published, assets, errors = consume(source, drive_stages(source, kind), persist=False)
    assert published == ["Missing"]
    assert errors == []
    assert assets[0].name.root == payload["name"]
    assert not assets[0].tags
    assert source.tags_registry.stats()["live_entities"] == 0


@pytest.mark.parametrize("enabled,tags", [(False, [definition("Disabled")]), (True, [])])
def test_disabled_or_empty_hooks_leave_assets_unchanged_without_catalog_calls(source, enabled, tags):
    source.native_assets["file"] = [("my_service.my_file", {"name": "my_file", "service": "my_service"})]
    source.native_tags["file"] = [("my_service.my_file", tag) for tag in tags]
    source.source_config.includeTags = enabled
    published, assets, errors = consume(source, drive_stages(source, "file"))
    assert published == []
    assert errors == []
    assert assets[0].name.root == "my_file"
    assert not assets[0].tags
    source.metadata.get_by_name.assert_not_called()


@pytest.mark.parametrize("kind,entity_fqn,payload", ASSETS)
def test_default_drive_hooks_leave_assets_unchanged(source, kind, entity_fqn, payload):
    instance = make_drive_source(source.metadata, tagged=False)
    instance.native_assets[kind] = [(entity_fqn, payload)]
    published, assets, errors = consume(instance, drive_stages(instance, kind))
    assert published == []
    assert errors == []
    assert (
        assets[0].model_dump(
            mode="json", include={"name", "service", "parent", "directory", "spreadsheet"}, exclude_none=True
        )
        == payload
    )
    source.metadata.get_by_name.assert_not_called()


def test_parent_child_and_existing_labels_stay_separate_and_definitions_are_deduplicated(source):
    source.native_assets["directory"] = [("my_service.my_directory", {"name": "my_directory", "service": "my_service"})]
    source.native_tags["directory"] = [("my_service.my_directory", definition("Parent"))]
    existing = TagLabel(tagFQN="Other.Existing", source="Classification", labelType="Manual", state="Confirmed")
    source.native_assets["file"] = [
        (
            "my_service.my_directory.my_file",
            {"name": "my_file", "service": "my_service", "directory": "my_service.my_directory", "tags": [existing]},
        )
    ]
    source.native_tags["file"] = [
        ("my_service.my_directory.my_file", definition("Parent")),
        ("my_service.my_directory.my_file", definition("Child")),
    ]
    published, assets, errors = consume(source, drive_stages(source, "directory"))
    assert published == ["Parent", "Child"]
    assert errors == []
    directory, file = assets
    assert [label.tagFQN.root for label in directory.tags] == ["DriveTags.Parent"]
    assert [label.tagFQN.root for label in file.tags] == ["Other.Existing", "DriveTags.Parent", "DriveTags.Child"]
    assert source.tags_registry.stats()["live_entities"] == 0

    source.native_assets["directory"] = []
    source.native_tags["directory"] = []
    published, files, errors = consume(source, drive_stages(source, "file"))
    assert published == []
    assert errors == []
    assert [label.tagFQN.root for label in files[0].tags] == ["Other.Existing", "DriveTags.Parent", "DriveTags.Child"]
    assert [label.tagFQN.root for label in directory.tags] == ["DriveTags.Parent"]
    assert source.tags_registry.stats()["live_entities"] == 0


def test_invalid_tags_do_not_discard_valid_tags_or_source_errors(source):
    error = Either(left={"name": "my_file", "error": "Source unavailable", "stackTrace": "trace"})
    source.native_errors["file"] = [error]
    source.native_assets["file"] = [("my_service.my_file", {"name": "my_file", "service": "my_service"})]
    source.native_tags["file"] = [("my_service.my_file", definition(name)) for name in ["", "bad>name", "Valid"]]
    published, assets, errors = consume(source, drive_stages(source, "file"))
    assert published == ["Valid"]
    assert len(errors) == 1
    assert errors[0].error == "Source unavailable"
    assert [label.tagFQN.root for label in assets[0].tags] == ["DriveTags.Valid"]


def test_closing_definition_stream_releases_scope_and_allows_retry(source):
    source.native_assets["file"] = [("my_service.my_file", {"name": "my_file", "service": "my_service"})]
    source.native_tags["file"] = [("my_service.my_file", definition(name)) for name in ["First", "Second"]]
    stream = drive_stages(source, "file")
    assert next(stream).right.tag_request.name.root == "First"
    stream.close()
    assert source.tags_registry.stats()["live_entities"] == 0
    published, assets, errors = consume(source, drive_stages(source, "file"))
    assert published == ["First", "Second"]
    assert errors == []
    assert [label.tagFQN.root for label in assets[0].tags] == ["DriveTags.First", "DriveTags.Second"]


def test_one_registration_failure_keeps_other_native_tags_and_the_asset(source):
    source.native_assets["file"] = [("my_service.my_file", {"name": "my_file", "service": "my_service"})]
    source.native_tags["file"] = [
        ("my_service.my_file", TagDefinition("DriveTags", "Broken", "Native tags", None)),
        ("my_service.my_file", definition("Valid")),
    ]
    published, assets, errors = consume(source, drive_stages(source, "file"))
    assert published == ["Valid"]
    assert len(errors) == 1
    assert "Failed to register tag [Broken]" in errors[0].error
    assert [label.tagFQN.root for label in assets[0].tags] == ["DriveTags.Valid"]
    assert source.tags_registry.stats()["live_entities"] == 0


def test_failed_native_tag_stage_releases_attachments_and_allows_the_asset(source):
    def tags():
        yield "my_service.my_file", definition("Unpublished")
        raise RuntimeError("Native tag API unavailable")

    source.native_assets["file"] = [("my_service.my_file", {"name": "my_file", "service": "my_service"})]
    source.native_tags["file"] = tags()
    published, assets, errors = consume(source, drive_stages(source, "file"))
    assert published == []
    assert errors == []
    assert assets[0].name.root == "my_file"
    assert not assets[0].tags
    assert source.tags_registry.stats()["live_entities"] == 0


@pytest.mark.parametrize("kind,entity_fqn,payload", ASSETS)
def test_closing_asset_stream_releases_attachments_and_closes_the_producer(source, kind, entity_fqn, payload):
    source.native_assets[kind] = [(entity_fqn, payload)]
    source.native_tags[kind] = [(entity_fqn, definition("Shared"))]
    stream = drive_stages(source, kind)
    assert next(stream).right.tag_request.name.root == "Shared"
    source.catalog.add("DriveTags.Shared")
    assert [label.tagFQN.root for label in next(stream).right.tags] == ["DriveTags.Shared"]
    stream.close()
    assert source.closed_stages[-1] == kind
    assert source.tags_registry.stats()["live_entities"] == 0


def test_file_batch_releases_root_nested_and_unemitted_attachments(source):
    source.native_assets["file"] = [
        ("my_service.root_file", {"name": "root_file", "service": "my_service"}),
        (
            "my_service.my_directory.my_file",
            {"name": "my_file", "service": "my_service", "directory": "my_service.my_directory"},
        ),
    ]
    source.native_tags["file"] = [
        ("my_service.root_file", definition("Root")),
        ("my_service.my_directory.my_file", definition("Nested")),
        ("my_service.my_directory.filtered_file", definition("Filtered")),
    ]
    published, assets, errors = consume(source, drive_stages(source, "file"))
    assert published == ["Root", "Nested", "Filtered"]
    assert errors == []
    assert [[label.tagFQN.root for label in asset.tags] for asset in assets] == [
        ["DriveTags.Root"],
        ["DriveTags.Nested"],
    ]
    assert source.tags_registry.stats()["live_entities"] == 0


def test_quoted_service_scope_is_released(source):
    source.context.get().upsert("drive_service", "my.service")
    source.native_assets["file"] = [('"my.service".my_file', {"name": "my_file", "service": '"my.service"'})]
    source.native_tags["file"] = [('"my.service".my_file', definition("Shared"))]
    _, assets, errors = consume(source, drive_stages(source, "file"))
    assert errors == []
    assert [label.tagFQN.root for label in assets[0].tags] == ["DriveTags.Shared"]
    assert source.tags_registry.stats()["live_entities"] == 0
