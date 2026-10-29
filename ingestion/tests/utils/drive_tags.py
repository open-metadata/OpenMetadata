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
"""In-memory Drive connector using the same tagging seam as Pipeline and Storage."""

from metadata.generated.schema.api.data.createDirectory import CreateDirectoryRequest
from metadata.generated.schema.api.data.createFile import CreateFileRequest
from metadata.generated.schema.api.data.createSpreadsheet import CreateSpreadsheetRequest
from metadata.generated.schema.api.data.createWorksheet import CreateWorksheetRequest
from metadata.generated.schema.metadataIngestion.driveServiceMetadataPipeline import DriveServiceMetadataPipeline
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Source
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.drive.googledrive.metadata import GoogleDriveSource

REQUEST_TYPES = {
    "directory": CreateDirectoryRequest,
    "file": CreateFileRequest,
    "spreadsheet": CreateSpreadsheetRequest,
    "worksheet": CreateWorksheetRequest,
}


class InMemoryDriveSource(GoogleDriveSource):
    """Produce requests from native records using the default tag hooks."""

    def requests(self, kind):
        try:
            yield from self.native_errors.get(kind, [])
            for entity_fqn, payload in self.native_assets.get(kind, []):
                labels = self.get_tag_by_fqn(entity_fqn)
                tags = list(payload.get("tags") or []) + (labels or [])
                yield Either(right=REQUEST_TYPES[kind].model_validate({**payload, "tags": tags or None}), left=None)
        finally:
            self.closed_stages.append(kind)

    def yield_directory(self, directory_details):
        yield from self.requests("directory")

    def yield_file(self, directory_details):
        yield from self.requests("file")

    def yield_spreadsheet(self, spreadsheet_details):
        yield from self.requests("spreadsheet")

    def yield_worksheet(self, spreadsheet_details):
        yield from self.requests("worksheet")


class TaggedDriveSource(InMemoryDriveSource):
    """Register native definitions and attachments through the Drive base."""

    def tags(self, kind):
        for entity_fqn, definition in self.native_tags.get(kind, []):
            yield from self.register_tag(entity_fqn=entity_fqn, definition=definition)

    def yield_directory_tags(self, directory_details):
        yield from self.tags("directory")
        yield from self.tags("file")

    def yield_spreadsheet_tags(self, spreadsheet_details):
        yield from self.tags("spreadsheet")
        yield from self.tags("worksheet")


def make_drive_source(metadata, *, tagged=True):
    instance = object.__new__(TaggedDriveSource if tagged else InMemoryDriveSource)
    Source.__init__(instance)
    instance.metadata = metadata
    instance.source_config = DriveServiceMetadataPipeline(includeTags=True)
    instance.context = TopologyContextManager(instance.topology)
    instance.context.get().upsert("drive_service", "my_service")
    instance.context.get().upsert("directory", "my_directory")
    instance.context.get().upsert("spreadsheet", "my_sheet")
    instance.native_assets = {}
    instance.native_tags = {}
    instance.native_errors = {}
    instance.closed_stages = []
    return instance


def drive_stages(source, kind):
    node = source.topology.directory if kind in {"directory", "file"} else source.topology.spreadsheet
    for stage in node.stages:
        yield from source._process_stage(stage, None)
