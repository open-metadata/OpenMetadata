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
PII processing models
"""
from dataclasses import dataclass
from enum import Enum
from typing import Optional

from pydantic import BaseModel

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.tagLabelRecognizerMetadata import (
    TagLabelRecognizerMetadata,
)


class TagType(Enum):
    SENSITIVE = "Sensitive"
    NONSENSITIVE = "NonSensitive"


class TagAndConfidence(BaseModel):
    tag_fqn: str
    confidence: float


@dataclass(frozen=True)
class ScoredTag:
    """
    Result of scoring a tag against sample data.

    Attributes:
        tag: The tag that was scored
        score: Confidence score (0.0-1.0)
        reason: Explanation of why this tag was matched
        recognizer_metadata: Optional metadata about the recognizer that applied this tag
    """

    tag: Tag
    score: float
    reason: str
    recognizer_metadata: Optional[TagLabelRecognizerMetadata] = None

    def __hash__(self) -> int:
        return hash(self.tag.fullyQualifiedName)

    @property
    def classification_name(self) -> str:
        if self.tag.classification and self.tag.classification.name:
            return self.tag.classification.name
        return "Unknown"

    @property
    def priority(self) -> int:
        return self.tag.autoClassificationPriority or 50
