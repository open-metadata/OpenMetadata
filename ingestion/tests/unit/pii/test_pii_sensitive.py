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

from metadata.generated.schema.type.tagLabel import LabelType, State, TagSource
from metadata.pii.algorithms.tags import PIISensitivityTag
from metadata.pii.processor import PIIProcessor


def test_pii_processor_build_tag_label_for_pii_sensitive():

    tag = PIISensitivityTag.SENSITIVE
    tag_label = PIIProcessor.build_tag_label(tag)

    assert tag_label.tagFQN.root == "PII.Sensitive"
    assert tag_label.source == TagSource.Classification
    assert tag_label.state == State.Suggested
    assert tag_label.labelType == LabelType.Generated


def test_pii_processor_build_tag_label_for_pii_nonsensitive():
    tag = PIISensitivityTag.NONSENSITIVE
    tag_label = PIIProcessor.build_tag_label(tag)

    assert tag_label.tagFQN.root == "PII.NonSensitive"
    assert tag_label.source == TagSource.Classification
    assert tag_label.state == State.Suggested
    assert tag_label.labelType == LabelType.Generated
