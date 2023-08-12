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
from typing import Optional

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.column_name_scanner import ColumnNameScanner
from metadata.pii.constants import PII
from metadata.pii.ner_scanner import NERScanner
from metadata.utils import fqn
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class PIIProcessor:
    """
    A scanner that uses Spacy NER for entity recognition
    """

    def __init__(self, metadata: OpenMetadata):

        self.metadata = metadata
        self.ner_scanner = NERScanner()

    def patch_column_tag(
        self, tag_type: str, table_entity: Table, column_fqn: str
    ) -> None:
        """
        Build the tag and run the PATCH
        """
        tag_fqn = fqn.build(
            self.metadata,
            entity_type=Tag,
            classification_name=PII,
            tag_name=tag_type,
        )
        tag_label = TagLabel(
            tagFQN=tag_fqn,
            source=TagSource.Classification,
            state=State.Suggested,
            labelType=LabelType.Automated,
        )
        self.metadata.patch_column_tag(
            table=table_entity,
            column_fqn=column_fqn,
            tag_label=tag_label,
        )

    def process(
        self,
        table_data: Optional[TableData],
        table_entity: Table,
        confidence_threshold: float,
    ):
        """
        Main entrypoint for the scanner.

        Adds PII tagging based on the column names
        and TableData
        """
        for idx, column in enumerate(table_entity.columns):

            try:
                # First, check if the column we are about to process
                # already has PII tags or not
                column_has_pii_tag = any(
                    (PII in tag.tagFQN.__root__ for tag in column.tags or [])
                )

                # If it has PII tags, we skip the processing
                # for the column
                if column_has_pii_tag is True:
                    continue

                # Scan by column name. If no results there, check the sample data, if any
                tag_and_confidence = ColumnNameScanner.scan(column.name.__root__) or (
                    self.ner_scanner.scan([row[idx] for row in table_data.rows])
                    if table_data
                    else None
                )

                if (
                    tag_and_confidence
                    and tag_and_confidence.tag
                    and tag_and_confidence.confidence >= confidence_threshold / 100
                ):
                    self.patch_column_tag(
                        tag_type=tag_and_confidence.tag.value,
                        table_entity=table_entity,
                        column_fqn=column.fullyQualifiedName.__root__,
                    )
            except Exception as err:
                logger.warning(f"Error computing PII tags for [{column}] - [{err}]")
