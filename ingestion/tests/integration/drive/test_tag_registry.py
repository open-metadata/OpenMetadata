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
"""Drive tag hooks through the topology, REST sink, and catalog API."""

from uuid import uuid4

import pytest

from metadata.domain.tags import TagDefinition
from metadata.generated.schema.api.data.createDirectory import CreateDirectoryRequest
from metadata.generated.schema.api.data.createFile import CreateFileRequest
from metadata.generated.schema.api.data.createSpreadsheet import CreateSpreadsheetRequest
from metadata.generated.schema.api.data.createWorksheet import CreateWorksheetRequest
from metadata.generated.schema.api.services.createDriveService import CreateDriveServiceRequest
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.data.directory import Directory
from metadata.generated.schema.entity.data.file import File
from metadata.generated.schema.entity.data.spreadsheet import Spreadsheet
from metadata.generated.schema.entity.data.worksheet import Worksheet
from metadata.generated.schema.entity.services.driveService import DriveService
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.sink.metadata_rest import MetadataRestSink

from ...utils.drive_tags import drive_stages, make_drive_source  # noqa: TID252


@pytest.fixture
def drive(metadata):
    service_name = f"drive_registry_{uuid4().hex[:8]}"
    service = metadata.create_or_update(
        CreateDriveServiceRequest.model_validate({"name": service_name, "serviceType": "GoogleDrive"})
    )
    classification = f"{service_name}_tags"
    try:
        directory = metadata.create_or_update(
            CreateDirectoryRequest.model_validate({"name": "my_directory", "service": service_name})
        )
        spreadsheet = metadata.create_or_update(
            CreateSpreadsheetRequest.model_validate({"name": "my_sheet", "service": service_name})
        )
        yield service_name, directory, spreadsheet, classification
    finally:
        metadata.delete(entity=DriveService, entity_id=service.id, recursive=True, hard_delete=True)
        if entity := metadata.get_by_name(entity=Classification, fqn=classification):
            metadata.delete(entity=Classification, entity_id=entity.id, recursive=True, hard_delete=True)


@pytest.mark.parametrize("kind", ["directory", "file", "spreadsheet", "worksheet", "missing"])
def test_drive_tag_hook_persists_labels_without_preseeding_tags(metadata, drive, kind):
    service, directory, spreadsheet, classification = drive
    directory_fqn = directory.fullyQualifiedName.root
    spreadsheet_fqn = spreadsheet.fullyQualifiedName.root
    cases = {
        "directory": (CreateDirectoryRequest, Directory, {"parent": directory_fqn}, directory_fqn),
        "file": (CreateFileRequest, File, {"directory": directory_fqn}, directory_fqn),
        "spreadsheet": (
            CreateSpreadsheetRequest,
            Spreadsheet,
            {"parent": {"id": str(directory.id.root), "type": "directory"}},
            directory_fqn,
        ),
        "worksheet": (CreateWorksheetRequest, Worksheet, {"spreadsheet": spreadsheet_fqn}, spreadsheet_fqn),
    }
    asset_kind = "file" if kind == "missing" else kind
    request_type, entity_type, parent, parent_fqn = cases[asset_kind]
    asset_request = request_type.model_validate({"name": "my_asset", "service": service, **parent})
    source = make_drive_source(metadata)
    source.native_assets[asset_kind] = [(f"{parent_fqn}.my_asset", asset_request.model_dump(mode="json"))]
    source.native_tags[asset_kind] = [
        (f"{parent_fqn}.my_asset", TagDefinition(classification, "Shared", "Native tags", "Native tag"))
    ]
    source.context.get().upsert("drive_service", service)
    sink = MetadataRestSink.create({"bulk_sink_batch_size": 1}, metadata)
    try:
        for record in drive_stages(source, asset_kind):
            assert record.left is None
            if kind == "missing" and isinstance(record.right, OMetaTagAndClassification):
                continue
            sink.run(record.right)
    finally:
        sink.close()
    assert not sink.status.failures
    asset = metadata.get_by_name(entity=entity_type, fqn=f"{parent_fqn}.my_asset", fields=["tags"])
    assert asset is not None
    assert [label.tagFQN.root for label in asset.tags or []] == (
        [] if kind == "missing" else [f"{classification}.Shared"]
    )
    assert source.tags_registry.stats()["live_entities"] == 0
