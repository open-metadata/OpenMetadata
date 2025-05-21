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
#  pylint: disable=invalid-name
"""
Entity interface model
"""

from typing import List, Optional, Protocol, runtime_checkable

from metadata.generated.schema.type import basic, entityHistory, tagLabel


@runtime_checkable
class EntityInterface(Protocol):
    """Entity interface model use where entity classes are used for structural typing"""

    @property
    def id(self) -> basic.Uuid:
        ...

    @property
    def description(self) -> Optional[basic.Markdown]:
        ...

    @property
    def displayName(self) -> Optional[str]:
        ...

    @property
    def name(self) -> basic.EntityName:
        ...

    @property
    def version(self) -> Optional[entityHistory.EntityVersion]:
        ...

    @property
    def updatedBy(self) -> Optional[str]:
        ...

    @property
    def updatedAt(self) -> Optional[basic.Timestamp]:
        ...

    @property
    def href(self) -> Optional[basic.Href]:
        ...

    @property
    def changeDescription(self) -> Optional[entityHistory.ChangeDescription]:
        ...

    @property
    def fullyQualifiedName(self) -> Optional[basic.FullyQualifiedEntityName]:
        ...


class EntityInterfaceWithTags(EntityInterface, Protocol):
    """Entity interface model with tags"""

    @property
    def tags(self) -> Optional[List[tagLabel.TagLabel]]:
        ...
