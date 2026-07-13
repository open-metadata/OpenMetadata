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
"""Helpers for working with entity references."""

from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityReference import EntityReference


def require_entity_reference_id(entity_reference: EntityReference, label: str) -> Uuid:
    if entity_reference.id is None:
        raise ValueError(f"{label} must include an id")
    return entity_reference.id
