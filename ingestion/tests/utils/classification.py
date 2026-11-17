#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from metadata.generated.schema.api.classification.createClassification import CreateClassificationRequest
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def snapshot_classification(metadata: OpenMetadata, fqn: str) -> CreateClassificationRequest:
    """Capture a classification's current definition as a request that restores it verbatim."""
    classification = metadata.get_by_name(entity=Classification, fqn=fqn, fields=["autoClassificationConfig"])
    # The entity and the request generate distinct AutoClassificationConfig classes, so the instance
    # has to be round-tripped through JSON rather than handed over directly.
    auto_classification_config = (
        classification.autoClassificationConfig.model_dump(mode="json")
        if classification.autoClassificationConfig
        else None
    )

    return CreateClassificationRequest(
        name=classification.name,
        displayName=classification.displayName,
        description=classification.description,
        provider=classification.provider,
        mutuallyExclusive=classification.mutuallyExclusive,
        autoClassificationConfig=auto_classification_config,
    )


def snapshot_tag(metadata: OpenMetadata, fqn: str) -> CreateTagRequest:
    """Capture a tag's current definition as a request that restores it verbatim."""
    tag = metadata.get_by_name(entity=Tag, fqn=fqn, fields=["recognizers"])

    return CreateTagRequest(
        name=tag.name,
        displayName=tag.displayName,
        description=tag.description,
        classification=fqn.rsplit(".", 1)[0],
        style=tag.style,
        provider=tag.provider,
        mutuallyExclusive=tag.mutuallyExclusive,
        recognizers=tag.recognizers,
        autoClassificationEnabled=tag.autoClassificationEnabled,
        autoClassificationPriority=tag.autoClassificationPriority,
    )
