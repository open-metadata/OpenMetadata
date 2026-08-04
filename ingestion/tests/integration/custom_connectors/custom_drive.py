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
"""Custom Drive connector yielding a deterministic in-memory drive tree.

``customDriveConnection.json`` does not declare ``sourcePythonClass``; it only
survives because the schema sets ``additionalProperties: true``, so the UI cannot
configure this connector today.
"""

from typing import Iterable, Optional  # noqa: UP035

from metadata.generated.schema.api.data.createDirectory import CreateDirectoryRequest
from metadata.generated.schema.api.data.createFile import CreateFileRequest
from metadata.generated.schema.api.data.createSpreadsheet import (
    CreateSpreadsheetRequest,
)
from metadata.generated.schema.api.data.createWorksheet import CreateWorksheetRequest
from metadata.generated.schema.api.services.createDriveService import (
    CreateDriveServiceRequest,
)
from metadata.generated.schema.entity.data.directory import DirectoryType
from metadata.generated.schema.entity.data.file import FileType
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.connections.drive.customDriveConnection import (
    CustomDriveConnection,
)
from metadata.generated.schema.entity.services.driveService import DriveServiceType
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata

DIRECTORY_NAME = "my_directory"
FILE_NAME = "my_report.csv"
SPREADSHEET_NAME = "my_spreadsheet"
WORKSHEET_NAME = "my_worksheet"


class CustomDriveSource(Source):
    """Yields one directory with a file, and one spreadsheet with a worksheet."""

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = config.serviceConnection.root.config

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,  # noqa: UP045
    ) -> "CustomDriveSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, CustomDriveConnection):
            raise InvalidSourceException(f"Expected CustomDriveConnection, but got {connection}")
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        """No external system to reach"""

    def close(self) -> None:
        """Nothing to close"""

    def _iter(self, *_, **__) -> Iterable[Either]:
        service_name = self.config.serviceName
        yield Either(
            right=CreateDriveServiceRequest(
                name=service_name,
                serviceType=DriveServiceType.CustomDrive,
                connection=self.config.serviceConnection.root,
                displayName="Custom Drive Demo",
                description="Shared drive served by the custom drive connector",
            )
        )
        yield Either(
            right=CreateDirectoryRequest(
                name=DIRECTORY_NAME,
                service=service_name,
                displayName="My Directory",
                description="Folder produced by the custom drive connector",
                directoryType=DirectoryType.Folder,
                path=f"/{DIRECTORY_NAME}",
                numberOfFiles=1,
            )
        )
        yield Either(
            right=CreateFileRequest(
                name=FILE_NAME,
                service=service_name,
                directory=f"{service_name}.{DIRECTORY_NAME}",
                displayName="My Report",
                description="Daily revenue export",
                fileType=FileType.CSV,
                mimeType="text/csv",
                fileExtension="csv",
                path=f"/{DIRECTORY_NAME}/{FILE_NAME}",
                size=2048,
            )
        )
        yield Either(
            right=CreateSpreadsheetRequest(
                name=SPREADSHEET_NAME,
                service=service_name,
                displayName="My Spreadsheet",
                description="Workbook produced by the custom drive connector",
                path=f"/{SPREADSHEET_NAME}",
                size=4096,
            )
        )
        yield Either(
            right=CreateWorksheetRequest(
                name=WORKSHEET_NAME,
                spreadsheet=f"{service_name}.{SPREADSHEET_NAME}",
                displayName="My Worksheet",
                description="Revenue tab of the workbook",
                rowCount=100,
                columnCount=2,
                columns=[
                    Column(name="day", dataType=DataType.DATE, description="Calendar day"),
                    Column(name="revenue", dataType=DataType.DECIMAL, description="Revenue for the day"),
                ],
            )
        )
