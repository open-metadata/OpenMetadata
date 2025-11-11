#  Copyright 2021 Collate
#  Copyright 2023 Schlameel
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
Utilities and a super class containing common utility methods for mixins performing JSON PATCHes

To be used be OpenMetadata
"""

from enum import Enum
from typing import Generic, List, Optional, Type, TypeVar, Union

from pydantic import BaseModel

from metadata.generated.schema.type import basic

T = TypeVar("T", bound=BaseModel)


class PatchField(str, Enum):
    """
    JSON PATCH field names
    """

    OPERATION = "op"
    PATH = "path"
    VALUE = "value"


class PatchOperation(str, Enum):
    """
    JSON PATCH operation strings
    """

    ADD = "add"
    REPLACE = "replace"
    REMOVE = "remove"


class PatchPath(str, Enum):
    """
    JSON PATCH path strings
    """

    COLUMNS_DESCRIPTION = "/columns/{index}/description"
    COLUMNS_TAGS = "/columns/{index}/tags/{tag_index}"
    DESCRIPTION = "/description"
    GLOSSARY_TERMS = "/glossaryTerms/{entity_id}"
    POLICIES = "/policies/{index}"
    POLICIES_HREF = "/policies/{index}/href"
    POLICIES_DESCRIPTION = "/policies/{index}/description"
    POLICIES_FQN = "/policies/{index}/fullyQualifiedName"
    POLICIES_NAME = "/policies/{index}/name"
    POLICIES_ID = "/policies/{index}/id"
    POLICIES_DISPLAY_NAME = "/policies/{index}/displayName"
    OWNER = "/owner"
    PARENT = "/parent"
    REFERENCES = "/references/{index}"
    RELATED_TERMS = "/relatedTerms/{index}"
    REVIEWERS = "/reviewers/{index}"
    ROLES = "/roles/{role_id}"
    RULES = "/rules/{rule_index}"
    RULES_CONDITION = "/rules/{rule_index}/condition"
    RULES_DESCRIPTION = "/rules/{rule_index}/description"
    RULES_EFFECT = "/rules/{rule_index}/effect"
    RULES_FQN = "/rules/{rule_index}/fullyQualifiedName"
    RULES_NAME = "/rules/{rule_index}/name"
    RULES_OPERATIONS = "/rules/{rule_index}/operations/{index}"
    RULES_RESOURCES = "/rules/{rule_index}/resources/{index}"
    SYNONYMS = "/synonyms/{index}"
    TABLE_CONSTRAINTS = "/tableConstraints"
    TAGS = "/tags/{tag_index}"
    RESPONSE = "/response"
    STATUS = "/status"


class PatchValue(str, Enum):
    """
    JSON PATCH value field names
    """

    ID = "id"
    COLUMNS = "columns"
    CONDITION = "condition"
    CONSTRAINT_TYPE = "constraintType"
    DESCRIPTION = "description"
    DISPLAY_NAME = "displayName"
    EFFECT = "effect"
    ENDPOINT = "endpoint"
    FQN = "fullyQualifiedName"
    GLOSSARY_TERM = "glossaryTerm"
    LABEL_TYPE = "labelType"
    NAME = "name"
    OPERATIONS = "operations"
    POLICY = "policy"
    REFERRED_COLUMNS = "referredColumns"
    RESOURCES = "resources"
    SOURCE = "source"
    STATE = "state"
    TAG_FQN = "tagFQN"
    TYPE = "type"
    USER = "user"


class OMetaPatchMixinBase(Generic[T]):
    """
    OpenMetadata API methods related to Glossaries.

    To be inherited by OpenMetadata
    """

    def _fetch_entity_if_exists(
        self,
        entity: Type[T],
        entity_id: Union[str, basic.Uuid],
        fields: Optional[List[str]] = None,
    ) -> Optional[T]:
        """
        Validates if we can update a description or not. Will return
        the instance if it can be updated. None otherwise.

        Args
            entity (T): Entity Type
            entity_id: ID
            fields: extra fields to fetch from API
        Returns
            instance to update
        """

        instance = self.get_by_id(entity=entity, entity_id=entity_id, fields=fields)

        if not instance:
            return None

        return instance
