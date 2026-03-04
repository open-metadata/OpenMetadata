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
Processor util to fetch pii sensitive columns.

DEPRECATED: This processor is deprecated in favor of TagProcessor which supports
multiple classifications and respects classification-level configuration.

For migration, use TagProcessor instead:
    from metadata.pii.tag_processor import TagProcessor
    processor = TagProcessor(config, metadata, classification_filter=["PII"])
"""
import warnings
from typing import Any, Sequence

from metadata.pii.algorithms.presidio_patches import ResultCapturingPatcher
from metadata.pii.algorithms.presidio_utils import explain_recognition_results

warnings.warn(
    "PIIProcessor is deprecated and will be removed in a future version. "
    "Please use TagProcessor instead for enhanced multi-classification support.",
    DeprecationWarning,
    stacklevel=2,
)

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
from metadata.pii.algorithms.classifiers import (  # pylint: disable=import-outside-toplevel
    ColumnClassifier,
    HeuristicPIIClassifier,
    PIISensitiveClassifier,
)
from metadata.pii.algorithms.tags import PIISensitivityTag
from metadata.pii.algorithms.utils import get_top_classes
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
        tolerance: float = 0.01,
    ):
        super().__init__(config, metadata)

        self.confidence_threshold = self.source_config.confidence / 100
        self._tolerance = tolerance

    @staticmethod
    def build_tag_label(tag: PIISensitivityTag, reason: str) -> TagLabel:
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
            reason=reason,
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

        # Build classifier with the results capturing patcher
        result_capturer = ResultCapturingPatcher()
        classifier: ColumnClassifier[PIISensitivityTag] = PIISensitiveClassifier(
            HeuristicPIIClassifier(extra_patchers=(result_capturer,))
        )

        # Get the tags and confidence
        scores = classifier.predict_scores(
            sample_data, column_name=column.name.root, column_data_type=column.dataType
        )

        # Filter noise and cap at 1.0 (don't normalize to sum=1)
        scores = {k: min(v, 1.0) for k, v in scores.items() if v > self._tolerance}

        # winner is at most 1 tag
        winner = get_top_classes(scores, 1, self.confidence_threshold)
        tag_labels = [
            self.build_tag_label(
                tag, explain_recognition_results(result_capturer.recognizer_results)
            )
            for tag in winner
        ]
        return tag_labels
