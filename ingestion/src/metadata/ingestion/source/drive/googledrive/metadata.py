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
Google Drive source implementation
"""
# pylint: disable=too-many-lines
import traceback
from datetime import datetime
from typing import Dict, Iterable, List, Optional

from metadata.generated.schema.api.data.createDirectory import CreateDirectoryRequest
from metadata.generated.schema.api.data.createFile import CreateFileRequest
from metadata.generated.schema.api.data.createSpreadsheet import (
    CreateSpreadsheetRequest,
)
from metadata.generated.schema.api.data.createWorksheet import CreateWorksheetRequest
from metadata.generated.schema.entity.data.directory import Directory, DirectoryType
from metadata.generated.schema.entity.data.file import File
from metadata.generated.schema.entity.data.spreadsheet import Spreadsheet
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.entity.services.connections.drive.googleDriveConnection import (
    GoogleDriveConnection,
)
from metadata.generated.schema.entity.services.driveService import DriveService
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.driveServiceMetadataPipeline import (
    DriveServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.drive.drive_service import DriveServiceSource
from metadata.ingestion.source.drive.googledrive.connection import (
    GoogleDriveClient,
    get_connection,
)
from metadata.ingestion.source.drive.googledrive.models import (
    GoogleDriveDirectoryInfo,
    GoogleDriveFile,
    GoogleDriveListResponse,
    GoogleSheetsSpreadsheetDetails,
)
from metadata.utils import fqn
from metadata.utils.filters import (
    filter_by_directory,
    filter_by_file,
    filter_by_worksheet,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def convert_timestamp_to_unix_millis(timestamp_str: Optional[str]) -> Optional[int]:
    """
    Convert ISO format timestamp string to Unix epoch time in milliseconds.
    """
    if timestamp_str:
        try:
            dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            return int(dt.timestamp() * 1000)
        except (ValueError, AttributeError) as e:
            logger.warning(f"Failed to parse timestamp '{timestamp_str}': {e}")

    return None


class GoogleDriveSource(DriveServiceSource):
    """
    Google Drive Source implementation
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config: DriveServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata = metadata
        self.service_connection: GoogleDriveConnection = (
            self.config.serviceConnection.root.config
        )
        self.client: GoogleDriveClient = get_connection(self.service_connection)
        self.connection_obj = self.client

        # Cache for storing directory hierarchy
        self._directories_cache: Dict[str, GoogleDriveDirectoryInfo] = {}
        self._current_directory_context: Optional[str] = None

        # Cache for storing files organized by parent directory
        self._files_by_parent_cache: Dict[str, List[GoogleDriveFile]] = {}

        # Cache for storing directory FQNs by directory ID
        self._directory_fqn_cache: Dict[str, str] = {}

        # Flag to track if root files have been processed
        self._root_files_processed: bool = False

        self.test_connection()

    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: GoogleDriveConnection = config.serviceConnection.root.config
        if not isinstance(connection, GoogleDriveConnection):
            raise InvalidSourceException(
                f"Expected GoogleDriveConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _build_directory_path(
        self, directory_id: str, directories_map: Dict[str, GoogleDriveDirectoryInfo]
    ) -> List[str]:
        """Build full directory path by traversing parents."""
        directory = directories_map.get(directory_id)
        if not directory:
            return []

        path_parts = [directory.name]
        current_parents = directory.parents
        visited = {directory_id}

        while current_parents:
            parent_id = current_parents[0]
            if parent_id in visited:
                break
            visited.add(parent_id)
            if parent_id in directories_map:
                parent_dir = directories_map[parent_id]
                path_parts.insert(0, parent_dir.name)
                current_parents = parent_dir.parents
            else:
                break

        return path_parts

    def _fetch_directories(self) -> None:
        """Fetch all directories from Google Drive and build hierarchy."""
        try:
            page_token = None
            directories = {}

            while True:
                query_params = {
                    "q": "mimeType='application/vnd.google-apps.folder' and trashed=false",
                    "fields": "nextPageToken, files(id, name, parents, createdTime, modifiedTime, size, shared, webViewLink, description, owners)",  # pylint: disable=line-too-long
                    "pageSize": 1000,
                    "supportsAllDrives": True,
                    "includeItemsFromAllDrives": self.service_connection.includeTeamDrives,
                }

                if page_token:
                    query_params["pageToken"] = page_token

                result_dict = (
                    self.client.drive_service.files().list(**query_params).execute()
                )
                result = GoogleDriveListResponse.model_validate(result_dict)

                for folder in result.files:
                    directory_info = GoogleDriveDirectoryInfo(
                        id=folder.id,
                        name=folder.name,
                        parents=folder.parents or [],
                        created_time=folder.createdTime,
                        modified_time=folder.modifiedTime,
                        is_shared=folder.shared or False,
                        web_view_link=folder.webViewLink,
                        description=folder.description or "",
                        owners=folder.owners or [],
                        path=None,  # Will be calculated below
                    )
                    directories[folder.id] = directory_info

                page_token = result.nextPageToken
                if not page_token:
                    break

            # Build directory paths
            for dir_id, directory in directories.items():
                directory.path = self._build_directory_path(dir_id, directories)

            self._directories_cache = directories

            # Now fetch all files and organize by parent directory
            self._fetch_all_files()

        except Exception as e:
            logger.error(f"Error fetching directories: {e}")
            logger.debug(traceback.format_exc())

    def _fetch_all_files(self) -> None:
        """Fetch all files from Google Drive and organize by parent directory."""
        try:
            logger.debug("Fetching all files from Google Drive...")
            page_token = None
            files_by_parent = {}
            total_files = 0

            while True:
                # Simple query - exclude only folders and spreadsheets
                query = "trashed=false and mimeType!='application/vnd.google-apps.folder' and mimeType!='application/vnd.google-apps.spreadsheet'"  # pylint: disable=line-too-long

                query_params = {
                    "q": query,
                    "fields": "nextPageToken, files(id, name, parents, createdTime, modifiedTime, size, mimeType, webViewLink, description, owners)",  # pylint: disable=line-too-long
                    "pageSize": 1000,
                    "supportsAllDrives": True,
                    "includeItemsFromAllDrives": self.service_connection.includeTeamDrives,
                }

                if page_token:
                    query_params["pageToken"] = page_token

                result_dict = (
                    self.client.drive_service.files().list(**query_params).execute()
                )
                result = GoogleDriveListResponse.model_validate(result_dict)

                for file_item in result.files:
                    total_files += 1
                    # Get parent directory ID
                    parents = file_item.parents or []
                    parent_id = parents[0] if parents else "root"

                    # Add file to parent directory list
                    if parent_id not in files_by_parent:
                        files_by_parent[parent_id] = []

                    files_by_parent[parent_id].append(file_item)

                page_token = result.nextPageToken
                if not page_token:
                    break

            # Cache the files
            self._files_by_parent_cache = files_by_parent
            logger.debug(
                f"Cached {total_files} files across {len(files_by_parent)} directories"
            )

            # Log some sample directories with file counts
            for parent_id, files in list(files_by_parent.items())[:5]:
                if parent_id == "root":
                    logger.debug(f"Root directory has {len(files)} files")
                elif parent_id in self._directories_cache:
                    dir_name = self._directories_cache[parent_id].name
                    logger.debug(f"Directory '{dir_name}' has {len(files)} files")

        except Exception as e:
            logger.error(f"Error fetching all files: {e}")
            logger.debug(traceback.format_exc())
            self._files_by_parent_cache = {}

    def _sort_directories_by_hierarchy(self) -> List[str]:
        """Sort directories hierarchically (parents before children)."""
        # Build adjacency list of parent -> children relationships
        children_map: Dict[str, List[str]] = {}
        root_directories = []

        for dir_id, directory_info in self._directories_cache.items():
            if not directory_info.parents:
                # Root directory (no parents)
                root_directories.append(dir_id)
            else:
                # Has parent(s), add to parent's children list
                parent_id = directory_info.parents[
                    0
                ]  # Google Drive folders have at most one parent
                if parent_id in self._directories_cache:
                    if parent_id not in children_map:
                        children_map[parent_id] = []
                    children_map[parent_id].append(dir_id)
                else:
                    # Parent not in cache (possibly filtered out or no permissions)
                    # Treat as root only if it passes filtering later
                    logger.debug(
                        f"Directory {directory_info.name} has parent {parent_id} not in cache, "
                        "treating as potential root"
                    )
                    root_directories.append(dir_id)

        # Perform depth-first traversal to get hierarchical order
        # Only include directories whose ancestors are all included
        ordered_directories = []
        visited = set()

        def dfs(directory_id: str):
            if directory_id in visited:
                return
            visited.add(directory_id)
            ordered_directories.append(directory_id)

            # Process children after parent
            for child_id in children_map.get(directory_id, []):
                dfs(child_id)

        # Start with root directories
        for root_id in root_directories:
            dfs(root_id)

        # Add any remaining directories that weren't processed (shouldn't happen with valid hierarchy)
        for dir_id, _ in self._directories_cache.items():
            if dir_id not in visited:
                ordered_directories.append(dir_id)

        return ordered_directories

    def _fetch_drive_items(
        self,
        directory_id: Optional[str] = None,
        mime_type_filter: Optional[str] = None,
        exclude_spreadsheets: bool = False,
    ) -> Iterable[GoogleDriveFile]:
        """Fetch items from Google Drive with optional filtering."""
        try:
            page_token = None

            while True:
                # Build query - exclude folders and trashed items
                query_parts = [
                    "trashed=false",
                    "mimeType!='application/vnd.google-apps.folder'",
                ]

                # Add MIME type filtering
                if mime_type_filter:
                    query_parts.append(f"mimeType='{mime_type_filter}'")
                elif exclude_spreadsheets:
                    query_parts.append(
                        "mimeType!='application/vnd.google-apps.spreadsheet'"
                    )

                if directory_id:
                    query_parts.append(f"'{directory_id}' in parents")

                query = " and ".join(query_parts)

                query_params = {
                    "q": query,
                    "fields": "nextPageToken, files(id, name, parents, createdTime, modifiedTime, size, mimeType, webViewLink, description, owners)",  # pylint: disable=line-too-long
                    "pageSize": 1000,
                    "supportsAllDrives": True,
                    "includeItemsFromAllDrives": self.service_connection.includeTeamDrives,
                }

                if page_token:
                    query_params["pageToken"] = page_token

                result_dict = (
                    self.client.drive_service.files().list(**query_params).execute()
                )
                result = GoogleDriveListResponse.model_validate(result_dict)

                yield from result.files

                page_token = result.nextPageToken
                if not page_token:
                    break

        except Exception as e:
            logger.error(f"Error fetching drive items: {e}")
            logger.debug(traceback.format_exc())

    def _fetch_files(
        self, directory_id: Optional[str] = None
    ) -> Iterable[GoogleDriveFile]:
        """Fetch files excluding Google Workspace native apps and folders."""
        yield from self._fetch_drive_items(
            directory_id=directory_id, exclude_spreadsheets=True
        )

    def get_spreadsheet_name(self, spreadsheet: GoogleDriveFile) -> str:
        """Get spreadsheet name."""
        return spreadsheet.name

    def get_spreadsheet_details(
        self, spreadsheet: GoogleDriveFile
    ) -> GoogleSheetsSpreadsheetDetails:
        """Get spreadsheet details including sheets."""

        spreadsheet_details_dict = (
            self.client.sheets_service.spreadsheets()
            .get(
                spreadsheetId=spreadsheet.id,
            )
            .execute()
        )

        if spreadsheet.parents:
            # Add parent information to the spreadsheet details
            spreadsheet_details_dict["parents"] = spreadsheet.parents

        # Add timestamps from the GoogleDriveFile object
        if spreadsheet.createdTime:
            spreadsheet_details_dict["createdTime"] = spreadsheet.createdTime
        if spreadsheet.modifiedTime:
            spreadsheet_details_dict["modifiedTime"] = spreadsheet.modifiedTime

        # Add mimeType from the GoogleDriveFile object
        if spreadsheet.mimeType:
            spreadsheet_details_dict["mimeType"] = spreadsheet.mimeType

        return GoogleSheetsSpreadsheetDetails.model_validate(spreadsheet_details_dict)

    def get_spreadsheets_list(self) -> Iterable[GoogleDriveFile]:
        """Fetch spreadsheets from Google Drive."""
        try:
            page_token = None
            while True:
                query_params = {
                    "q": "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
                    "fields": (
                        "nextPageToken, files(id, name, parents, createdTime, "
                        "modifiedTime, size, mimeType, webViewLink, description, owners)"
                    ),
                    "pageSize": 1000,
                    "supportsAllDrives": True,
                    "includeItemsFromAllDrives": self.service_connection.includeTeamDrives,
                }

                if page_token:
                    query_params["pageToken"] = page_token

                result_dict = (
                    self.client.drive_service.files().list(**query_params).execute()
                )
                result = GoogleDriveListResponse.model_validate(result_dict)

                yield from result.files

                page_token = result.nextPageToken
                if not page_token:
                    break

        except Exception as e:
            logger.error(f"Error fetching spreadsheets: {e}")
            logger.debug(traceback.format_exc())

    def get_directory_names(self) -> Iterable[str]:
        """Get directory names in hierarchical order."""
        try:
            if not self.source_config.includeDirectories:
                return

            self._fetch_directories()

            # Get directories in hierarchical order (parents before children)
            ordered_directory_ids = self._sort_directories_by_hierarchy()

            logger.debug(
                f"Processing {len(ordered_directory_ids)} directories in hierarchical order"
            )

            # Track which directories pass the filter to ensure child directories
            # are only included if their parents are also included
            included_directories = set()

            for directory_id in ordered_directory_ids:
                directory_info = self._directories_cache[directory_id]

                # Check if parent directory was included (if it has a parent)
                should_include = True
                if directory_info.parents:
                    parent_id = directory_info.parents[0]
                    if (
                        parent_id in self._directories_cache
                        and parent_id not in included_directories
                    ):
                        # Parent was filtered out or failed, skip this directory
                        logger.debug(
                            f"Skipping directory '{directory_info.name}' because its parent was not included"
                        )
                        should_include = False

                if should_include:
                    # Log the directory and its parent for debugging
                    parent_info = ""
                    if directory_info.parents:
                        parent_id = directory_info.parents[0]
                        if parent_id in self._directories_cache:
                            parent_name = self._directories_cache[parent_id].name
                            parent_info = f" (parent: {parent_name})"

                    logger.debug(
                        f"Processing directory: {directory_info.name}{parent_info}, "
                        f"path: {'.'.join(directory_info.path) if directory_info.path else directory_info.name}"
                    )

                    directory_fqn = fqn.build(
                        self.metadata,
                        entity_type=Directory,
                        service_name=self.context.get().drive_service,
                        directory_path=[directory_info.name],
                    )

                    # Apply the directory filter
                    if not filter_by_directory(
                        self.source_config.directoryFilterPattern,
                        (
                            directory_fqn
                            if self.source_config.useFqnForFiltering
                            else directory_info.name
                        ),
                    ):
                        # Directory passes the filter, include it
                        included_directories.add(directory_id)
                        yield directory_id
                    else:
                        logger.debug(
                            f"Directory '{directory_info.name}' filtered out by directoryFilterPattern"
                        )

        except Exception as e:
            logger.error(f"Error getting directory names: {e}")
            logger.debug(traceback.format_exc())

    def get_file_names(self) -> Iterable[str]:
        """Required by abstract base class but not used by topology framework."""
        return iter([])

    def yield_directory(  # pylint: disable=arguments-renamed
        self, directory_id: str
    ) -> Iterable[Either[CreateDirectoryRequest]]:
        """Create directory request for given directory ID."""
        if not self.source_config.includeDirectories:
            return
        try:
            directory_info = self._directories_cache.get(directory_id)
            if not directory_info:
                return

            # Set current directory context
            self._current_directory_context = directory_id

            logger.debug(
                f"Processing directory: {directory_info.name} (ID: {directory_id})"
            )

            # Build parent reference if exists and validate parent exists in OpenMetadata
            parent_reference = None
            existing_parent = None
            if directory_info.parents:
                parent_id = directory_info.parents[0]
                if parent_id in self._directories_cache:
                    parent_info = self._directories_cache[parent_id]

                    # Build parent reference using the enhanced Directory FQN builder
                    # that supports nested directory paths
                    service_name = self.context.get().drive_service
                    path_components = parent_info.path or [parent_info.name]

                    # Use the proper FQN builder with directory_path parameter
                    parent_reference = fqn.build(
                        self.metadata,
                        entity_type=Directory,
                        service_name=service_name,
                        directory_path=path_components,
                    )

                    # Check if parent directory actually exists in OpenMetadata
                    try:
                        existing_parent = self.metadata.get_by_name(
                            entity=Directory, fqn=parent_reference
                        )
                        if not existing_parent:
                            logger.warning(
                                f"Skipping '{directory_info.name}': "
                                f"parent '{parent_info.path}' missing in OpenMetadata"
                            )
                            return
                    except Exception as e:
                        logger.warning(
                            f"Skipping directory '{directory_info.name}' because parent directory "
                            f"'{parent_info.path}' could not be found in OpenMetadata: {e}"
                        )
                        return
                else:
                    # Parent not in cache (possibly filtered out or no permissions)
                    logger.debug(
                        f"Parent directory {parent_id} not found in cache for directory {directory_info.name}"
                    )

            # Build service FQN
            service_fqn = fqn.build(
                self.metadata,
                entity_type=DriveService,
                service_name=self.context.get().drive_service,
            )

            logger.debug(
                f"Creating directory request: name={directory_info.name}, service={service_fqn}, "
            )
            request = CreateDirectoryRequest(
                name=directory_info.name,
                directoryType=DirectoryType.Folder,
                displayName=directory_info.name,
                description=directory_info.description,
                service=service_fqn,
                parent=(
                    existing_parent.fullyQualifiedName.root
                    if existing_parent
                    else parent_reference
                ),
                sourceUrl=directory_info.web_view_link,
                path=(
                    ".".join(directory_info.path)
                    if directory_info.path
                    else directory_info.name
                ),
                isShared=directory_info.is_shared,
            )

            # Cache the directory FQN for later use in file processing
            path_components = directory_info.path or [directory_info.name]

            directory_fqn = fqn.build(
                self.metadata,
                entity_type=Directory,
                service_name=self.context.get().drive_service,
                directory_path=path_components,
            )
            self._directory_fqn_cache[directory_id] = directory_fqn

            self.register_record_directory(request)
            yield Either(right=request)

        except Exception as exc:
            logger.error(f"Error creating directory request for {directory_id}: {exc}")
            logger.debug(traceback.format_exc())
            yield Either(
                left=StackTraceError(
                    name=directory_id,
                    error=f"Error creating directory {directory_id}: {str(exc)}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def register_record_directory(
        self, directory_request: CreateDirectoryRequest
    ) -> None:
        """Build FQN using complete directory path for nested directories."""
        # Get the directory info from cache using the current context
        if (
            self._current_directory_context
            and self._current_directory_context in self._directories_cache
        ):
            directory_info = self._directories_cache[self._current_directory_context]

            # Build FQN using the complete path for proper tracking
            path_components = directory_info.path or [directory_info.name]

            # Use the enhanced FQN builder with directory_path
            directory_fqn = fqn.build(
                self.metadata,
                entity_type=Directory,
                service_name=self.context.get().drive_service,
                directory_path=path_components,
            )
        else:
            # Fallback to original method if no context
            directory_fqn = fqn.build(
                self.metadata,
                entity_type=Directory,
                service_name=self.context.get().drive_service,
                directory_path=[directory_request.name.root],
            )

        self.directory_source_state.add(directory_fqn)

    def register_record_file(self, file_request: CreateFileRequest) -> None:
        """Build FQN using cached directory FQN for efficiency."""
        # Build file FQN - use cached directory FQN if available
        if file_request.directory:
            # Directory reference already contains the full FQN path
            file_fqn = fqn.build(
                self.metadata,
                entity_type=File,
                service_name=self.context.get().drive_service,
                directory_path=[
                    file_request.directory.root
                ],  # This is already the full directory FQN
                file_name=file_request.name.root,
            )
        else:
            # File without directory (root level)
            file_fqn = fqn.build(
                self.metadata,
                entity_type=File,
                service_name=self.context.get().drive_service,
                directory_path=["root"],
                file_name=file_request.name.root,
            )

        self.file_source_state.add(file_fqn)

    def yield_file(  # pylint: disable=too-many-branches, arguments-renamed
        self, directory_id: str
    ) -> Iterable[Either[CreateFileRequest]]:
        """Process all files in given directory including root-level files."""
        if not getattr(self.source_config, "includeFiles", True):
            return
        try:  # pylint: disable=too-many-nested-blocks

            # Get all files for this directory from cache
            files_in_directory = self._files_by_parent_cache.get(directory_id, [])

            if not files_in_directory:
                logger.debug(f"No files found in directory {directory_id}")
                return

            logger.debug(
                f"Processing {len(files_in_directory)} files in directory {directory_id}"
            )

            # Get directory FQN from cache for file references
            directory_reference = None
            if directory_id != "root" and directory_id in self._directory_fqn_cache:
                directory_reference = self._directory_fqn_cache[directory_id]

            # Build service FQN once and handle root files processing
            service_fqn = fqn.build(
                self.metadata,
                entity_type=DriveService,
                service_name=self.context.get().drive_service,
            )

            # Handle root files only once - when creating service FQN
            if not self._root_files_processed:
                # Get root files and process them
                root_files = self._files_by_parent_cache.get("root", [])
                if root_files:
                    logger.debug(
                        f"Processing {len(root_files)} root files (files with no parent directory)"
                    )

                    for file_info in root_files:
                        try:
                            # Apply file filtering
                            if not filter_by_file(
                                self.source_config.fileFilterPattern,
                                file_info.name,
                            ):
                                logger.debug(
                                    f"Processing root file: {file_info.name} (MIME: {file_info.mimeType})"
                                )

                                request = CreateFileRequest(
                                    name=file_info.name,
                                    displayName=file_info.name,
                                    description=file_info.description,
                                    service=service_fqn,
                                    directory=None,  # Root files have no directory
                                    mimeType=file_info.mimeType,
                                    size=(
                                        int(file_info.size) if file_info.size else None
                                    ),
                                    webViewLink=file_info.webViewLink,
                                )

                                self.register_record_file(request)
                                yield Either(right=request)
                            else:
                                logger.debug(
                                    f"Root file '{file_info.name}' filtered out by fileFilterPattern"
                                )

                        except Exception as file_exc:
                            logger.error(
                                f"Error processing root file {file_info.name}: {file_exc}"
                            )
                            yield Either(
                                left=StackTraceError(
                                    name=file_info.name,
                                    error=f"Error creating root file {file_info.name}: {str(file_exc)}",
                                    stackTrace=traceback.format_exc(),
                                )
                            )

                # Set the flag to True after processing root files
                self._root_files_processed = True
                logger.debug("Root files processing completed and flag set to True")

            # Skip processing current directory if it's root (already processed above)
            if directory_id == "root":
                logger.debug(
                    "Directory is root and root files already processed, skipping duplicate processing"
                )
                return

            # Process all files in this directory (non-root directories)
            for file_info in files_in_directory:
                try:
                    # Apply file filtering
                    if not filter_by_file(
                        self.source_config.fileFilterPattern,
                        file_info.name,
                    ):
                        logger.debug(
                            f"Processing file: {file_info.name} (MIME: {file_info.mimeType})"
                        )

                        request = CreateFileRequest(
                            name=file_info.name,
                            displayName=file_info.name,
                            description=file_info.description,
                            service=service_fqn,
                            directory=directory_reference,
                            mimeType=file_info.mimeType,
                            size=int(file_info.size) if file_info.size else None,
                            webViewLink=file_info.webViewLink,
                        )

                        self.register_record_file(request)
                        yield Either(right=request)
                    else:
                        logger.debug(
                            f"File '{file_info.name}' filtered out by fileFilterPattern"
                        )

                except Exception as file_exc:
                    logger.error(f"Error processing file {file_info.name}: {file_exc}")
                    yield Either(
                        left=StackTraceError(
                            name=file_info.name,
                            error=f"Error creating file {file_info.name}: {str(file_exc)}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

        except Exception as exc:
            logger.error(f"Error processing files in directory {directory_id}: {exc}")
            logger.debug(traceback.format_exc())
            yield Either(
                left=StackTraceError(
                    name=directory_id,
                    error=f"Error processing directory files: {str(exc)}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_spreadsheet(  # pylint: disable=arguments-renamed
        self, spreadsheet_details: GoogleSheetsSpreadsheetDetails
    ) -> Iterable[Either[CreateSpreadsheetRequest]]:
        """Create spreadsheet request for given spreadsheet."""
        if not self.source_config.includeSpreadsheets:
            return
        try:
            request = CreateSpreadsheetRequest(
                name=spreadsheet_details.spreadsheetId,
                displayName=(
                    spreadsheet_details.properties.title
                    if spreadsheet_details.properties
                    else None
                ),
                description=spreadsheet_details.description,
                service=self.context.get().drive_service,
                sourceUrl=spreadsheet_details.spreadsheetUrl,
                modifiedTime=convert_timestamp_to_unix_millis(
                    spreadsheet_details.modifiedTime
                ),
                createdTime=convert_timestamp_to_unix_millis(
                    spreadsheet_details.createdTime
                ),
                mimeType=spreadsheet_details.mimeType,
            )
            self.register_record_spreadsheet(request)
            yield Either(right=request)

        except Exception as exc:
            title = (
                spreadsheet_details.properties.title
                if spreadsheet_details.properties
                else "Unknown"
            )
            logger.error(f"Error creating spreadsheet request for {title}: {exc}")
            logger.debug(traceback.format_exc())
            yield Either(
                left=StackTraceError(
                    name=title,
                    error=f"Error creating spreadsheet {title}: {str(exc)}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_worksheet(  # pylint: disable=arguments-renamed
        self, spreadsheet_details: GoogleSheetsSpreadsheetDetails
    ) -> Iterable[Either[CreateWorksheetRequest]]:
        """Create worksheet requests for all sheets in spreadsheet."""
        if not self.source_config.includeWorksheets:
            return
        spreadsheet_reference = fqn.build(
            self.metadata,
            entity_type=Spreadsheet,
            service_name=self.context.get().drive_service,
            spreadsheet_name=spreadsheet_details.spreadsheetId,
        )

        for worksheet in spreadsheet_details.sheets:
            try:
                worksheet_title = (
                    worksheet.properties.title if worksheet.properties else None
                )
                if filter_by_worksheet(
                    self.source_config.worksheetFilterPattern,
                    worksheet_title,
                ):
                    self.status.filter(
                        worksheet_title,
                        "Worksheet Filtered Out",
                    )
                    continue

                # Build columns by fetching header row and inferring types from a small sample
                columns: List[Column] = []
                if worksheet_title:
                    try:
                        columns = self._get_sheet_columns(
                            spreadsheet_id=spreadsheet_details.spreadsheetId,
                            sheet_title=worksheet_title,
                        )
                    except Exception as col_exc:
                        logger.debug(
                            f"Error extracting columns for worksheet {worksheet_title}: {col_exc}"
                        )

                # Get worksheet metadata from properties
                worksheet_id = None
                index = None
                row_count = None
                column_count = None

                if worksheet.properties:
                    # Get worksheetId (sheetId)
                    if worksheet.properties.sheetId is not None:
                        worksheet_id = str(worksheet.properties.sheetId)
                    # Get index
                    if worksheet.properties.index is not None:
                        index = worksheet.properties.index
                    # Get row count and column count from gridProperties
                    if worksheet.properties.gridProperties:
                        if worksheet.properties.gridProperties.rowCount:
                            row_count = worksheet.properties.gridProperties.rowCount
                        if worksheet.properties.gridProperties.columnCount:
                            column_count = (
                                worksheet.properties.gridProperties.columnCount
                            )

                request = CreateWorksheetRequest(
                    name=(worksheet_id if worksheet_id else ""),
                    displayName=str(worksheet_title) if worksheet_title else "",
                    service=self.context.get().drive_service,
                    spreadsheet=spreadsheet_reference,
                    worksheetId=worksheet_id,
                    index=index,
                    columns=columns if columns else [],
                    rowCount=row_count,
                    columnCount=column_count,
                    sourceUrl=(
                        f"{spreadsheet_details.spreadsheetUrl}#gid={worksheet.properties.sheetId}"
                        if spreadsheet_details.spreadsheetUrl
                        and worksheet.properties
                        and worksheet.properties.sheetId is not None
                        else None
                    ),
                )

                self.register_record_worksheet(request)
                yield Either(right=request)
            except Exception as exc:
                logger.error(
                    f"Error creating worksheet request for {worksheet.name or 'Unknown'}: {exc}"
                )
                logger.debug(traceback.format_exc())
                yield Either(
                    left=StackTraceError(
                        name=worksheet.name or "Unknown",
                        error=f"Error creating worksheet {worksheet.name or 'Unknown'}: {str(exc)}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def close(self) -> None:
        """Close Google Drive source and clean up resources."""
        try:
            # Clear directory cache
            self._directories_cache.clear()
            self._current_directory_context = None

            # Clear file cache
            self._files_by_parent_cache.clear()

            # Clear directory FQN cache
            self._directory_fqn_cache.clear()

            # Reset root files processed flag
            self._root_files_processed = False

            # Close the client connection if it has a close method
            if hasattr(self.client, "close"):
                self.client.close()

        except Exception as e:
            logger.error(f"Error closing Google Drive source: {e}")
            logger.debug(traceback.format_exc())

    def _normalize_rows_to_headers(
        self, data_rows: List[List], headers: List[str]
    ) -> List[List]:
        """
        Normalize row lengths to match the number of headers.
        """
        normalized_rows = []
        for row in data_rows:
            row_list = list(row) if isinstance(row, list) else []
            if len(row_list) < len(headers):
                row_list = row_list + [None] * (len(headers) - len(row_list))
            else:
                row_list = row_list[: len(headers)]
            normalized_rows.append(row_list)
        return normalized_rows

    def _get_sheet_columns(  # pylint: disable=too-many-locals
        self, spreadsheet_id: str, sheet_title: str
    ) -> List[Column]:
        """Fetch header row and a sample of data rows to infer column data types using the
        same DataFrame + DataFrameColumnParser approach used for datalake files.

        We build a pandas DataFrame for the sheet (capped rows) and let the generic parser
        infer types across values instead of a single-row guess.
        """
        try:
            # Try pandas-based inference across a capped set of rows to reuse datalake logic.
            import pandas as pd  # pylint: disable=import-outside-toplevel

            from metadata.utils.datalake.datalake_utils import (  # pylint: disable=import-outside-toplevel
                DataFrameColumnParser,
            )

            # Fetch a larger range: header + up to N rows for better inference
            # Keep the cap conservative to avoid heavy payloads
            max_rows = 100
            data_range = f"'{sheet_title}'!1:{max_rows}"
            result = (
                self.client.sheets_service.spreadsheets()
                .values()
                .get(
                    spreadsheetId=spreadsheet_id,
                    range=data_range,
                    valueRenderOption="UNFORMATTED_VALUE",
                    dateTimeRenderOption="FORMATTED_STRING",
                )
                .execute()
            )
            values = result.get("values", [])
            if not values or not values[0]:
                return []

            headers = [str(h) if h is not None else "" for h in values[0]]
            data_rows = values[1:]

            # Normalize row lengths to headers
            normalized_rows = self._normalize_rows_to_headers(data_rows, headers)

            # If the sheet only has headers, build an empty frame with the headers
            df = (
                pd.DataFrame(normalized_rows, columns=headers)
                if normalized_rows
                else pd.DataFrame(columns=headers)
            )

            parser = DataFrameColumnParser.create(df)
            inferred_columns: List[Column] = parser.get_columns()

            return inferred_columns

        except Exception as exc:
            logger.error(f"Error fetching columns for sheet '{sheet_title}': {exc}")
            logger.debug(traceback.format_exc())
            return []
