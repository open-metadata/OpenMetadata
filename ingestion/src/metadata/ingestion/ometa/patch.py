#  Copyright 2021 Schlameel
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
Helper definitions for JSON PATCH field names and values
"""

from enum import Enum


class PatchField(str, Enum):
    """
    JSON PATCH field names
    """

    OPERATION = "op"
    PATH = "path"
    VALUE = "value"


class PatchValue(str, Enum):
    """
    JSON PATCH value field names
    """

    ID = "id"
    CONDITION = "condition"
    DESCRIPTION = "description"
    EFFECT = "effect"
    FQN = "fullyQualifiedName"
    LABEL_TYPE = "labelType"
    NAME = "name"
    OPERATIONS = "operations"
    POLICY = "policy"
    RESOURCES = "resources"
    SOURCE = "source"
    STATE = "state"
    TAG_FQN = "tagFQN"
    TYPE = "type"


class PatchPath(str, Enum):
    """
    JSON PATCH path strings
    """

    COLUMNS_DESCRIPTION = "/columns/{index}/description"
    COLUMNS_TAGS = "/columns/{index}/tags/{tag_index}"
    DESCRIPTION = "/description"
    POLICIES = "/policies/{index}"
    POLICIES_HREF = "/policies/{index}/href"
    POLICIES_DESCRIPTION = "/policies/{index}/description"
    POLICIES_FQN = "/policies/{index}/fullyQualifiedName"
    POLICIES_NAME = "/policies/{index}/name"
    POLICIES_ID = "/policies/{index}/id"
    POLICIES_DISPLAY_NAME = "/policies/{index}/displayName"
    OWNER = "/owner"
    ROLES = "/roles/{role_id}"
    RULES = "/rules/{rule_index}"
    RULES_CONDITION = "/rules/{rule_index}/condition"
    RULES_DESCRIPTION = "/rules/{rule_index}/description"
    RULES_EFFECT = "/rules/{rule_index}/effect"
    RULES_FQN = "/rules/{rule_index}/fullyQualifiedName"
    RULES_NAME = "/rules/{rule_index}/name"
    RULES_OPERATIONS = "/rules/{rule_index}/operations/{index}"
    RULES_RESOURCES = "/rules/{rule_index}/resources/{index}"
    TAGS = "/tags/{tag_index}"


# Operations
class PatchOperation(str, Enum):
    """
    JSON PATCH operation strings
    """

    ADD = "add"
    REPLACE = "replace"
    REMOVE = "remove"
