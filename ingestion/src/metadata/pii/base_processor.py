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
Base class for the Auto Classification Processor.
"""
import traceback
from abc import ABC, abstractmethod
from typing import Any, Optional, Sequence, Type, TypeVar, cast, final

from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.steps import Processor
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sampler.models import SamplerResponse

C = TypeVar("C", bound="AutoClassificationProcessor")


class AutoClassificationProcessor(Processor, ABC):
    """
    Abstract class for the Auto Classification Processor.

    Implementations should only provide the logic for creating tags based on sample data,
    and rely on the running part to be handled by the base class.
    """

    # Some methods are marked as final to prevent overriding in subclasses thus
    # ensuring that the workflow is always run in the same way keeping implementer
    # with the responsibility of *only* implementing the logic for creating tags.
    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata

        # Init and type the source config
        self.source_config: DatabaseServiceAutoClassificationPipeline = cast(
            DatabaseServiceAutoClassificationPipeline,
            self.config.source.sourceConfig.config,
        )  # Used to satisfy type checked

    @abstractmethod
    def create_column_tag_labels(
        self, column: Column, sample_data: Sequence[Any]
    ) -> Sequence[TagLabel]:
        """
        Create tags for the column based on the sample data.
        """

    @property
    def name(self) -> str:
        return "Auto Classification Processor"

    def close(self) -> None:
        """Nothing to close"""

    @classmethod
    @final
    def create(
        cls: Type[C],
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> C:
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config=config, metadata=metadata)

    @final
    def _run(self, record: SamplerResponse) -> Either[SamplerResponse]:
        """
        Main entrypoint for the processor.
        """

        # We don't always need to process
        if not self.source_config.enableAutoClassification:
            return Either(right=record, left=None)

        column_tags = []

        for idx, column in enumerate(record.table.columns):
            try:
                tags = self.create_column_tag_labels(
                    column=column,
                    sample_data=[row[idx] for row in record.sample_data.data.rows],
                )
                for tag in tags:
                    column_tag = ColumnTag(
                        column_fqn=column.fullyQualifiedName.root, tag_label=tag
                    )
                    column_tags.append(column_tag)
            except Exception as err:
                # TODO: Shouldn't we return a Left here?
                self.status.failed(
                    StackTraceError(
                        name=record.table.fullyQualifiedName.root,
                        error=f"Error in Processor {self.name} computing tags for [{column}] - [{err}]",
                        stackTrace=traceback.format_exc(),
                    )
                )

        record.column_tags = column_tags
        return Either(right=record, left=None)
