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
Tag utils Module
"""

import functools
import traceback
from typing import Iterable, List, Optional, Type, Union

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_ometa_tag_and_classification(
    tags: List[str],
    classification_name: str,
    tag_description: str,
    classification_description: str,
    include_tags: bool = True,
    tag_fqn: Optional[FullyQualifiedEntityName] = None,
) -> Iterable[Either[OMetaTagAndClassification]]:
    """
    Returns the OMetaTagAndClassification object
    """
    if include_tags:
        for tag in tags:
            try:
                classification = OMetaTagAndClassification(
                    fqn=tag_fqn,
                    classification_request=CreateClassificationRequest(
                        name=EntityName(classification_name),
                        description=Markdown(classification_description),
                    ),
                    tag_request=CreateTagRequest(
                        classification=FullyQualifiedEntityName(classification_name),
                        name=EntityName(tag),
                        description=Markdown(tag_description)
                        if tag_description
                        else None,
                    ),
                )
                yield Either(right=classification)
                logger.debug(
                    f"Classification {classification_name}, Tag {tag} Ingested"
                )
            except Exception as err:
                yield Either(
                    left=StackTraceError(
                        name=tag,
                        error=f"Error yielding tag [{tag}]: [{err}]",
                        stackTrace=traceback.format_exc(),
                    )
                )


@functools.lru_cache(maxsize=512)
def get_tag_label(
    metadata: OpenMetadata,
    tag_name: str,
    classification_name: Optional[str],
    tag_type: Union[Type[Tag], Type[GlossaryTerm]] = Tag,
) -> Optional[TagLabel]:
    """
    Returns the tag label if the tag is created
    """
    try:
        if tag_type == Tag:
            # Build the tag FQN
            tag_fqn = fqn.build(
                metadata,
                tag_type,
                classification_name=classification_name,
                tag_name=tag_name,
            )
            source = TagSource.Classification.value

        # We either have a Tag or a Glossary
        else:
            tag_fqn = tag_name
            source = TagSource.Glossary.value

        # Check if the tag exists
        tag = metadata.get_by_name(entity=tag_type, fqn=tag_fqn)
        if tag:
            return TagLabel(
                tagFQN=TagFQN(tag_fqn),
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=source,
            )

        logger.warning(f"Tag does not exist: {tag_fqn}")

    except Exception as err:
        logger.debug(traceback.format_exc())
        logger.error(f"Error processing tag label: {err}")
    return None


def get_tag_labels(
    metadata: OpenMetadata,
    tags: List[str],
    classification_name: Optional[str] = None,
    include_tags: bool = True,
    tag_type: Union[Type[Tag], Type[GlossaryTerm]] = Tag,
) -> Optional[List[TagLabel]]:
    """
    Method to create tag labels from the collected tags
    """
    tag_labels_list = []
    if tags and include_tags:
        for tag in tags:
            try:
                tag_label = get_tag_label(
                    metadata,
                    tag_name=tag,
                    classification_name=classification_name,
                    tag_type=tag_type,
                )
                if tag_label:
                    tag_labels_list.append(tag_label)

            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(f"Error processing tag labels: {err}")
    return tag_labels_list or None
