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

from metadata.generated.schema.metadataIngestion.driveServiceMetadataPipeline import DriveServiceMetadataPipeline
from metadata.ingestion.api.steps import Source
from metadata.ingestion.source.drive.googledrive.metadata import GoogleDriveSource


class InMemoryDriveSource(GoogleDriveSource):
    """In-memory asset producer with the default Drive tag hooks."""

    def requests(self, _):
        yield from self.records

    yield_directory = requests
    yield_file = requests
    yield_spreadsheet = requests
    yield_worksheet = requests


class TaggedDriveSource(InMemoryDriveSource):
    """In-memory asset producer using the shared Drive tagging seam."""

    def tags(self, asset_request):
        return self.native_tags.get(asset_request.name.root, [])

    yield_directory_tags = tags
    yield_file_tags = tags
    yield_spreadsheet_tags = tags
    yield_worksheet_tags = tags


def make_drive_source(metadata, *, tagged=True):
    instance = object.__new__(TaggedDriveSource if tagged else InMemoryDriveSource)
    Source.__init__(instance)
    instance.metadata = metadata
    instance.source_config = DriveServiceMetadataPipeline(includeTags=True)
    instance.records = []
    instance.native_tags = {}
    return instance
