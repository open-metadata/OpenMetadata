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

import traceback
from typing import List, Optional

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_tag_labels(
    metadata: OpenMetadata,
    tags: List[str],
    classification_name: str,
    include_tags: bool = True,
) -> Optional[List[TagLabel]]:
    """
    Mehthod to create tag labels from the collected tags
    """
    if tags and include_tags:
        try:
            return [
                TagLabel(
                    tagFQN=fqn.build(
                        metadata,
                        Tag,
                        classification_name=classification_name,
                        tag_name=tag,
                    ),
                    labelType=LabelType.Automated.value,
                    state=State.Suggested.value,
                    source=TagSource.Classification.value,
                )
                for tag in tags
            ]
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error processing tag labels: {err}")
    return None
