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
from typing import Any, Sequence, TypeVar, Union

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
from metadata.pii.algorithms.column_labelers import HeuristicPIILabeler
from metadata.pii.algorithms.label_extractors import (
    LabelExtractor,
    ProbabilisticLabelExtractor,
)
from metadata.pii.algorithms.scoring_ops import scores_group_by
from metadata.pii.algorithms.tags import (
    PIICategoryTag,
    PIIClassificationName,
    PIISensitivityTag,
    PIITag,
)
from metadata.pii.algorithms.tags_ops import (
    categorize_pii_tag,
    get_sensitivity_for_pii_category,
    resolve_sensitivity,
)
from metadata.pii.base_processor import AutoClassificationProcessor
from metadata.utils import fqn
from metadata.utils.logger import profiler_logger

T = TypeVar("T")

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

        from metadata.pii.algorithms.column_labelers import (  # pylint: disable=import-outside-toplevel
            ColumnLabeler,
            HeuristicPIILabeler,
        )

        prob_threshold = self.source_config.confidence / 100
        score_threshold = 0.1  # This is the minimum score to consider a tag

        self._pii_category_extractor: LabelExtractor[
            PIICategoryTag
        ] = ProbabilisticLabelExtractor(
            score_threshold=score_threshold,
            prob_threshold=prob_threshold,
            k=1,  # k=1 means we return only the top category
        )

        self._pii_labeler: ColumnLabeler[PIITag] = HeuristicPIILabeler()

    def create_column_tag_labels(
        self, column: Column, sample_data: Sequence[Any]
    ) -> Sequence[TagLabel]:
        """
        Create tags for the column based on the sample data.
        """
        # If the column we are about to process already has PII tags return empty
        for tag in column.tags or []:
            if PIIClassificationName.PII.value in tag.tagFQN.root:
                return []

        pii_tag_scores = self._pii_labeler.predict_scores(
            sample_data, column_name=column.name.root, column_data_type=column.dataType
        )

        pii_category_scores = scores_group_by(pii_tag_scores, categorize_pii_tag)

        # We allow more than one category to be assigned, this might be useful
        # for documents that contain multiple PII types.
        # Whether, we want to return one or multiple labels is controlled
        # by the LabelExtractor; to modify this behavior, please change the
        # LabelExtractor used, and not the implementation of this method.

        pii_categories = self._pii_category_extractor.extract_labels(
            pii_category_scores
        )

        tag_labels = [get_tag_label(pii_category) for pii_category in pii_categories]

        # Determine the sensitivity of the PII categories, if any
        pii_sensitivity = resolve_sensitivity(
            {get_sensitivity_for_pii_category(pc) for pc in pii_categories}
        )

        if pii_sensitivity:
            tag_labels.append(get_tag_label(pii_sensitivity))

        return tag_labels


def get_tag_label(tag: Union[PIICategoryTag, PIISensitivityTag]) -> TagLabel:

    fqn_str = fqn.build(
        None,
        entity_type=Tag,
        classification_name=tag.pii_classification_name().value,
        tag_name=tag.value,
    )

    if fqn_str is None:
        # This should be prevented by unit tests, but in case it happens,
        # we prefer to fail noisily rather than silently returning None.
        raise ValueError(f"Failed to build FQN for tag: {tag}")

    return TagLabel(
        tagFQN=fqn_str,
        source=TagSource.Classification,
        state=State.Suggested,
        labelType=LabelType.Generated,
    )
