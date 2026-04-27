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
Real Integration Tests for Google Drive Source
Tests actual method execution with mocked API responses
"""

from typing import Dict, List
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.services.connections.drive.googleDriveConnection import (
    GoogleDriveConnection,
)
from metadata.generated.schema.metadataIngestion.driveServiceMetadataPipeline import (
    DriveServiceMetadataPipeline,
)
from metadata.generated.schema.security.credentials.gcpCredentials import GCPCredentials
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
)
from metadata.ingestion.source.drive.googledrive.metadata import GoogleDriveSource
from metadata.ingestion.source.drive.googledrive.models import (
    GoogleDriveDirectoryInfo,
    GoogleDriveFile,
    GoogleDriveListResponse,
    GoogleDriveOwner,
    GoogleSheetsProperties,
    GoogleSheetsSheet,
    GoogleSheetsSpreadsheetDetails,
    GoogleSheetsSpreadsheetProperties,
)


class TestGoogleDriveRealMethods:
    """Test actual Google Drive method execution"""

    @pytest.fixture
    def googledrive_source(self):
        """Create a real GoogleDriveSource instance with mocked dependencies"""
        # Mock the metadata client
        mock_metadata = MagicMock()
        mock_metadata.get_service_or_create.return_value = MagicMock()
        mock_metadata.get_by_name.return_value = None

        # Mock config object
        mock_config = MagicMock()
        mock_config.serviceConnection.root.config = GoogleDriveConnection(
            credentials=GCPCredentials(
                gcpConfig=GcpCredentialsValues(
                    type="service_account",
                    projectId="test-project",
                    privateKeyId="test-key-id",
                    privateKey="-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----",
                    clientEmail="test@test-project.iam.gserviceaccount.com",
                    clientId="123456789",
                    authUri="https://accounts.google.com/o/oauth2/auth",
                    tokenUri="https://oauth2.googleapis.com/token",
                    authProviderX509CertUrl="https://www.googleapis.com/oauth2/v1/certs",
                    clientX509CertUrl="https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project.iam.gserviceaccount.com",
                )
            ),
            includeTeamDrives=True,
            includeGoogleSheets=True,
        )

        # Mock source config
        mock_source_config = DriveServiceMetadataPipeline(
            includeDirectories=True,
            includeFiles=True,
            includeSpreadsheets=True,
            includeWorksheets=True,
            directoryFilterPattern=None,
            fileFilterPattern=None,
            worksheetFilterPattern=None,
            useFqnForFiltering=False,
        )
        mock_config.sourceConfig.config = mock_source_config

        # Create a mock client instance
        mock_client = MagicMock()
        mock_client.drive_service = MagicMock()
        mock_client.sheets_service = MagicMock()

        # Create source instance without calling __init__ to avoid authentication
        source = GoogleDriveSource.__new__(GoogleDriveSource)
        source.config = mock_config
        source.metadata = mock_metadata
        source.service_connection = mock_config.serviceConnection.root.config
        source.source_config = mock_source_config
        source.client = mock_client
        source.connection_obj = mock_client

        # Initialize caches
        source._directories_cache: Dict[str, GoogleDriveDirectoryInfo] = {}
        source._current_directory_context: str = None
        source._files_by_parent_cache: Dict[str, List[GoogleDriveFile]] = {}
        source._directory_fqn_cache: Dict[str, str] = {}
        source._root_files_processed: bool = False

        # Mock context
        source.context = MagicMock()
        source.context.get.return_value.drive_service = "test_googledrive"

        # Mock status and state tracking
        source.status = MagicMock()
        source.directory_source_state = MagicMock()
        source.file_source_state = MagicMock()

        return source, mock_client

    def test_fetch_directories_real_execution(self, googledrive_source):
        """Test actual _fetch_directories method execution"""
        source, mock_client = googledrive_source

        # Mock API response for directories
        mock_response1 = GoogleDriveListResponse(
            files=[
                GoogleDriveFile(
                    id="dir_001",
                    name="Documents",
                    parents=None,
                    createdTime="2023-01-01T12:00:00Z",
                    modifiedTime="2023-01-01T12:00:00Z",
                    shared=False,
                    webViewLink="https://drive.google.com/drive/folders/dir_001",
                    description="Main documents folder",
                    owners=[GoogleDriveOwner(displayName="John Doe")],
                ),
                GoogleDriveFile(
                    id="dir_002",
                    name="Projects",
                    parents=["dir_001"],
                    createdTime="2023-01-02T12:00:00Z",
                    modifiedTime="2023-01-02T12:00:00Z",
                    shared=True,
                    webViewLink="https://drive.google.com/drive/folders/dir_002",
                    description="Projects subfolder",
                    owners=[GoogleDriveOwner(displayName="Jane Smith")],
                ),
            ],
            nextPageToken=None,
        )

        # Mock files response (empty for this test)
        mock_files_response = GoogleDriveListResponse(files=[], nextPageToken=None)

        mock_client.drive_service.files.return_value.list.return_value.execute.side_effect = [
            mock_response1.model_dump(),  # Directories call
            mock_files_response.model_dump(),  # Files call
        ]

        # Execute the real method
        source._fetch_directories()

        # Verify the method was called correctly for directories
        calls = mock_client.drive_service.files.return_value.list.call_args_list
        directory_call = calls[0][1]
        assert "mimeType='application/vnd.google-apps.folder'" in directory_call["q"]
        assert "trashed=false" in directory_call["q"]
        assert directory_call["pageSize"] == 1000
        assert directory_call["supportsAllDrives"] is True

        # Verify directories were cached
        assert len(source._directories_cache) == 2
        assert "dir_001" in source._directories_cache
        assert "dir_002" in source._directories_cache

        # Verify directory hierarchy
        dir_001 = source._directories_cache["dir_001"]
        assert dir_001.name == "Documents"
        assert dir_001.path == ["Documents"]

        dir_002 = source._directories_cache["dir_002"]
        assert dir_002.name == "Projects"
        assert dir_002.path == ["Documents", "Projects"]

    def test_fetch_all_files_real_execution(self, googledrive_source):
        """Test actual _fetch_all_files method execution"""
        source, mock_client = googledrive_source

        # Mock API response for files
        mock_response = GoogleDriveListResponse(
            files=[
                GoogleDriveFile(
                    id="file_001",
                    name="document1.pdf",
                    parents=["dir_001"],
                    mimeType="application/pdf",
                    size="1024000",
                    webViewLink="https://drive.google.com/file/d/file_001/view",
                    description="Important document",
                ),
                GoogleDriveFile(
                    id="file_002",
                    name="image1.jpg",
                    parents=["root"],
                    mimeType="image/jpeg",
                    size="512000",
                    webViewLink="https://drive.google.com/file/d/file_002/view",
                    description="Profile image",
                ),
            ],
            nextPageToken=None,
        )

        mock_client.drive_service.files.return_value.list.return_value.execute.return_value = mock_response.model_dump()

        # Execute the real method
        source._fetch_all_files()

        # Verify the method was called correctly
        mock_client.drive_service.files.return_value.list.assert_called()
        call_args = mock_client.drive_service.files.return_value.list.call_args[1]
        assert "trashed=false" in call_args["q"]
        assert "mimeType!='application/vnd.google-apps.folder'" in call_args["q"]
        assert "mimeType!='application/vnd.google-apps.spreadsheet'" in call_args["q"]

        # Verify files were cached by parent
        assert len(source._files_by_parent_cache) == 2
        assert "dir_001" in source._files_by_parent_cache
        assert "root" in source._files_by_parent_cache
        assert len(source._files_by_parent_cache["dir_001"]) == 1
        assert len(source._files_by_parent_cache["root"]) == 1

    def test_get_directory_names_real_execution(self, googledrive_source):
        """Test get_directory_names method with hierarchical ordering"""
        source, mock_client = googledrive_source

        # Pre-populate directory cache
        source._directories_cache = {
            "dir_001": GoogleDriveDirectoryInfo(
                id="dir_001",
                name="Documents",
                parents=[],
                path=["Documents"],
            ),
            "dir_002": GoogleDriveDirectoryInfo(
                id="dir_002",
                name="Projects",
                parents=["dir_001"],
                path=["Documents", "Projects"],
            ),
            "dir_003": GoogleDriveDirectoryInfo(
                id="dir_003",
                name="Archive",
                parents=["dir_002"],
                path=["Documents", "Projects", "Archive"],
            ),
        }

        # Mock _fetch_directories to prevent actual API calls
        source._fetch_directories = MagicMock()

        # Mock metadata FQN building
        source.metadata.get_by_name = MagicMock(return_value=None)

        # Execute the real method
        result_generator = source.get_directory_names()
        result = list(result_generator)

        # Verify hierarchical order (parents before children)
        assert len(result) == 3
        assert result[0] == "dir_001"  # Root directory first
        assert result[1] == "dir_002"  # Child of dir_001
        assert result[2] == "dir_003"  # Child of dir_002

    def test_yield_directory_real_execution(self, googledrive_source):
        """Test yield_directory method execution"""
        source, mock_client = googledrive_source

        # Pre-populate directory cache
        directory_info = GoogleDriveDirectoryInfo(
            id="dir_001",
            name="Test Directory",
            parents=[],
            description="Test directory for unit tests",
            web_view_link="https://drive.google.com/drive/folders/dir_001",
            path=["Test Directory"],
        )
        source._directories_cache["dir_001"] = directory_info

        # Execute the real method
        result_generator = source.yield_directory("dir_001")
        results = list(result_generator)

        # Verify we got a successful result
        assert len(results) == 1
        assert results[0].right is not None

        # Verify the CreateDirectoryRequest
        directory_request = results[0].right
        assert directory_request.name.root == "Test Directory"
        assert directory_request.displayName == "Test Directory"
        assert directory_request.description.root == "Test directory for unit tests"
        assert directory_request.sourceUrl.root == "https://drive.google.com/drive/folders/dir_001"

    def test_yield_file_real_execution(self, googledrive_source):
        """Test yield_file method execution"""
        source, mock_client = googledrive_source

        # Pre-populate files cache
        test_file = GoogleDriveFile(
            id="file_001",
            name="test_document.pdf",
            parents=["dir_001"],
            mimeType="application/pdf",
            size="1024000",
            webViewLink="https://drive.google.com/file/d/file_001/view",
            description="Test PDF document",
        )
        source._files_by_parent_cache["dir_001"] = [test_file]

        # Mock directory FQN cache
        source._directory_fqn_cache["dir_001"] = "test_googledrive.Test Directory"

        # Execute the real method
        result_generator = source.yield_file("dir_001")
        results = list(result_generator)

        # Verify we got a successful result
        assert len(results) == 1
        assert results[0].right is not None

        # Verify the CreateFileRequest
        file_request = results[0].right
        assert file_request.name.root == "test_document.pdf"
        assert file_request.displayName == "test_document.pdf"
        assert file_request.mimeType == "application/pdf"
        assert file_request.size == 1024000
        assert str(file_request.webViewLink) == "https://drive.google.com/file/d/file_001/view"

    def test_get_spreadsheets_list_real_execution(self, googledrive_source):
        """Test get_spreadsheets_list method execution"""
        source, mock_client = googledrive_source

        # Mock API response for spreadsheets
        mock_response = GoogleDriveListResponse(
            files=[
                GoogleDriveFile(
                    id="sheet_001",
                    name="Sales Report",
                    mimeType="application/vnd.google-apps.spreadsheet",
                    webViewLink="https://docs.google.com/spreadsheets/d/sheet_001/edit",
                    parents=["dir_001"],
                ),
                GoogleDriveFile(
                    id="sheet_002",
                    name="Budget Planning",
                    mimeType="application/vnd.google-apps.spreadsheet",
                    webViewLink="https://docs.google.com/spreadsheets/d/sheet_002/edit",
                    parents=["root"],
                ),
            ],
            nextPageToken=None,
        )

        mock_client.drive_service.files.return_value.list.return_value.execute.return_value = mock_response.model_dump()

        # Execute the real method
        result_generator = source.get_spreadsheets_list()
        results = list(result_generator)

        # Verify the method was called correctly
        mock_client.drive_service.files.return_value.list.assert_called()
        call_args = mock_client.drive_service.files.return_value.list.call_args[1]
        assert "mimeType='application/vnd.google-apps.spreadsheet'" in call_args["q"]

        # Verify results
        assert len(results) == 2
        assert results[0].name == "Sales Report"
        assert results[1].name == "Budget Planning"

    def test_get_spreadsheet_details_real_execution(self, googledrive_source):
        """Test get_spreadsheet_details method execution"""
        source, mock_client = googledrive_source

        # Create test spreadsheet file
        test_spreadsheet = GoogleDriveFile(
            id="sheet_001",
            name="Test Spreadsheet",
            parents=["dir_001"],
            mimeType="application/vnd.google-apps.spreadsheet",
        )

        # Mock Sheets API response
        mock_sheets_response = {
            "spreadsheetId": "sheet_001",
            "properties": {"title": "Test Spreadsheet"},
            "sheets": [
                {
                    "properties": {
                        "sheetId": 0,
                        "title": "Sheet1",
                        "sheetType": "GRID",
                        "gridProperties": {"rowCount": 1000, "columnCount": 26},
                    }
                },
                {
                    "properties": {
                        "sheetId": 1,
                        "title": "Data",
                        "sheetType": "GRID",
                        "gridProperties": {"rowCount": 500, "columnCount": 10},
                    }
                },
            ],
        }

        mock_client.sheets_service.spreadsheets.return_value.get.return_value.execute.return_value = (
            mock_sheets_response
        )

        # Execute the real method
        result = source.get_spreadsheet_details(test_spreadsheet)

        # Verify the method was called correctly
        mock_client.sheets_service.spreadsheets.return_value.get.assert_called_with(spreadsheetId="sheet_001")

        # Verify result
        assert isinstance(result, GoogleSheetsSpreadsheetDetails)
        assert result.spreadsheetId == "sheet_001"
        assert result.properties.title == "Test Spreadsheet"
        assert len(result.sheets) == 2
        assert result.sheets[0].properties.title == "Sheet1"
        assert result.sheets[1].properties.title == "Data"

    def test_yield_spreadsheet_real_execution(self, googledrive_source):
        """Test yield_spreadsheet method execution"""
        source, mock_client = googledrive_source

        # Create test spreadsheet details
        spreadsheet_details = GoogleSheetsSpreadsheetDetails(
            spreadsheetId="sheet_001",
            properties=GoogleSheetsSpreadsheetProperties(title="Test Spreadsheet"),
            description="Test spreadsheet for unit tests",
            spreadsheetUrl="https://docs.google.com/spreadsheets/d/sheet_001/edit",
            sheets=[],
        )

        # Mock register method
        source.register_record_spreadsheet = MagicMock()

        # Execute the real method
        result_generator = source.yield_spreadsheet(spreadsheet_details)
        results = list(result_generator)

        # Verify we got a successful result
        assert len(results) == 1
        assert results[0].right is not None

        # Verify the CreateSpreadsheetRequest
        spreadsheet_request = results[0].right
        assert spreadsheet_request.name.root == "sheet_001"
        assert spreadsheet_request.displayName == "Test Spreadsheet"
        assert spreadsheet_request.description.root == "Test spreadsheet for unit tests"
        assert spreadsheet_request.sourceUrl.root == "https://docs.google.com/spreadsheets/d/sheet_001/edit"

    def test_yield_worksheet_real_execution(self, googledrive_source):
        """Test yield_worksheet method execution"""
        source, mock_client = googledrive_source

        # Create test spreadsheet details with sheets
        spreadsheet_details = GoogleSheetsSpreadsheetDetails(
            spreadsheetId="sheet_001",
            properties=GoogleSheetsSpreadsheetProperties(title="Test Spreadsheet"),
            sheets=[
                GoogleSheetsSheet(
                    properties=GoogleSheetsProperties(
                        sheetId=0,
                        title="Sheet1",
                    )
                ),
                GoogleSheetsSheet(
                    properties=GoogleSheetsProperties(
                        sheetId=1,
                        title="Data Analysis",
                    )
                ),
            ],
        )

        # Mock register method
        source.register_record_worksheet = MagicMock()

        # Execute the real method
        result_generator = source.yield_worksheet(spreadsheet_details)
        results = list(result_generator)

        # Verify we got results for both worksheets
        assert len(results) == 2

        # Verify both results are successful
        assert results[0].right is not None
        assert results[1].right is not None

        # Verify the CreateWorksheetRequests
        worksheet1_request = results[0].right
        assert worksheet1_request.name.root == "0"
        assert worksheet1_request.displayName == "Sheet1"

        worksheet2_request = results[1].right
        assert worksheet2_request.name.root == "1"
        assert worksheet2_request.displayName == "Data Analysis"

    def test_pagination_handling_real_execution(self, googledrive_source):
        """Test pagination handling in _fetch_directories"""
        source, mock_client = googledrive_source

        # Mock paginated responses for directories
        first_batch = GoogleDriveListResponse(
            files=[
                GoogleDriveFile(
                    id=f"dir_{i:03d}",
                    name=f"Directory {i}",
                    parents=None,
                )
                for i in range(1, 101)
            ],
            nextPageToken="token_page_2",
        )

        second_batch = GoogleDriveListResponse(
            files=[
                GoogleDriveFile(
                    id=f"dir_{i:03d}",
                    name=f"Directory {i}",
                    parents=None,
                )
                for i in range(101, 151)
            ],
            nextPageToken=None,  # Last page
        )

        # Mock empty files response
        empty_files = GoogleDriveListResponse(files=[], nextPageToken=None)

        responses = [
            first_batch.model_dump(),  # First directory batch
            second_batch.model_dump(),  # Second directory batch
            empty_files.model_dump(),  # Files response
        ]

        mock_client.drive_service.files.return_value.list.return_value.execute.side_effect = responses

        # Execute the real method
        source._fetch_directories()

        # Verify pagination calls for directories
        directory_calls = [
            call
            for call in mock_client.drive_service.files.return_value.list.call_args_list
            if "mimeType='application/vnd.google-apps.folder'" in call[1]["q"]
        ]
        assert len(directory_calls) == 2

        # Check first call (no pageToken)
        first_call = directory_calls[0][1]
        assert "pageToken" not in first_call

        # Check second call (with pageToken)
        second_call = directory_calls[1][1]
        assert second_call["pageToken"] == "token_page_2"

        # Verify total directories cached
        assert len(source._directories_cache) == 150

    def test_error_handling_in_fetch_directories(self, googledrive_source):
        """Test error handling in _fetch_directories"""
        source, mock_client = googledrive_source

        # Mock an exception from the client
        mock_client.drive_service.files.return_value.list.return_value.execute.side_effect = Exception("API Error")

        # Execute the real method - should not raise exception
        source._fetch_directories()

        # Should have empty cache on error
        assert len(source._directories_cache) == 0
        assert len(source._files_by_parent_cache) == 0

    def test_root_files_processing_real_execution(self, googledrive_source):
        """Test root files processing in yield_file"""
        source, mock_client = googledrive_source

        # Pre-populate root files in cache
        root_file = GoogleDriveFile(
            id="root_file_001",
            name="root_document.txt",
            parents=None,  # Root file has no parents
            mimeType="text/plain",
            size="2048",
            webViewLink="https://drive.google.com/file/d/root_file_001/view",
            description="Document in root directory",
        )
        source._files_by_parent_cache["root"] = [root_file]

        # Also add a file to the test directory so the method executes fully
        test_file = GoogleDriveFile(
            id="file_001",
            name="test_file.txt",
            parents=["dir_001"],
            mimeType="text/plain",
            size="1024",
            webViewLink="https://drive.google.com/file/d/file_001/view",
            description="Test file",
        )
        source._files_by_parent_cache["dir_001"] = [test_file]

        # Mock register method
        source.register_record_file = MagicMock()

        # Execute the real method for a directory with files (this triggers root file processing)
        result_generator = source.yield_file("dir_001")
        results = list(result_generator)  # noqa: F841

        # Verify root files were processed (flag should be set after first call)
        assert source._root_files_processed is True

        # Test calling with root directory after root files processed
        root_results = list(source.yield_file("root"))

        # Should return empty since root files already processed
        assert len(root_results) == 0

    def test_directory_hierarchy_sorting_real_execution(self, googledrive_source):
        """Test _sort_directories_by_hierarchy method"""
        source, mock_client = googledrive_source

        # Pre-populate directory cache with complex hierarchy
        source._directories_cache = {
            "root_dir": GoogleDriveDirectoryInfo(
                id="root_dir",
                name="Root",
                parents=[],
            ),
            "child1": GoogleDriveDirectoryInfo(
                id="child1",
                name="Child1",
                parents=["root_dir"],
            ),
            "child2": GoogleDriveDirectoryInfo(
                id="child2",
                name="Child2",
                parents=["root_dir"],
            ),
            "grandchild": GoogleDriveDirectoryInfo(
                id="grandchild",
                name="Grandchild",
                parents=["child1"],
            ),
        }

        # Execute the real method
        result = source._sort_directories_by_hierarchy()

        # Verify hierarchical order
        root_index = result.index("root_dir")
        child1_index = result.index("child1")
        child2_index = result.index("child2")
        grandchild_index = result.index("grandchild")

        # Root should come before children
        assert root_index < child1_index
        assert root_index < child2_index
        # Child1 should come before grandchild
        assert child1_index < grandchild_index

    def test_close_method_real_execution(self, googledrive_source):
        """Test close method execution"""
        source, mock_client = googledrive_source

        # Pre-populate caches
        source._directories_cache["test"] = MagicMock()
        source._files_by_parent_cache["test"] = [MagicMock()]
        source._directory_fqn_cache["test"] = "test_fqn"
        source._current_directory_context = "test_context"
        source._root_files_processed = True

        # Mock client close method
        mock_client.close = MagicMock()

        # Execute the real method
        source.close()

        # Verify all caches were cleared
        assert len(source._directories_cache) == 0
        assert len(source._files_by_parent_cache) == 0
        assert len(source._directory_fqn_cache) == 0
        assert source._current_directory_context is None
        assert source._root_files_processed is False

        # Verify client close was called
        mock_client.close.assert_called_once()

    def test_get_spreadsheet_name_real_execution(self, googledrive_source):
        """Test get_spreadsheet_name method"""
        source, mock_client = googledrive_source

        mock_spreadsheet = GoogleDriveFile(
            id="sheet_001",
            name="Test Spreadsheet Name",
            mimeType="application/vnd.google-apps.spreadsheet",
        )

        # Execute the real method
        result = source.get_spreadsheet_name(mock_spreadsheet)

        # Verify result
        assert result == "Test Spreadsheet Name"

    def test_file_filtering_real_execution(self, googledrive_source):
        """Test file filtering in yield_file"""
        source, mock_client = googledrive_source

        # Configure filter pattern to exclude .txt files
        from metadata.generated.schema.type.filterPattern import FilterPattern

        source.source_config.fileFilterPattern = FilterPattern(
            excludes=[".*\\.txt$"]  # Use proper regex pattern
        )

        # Pre-populate files cache with mixed file types
        txt_file = GoogleDriveFile(
            id="file_001",
            name="document.txt",
            mimeType="text/plain",
        )
        pdf_file = GoogleDriveFile(
            id="file_002",
            name="document.pdf",
            mimeType="application/pdf",
        )
        source._files_by_parent_cache["dir_001"] = [txt_file, pdf_file]

        # Mock register method
        source.register_record_file = MagicMock()

        # Execute the real method
        result_generator = source.yield_file("dir_001")
        results = list(result_generator)

        # Should only get the PDF file (txt file filtered out)
        assert len(results) == 1
        assert results[0].right.name.root == "document.pdf"
