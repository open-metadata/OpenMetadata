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
Processor util to fetch pii sensitive columns
"""
from typing import Any, Sequence

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.algorithms.tags import PIISensitivityTag
from metadata.pii.algorithms.utils import get_top_classes, normalize_scores
from metadata.pii.base_processor import AutoClassificationProcessor
from metadata.pii.constants import PII
from metadata.utils import fqn
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class PIIProcessor(AutoClassificationProcessor):
    """
    An AutoClassificationProcessor that uses a PIISensitive classifier to tag columns.
    """

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)

        from metadata.pii.algorithms.classifiers import (  # pylint: disable=import-outside-toplevel
            ColumnClassifier,
            PIISensitiveClassifier,
        )

        self._classifier: ColumnClassifier[PIISensitivityTag] = PIISensitiveClassifier()

        self.confidence_threshold = self.source_config.confidence / 100
        self._tolerance = 0.01

    @staticmethod
    def build_tag_label(tag: PIISensitivityTag) -> TagLabel:
        tag_fqn = fqn.build(
            metadata=None,
            entity_type=Tag,
            classification_name=PII,
            tag_name=tag.value,
        )

        tag_label = TagLabel(
            tagFQN=tag_fqn,
            source=TagSource.Classification,
            state=State.Suggested,
            labelType=LabelType.Generated,
        )

        return tag_label

    def create_column_tag_labels(
        self, column: Column, sample_data: Sequence[Any]
    ) -> Sequence[TagLabel]:
        """
        Create tags for the column based on the sample data.
        """
        # If the column we are about to process already has PII tags return empty
        for tag in column.tags or []:
            if PII in tag.tagFQN.root:
                return []

        # Get the tags and confidence
        scores = self._classifier.predict_scores(
            sample_data, column_name=column.name.root, column_data_type=column.dataType
        )

        scores = normalize_scores(scores, tol=self._tolerance)

        # winner is at most 1 tag
        winner = get_top_classes(scores, 1, self.confidence_threshold)
        tag_labels = [self.build_tag_label(tag) for tag in winner]
        return tag_labels
