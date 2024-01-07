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
PII application
"""
import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.entity.applications.configuration.external.autoTaggerAppConfig import (
    AutoTaggerAppConfig,
)
from metadata.generated.schema.entity.data.table import Column, Table, TableData
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.constants import PII
from metadata.pii.scanners.column_name_scanner import ColumnNameScanner
from metadata.pii.scanners.ner_scanner import NERScanner
from metadata.utils.logger import app_logger
from metadata.workflow.application import AppRunner, InvalidAppConfiguration

logger = app_logger()

DEFAULT_CONFIDENCE = 80


class AutoTaggerApp(AppRunner):
    """
    PII Application
    You can execute it with `metadata app -c <path-to-yaml>`
    with a YAML file like:

    sourcePythonClass: metadata.applications.auto_tagger.AutoTaggerApp
    appConfig:
      type: AutoTagger
      confidenceLevel: 80
    workflowConfig:
      loggerLevel: INFO
      openMetadataServerConfig:
        hostPort: http://localhost:8585/api
        authProvider: openmetadata
        securityConfig:
          jwtToken: "..."
    """

    def __init__(self, config: AutoTaggerAppConfig, metadata: OpenMetadata):
        super().__init__(config, metadata)

        if not isinstance(config, AutoTaggerAppConfig):
            raise InvalidAppConfiguration(
                f"AutoTagger Runner expects an AutoTaggerAppConfig, we got [{config}]"
            )

        self._ner_scanner = None
        self.confidence_threshold = config.confidenceLevel or DEFAULT_CONFIDENCE

    @staticmethod
    def build_column_tag(tag_fqn: str, column_fqn: str) -> ColumnTag:
        """
        Build the tag and run the PATCH
        """
        tag_label = TagLabel(
            tagFQN=TagFQN(__root__=tag_fqn),
            source=TagSource.Classification,
            state=State.Suggested,
            labelType=LabelType.Automated,
        )

        return ColumnTag(column_fqn=column_fqn, tag_label=tag_label)

    @property
    def ner_scanner(self) -> NERScanner:
        """Load the NER Scanner only if called"""
        if self._ner_scanner is None:
            self._ner_scanner = NERScanner()

        return self._ner_scanner

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
        column_has_pii_tag = any(
            (PII in tag.tagFQN.__root__ for tag in column.tags or [])
        )

        # If it has PII tags, we skip the processing
        # for the column
        if column_has_pii_tag is True:
            return None

        # Scan by column name. If no results there, check the sample data, if any
        tag_and_confidence = ColumnNameScanner.scan(column.name.__root__) or (
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
                    column_fqn=column.fullyQualifiedName.__root__,
                )
            ]

        return None

    def process_table(self, table: Table) -> Optional[List[ColumnTag]]:
        """Run the patching of the table"""
        column_tags = []
        for idx, column in enumerate(table.columns):
            try:
                col_tags = self.process_column(
                    idx=idx,
                    column=column,
                    table_data=table.sampleData,
                    confidence_threshold=self.confidence_threshold,
                )
                if col_tags:
                    column_tags.extend(col_tags)
            except Exception as err:
                self.status.failed(
                    StackTraceError(
                        name=table.fullyQualifiedName.__root__,
                        error=f"Error computing PII tags for [{column}] - [{err}]",
                        stackTrace=traceback.format_exc(),
                    )
                )

        if column_tags:
            return column_tags

        return None

    def patch_columns(self, table: Table, column_tags: List[ColumnTag]) -> None:
        """Patch columns with PII"""
        patched = self.metadata.patch_column_tags(table=table, column_tags=column_tags)
        if not patched:
            self.status.failed(
                StackTraceError(
                    name=table.fullyQualifiedName.__root__,
                    error="Error patching tags for table",
                )
            )
        else:
            self.status.scanned(table)
            logger.debug(
                f"Successfully patched tag {column_tags} for {table.fullyQualifiedName.__root__}"
            )

    def run(self) -> None:
        """
        The PII Application will:
        1. List tables
        2. Check their column names and sample data (if any)
        3. PATCH PII tags when needed
        """
        tables: Iterable[Table] = self.metadata.list_all_entities(
            entity=Table, fields=["sampleData", "tags"]
        )
        for table in tables:
            column_tags = self.process_table(table)
            if column_tags:
                self.patch_columns(table=table, column_tags=column_tags)
            else:
                self.status.filter(
                    key=table.fullyQualifiedName.__root__, reason="No PII found"
                )

    def close(self) -> None:
        """Nothing to close"""
