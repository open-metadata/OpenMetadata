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
Base class for ingesting drive services
"""

import traceback
from abc import ABC, abstractmethod
from collections.abc import Callable, Iterable
from contextlib import closing
from typing import Annotated, Any

from pydantic import Field

from metadata.domain.tags import TagDefinition, TagRegistry
from metadata.generated.schema.api.data.createDirectory import CreateDirectoryRequest
from metadata.generated.schema.api.data.createFile import CreateFileRequest
from metadata.generated.schema.api.data.createSpreadsheet import (
    CreateSpreadsheetRequest,
)
from metadata.generated.schema.api.data.createWorksheet import CreateWorksheetRequest
from metadata.generated.schema.api.services.createDriveService import (
    CreateDriveServiceRequest,
)
from metadata.generated.schema.entity.data.directory import Directory
from metadata.generated.schema.entity.data.file import File
from metadata.generated.schema.entity.data.spreadsheet import Spreadsheet
from metadata.generated.schema.entity.data.worksheet import Worksheet
from metadata.generated.schema.entity.services.driveService import (
    DriveConnection,
    DriveService,
)
from metadata.generated.schema.metadataIngestion.driveServiceMetadataPipeline import (
    DriveServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.delete import delete_entity_from_source
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Source
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyContextManager,
    TopologyNode,
)
from metadata.ingestion.source.connections import (
    run_test_connection,
    test_connection_common,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_directory, filter_by_spreadsheet
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DriveServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Drive Services.
    service -> directory -> file/spreadsheet -> worksheet.

    Drive hierarchy is more flexible than database hierarchy:
    - Directories can be nested (parent-child relationships)
    - Files can exist with or without directories
    - Spreadsheets are special entities that contain worksheets
    - Multiple drive service types: Google Drive, SharePoint, OneDrive, etc.
    """

    root: Annotated[TopologyNode, Field(description="Root node for the topology")] = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=DriveService,
                context="drive_service",
                processor="yield_create_request_drive_service",
                overwrite=False,
                must_return=True,
            ),
        ],
        children=["directory", "spreadsheet"],
        post_process=[
            "mark_directories_as_deleted",
            "mark_files_as_deleted",
            "mark_spreadsheets_as_deleted",
        ],
    )

    directory: Annotated[TopologyNode, Field(description="Directory Node")] = TopologyNode(
        producer="get_directory_names",
        stages=[
            NodeStage(  # pyright: ignore[reportCallIssue]
                type_=OMetaTagAndClassification,
                processor="yield_directory_tag_details",
                nullable=True,
            ),
            NodeStage(
                type_=Directory,
                context="directory",
                processor="yield_directory_details",
                consumer=["drive_service"],
            ),
            NodeStage(
                type_=File,
                context="file",
                processor="yield_file_details",
                consumer=["drive_service", "directory"],
            ),
        ],
        children=[],
    )

    spreadsheet: Annotated[TopologyNode, Field(description="Spreadsheet Node")] = TopologyNode(
        producer="get_spreadsheet",
        stages=[
            NodeStage(  # pyright: ignore[reportCallIssue]
                type_=OMetaTagAndClassification,
                processor="yield_spreadsheet_tag_details",
                nullable=True,
            ),
            NodeStage(
                type_=Spreadsheet,
                context="spreadsheet",
                processor="yield_spreadsheet_details",
                consumer=["drive_service"],
            ),
            NodeStage(
                type_=Worksheet,
                context="worksheet",
                processor="yield_worksheet_details",
                consumer=["drive_service", "spreadsheet"],
            ),
        ],
        children=[],
        post_process=["mark_worksheets_as_deleted"],
    )


class DriveServiceSource(TopologyRunnerMixin, Source, ABC):  # pylint: disable=too-many-public-methods
    """
    Base class for Drive Services.
    It implements the topology and context for drive-based systems like:
    - Google Drive
    - SharePoint
    - OneDrive
    - Box
    - Dropbox
    etc.

    Native tag hooks register definitions and attachments before asset extraction.
    Asset producers resolve labels with get_tag_by_fqn; child detail processors release item scopes.
    """

    source_config: DriveServiceMetadataPipeline
    config: WorkflowSource
    _connection: BaseConnection | None = None
    directory_source_state: set = set()  # noqa: RUF012
    file_source_state: set = set()  # noqa: RUF012
    spreadsheet_source_state: set = set()  # noqa: RUF012
    worksheet_source_state: set = set()  # noqa: RUF012

    @property
    def tags_registry(self) -> TagRegistry:
        """Per-source registry for Drive tag definitions and labels."""
        instance_dict = vars(self)
        cached = instance_dict.get("tags_registry")
        if cached is not None:
            return cached
        return instance_dict.setdefault("tags_registry", TagRegistry(metadata=self.metadata))

    def register_tag(
        self,
        *,
        definition: TagDefinition | None,
        entity_fqn: str | None = None,
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Queue a definition and optional assignment, yielding preparation errors."""
        if definition is None:
            return
        error = self.tags_registry.register(definition, entity_fqn=entity_fqn)
        if error is not None:
            yield Either(left=error, right=None)

    # Big union of types we want to fetch dynamically
    service_connection: DriveConnection.model_fields["config"].annotation  # noqa: F821

    topology = DriveServiceTopology()
    context = TopologyContextManager(topology)

    @property
    def name(self) -> str:
        return self.service_connection.type.name

    def prepare(self):
        """By default, there is no preparation needed"""

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def yield_create_request_drive_service(self, config: WorkflowSource) -> Iterable[Either[CreateDriveServiceRequest]]:
        yield Either(right=self.metadata.get_create_service_from_source(entity=DriveService, config=config))

    # Abstract methods for drive-specific implementations

    @abstractmethod
    def get_directory_names(self) -> Iterable[str]:
        """
        Prepares the directory names to be sent to stage.
        Filtering happens here.
        """

    @abstractmethod
    def get_file_names(self) -> Iterable[str]:
        """
        Prepares the file names to be sent to stage.
        Filtering happens here. Files may or may not be in directories.
        """

    @abstractmethod
    def yield_directory(self, directory_name: str) -> Iterable[Either[CreateDirectoryRequest]]:
        """
        From topology.
        Prepare a directory request and pass it to the sink.
        Handle parent-child relationships for nested directories.
        """

    @abstractmethod
    def yield_file(self, file_name: str) -> Iterable[Either[CreateFileRequest]]:
        """
        From topology.
        Prepare a file request and pass it to the sink.
        Link to directory if the file belongs to one.
        """

    @abstractmethod
    def yield_spreadsheet(self, spreadsheet_name: str) -> Iterable[Either[CreateSpreadsheetRequest]]:
        """
        From topology.
        Prepare a spreadsheet request and pass it to the sink.
        """

    @abstractmethod
    def yield_worksheet(self, worksheet_name: str) -> Iterable[Either[CreateWorksheetRequest]]:
        """
        From topology.
        Prepare a worksheet request and pass it to the sink.
        Link to parent spreadsheet.
        """

    def get_tag_by_fqn(self, entity_fqn: str) -> list[TagLabel] | None:
        """Return existing labels attached to an entity."""
        if not self.source_config.includeTags:
            return None
        if registry := vars(self).get("tags_registry"):
            return registry.labels_for(entity_fqn) or None
        return None

    def _clear_tag_scope(self) -> None:
        """Release attachments for the current sequential directory or spreadsheet item."""
        if registry := vars(self).get("tags_registry"):
            # Root files can share a batch with directory files, so cleanup uses the service scope.
            registry.clear_scope(fqn.quote_name(vars(self.context.get())["drive_service"]))

    def _yield_tag_details(
        self, producer: Callable[[Any], Iterable[Either[OMetaTagAndClassification]]], details: Any
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Publish definitions before the corresponding asset stage."""
        if not self.source_config.includeTags:
            return
        completed = False
        try:
            yield from producer(details) or []
            if registry := vars(self).get("tags_registry"):
                with closing(registry.drain()) as definitions:
                    for record in definitions:
                        yield Either(right=record, left=None)
            completed = True
        finally:
            if not completed:
                self._clear_tag_scope()

    def yield_directory_tags(self, directory_details: Any) -> Iterable[Either[OMetaTagAndClassification]]:
        """Register native directory and file tags for the current directory item."""
        return ()

    def yield_directory_tag_details(self, directory_details: Any) -> Iterable[Either[OMetaTagAndClassification]]:
        yield from self._yield_tag_details(self.yield_directory_tags, directory_details)

    def yield_directory_details(self, directory_details: Any) -> Iterable[Either[CreateDirectoryRequest]]:
        """Yield directory requests, retaining attachments for the following child stage."""
        completed = False
        try:
            yield from self.yield_directory(directory_details)
            completed = True
        finally:
            if not completed:
                self._clear_tag_scope()

    def yield_file_details(self, directory_details: Any) -> Iterable[Either[CreateFileRequest]]:
        """Yield file requests and release the stage's tag attachments."""
        try:
            yield from self.yield_file(directory_details)
        finally:
            self._clear_tag_scope()

    def yield_spreadsheet_tags(self, spreadsheet_details: Any) -> Iterable[Either[OMetaTagAndClassification]]:
        """Register native spreadsheet and worksheet tags for the current spreadsheet item."""
        return ()

    def yield_spreadsheet_tag_details(self, spreadsheet_details: Any) -> Iterable[Either[OMetaTagAndClassification]]:
        yield from self._yield_tag_details(self.yield_spreadsheet_tags, spreadsheet_details)

    def yield_spreadsheet_details(self, spreadsheet_details: Any) -> Iterable[Either[CreateSpreadsheetRequest]]:
        """Yield spreadsheet requests, retaining attachments for the following child stage."""
        completed = False
        try:
            yield from self.yield_spreadsheet(spreadsheet_details)
            completed = True
        finally:
            if not completed:
                self._clear_tag_scope()

    def yield_worksheet_details(self, spreadsheet_details: Any) -> Iterable[Either[CreateWorksheetRequest]]:
        """Yield worksheet requests and release the stage's tag attachments."""
        try:
            yield from self.yield_worksheet(spreadsheet_details)
        finally:
            self._clear_tag_scope()

    @abstractmethod
    def get_spreadsheets_list(self) -> Any:
        """
        Method to iterate through spreadsheet lists filter spreadsheets & yield spreadsheet details
        """
        return []

    @abstractmethod
    def get_spreadsheet_name(self, spreadsheet: Any) -> str:
        """
        Method to get spreadsheet name
        """

    @abstractmethod
    def get_spreadsheet_details(self, spreadsheet: Any) -> Any:
        """
        Method to get spreadsheet details
        """

    def get_spreadsheet(self) -> Any:
        """
        Method to iterate through spreadsheet lists filter spreadsheets & yield spreadsheet details
        """
        if not self.source_config.includeSpreadsheets:
            return
        for spreadsheet in self.get_spreadsheets_list():
            spreadsheet_name = self.get_spreadsheet_name(spreadsheet)
            if filter_by_spreadsheet(
                self.source_config.spreadsheetFilterPattern,
                spreadsheet_name,
            ):
                self.status.filter(
                    spreadsheet_name,
                    "Spreadsheet Filtered Out",
                )
                continue
            spreadsheet_details = self.get_spreadsheet_details(spreadsheet)
            yield spreadsheet_details

    # Record registration methods for tracking processed entities

    def register_record_directory(self, directory_request: CreateDirectoryRequest) -> None:
        """
        Mark the directory record as scanned and update the directory_source_state
        """
        directory_fqn = fqn.build(
            self.metadata,
            entity_type=Directory,
            service_name=self.context.get().drive_service,
            directory_path=[directory_request.name.root],
        )
        self.directory_source_state.add(directory_fqn)

    def register_record_file(self, file_request: CreateFileRequest) -> None:
        """
        Mark the file record as scanned and update the file_source_state
        """
        file_fqn = fqn.build(
            self.metadata,
            entity_type=File,
            service_name=self.context.get().drive_service,
            directory_path=[self.context.get().directory],
            file_name=file_request.name.root,
        )
        self.file_source_state.add(file_fqn)

    def register_record_spreadsheet(self, spreadsheet_request: CreateSpreadsheetRequest) -> None:
        """
        Mark the spreadsheet record as scanned and update the spreadsheet_source_state
        """
        spreadsheet_fqn = fqn.build(
            self.metadata,
            entity_type=Spreadsheet,
            service_name=self.context.get().drive_service,
            spreadsheet_name=spreadsheet_request.name.root,
        )
        self.spreadsheet_source_state.add(spreadsheet_fqn)

    def register_record_worksheet(self, worksheet_request: CreateWorksheetRequest) -> None:
        """
        Mark the worksheet record as scanned and update the worksheet_source_state
        """
        worksheet_fqn = fqn.build(
            self.metadata,
            entity_type=Worksheet,
            service_name=self.context.get().drive_service,
            spreadsheet_name=worksheet_request.spreadsheet.root,
            worksheet_name=worksheet_request.name.root,
        )
        self.worksheet_source_state.add(worksheet_fqn)

    # Filtering methods

    def _get_filtered_directory_names(self, return_fqn: bool = False, add_to_status: bool = True) -> Iterable[str]:
        """
        Get filtered directory names based on the directory filter pattern
        """
        directory_names_iterable = getattr(self, "get_directory_names_raw", self.get_directory_names)()
        for directory_name in directory_names_iterable:
            directory_fqn = fqn.build(
                self.metadata,
                entity_type=Directory,
                service_name=self.context.get().drive_service,
                directory_path=[directory_name],
            )
            if filter_by_directory(
                self.source_config.directoryFilterPattern,
                directory_fqn if self.source_config.useFqnForFiltering else directory_name,
            ):
                if add_to_status:
                    self.status.filter(directory_fqn, "Directory Filtered Out")
                continue
            yield directory_fqn if return_fqn else directory_name

    # Owner reference methods

    def get_owner_ref(self, entity_name: str) -> EntityReferenceList | None:
        """
        Method to process the entity owners
        """
        try:
            if self.source_config.includeOwners:
                # Implementation depends on the specific drive service
                # Override in specific implementations
                pass
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error processing owner for entity {entity_name}: {exc}")
        return None

    # Deletion marking methods

    def mark_directories_as_deleted(self):
        """
        Mark directories as deleted if they are no longer present in the source
        """
        if self.source_config.markDeletedDirectories:
            logger.info(
                f"Mark Deleted Directories set to True. Processing service [{self.context.get().drive_service}]"
            )
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=Directory,
                entity_source_state=self.directory_source_state,
                recursive=self.source_config.markDeletedDirectories,
                params={"service": self.context.get().drive_service},
            )

    def mark_files_as_deleted(self):
        """
        Mark files as deleted if they are no longer present in the source
        """
        if self.source_config.markDeletedFiles:
            logger.info(f"Mark Deleted Files set to True. Processing service [{self.context.get().drive_service}]")

            # Get directory context if available
            params = {"service": self.context.get().drive_service}
            if self.context.get().__dict__.get("directory"):
                params["directory"] = self.context.get().directory

            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=File,
                entity_source_state=self.file_source_state,
                recursive=self.source_config.markDeletedFiles,
                params=params,
            )

    def mark_spreadsheets_as_deleted(self):
        """
        Mark spreadsheets as deleted if they are no longer present in the source
        """
        if self.source_config.markDeletedSpreadsheets:
            logger.info(
                f"Mark Deleted Spreadsheets set to True. Processing service [{self.context.get().drive_service}]"
            )
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=Spreadsheet,
                entity_source_state=self.spreadsheet_source_state,
                recursive=self.source_config.markDeletedSpreadsheets,
                params={"service": self.context.get().drive_service},
            )

    def mark_worksheets_as_deleted(self):
        """
        Mark worksheets as deleted if they are no longer present in the source
        """
        if not self.context.get().__dict__.get("spreadsheet"):
            logger.debug("No Spreadsheet found in the context. We cannot run the worksheet deletion.")
            return

        if self.source_config.markDeletedWorksheets:
            logger.info(
                f"Mark Deleted Worksheets set to True. Processing spreadsheet [{self.context.get().spreadsheet}]"
            )

            # Build the spreadsheet FQN to use as parameter
            spreadsheet_fqn = fqn.build(
                self.metadata,
                entity_type=Spreadsheet,
                service_name=self.context.get().drive_service,
                spreadsheet_name=self.context.get().spreadsheet,
            )

            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=Worksheet,
                entity_source_state=self.worksheet_source_state,
                recursive=self.source_config.markDeletedWorksheets,
                params={"spreadsheet": spreadsheet_fqn},
            )

    def test_connection(self) -> None:
        if self._connection is not None:
            run_test_connection(self.metadata, self._connection)
        else:
            test_connection_common(self.metadata, self.connection_obj, self.service_connection)
