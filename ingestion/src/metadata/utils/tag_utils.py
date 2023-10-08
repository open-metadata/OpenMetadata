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
from typing import Iterable, List, Optional

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_ometa_tag_and_classification(
    tags: List[str],
    classification_name: str,
    tag_description: Optional[str],
    classification_description: Optional[str],
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
                        name=classification_name,
                        description=classification_description,
                    ),
                    tag_request=CreateTagRequest(
                        classification=classification_name,
                        name=tag,
                        description=tag_description,
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
                        stack_trace=traceback.format_exc(),
                    )
                )


@functools.lru_cache(maxsize=512)
def get_tag_label(
    metadata: OpenMetadata, tag_name: str, classification_name: str
) -> Optional[TagLabel]:
    """
    Returns the tag label if the tag is created
    """
    try:
        # Build the tag FQN
        tag_fqn = fqn.build(
            metadata,
            Tag,
            classification_name=classification_name,
            tag_name=tag_name,
        )

        # Check if the tag exists
        tag = metadata.get_by_name(entity=Tag, fqn=tag_fqn)
        if tag:
            return TagLabel(
                tagFQN=tag_fqn,
                labelType=LabelType.Automated.value,
                state=State.Suggested.value,
                source=TagSource.Classification.value,
            )
    except Exception as err:
        logger.debug(traceback.format_exc())
        logger.error(f"Error processing tag label: {err}")
    return None


def get_tag_labels(
    metadata: OpenMetadata,
    tags: List[str],
    classification_name: str,
    include_tags: bool = True,
) -> Optional[List[TagLabel]]:
    """
    Method to create tag labels from the collected tags
    """
    tag_labels_list = []
    if tags and include_tags:
        for tag in tags:
            try:
                tag_label = get_tag_label(
                    metadata, tag_name=tag, classification_name=classification_name
                )
                if tag_label:
                    tag_labels_list.append(tag_label)

            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(f"Error processing tag labels: {err}")
    return tag_labels_list or None
