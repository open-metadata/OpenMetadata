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
SFTP source implementation
"""
import io
import mimetypes
import stat
import traceback
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd

from metadata.generated.schema.api.data.createDirectory import CreateDirectoryRequest
from metadata.generated.schema.api.data.createFile import CreateFileRequest
from metadata.generated.schema.api.data.createSpreadsheet import (
    CreateSpreadsheetRequest,
)
from metadata.generated.schema.api.data.createWorksheet import CreateWorksheetRequest
from metadata.generated.schema.entity.data.directory import Directory, DirectoryType
from metadata.generated.schema.entity.data.file import FileType
from metadata.generated.schema.entity.data.table import Column, DataType, TableData
from metadata.generated.schema.entity.services.connections.drive.sftpConnection import (
    SftpConnection,
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
from metadata.ingestion.source.drive.sftp.connection import SftpClient, get_connection
from metadata.ingestion.source.drive.sftp.models import SftpDirectoryInfo, SftpFileInfo
from metadata.utils import fqn
from metadata.utils.filters import filter_by_directory, filter_by_file
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

CSV_EXTENSIONS = {".csv", ".tsv"}
STRUCTURED_DATA_EXTENSIONS = {".csv", ".tsv", ".json", ".jsonl", ".parquet", ".avro"}
MAX_SAMPLE_ROWS = 50
CHUNKSIZE = 200

PANDAS_DTYPE_MAP = {
    "int64": DataType.INT,
    "int32": DataType.INT,
    "float64": DataType.FLOAT,
    "float32": DataType.FLOAT,
    "bool": DataType.BOOLEAN,
    "datetime64[ns]": DataType.DATETIME,
    "object": DataType.STRING,
}


class SftpSource(DriveServiceSource):
    """
    SFTP Source implementation
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config: DriveServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata = metadata
        self.service_connection: SftpConnection = (
            self.config.serviceConnection.root.config
        )
        self.client: SftpClient = get_connection(self.service_connection)
        self.connection_obj = self.client

        self._directories_cache: Dict[str, SftpDirectoryInfo] = {}
        self._files_by_parent_cache: Dict[str, List[SftpFileInfo]] = {}
        self._directory_fqn_cache: Dict[str, str] = {}
        self._current_directory_context: Optional[str] = None
        self._root_files_processed: bool = False
        self._root_directory_prefixes: List[str] = []

        self.test_connection()

    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SftpConnection = config.serviceConnection.root.config
        if not isinstance(connection, SftpConnection):
            raise InvalidSourceException(
                f"Expected SftpConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _build_directory_path(self, full_path: str) -> List[str]:
        """Build directory path as list of components, stripping root directory prefix."""
        clean_path = full_path.strip("/")
        if not clean_path:
            return []
        components = clean_path.split("/")
        for root_prefix in self._root_directory_prefixes:
            prefix_parts = root_prefix.strip("/").split("/")
            if components[:len(prefix_parts)] == prefix_parts:
                components = components[len(prefix_parts):]
                break
        return components

    def _get_full_path_for_stripped(self, stripped_path: List[str]) -> Optional[str]:
        """Reconstruct the full SFTP path from stripped path components."""
        if not stripped_path:
            return None
        stripped_path_str = "/" + "/".join(stripped_path)
        if stripped_path_str in self._directories_cache:
            return stripped_path_str
        for root_prefix in self._root_directory_prefixes:
            full_path = root_prefix.rstrip("/") + "/" + "/".join(stripped_path)
            if full_path in self._directories_cache:
                return full_path
        return None

    def _fetch_directories(self) -> None:
        """Fetch all directories from SFTP server and build hierarchy."""
        try:
            root_dirs = self.service_connection.rootDirectories or ["/"]
            self._root_directory_prefixes = [
                d.rstrip("/") for d in root_dirs if d != "/"
            ]
            directories = {}

            for root_dir in root_dirs:
                self._fetch_directories_recursive(root_dir, directories)

            self._directories_cache = directories

            self._fetch_all_files()

        except Exception as e:
            logger.error(f"Error fetching directories: {e}")
            logger.debug(traceback.format_exc())

    def _fetch_directories_recursive(
        self,
        path: str,
        directories: Dict[str, SftpDirectoryInfo],
        parent_path: Optional[str] = None,
    ) -> None:
        """Recursively fetch directories starting from given path."""
        try:
            normalized_path = path.rstrip("/") or "/"
            entries = self.client.sftp.listdir_attr(normalized_path)

            for entry in entries:
                if stat.S_ISDIR(entry.st_mode):
                    dir_name = entry.filename
                    if normalized_path == "/":
                        full_path = f"/{dir_name}"
                    else:
                        full_path = f"{normalized_path}/{dir_name}"

                    path_components = self._build_directory_path(full_path)
                    parent_paths = path_components[:-1] if len(path_components) > 1 else []

                    directory_info = SftpDirectoryInfo(
                        name=dir_name,
                        full_path=full_path,
                        parents=parent_paths,
                        modified_time=entry.st_mtime,
                        path=path_components,
                    )
                    directories[full_path] = directory_info

                    self._fetch_directories_recursive(full_path, directories, full_path)

        except Exception as e:
            logger.warning(f"Error fetching directories from {path}: {e}")
            logger.debug(traceback.format_exc())

    def _fetch_all_files(self) -> None:
        """Fetch all files from SFTP server and organize by parent directory."""
        try:
            logger.debug("Fetching all files from SFTP...")
            files_by_parent = {}
            total_files = 0

            for full_path, directory_info in self._directories_cache.items():
                try:
                    entries = self.client.sftp.listdir_attr(full_path)

                    for entry in entries:
                        if not stat.S_ISDIR(entry.st_mode):
                            total_files += 1
                            if full_path == "/":
                                file_path = f"/{entry.filename}"
                            else:
                                file_path = f"{full_path}/{entry.filename}"

                            mime_type, _ = mimetypes.guess_type(entry.filename)

                            file_info = SftpFileInfo(
                                name=entry.filename,
                                full_path=file_path,
                                size=entry.st_size,
                                modified_time=entry.st_mtime,
                                mime_type=mime_type,
                            )

                            if full_path not in files_by_parent:
                                files_by_parent[full_path] = []
                            files_by_parent[full_path].append(file_info)

                except Exception as e:
                    logger.warning(f"Error fetching files from {full_path}: {e}")

            root_dirs = self.service_connection.rootDirectories or ["/"]
            for root_dir in root_dirs:
                try:
                    normalized_root = root_dir.rstrip("/") or "/"
                    entries = self.client.sftp.listdir_attr(normalized_root)

                    for entry in entries:
                        if not stat.S_ISDIR(entry.st_mode):
                            total_files += 1
                            if normalized_root == "/":
                                file_path = f"/{entry.filename}"
                            else:
                                file_path = f"{normalized_root}/{entry.filename}"

                            mime_type, _ = mimetypes.guess_type(entry.filename)

                            file_info = SftpFileInfo(
                                name=entry.filename,
                                full_path=file_path,
                                size=entry.st_size,
                                modified_time=entry.st_mtime,
                                mime_type=mime_type,
                            )

                            if "root" not in files_by_parent:
                                files_by_parent["root"] = []
                            files_by_parent["root"].append(file_info)

                except Exception as e:
                    logger.warning(f"Error fetching root files from {root_dir}: {e}")

            self._files_by_parent_cache = files_by_parent
            logger.debug(
                f"Cached {total_files} files across {len(files_by_parent)} directories"
            )

        except Exception as e:
            logger.error(f"Error fetching all files: {e}")
            logger.debug(traceback.format_exc())
            self._files_by_parent_cache = {}

    def _sort_directories_by_hierarchy(self) -> List[str]:
        """Sort directories hierarchically (parents before children)."""
        children_map: Dict[str, List[str]] = {}
        root_directories = []

        for full_path, directory_info in self._directories_cache.items():
            parent_stripped_path = directory_info.path[:-1] if len(directory_info.path) > 1 else None
            parent_full_path = self._get_full_path_for_stripped(parent_stripped_path) if parent_stripped_path else None

            if parent_full_path is None or parent_full_path not in self._directories_cache:
                root_directories.append(full_path)
            else:
                if parent_full_path not in children_map:
                    children_map[parent_full_path] = []
                children_map[parent_full_path].append(full_path)

        ordered_directories = []
        visited = set()

        def dfs(directory_path: str):
            if directory_path in visited:
                return
            visited.add(directory_path)
            ordered_directories.append(directory_path)

            for child_path in children_map.get(directory_path, []):
                dfs(child_path)

        for root_path in root_directories:
            dfs(root_path)

        for dir_path in self._directories_cache:
            if dir_path not in visited:
                ordered_directories.append(dir_path)

        return ordered_directories

    def get_directory_names(self) -> Iterable[str]:
        """Get directory names in hierarchical order."""
        try:
            if not self.source_config.includeDirectories:
                return

            self._fetch_directories()

            ordered_directory_paths = self._sort_directories_by_hierarchy()

            logger.debug(
                f"Processing {len(ordered_directory_paths)} directories in hierarchical order"
            )

            included_directories = set()

            for dir_path in ordered_directory_paths:
                directory_info = self._directories_cache[dir_path]

                should_include = True
                if directory_info.parents:
                    parent_full_path = self._get_full_path_for_stripped(directory_info.parents)
                    if (
                        parent_full_path
                        and parent_full_path in self._directories_cache
                        and parent_full_path not in included_directories
                    ):
                        logger.debug(
                            f"Skipping directory '{directory_info.name}' because its parent was not included"
                        )
                        should_include = False

                if should_include:
                    directory_fqn = fqn.build(
                        self.metadata,
                        entity_type=Directory,
                        service_name=self.context.get().drive_service,
                        directory_path=[directory_info.name],
                    )

                    if not filter_by_directory(
                        self.source_config.directoryFilterPattern,
                        (
                            directory_fqn
                            if self.source_config.useFqnForFiltering
                            else directory_info.name
                        ),
                    ):
                        included_directories.add(dir_path)
                        yield dir_path
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

    def yield_directory(
        self, directory_path: str
    ) -> Iterable[Either[CreateDirectoryRequest]]:
        """Create directory request for given directory path."""
        if not self.source_config.includeDirectories:
            return
        try:
            directory_info = self._directories_cache.get(directory_path)
            if not directory_info:
                return

            self._current_directory_context = directory_path

            logger.debug(
                f"Processing directory: {directory_info.name} (Path: {directory_path})"
            )

            parent_reference = None
            if directory_info.parents:
                parent_full_path = self._get_full_path_for_stripped(directory_info.parents)
                if parent_full_path and parent_full_path in self._directories_cache:
                    parent_info = self._directories_cache[parent_full_path]

                    service_name = self.context.get().drive_service
                    path_components = parent_info.path or [parent_info.name]

                    parent_reference = fqn.build(
                        self.metadata,
                        entity_type=Directory,
                        service_name=service_name,
                        directory_path=path_components,
                    )

            service_fqn = fqn.build(
                self.metadata,
                entity_type=DriveService,
                service_name=self.context.get().drive_service,
            )

            logger.debug(
                f"Creating directory request: name={directory_info.name}, service={service_fqn}"
            )

            request = CreateDirectoryRequest(
                name=directory_info.name,
                directoryType=DirectoryType.Folder,
                displayName=directory_info.name,
                service=service_fqn,
                parent=parent_reference,
                path=(
                    ".".join(directory_info.path)
                    if directory_info.path
                    else directory_info.name
                ),
            )

            path_components = directory_info.path or [directory_info.name]

            directory_fqn = fqn.build(
                self.metadata,
                entity_type=Directory,
                service_name=self.context.get().drive_service,
                directory_path=path_components,
            )
            self._directory_fqn_cache[directory_path] = directory_fqn

            self.register_record_directory(request)
            yield Either(right=request)

        except Exception as exc:
            logger.error(f"Error creating directory request for {directory_path}: {exc}")
            logger.debug(traceback.format_exc())
            yield Either(
                left=StackTraceError(
                    name=directory_path,
                    error=f"Error creating directory {directory_path}: {str(exc)}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def register_record_directory(
        self, directory_request: CreateDirectoryRequest
    ) -> None:
        """Build FQN using complete directory path for nested directories."""
        if (
            self._current_directory_context
            and self._current_directory_context in self._directories_cache
        ):
            directory_info = self._directories_cache[self._current_directory_context]

            path_components = directory_info.path or [directory_info.name]

            directory_fqn = fqn.build(
                self.metadata,
                entity_type=Directory,
                service_name=self.context.get().drive_service,
                directory_path=path_components,
            )
        else:
            directory_fqn = fqn.build(
                self.metadata,
                entity_type=Directory,
                service_name=self.context.get().drive_service,
                directory_path=[directory_request.name.root],
            )

        self.directory_source_state.add(directory_fqn)

    def yield_file(
        self, directory_path: str
    ) -> Iterable[Either[CreateFileRequest]]:
        """Process all files in given directory."""
        if not getattr(self.source_config, "includeFiles", True):
            return
        try:
            files_in_directory = self._files_by_parent_cache.get(directory_path, [])

            service_fqn = fqn.build(
                self.metadata,
                entity_type=DriveService,
                service_name=self.context.get().drive_service,
            )

            if not self._root_files_processed:
                root_files = self._files_by_parent_cache.get("root", [])
                if root_files:
                    logger.debug(
                        f"Processing {len(root_files)} root files"
                    )

                    for file_info in root_files:
                        try:
                            if not filter_by_file(
                                self.source_config.fileFilterPattern,
                                file_info.name,
                            ):
                                # Check if we should skip non-structured files
                                structured_only = getattr(
                                    self.service_connection, "structuredDataFilesOnly", False
                                )
                                if structured_only and not self._is_structured_data_file(
                                    file_info.name
                                ):
                                    logger.debug(
                                        f"Skipping non-structured root file '{file_info.name}' "
                                        "(structuredDataFilesOnly=true)"
                                    )
                                    continue

                                columns = None
                                file_type = None

                                if self._is_csv_file(file_info.name):
                                    file_type = FileType.CSV
                                    columns, _ = self._extract_csv_schema(
                                        file_info.full_path, file_info.name
                                    )

                                request = CreateFileRequest(
                                    name=file_info.name,
                                    displayName=file_info.name,
                                    service=service_fqn,
                                    directory=None,
                                    mimeType=file_info.mime_type,
                                    size=file_info.size,
                                    fileType=file_type,
                                    columns=columns,
                                )

                                self.register_record_file(request)
                                yield Either(right=request)
                            else:
                                logger.debug(
                                    f"Root file '{file_info.name}' filtered out"
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

                self._root_files_processed = True

            if directory_path == "root":
                return

            if not files_in_directory:
                logger.debug(f"No files found in directory {directory_path}")
                return

            logger.debug(
                f"Processing {len(files_in_directory)} files in directory {directory_path}"
            )

            directory_reference = None
            if directory_path in self._directory_fqn_cache:
                directory_reference = self._directory_fqn_cache[directory_path]

            for file_info in files_in_directory:
                try:
                    if not filter_by_file(
                        self.source_config.fileFilterPattern,
                        file_info.name,
                    ):
                        # Check if we should skip non-structured files
                        structured_only = getattr(
                            self.service_connection, "structuredDataFilesOnly", False
                        )
                        if structured_only and not self._is_structured_data_file(
                            file_info.name
                        ):
                            logger.debug(
                                f"Skipping non-structured file '{file_info.name}' "
                                "(structuredDataFilesOnly=true)"
                            )
                            continue

                        logger.debug(
                            f"Processing file: {file_info.name} (MIME: {file_info.mime_type})"
                        )

                        columns = None
                        file_type = None

                        if self._is_csv_file(file_info.name):
                            file_type = FileType.CSV
                            columns, _ = self._extract_csv_schema(
                                file_info.full_path, file_info.name
                            )

                        request = CreateFileRequest(
                            name=file_info.name,
                            displayName=file_info.name,
                            service=service_fqn,
                            directory=directory_reference,
                            mimeType=file_info.mime_type,
                            size=file_info.size,
                            fileType=file_type,
                            columns=columns,
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
            logger.error(f"Error processing files in directory {directory_path}: {exc}")
            logger.debug(traceback.format_exc())
            yield Either(
                left=StackTraceError(
                    name=directory_path,
                    error=f"Error processing directory files: {str(exc)}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_spreadsheets_list(self) -> Any:
        """SFTP does not support spreadsheets."""
        return []

    def get_spreadsheet_name(self, spreadsheet: Any) -> str:
        """SFTP does not support spreadsheets."""
        return ""

    def get_spreadsheet_details(self, spreadsheet: Any) -> Any:
        """SFTP does not support spreadsheets."""
        return None

    def yield_spreadsheet(
        self, spreadsheet_details: Any
    ) -> Iterable[Either[CreateSpreadsheetRequest]]:
        """SFTP does not support spreadsheets."""
        return iter([])

    def yield_worksheet(
        self, spreadsheet_details: Any
    ) -> Iterable[Either[CreateWorksheetRequest]]:
        """SFTP does not support worksheets."""
        return iter([])

    def close(self) -> None:
        """Close SFTP source and clean up resources."""
        try:
            self._directories_cache.clear()
            self._current_directory_context = None
            self._files_by_parent_cache.clear()
            self._directory_fqn_cache.clear()
            self._root_files_processed = False

            if self.client:
                self.client.close()

        except Exception as e:
            logger.error(f"Error closing SFTP source: {e}")
            logger.debug(traceback.format_exc())

    def _is_csv_file(self, filename: str) -> bool:
        """Check if file is a CSV or TSV file."""
        lower_name = filename.lower()
        return any(lower_name.endswith(ext) for ext in CSV_EXTENSIONS)

    def _is_structured_data_file(self, filename: str) -> bool:
        """Check if file is a structured data file (CSV, TSV, JSON, Parquet, Avro)."""
        lower_name = filename.lower()
        return any(lower_name.endswith(ext) for ext in STRUCTURED_DATA_EXTENSIONS)

    def _get_csv_separator(self, filename: str) -> str:
        """Get separator based on file extension."""
        if filename.lower().endswith(".tsv"):
            return "\t"
        return ","

    def _extract_csv_schema(
        self, file_path: str, filename: str
    ) -> tuple[Optional[List[Column]], Optional[TableData]]:
        """
        Extract column schema and sample data from CSV file.

        Args:
            file_path: Full path to the CSV file on SFTP server
            filename: Name of the file (for determining separator)

        Returns:
            Tuple of (columns, sample_data) or (None, None) on error
        """
        try:
            separator = self._get_csv_separator(filename)
            logger.debug(f"Extracting CSV schema from {file_path} with separator '{separator}'")

            with self.client.sftp.open(file_path, "r") as remote_file:
                content = remote_file.read()

            if isinstance(content, bytes):
                content = content.decode("utf-8", errors="ignore")

            df = pd.read_csv(
                io.StringIO(content),
                sep=separator,
                nrows=CHUNKSIZE,
                encoding_errors="ignore",
            )

            if len(df.columns) == 0:
                logger.debug(f"CSV file {file_path} has no columns")
                return None, None

            columns = []
            for col_name in df.columns:
                dtype_str = str(df[col_name].dtype)
                data_type = PANDAS_DTYPE_MAP.get(dtype_str, DataType.STRING)

                columns.append(
                    Column(
                        name=str(col_name),
                        displayName=str(col_name),
                        dataType=data_type,
                        dataTypeDisplay=data_type.value,
                    )
                )

            sample_df = df.head(MAX_SAMPLE_ROWS)
            sample_rows = []
            for _, row in sample_df.iterrows():
                sample_rows.append([str(val) if pd.notna(val) else None for val in row])

            sample_data = TableData(
                columns=[str(col) for col in df.columns],
                rows=sample_rows,
            )

            logger.debug(
                f"Extracted {len(columns)} columns and {len(sample_rows)} sample rows from {filename}"
            )

            return columns, sample_data

        except Exception as e:
            logger.warning(f"Failed to extract CSV schema from {file_path}: {e}")
            logger.debug(traceback.format_exc())
            return None, None
