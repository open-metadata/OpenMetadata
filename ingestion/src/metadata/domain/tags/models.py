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
"""Tag definition values shared by resolution and registration."""

from dataclasses import dataclass

from metadata.generated.schema.type.tagLabel import LabelType, State


@dataclass(frozen=True)
class TagDefinition:
    """Classification and tag names with their descriptions."""

    classification_name: str
    tag_name: str
    classification_description: str
    tag_description: str


@dataclass(frozen=True)
class TagAssignment:
    """Classification tag reference and its entity attachment options."""

    classification_name: str
    tag_name: str
    entity_fqn: str
    label_type: LabelType = LabelType.Automated
    state: State = State.Suggested
