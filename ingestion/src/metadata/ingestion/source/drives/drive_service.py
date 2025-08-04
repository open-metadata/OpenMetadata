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
from typing import Any, Iterable, List, Optional, Set, Tuple

from pydantic import BaseModel, Field
from typing_extensions import Annotated

from metadata.generated.schema.api.data.createDirectory import CreateDirectoryRequest
from metadata.generated.schema.api.data.createFile import CreateFileRequest
from metadata.generated.schema.api.data.createSpreadsheet import CreateSpreadsheetRequest
from metadata.generated.schema.api.data.createWorksheet import CreateWorksheetRequest
from metadata.generated.schema.api.services.createDriveService import CreateDriveServiceRequest
from metadata.generated.schema.entity.data.directory import Directory
from metadata.generated.schema.entity.data.file import File
from metadata.generated.schema.entity.data.spreadsheet import Spreadsheet
from metadata.generated.schema.entity.data.worksheet import Worksheet
from metadata.generated.schema.entity.services.driveService import (
    DriveConnection,
    DriveService,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.driveServiceMetadataPipeline import (
    DriveServiceMetadataPipeline,
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.delete import delete_entity_from_source
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Source
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.life_cycle import OMetaLifeCycleData
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyContextManager,
    TopologyNode,
)
from metadata.ingestion.source.connections import test_connection_common
from metadata.utils import fqn
from metadata.utils.execution_time_tracker import calculate_execution_time
from metadata.utils.filters import filter_by_schema
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_tag_label

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

    root: Annotated[
        TopologyNode, Field(description="Root node for the topology")
    ] = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=DriveService,
                context="drive_service",
                processor="yield_create_request_drive_service",
                overwrite=False,
                must_return=True,
                cache_entities=True,
            ),
        ],
        children=["directory", "spreadsheet"],
        post_process=[
            "mark_directories_as_deleted",
            "mark_files_as_deleted",
            "mark_spreadsheets_as_deleted",
            "mark_worksheets_as_deleted",
        ],
    )
    
    directory: Annotated[
        TopologyNode, Field(description="Directory Node")
    ] = TopologyNode(
        producer="get_directory_names",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_directory_tag_details",
                nullable=True,
                store_all_in_context=True,
            ),
            NodeStage(
                type_=Directory,
                context="directory",
                processor="yield_directory",
                consumer=["drive_service"],
                cache_entities=True,
                use_cache=True,
            ),
            NodeStage(
                type_=OMetaLifeCycleData,
                processor="yield_directory_life_cycle_data",
                nullable=True,
            ),
        ],
        children=["file"],  # Note: Directories handle their own nesting through parent references
        post_process=["mark_files_as_deleted"],
    )
    
    file: Annotated[
        TopologyNode, Field(description="File Node")
    ] = TopologyNode(
        producer="get_file_names",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_file_tag_details",
                nullable=True,
                store_all_in_context=True,
            ),
            NodeStage(
                type_=File,
                context="file",
                processor="yield_file",
                consumer=["drive_service", "directory"],
                use_cache=True,
            ),
            NodeStage(
                type_=OMetaLifeCycleData,
                processor="yield_file_life_cycle_data",
                nullable=True,
            ),
        ],
    )
    
    spreadsheet: Annotated[
        TopologyNode, Field(description="Spreadsheet Node")
    ] = TopologyNode(
        producer="get_spreadsheet_names",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_spreadsheet_tag_details",
                nullable=True,
                store_all_in_context=True,
            ),
            NodeStage(
                type_=Spreadsheet,
                context="spreadsheet",
                processor="yield_spreadsheet",
                consumer=["drive_service"],
                cache_entities=True,
                use_cache=True,
            ),
            NodeStage(
                type_=OMetaLifeCycleData,
                processor="yield_spreadsheet_life_cycle_data",
                nullable=True,
            ),
        ],
        children=["worksheet"],
        post_process=["mark_worksheets_as_deleted"],
    )
    
    worksheet: Annotated[
        TopologyNode, Field(description="Worksheet Node")
    ] = TopologyNode(
        producer="get_worksheet_names",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_worksheet_tag_details",
                nullable=True,
                store_all_in_context=True,
            ),
            NodeStage(
                type_=Worksheet,
                context="worksheet",
                processor="yield_worksheet",
                consumer=["drive_service", "spreadsheet"],
                use_cache=True,
            ),
            NodeStage(
                type_=OMetaLifeCycleData,
                processor="yield_worksheet_life_cycle_data",
                nullable=True,
            ),
        ],
    )


class DriveServiceSource(
    TopologyRunnerMixin, Source, ABC
):  # pylint: disable=too-many-public-methods
    """
    Base class for Drive Services.
    It implements the topology and context for drive-based systems like:
    - Google Drive
    - SharePoint
    - OneDrive
    - Box
    - Dropbox
    etc.
    """

    source_config: DriveServiceMetadataPipeline
    config: WorkflowSource
    directory_source_state: Set = set()
    file_source_state: Set = set()
    spreadsheet_source_state: Set = set()
    worksheet_source_state: Set = set()
    
    # Big union of types we want to fetch dynamically
    service_connection: DriveConnection.model_fields["config"].annotation

    topology = DriveServiceTopology()
    context = TopologyContextManager(topology)

    @property
    def name(self) -> str:
        return self.service_connection.type.name

    def prepare(self):
        """By default, there is no preparation needed"""

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def yield_create_request_drive_service(
        self, config: WorkflowSource
    ) -> Iterable[Either[CreateDriveServiceRequest]]:
        yield Either(
            right=self.metadata.get_create_service_from_source(
                entity=DriveService, config=config
            )
        )

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
    def get_spreadsheet_names(self) -> Iterable[str]:
        """
        Prepares the spreadsheet names to be sent to stage.
        Filtering happens here.
        """

    @abstractmethod
    def get_worksheet_names(self) -> Iterable[str]:
        """
        Prepares the worksheet names to be sent to stage.
        Filtering happens here.
        """

    @abstractmethod
    def yield_directory(
        self, directory_name: str
    ) -> Iterable[Either[CreateDirectoryRequest]]:
        """
        From topology.
        Prepare a directory request and pass it to the sink.
        Handle parent-child relationships for nested directories.
        """

    @abstractmethod
    def yield_file(
        self, file_name: str
    ) -> Iterable[Either[CreateFileRequest]]:
        """
        From topology.
        Prepare a file request and pass it to the sink.
        Link to directory if the file belongs to one.
        """

    @abstractmethod
    def yield_spreadsheet(
        self, spreadsheet_name: str
    ) -> Iterable[Either[CreateSpreadsheetRequest]]:
        """
        From topology.
        Prepare a spreadsheet request and pass it to the sink.
        """

    @abstractmethod
    def yield_worksheet(
        self, worksheet_name: str
    ) -> Iterable[Either[CreateWorksheetRequest]]:
        """
        From topology.
        Prepare a worksheet request and pass it to the sink.
        Link to parent spreadsheet.
        """

    # Tag handling methods
    
    def yield_directory_tag_details(
        self, directory_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each directory
        """
        if self.source_config.includeTags:
            yield from self.yield_directory_tags(directory_name) or []

    def yield_file_tag_details(
        self, file_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each file
        """
        if self.source_config.includeTags:
            yield from self.yield_file_tags(file_name) or []

    def yield_spreadsheet_tag_details(
        self, spreadsheet_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each spreadsheet
        """
        if self.source_config.includeTags:
            yield from self.yield_spreadsheet_tags(spreadsheet_name) or []

    def yield_worksheet_tag_details(
        self, worksheet_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each worksheet
        """
        if self.source_config.includeTags:
            yield from self.yield_worksheet_tags(worksheet_name) or []

    # Optional tag methods - can be overridden by specific implementations
    
    def yield_directory_tags(
        self, directory_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each directory
        """

    def yield_file_tags(
        self, file_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each file
        """

    def yield_spreadsheet_tags(
        self, spreadsheet_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each spreadsheet
        """

    def yield_worksheet_tags(
        self, worksheet_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each worksheet
        """

    # Lifecycle data methods - optional
    
    def yield_directory_life_cycle_data(self, _) -> Iterable[Either[OMetaLifeCycleData]]:
        """
        Get the life cycle data of the directory
        """

    def yield_file_life_cycle_data(self, _) -> Iterable[Either[OMetaLifeCycleData]]:
        """
        Get the life cycle data of the file
        """

    def yield_spreadsheet_life_cycle_data(self, _) -> Iterable[Either[OMetaLifeCycleData]]:
        """
        Get the life cycle data of the spreadsheet
        """

    def yield_worksheet_life_cycle_data(self, _) -> Iterable[Either[OMetaLifeCycleData]]:
        """
        Get the life cycle data of the worksheet
        """

    # Utility methods for tags and FQN handling
    
    def get_tag_by_fqn(self, entity_fqn: str) -> Optional[List[TagLabel]]:
        """
        Pick up the tags registered in the context
        searching by entity FQN
        """
        tag_labels = []
        for tag_and_category in self.context.get().tags or []:
            if tag_and_category.fqn and tag_and_category.fqn.root == entity_fqn:
                tag_label = get_tag_label(
                    metadata=self.metadata,
                    tag_name=tag_and_category.tag_request.name.root,
                    classification_name=tag_and_category.classification_request.name.root,
                )
                if tag_label:
                    tag_labels.append(tag_label)
        return tag_labels or None

    def get_directory_tag_labels(self, directory_name: str) -> Optional[List[TagLabel]]:
        """
        Method to get directory tags
        This will only get executed if the tags context
        is properly informed
        """
        directory_fqn = fqn.build(
            self.metadata,
            entity_type=Directory,
            service_name=self.context.get().drive_service,
            directory_name=directory_name,
        )
        return self.get_tag_by_fqn(entity_fqn=directory_fqn)

    def get_file_tag_labels(self, file_name: str) -> Optional[List[TagLabel]]:
        """
        Method to get file tags
        This will only get executed if the tags context
        is properly informed
        """
        file_fqn = fqn.build(
            self.metadata,
            entity_type=File,
            service_name=self.context.get().drive_service,
            directory_name=self.context.get().directory,
            file_name=file_name,
        )
        return self.get_tag_by_fqn(entity_fqn=file_fqn)

    def get_spreadsheet_tag_labels(self, spreadsheet_name: str) -> Optional[List[TagLabel]]:
        """
        Method to get spreadsheet tags
        This will only get executed if the tags context
        is properly informed
        """
        spreadsheet_fqn = fqn.build(
            self.metadata,
            entity_type=Spreadsheet,
            service_name=self.context.get().drive_service,
            spreadsheet_name=spreadsheet_name,
        )
        return self.get_tag_by_fqn(entity_fqn=spreadsheet_fqn)

    def get_worksheet_tag_labels(self, worksheet_name: str) -> Optional[List[TagLabel]]:
        """
        Method to get worksheet tags
        This will only get executed if the tags context
        is properly informed
        """
        worksheet_fqn = fqn.build(
            self.metadata,
            entity_type=Worksheet,
            service_name=self.context.get().drive_service,
            spreadsheet_name=self.context.get().spreadsheet,
            worksheet_name=worksheet_name,
        )
        return self.get_tag_by_fqn(entity_fqn=worksheet_fqn)

    # Record registration methods for tracking processed entities
    
    @calculate_execution_time()
    def register_record_directory(self, directory_request: CreateDirectoryRequest) -> None:
        """
        Mark the directory record as scanned and update the directory_source_state
        """
        directory_fqn = fqn.build(
            self.metadata,
            entity_type=Directory,
            service_name=self.context.get().drive_service,
            directory_name=directory_request.name.root,
            skip_es_search=True,
        )
        self.directory_source_state.add(directory_fqn)

    @calculate_execution_time()
    def register_record_file(self, file_request: CreateFileRequest) -> None:
        """
        Mark the file record as scanned and update the file_source_state
        """
        file_fqn = fqn.build(
            self.metadata,
            entity_type=File,
            service_name=self.context.get().drive_service,
            directory_name=self.context.get().directory,
            file_name=file_request.name.root,
            skip_es_search=True,
        )
        self.file_source_state.add(file_fqn)

    @calculate_execution_time()
    def register_record_spreadsheet(self, spreadsheet_request: CreateSpreadsheetRequest) -> None:
        """
        Mark the spreadsheet record as scanned and update the spreadsheet_source_state
        """
        spreadsheet_fqn = fqn.build(
            self.metadata,
            entity_type=Spreadsheet,
            service_name=self.context.get().drive_service,
            spreadsheet_name=spreadsheet_request.name.root,
            skip_es_search=True,
        )
        self.spreadsheet_source_state.add(spreadsheet_fqn)

    @calculate_execution_time()
    def register_record_worksheet(self, worksheet_request: CreateWorksheetRequest) -> None:
        """
        Mark the worksheet record as scanned and update the worksheet_source_state
        """
        worksheet_fqn = fqn.build(
            self.metadata,
            entity_type=Worksheet,
            service_name=self.context.get().drive_service,
            spreadsheet_name=self.context.get().spreadsheet,
            worksheet_name=worksheet_request.name.root,
            skip_es_search=True,
        )
        self.worksheet_source_state.add(worksheet_fqn)

    # Filtering methods
    
    def _get_filtered_directory_names(
        self, return_fqn: bool = False, add_to_status: bool = True
    ) -> Iterable[str]:
        """
        Get filtered directory names based on the directory filter pattern
        """
        directory_names_iterable = getattr(
            self, "get_directory_names_raw", self.get_directory_names
        )()
        for directory_name in directory_names_iterable:
            directory_fqn = fqn.build(
                self.metadata,
                entity_type=Directory,
                service_name=self.context.get().drive_service,
                directory_name=directory_name,
            )
            if filter_by_schema(
                self.source_config.directoryFilterPattern,
                directory_fqn
                if self.source_config.useFqnForFiltering
                else directory_name,
            ):
                if add_to_status:
                    self.status.filter(directory_fqn, "Directory Filtered Out")
                continue
            yield directory_fqn if return_fqn else directory_name

    # Owner reference methods
    
    @calculate_execution_time()
    def get_owner_ref(self, entity_name: str) -> Optional[EntityReferenceList]:
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
                mark_deleted_entity=self.source_config.markDeletedDirectories,
                params={"service": self.context.get().drive_service},
            )

    def mark_files_as_deleted(self):
        """
        Mark files as deleted if they are no longer present in the source
        """
        if self.source_config.markDeletedFiles:
            logger.info(
                f"Mark Deleted Files set to True. Processing service [{self.context.get().drive_service}]"
            )
            
            # Get directory context if available
            params = {"service": self.context.get().drive_service}
            if self.context.get().__dict__.get("directory"):
                params["directory"] = self.context.get().directory
            
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=File,
                entity_source_state=self.file_source_state,
                mark_deleted_entity=self.source_config.markDeletedFiles,
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
                mark_deleted_entity=self.source_config.markDeletedSpreadsheets,
                params={"service": self.context.get().drive_service},
            )

    def mark_worksheets_as_deleted(self):
        """
        Mark worksheets as deleted if they are no longer present in the source
        """
        if not self.context.get().__dict__.get("spreadsheet"):
            raise ValueError(
                "No Spreadsheet found in the context. We cannot run the worksheet deletion."
            )

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
                mark_deleted_entity=self.source_config.markDeletedWorksheets,
                params={"spreadsheet": spreadsheet_fqn},
            )

    def test_connection(self) -> None:
        test_connection_common(
            self.metadata, self.connection_obj, self.service_connection
        )
