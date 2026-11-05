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
"""Native tag mapping shared by Databricks and Unity Catalog sources."""

from dataclasses import dataclass

from metadata.domain.tags import TagDefinition


@dataclass(frozen=True)
class TagMappingConfig:
    """Descriptions and fallback classification for native key-value tags."""

    classification_description: str
    tag_description: str
    valueless_classification: str
    valueless_description: str


def map_databricks_tag(name: str | None, value: str | None, config: TagMappingConfig) -> TagDefinition | None:
    """Map a native tag to its classification, value and descriptions."""
    if not name:
        return None
    if value and str(value).strip():
        return TagDefinition(
            classification_name=name,
            tag_name=value,
            classification_description=config.classification_description,
            tag_description=config.tag_description,
        )
    return TagDefinition(
        classification_name=config.valueless_classification,
        tag_name=name,
        classification_description=config.valueless_description,
        tag_description=config.valueless_description,
    )
