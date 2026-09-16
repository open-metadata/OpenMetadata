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
from collections.abc import Iterator
from typing import Any, List, Optional, Sequence, Type, TypeVar, cast, final

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Column, ColumnName, Table
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
from metadata.ingestion.ometa.utils import model_str
from metadata.sampler.models import SamplerResponse
from metadata.utils.logger import profiler_logger

C = TypeVar("C", bound="AutoClassificationProcessor")
MAX_COLUMN_NESTING_DEPTH = 10

logger = profiler_logger()


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

    @staticmethod
    def _get_entity_columns(entity) -> Optional[List[Column]]:
        """Get columns from a classifiable entity"""
        if isinstance(entity, Table):
            return entity.columns
        if isinstance(entity, Container):
            return entity.dataModel.columns if entity.dataModel else None
        return None

    @classmethod
    def _get_classifier_columns(
        cls, columns: list[Column], sampled_columns: Sequence[ColumnName] | None
    ) -> Iterator[tuple[Column, int | None]]:
        """Keep sampled fields authoritative unless sampling exposes no fields."""
        if not sampled_columns:
            for column in columns:
                for leaf_column in cls._iter_leaf_columns(column):
                    yield leaf_column, None
            return

        for idx, column_name in enumerate(sampled_columns):
            column = next((c for c in columns if c.name == column_name), None)
            if column:
                yield column, idx

    @staticmethod
    def _iter_leaf_columns(
        column: Column, max_depth: int = MAX_COLUMN_NESTING_DEPTH
    ) -> Iterator[Column]:
        """Iterate leaves without following cyclic or pathologically deep schemas."""
        stack: list[tuple[Column, int, tuple[int, ...]]] = [(column, 0, ())]

        while stack:
            current, depth, ancestors = stack.pop()
            current_id = id(current)
            if current_id in ancestors:
                logger.warning(
                    "Skipping cyclic column hierarchy at %s", model_str(current.name)
                )
                continue

            children = [child for child in current.children or [] if child]
            if not children:
                yield current
                continue

            if depth >= max_depth:
                logger.warning(
                    "Column hierarchy reached maximum depth %d at %s; treating it as a leaf",
                    max_depth,
                    model_str(current.name),
                )
                yield current
                continue

            child_ancestors = (*ancestors, current_id)
            stack.extend(
                (child, depth + 1, child_ancestors) for child in reversed(children)
            )

    @final
    def _run(self, record: SamplerResponse) -> Either[SamplerResponse]:
        """
        Main entrypoint for the processor.
        """

        # We don't always need to process
        if not self.source_config.enableAutoClassification:
            return Either(right=record, left=None)

        entity = record.entity
        columns = self._get_entity_columns(entity)

        if not columns:
            return Either(right=record, left=None)

        column_tags = []
        table_data = record.sample_data.data if record.sample_data else None
        table_data_columns = table_data.columns if table_data is not None else None

        for column, sample_index in self._get_classifier_columns(
            columns, table_data_columns
        ):
            try:
                column_sample_data = (
                    [row[sample_index] for row in table_data.rows or []]
                    if sample_index is not None and table_data is not None
                    else []
                )
                tags = self.create_column_tag_labels(
                    column=column,
                    sample_data=column_sample_data,
                )
                for tag in tags:
                    column_tag = ColumnTag(
                        column_fqn=column.fullyQualifiedName.root, tag_label=tag
                    )
                    column_tags.append(column_tag)
            except Exception as err:
                self.status.failed(
                    StackTraceError(
                        name=entity.fullyQualifiedName.root,
                        error=f"Error in Processor {self.name} computing tags for [{column}] - [{err}]",
                        stackTrace=traceback.format_exc(),
                    )
                )

        record.column_tags = column_tags

        # Free the sample data rows now that classification is done.
        # The sink only needs them if store=True.
        if record.sample_data and not record.sample_data.store:
            record.sample_data.data = None

        return Either(right=record, left=None)
