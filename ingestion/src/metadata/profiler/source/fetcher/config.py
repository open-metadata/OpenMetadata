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
Entity Fetcher Configuration Models
"""

from typing import Optional, Protocol, runtime_checkable

from metadata.generated.schema.type.filterPattern import FilterPattern


# We take the names from the JSON Schema
# pylint: disable=invalid-name
@runtime_checkable
class EntityFilterConfigInterface(Protocol):
    """Interface for the OM workflow source configs that allow filtering"""

    @property
    def classificationFilterPattern(self) -> Optional[FilterPattern]:
        ...

    @property
    def databaseFilterPattern(self) -> Optional[FilterPattern]:
        ...

    @property
    def schemaFilterPattern(self) -> Optional[FilterPattern]:
        ...

    @property
    def tableFilterPattern(self) -> Optional[FilterPattern]:
        ...

    @property
    def useFqnForFiltering(self) -> Optional[bool]:
        ...

    @property
    def includeViews(self) -> Optional[bool]:
        ...
