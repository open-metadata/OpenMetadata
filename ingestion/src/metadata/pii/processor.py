#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Processor util to fetch pii sensitive columns
"""
import traceback
from typing import List, Optional, cast

from metadata.generated.schema.entity.data.table import Column, TableData
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Processor
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.constants import PII
from metadata.pii.scanners.column_name_scanner import ColumnNameScanner
from metadata.pii.scanners.ner_scanner import NERScanner
from metadata.profiler.api.models import ProfilerResponse
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class PIIProcessor(Processor):
    """
    A scanner that uses Spacy NER for entity recognition
    """

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata

        # Init and type the source config
        self.source_config: DatabaseServiceProfilerPipeline = cast(
            DatabaseServiceProfilerPipeline, self.config.source.sourceConfig.config
        )  # Used to satisfy type checked

        self._ner_scanner = None
        self.name_scanner = ColumnNameScanner()
        self.confidence_threshold = self.source_config.confidence

    @property
    def name(self) -> str:
        return "PII Processor"

    @property
    def ner_scanner(self) -> NERScanner:
        """Load the NER Scanner only if called"""
        if self._ner_scanner is None:
            self._ner_scanner = NERScanner()

        return self._ner_scanner

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "Step":
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config=config, metadata=metadata)

    def close(self) -> None:
        """Nothing to close"""

    @staticmethod
    def build_column_tag(tag_fqn: str, column_fqn: str) -> ColumnTag:
        """
        Build the tag and run the PATCH
        """
        tag_label = TagLabel(
            tagFQN=tag_fqn,
            source=TagSource.Classification,
            state=State.Suggested,
            labelType=LabelType.Automated,
        )

        return ColumnTag(column_fqn=column_fqn, tag_label=tag_label)

    def process_column(
        self,
        idx: int,
        column: Column,
        table_data: Optional[TableData],
        confidence_threshold: float,
    ) -> Optional[List[ColumnTag]]:
        """
        Tag a column with PII if we find it using our scanners
        """

        # First, check if the column we are about to process
        # already has PII tags or not
        column_has_pii_tag = any((PII in tag.tagFQN.root for tag in column.tags or []))

        # If it has PII tags, we skip the processing
        # for the column
        if column_has_pii_tag is True:
            return None

        # Scan by column name. If no results there, check the sample data, if any
        tag_and_confidence = self.name_scanner.scan(column.name.root) or (
            self.ner_scanner.scan([row[idx] for row in table_data.rows])
            if table_data
            else None
        )

        if (
            tag_and_confidence
            and tag_and_confidence.tag_fqn
            and tag_and_confidence.confidence >= confidence_threshold / 100
        ):
            # We support returning +1 tags for a single column in _run
            return [
                self.build_column_tag(
                    tag_fqn=tag_and_confidence.tag_fqn,
                    column_fqn=column.fullyQualifiedName.root,
                )
            ]

        return None

    def _run(
        self,
        record: ProfilerResponse,
    ) -> Either[ProfilerResponse]:
        """
        Main entrypoint for the scanner.

        Adds PII tagging based on the column names
        and TableData
        """

        # We don't always need to process
        if not self.source_config.processPiiSensitive:
            return Either(right=record)

        column_tags = []
        for idx, column in enumerate(record.table.columns):
            try:
                col_tags = self.process_column(
                    idx=idx,
                    column=column,
                    table_data=record.sample_data.data,
                    confidence_threshold=self.confidence_threshold,
                )
                if col_tags:
                    column_tags.extend(col_tags)
            except Exception as err:
                self.status.failed(
                    StackTraceError(
                        name=record.table.fullyQualifiedName.root,
                        error=f"Error computing PII tags for [{column}] - [{err}]",
                        stackTrace=traceback.format_exc(),
                    )
                )

        record.column_tags = column_tags
        return Either(right=record)
