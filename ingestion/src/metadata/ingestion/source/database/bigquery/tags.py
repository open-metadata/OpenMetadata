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
"""Map native BigQuery labels and policy tags to definitions."""

from typing import Literal

from metadata.domain.tags import TagDefinition


def map_bigquery_tag(
    classification_name: str, tag_name: str, tag_type: Literal["Dataset", "Table", "Policy"]
) -> TagDefinition:
    """Return a definition with the native BigQuery classification and descriptions."""
    kind = "Tag" if tag_type == "Policy" else "Label"
    return TagDefinition(
        classification_name=classification_name,
        tag_name=tag_name,
        classification_description=f"BigQuery {tag_type} Classification",
        tag_description=f"Bigquery {tag_type} {kind}",
    )
