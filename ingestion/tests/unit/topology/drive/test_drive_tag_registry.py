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
"""Drive connector tag hooks publish definitions before their assets."""

from unittest.mock import MagicMock

import pytest

from metadata.domain.tags import TagDefinition
from metadata.generated.schema.api.data.createDirectory import CreateDirectoryRequest
from metadata.generated.schema.api.data.createFile import CreateFileRequest
from metadata.generated.schema.api.data.createSpreadsheet import CreateSpreadsheetRequest
from metadata.generated.schema.api.data.createWorksheet import CreateWorksheetRequest
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from ....utils.drive_tags import make_drive_source  # noqa: TID252


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
    ("directory", CreateDirectoryRequest(name="my_directory", service="my_service")),
    ("file", CreateFileRequest(name="my_file.csv", service="my_service", directory="my_service.my_directory")),
    ("spreadsheet", CreateSpreadsheetRequest(name="my_sheet", service="my_service")),
    ("worksheet", CreateWorksheetRequest(name="my_tab", service="my_service", spreadsheet="my_service.my_sheet")),
]


@pytest.mark.parametrize("kind,asset_request", ASSETS)
def test_each_asset_hook_publishes_definitions_before_attaching_labels(source, kind, asset_request):
    source.records = [Either(right=asset_request.model_copy(deep=True))]
    source.native_tags = {asset_request.name.root: [definition("Shared")]}
    published, assets, errors = consume(source, getattr(source, f"yield_{kind}_details")(None))
    assert published == ["Shared"]
    assert errors == []
    assert len(assets) == 1
    assert [label.tagFQN.root for label in assets[0].tags] == ["DriveTags.Shared"]
    assert source.tags_registry.stats()["live_entities"] == 0


@pytest.mark.parametrize("kind,asset_request", ASSETS)
def test_missing_tags_do_not_prevent_asset_creation(source, kind, asset_request):
    source.records = [Either(right=asset_request.model_copy(deep=True))]
    source.native_tags = {asset_request.name.root: [definition("Missing")]}
    published, assets, errors = consume(source, getattr(source, f"yield_{kind}_details")(None), persist=False)
    assert published == ["Missing"]
    assert errors == []
    assert assets[0].name == asset_request.name
    assert not assets[0].tags
    assert source.tags_registry.stats()["live_entities"] == 0


@pytest.mark.parametrize("enabled,tags", [(False, [definition("Disabled")]), (True, [])])
def test_disabled_or_empty_hooks_leave_assets_unchanged_without_catalog_calls(source, enabled, tags):
    asset_request = CreateFileRequest(name="my_file", service="my_service")
    source.records = [Either(right=asset_request)]
    source.native_tags = {"my_file": tags}
    source.source_config.includeTags = enabled
    published, assets, errors = consume(source, source.yield_file_details(None))
    assert published == []
    assert errors == []
    assert assets == [asset_request]
    assert not assets[0].tags
    source.metadata.get_by_name.assert_not_called()


@pytest.mark.parametrize("kind,asset_request", ASSETS)
def test_default_drive_hooks_leave_assets_unchanged(source, kind, asset_request):
    instance = make_drive_source(source.metadata, tagged=False)
    instance.records = [Either(right=asset_request.model_copy(deep=True))]
    published, assets, errors = consume(instance, getattr(instance, f"yield_{kind}_details")(None))
    assert published == []
    assert errors == []
    assert assets == [asset_request]
    source.metadata.get_by_name.assert_not_called()


def test_parent_and_child_assets_keep_separate_labels_and_preserve_existing_labels(source):
    parent = CreateDirectoryRequest(name="my_directory", service="my_service")
    child = CreateDirectoryRequest(name="nested", service="my_service", parent="my_service.my_directory")
    source.native_tags = {"my_directory": [definition("Parent")], "nested": [definition("Child")]}
    source.records = [Either(right=parent), Either(right=child)]
    _, assets, errors = consume(source, source.yield_directory_details(None))
    assert errors == []
    assert [[label.tagFQN.root for label in asset.tags] for asset in assets] == [
        ["DriveTags.Parent"],
        ["DriveTags.Child"],
    ]
    existing = TagLabel(tagFQN="Other.Existing", source="Classification", labelType="Manual", state="Confirmed")
    source.records = [Either(right=CreateFileRequest(name="my_file", service="my_service", tags=[existing]))]
    source.native_tags["my_file"] = [definition("Child")]
    published, files, errors = consume(source, source.yield_file_details(None))
    assert published == []
    assert errors == []
    assert [label.tagFQN.root for label in files[0].tags] == ["Other.Existing", "DriveTags.Child"]
    assert source.tags_registry.stats()["live_entities"] == 0


def test_invalid_tags_do_not_discard_valid_tags_or_source_errors(source):
    error = Either(left={"name": "my_file", "error": "Source unavailable", "stackTrace": "trace"})
    source.records = [error, Either(right=CreateFileRequest(name="my_file", service="my_service"))]
    source.native_tags = {"my_file": [definition(""), definition("bad>name"), definition("Valid")]}
    published, assets, errors = consume(source, source.yield_file_details(None))
    assert published == ["Valid"]
    assert len(errors) == 1
    assert errors[0].error == "Source unavailable"
    assert [label.tagFQN.root for label in assets[0].tags] == ["DriveTags.Valid"]


def test_closing_definition_stream_releases_scope_and_allows_retry(source):
    source.records = [Either(right=CreateFileRequest(name="my_file", service="my_service"))]
    source.native_tags = {"my_file": [definition("First"), definition("Second")]}
    stream = source.yield_file_details(None)
    assert next(stream).right.tag_request.name.root == "First"
    stream.close()
    assert source.tags_registry.stats()["live_entities"] == 0
    published, assets, errors = consume(source, source.yield_file_details(None))
    assert published == ["First", "Second"]
    assert errors == []
    assert [label.tagFQN.root for label in assets[0].tags] == ["DriveTags.First", "DriveTags.Second"]


def test_hook_failure_keeps_already_extracted_tags_and_the_asset(source):
    def tags():
        yield definition("Valid")
        raise RuntimeError("Native tag API unavailable")

    source.records = [Either(right=CreateFileRequest(name="my_file", service="my_service"))]
    source.native_tags = {"my_file": tags()}
    published, assets, errors = consume(source, source.yield_file_details(None))
    assert published == ["Valid"]
    assert len(errors) == 1
    assert "Native tag API unavailable" in errors[0].error
    assert [label.tagFQN.root for label in assets[0].tags] == ["DriveTags.Valid"]
    assert source.tags_registry.stats()["live_entities"] == 0


def test_closing_asset_stream_releases_attachments_and_closes_the_producer(source):
    closed = []

    def records():
        try:
            yield Either(right=CreateFileRequest(name="my_file", service="my_service"))
        finally:
            closed.append(True)

    source.records = records()
    source.native_tags = {"my_file": [definition("Shared")]}
    stream = source.yield_file_details(None)
    assert next(stream).right.tag_request.name.root == "Shared"
    source.catalog.add("DriveTags.Shared")
    assert [label.tagFQN.root for label in next(stream).right.tags] == ["DriveTags.Shared"]
    stream.close()
    assert closed == [True]
    assert source.tags_registry.stats()["live_entities"] == 0
