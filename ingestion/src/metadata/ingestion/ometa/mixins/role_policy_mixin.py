#  Copyright 2023 Schlameel
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
Mixin class containing Role and Policy specific methods

To be used by OpenMetadata class
"""
import json
import traceback
from typing import Dict, Generic, List, Optional, Type, TypeVar, Union

from pydantic import BaseModel

from metadata.generated.schema.entity.policies.accessControl.rule import Rule
from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.type import basic
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

T = TypeVar("T", bound=BaseModel)

OPERATION = "op"
PATH = "path"
VALUE = "value"
VALUE_ID = "id"
VALUE_TYPE = "type"
VALUE_POLICY = "policy"
VALUE_CONDITION: str = "condition"
VALUE_DESCRIPTION: str = "description"
VALUE_EFFECT: str = "effect"
VALUE_FQN: str = "fullyQualifiedName"
VALUE_NAME: str = "name"
VALUE_OPERATIONS: str = "operations"
VALUE_RESOURCES: str = "resources"

# Operations
ADD = "add"
REPLACE = "replace"
REMOVE = "remove"

# Paths
ROLES_PATH: str = "/roles/{role_id}"
POLICIES_PATH: str = "/policies/{index}"
POLICIES_HREF_PATH: str = "/policies/{index}/href"
POLICIES_DESCRIPTION_PATH: str = "/policies/{index}/description"
POLICIES_FQN_PATH: str = "/policies/{index}/fullyQualifiedName"
POLICIES_NAME_PATH: str = "/policies/{index}/name"
POLICIES_ID_PATH: str = "/policies/{index}/id"
POLICIES_DISPLAY_NAME_PATH: str = "/policies/{index}/displayName"
DESCRIPTION_PATH: str = "/description"
RULES_PATH: str = "/rules/{rule_index}"
RULES_CONDITION_PATH: str = "/rules/{rule_index}/condition"
RULES_DESCRIPTION_PATH: str = "/rules/{rule_index}/description"
RULES_EFFECT_PATH: str = "/rules/{rule_index}/effect"
RULES_FQN_PATH: str = "/rules/{rule_index}/fullyQualifiedName"
RULES_NAME_PATH: str = "/rules/{rule_index}/name"
RULES_OPERATIONS_PATH: str = "/rules/{rule_index}/operations/{index}"
RULES_RESOURCES_PATH: str = "/rules/{rule_index}/resources/{index}"


class OMetaRolePolicyMixin(Generic[T]):
    """
    OpenMetadata API methods related to Roles and Policies.

    To be inherited by OpenMetadata
    """

    client: REST

    def _validate_instance_description(
        self, entity: Type[T], entity_id: Union[str, basic.Uuid]
    ) -> Optional[T]:
        """
        Validates if we can update a description or not. Will return
        the instance if it can be updated. None otherwise.

        Args
            entity (T): Entity Type
            entity_id: ID
            description: new description to add
            force: if True, we will patch any existing description. Otherwise, we will maintain
                the existing data.
        Returns
            instance to update
        """

        instance = self.get_by_id(entity=entity, entity_id=entity_id, fields=["*"])

        if not instance:
            logger.warning(
                f"Cannot find an instance of '{entity.__class__.__name__}' with id [{str(entity_id)}]."
            )
            return None

        return instance

    @staticmethod
    def _get_rule_merge_patches(
        previous: List,
        current: List,
        rule_index: int,
        path: str,
        is_enum: bool,
    ) -> List[Dict]:
        """
        Get the operations required to overwrite the set (resources or operations) of a rule.
        :param previous: the previous set to be overwritten by current
        :param current: the current set to overwrite previous
        :param rule_index: the index of the rule on which we are being operated
        :param path: the formattable string that names the path
        :param is_enum: is the set enums or not
        :return: List of patch operations
        """
        data: List[Dict] = []
        for index in range(len(previous) - 1, len(current) - 1, -1):
            data.append(
                {
                    OPERATION: REMOVE,
                    PATH: path.format(rule_index=rule_index - 1, index=index),
                }
            )
        index: int = 0
        for item in current:
            data.append(
                {
                    OPERATION: REPLACE if index < len(previous) else ADD,
                    PATH: path.format(rule_index=rule_index - 1, index=index),
                    VALUE: item.name if is_enum else item,
                }
            )
            index += 1
        return data

    @staticmethod
    def _get_optional_rule_patch(
        previous: Union[basic.FullyQualifiedEntityName, basic.Markdown],
        current: Union[basic.FullyQualifiedEntityName, basic.Markdown],
        rule_index: int,
        path: str,
    ) -> List[Dict]:
        """
        Get the operations required to update an optional rule field
        :param previous: the field from the previous rule
        :param current: the field from the current rule
        :param rule_index: the index of the previous rule
        :param path: path string for the filed
        :return: list with one dict describing the operation to update the field
        """
        data: List[Dict] = []
        if current is None:
            if previous is not None:
                data = [
                    {
                        OPERATION: REMOVE,
                        PATH: path.format(rule_index=rule_index),
                    }
                ]
        else:
            data = [
                {
                    OPERATION: ADD if previous is None else REPLACE,
                    PATH: path.format(rule_index=rule_index),
                    VALUE: str(current.__root__),
                }
            ]
        return data

    def patch_role_policy(
        self,
        entity_id: Union[str, basic.Uuid],
        policy_id: Union[str, basic.Uuid],
        operation: Union[ADD, REMOVE] = ADD,
    ) -> Optional[Role]:
        """
        Given a Role ID, JSON PATCH the policies.

        Args
            entity_id: ID of the role to be patched
            policy_id: ID of the policy to be added or removed
            operation: Operation to be performed. Either 'add' or 'remove'
        Returns
            Updated Entity
        """
        instance: Role = self._validate_instance_description(
            entity=Role, entity_id=entity_id
        )
        if not instance:
            return None

        policy_index: int = len(instance.policies.__root__) - 1
        data: List
        if operation is REMOVE:
            if len(instance.policies.__root__) == 1:
                logger.error(
                    f"The Role with id [{model_str(entity_id)}] has only one (1)"
                    f" policy. Unable to remove."
                )
                return None

            data = [{OPERATION: REMOVE, PATH: POLICIES_PATH.format(index=policy_index)}]

            index: int = 0
            is_policy_found: bool = False
            for policy in instance.policies.__root__:
                if model_str(policy.id) == model_str(policy_id):
                    is_policy_found = True
                    continue
                data.append(
                    {
                        OPERATION: REPLACE,
                        PATH: POLICIES_DESCRIPTION_PATH.format(index=index),
                        VALUE: model_str(policy.description.__root__),
                    }
                )
                data.append(
                    {
                        OPERATION: REPLACE if policy.displayName else ADD,
                        PATH: POLICIES_DISPLAY_NAME_PATH.format(index=index),
                        VALUE: model_str(
                            policy.displayName if policy.displayName else policy.name
                        ),
                    }
                )
                data.append(
                    {
                        OPERATION: REPLACE,
                        PATH: POLICIES_FQN_PATH.format(index=index),
                        VALUE: model_str(policy.fullyQualifiedName),
                    }
                )
                data.append(
                    {
                        OPERATION: REPLACE,
                        PATH: POLICIES_HREF_PATH.format(index=index),
                        VALUE: model_str(policy.href),
                    }
                )
                data.append(
                    {
                        OPERATION: REPLACE,
                        PATH: POLICIES_ID_PATH.format(index=index),
                        VALUE: model_str(policy.id),
                    }
                )
                data.append(
                    {
                        OPERATION: REPLACE,
                        PATH: POLICIES_NAME_PATH.format(index=index),
                        VALUE: model_str(policy.name),
                    }
                )
                index += 1

            if not is_policy_found:
                logger.error(
                    f"Policy [{model_str(policy_id)}] not found for Role [{model_str(entity_id)}]."
                    " No policies removed."
                )
                return None
        else:
            data = [
                {
                    OPERATION: operation,
                    PATH: POLICIES_PATH.format(index=policy_index),
                    VALUE: {
                        VALUE_ID: model_str(policy_id),
                        VALUE_TYPE: VALUE_POLICY,
                    },
                }
            ]

        try:
            res = self.client.patch(
                path=ROLES_PATH.format(role_id=model_str(entity_id)),
                data=json.dumps(data),
            )
            return Role(**res)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error trying to PATCH policies for Role [{model_str(entity_id)}]: {exc}"
            )

        return None

    def patch_policy_rule(
        self,
        entity_id: Union[str, basic.Uuid],
        rule: Optional[Rule] = None,
        operation: Union[ADD, REMOVE] = ADD,
    ) -> Optional[Policy]:
        """
        Given a Policy ID, JSON PATCH the rule (add or remove).

        Args
            entity_id: ID of the role to be patched
            rule: The rule to add or remove
            operation: The operation to perform, either "add" or "remove"
        Returns
            Updated Entity
        """
        instance: Policy = self._validate_instance_description(
            entity=Policy, entity_id=entity_id
        )
        if not instance:
            return None

        rule_index: int = len(instance.rules.__root__) - 1
        data: List[Dict]
        if operation == ADD:
            data = [
                {
                    OPERATION: ADD,
                    PATH: RULES_PATH.format(rule_index=rule_index + 1),
                    VALUE: {
                        VALUE_NAME: rule.name,
                        VALUE_CONDITION: rule.condition.__root__,
                        VALUE_EFFECT: rule.effect.name,
                        VALUE_OPERATIONS: [
                            operation.name for operation in rule.operations
                        ],
                        VALUE_RESOURCES: list(rule.resources),
                    },
                }
            ]
            if rule.description is not None:
                data[0][VALUE][VALUE_DESCRIPTION] = str(rule.description.__root__)

            if rule.fullyQualifiedName is not None:
                data[0][VALUE][VALUE_FQN] = str(rule.fullyQualifiedName.__root__)

        else:
            if rule_index == 0:
                logger.error(f"Unable to remove only rule from Policy [{entity_id}].")
                return None

            data = [
                {
                    OPERATION: REMOVE,
                    PATH: RULES_PATH.format(rule_index=rule_index),
                }
            ]

            for rule_index in range(len(instance.rules.__root__) - 1, -1, -1):
                current_rule: Rule = instance.rules.__root__[rule_index]
                if current_rule.name == rule.name:
                    break

                if rule_index == 0:
                    logger.error(
                        f"Rule [{rule.name}] not found in Policy [{entity_id}]. Unable to remove rule."
                    )
                    return None

                previous_rule: Rule = instance.rules.__root__[rule_index - 1]
                # Condition
                data.append(
                    {
                        OPERATION: REPLACE,
                        PATH: RULES_CONDITION_PATH.format(rule_index=rule_index - 1),
                        VALUE: current_rule.condition.__root__,
                    }
                )
                # Description - Optional
                data += OMetaRolePolicyMixin._get_optional_rule_patch(
                    previous=previous_rule.description,
                    current=current_rule.description,
                    rule_index=rule_index - 1,
                    path=RULES_DESCRIPTION_PATH,
                )

                # Effect
                data.append(
                    {
                        OPERATION: REPLACE,
                        PATH: RULES_EFFECT_PATH.format(rule_index=rule_index - 1),
                        VALUE: current_rule.effect.name,
                    }
                )

                # Fully qualified name - Optional
                data += OMetaRolePolicyMixin._get_optional_rule_patch(
                    previous=previous_rule.fullyQualifiedName,
                    current=current_rule.fullyQualifiedName,
                    rule_index=rule_index - 1,
                    path=RULES_FQN_PATH,
                )

                # Name
                data.append(
                    {
                        OPERATION: REPLACE,
                        PATH: RULES_NAME_PATH.format(rule_index=rule_index - 1),
                        VALUE: current_rule.name,
                    }
                )
                # Operations
                data += OMetaRolePolicyMixin._get_rule_merge_patches(
                    previous=previous_rule.operations,
                    current=current_rule.operations,
                    rule_index=rule_index,
                    path=RULES_OPERATIONS_PATH,
                    is_enum=True,
                )
                # Resources
                data += OMetaRolePolicyMixin._get_rule_merge_patches(
                    previous=previous_rule.resources,
                    current=current_rule.resources,
                    rule_index=rule_index,
                    path=RULES_RESOURCES_PATH,
                    is_enum=False,
                )

        try:
            res = self.client.patch(
                path=POLICIES_PATH.format(index=model_str(entity_id)),
                data=json.dumps(data),
            )
            return Policy(**res)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error trying to PATCH description for Role [{model_str(entity_id)}]: {exc}"
            )

        return None
