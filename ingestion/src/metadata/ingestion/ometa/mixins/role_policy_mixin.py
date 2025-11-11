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
Mixin class containing Role and Policy specific methods

To be used by OpenMetadata class
"""
import json
import traceback
from typing import Dict, List, Optional, Union

from metadata.generated.schema.entity.policies.accessControl.rule import Rule
from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.type import basic
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.mixins.patch_mixin_utils import (
    OMetaPatchMixinBase,
    PatchField,
    PatchOperation,
    PatchPath,
    PatchValue,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.deprecation import deprecated
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaRolePolicyMixin(OMetaPatchMixinBase):
    """
    OpenMetadata API methods related to Roles and Policies.

    To be inherited by OpenMetadata
    """

    client: REST

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

        Args
            previous: the previous set to be overwritten by current
            current: the current set to overwrite previous
            rule_index: the index of the rule on which we are being operated
            path: the formattable string that names the path
            is_enum: is the set enums or not
        Returns
            List of patch operations
        """
        data: List[Dict] = []
        for index in range(len(previous) - 1, len(current) - 1, -1):
            data.append(
                {
                    PatchField.OPERATION: PatchOperation.REMOVE,
                    PatchField.PATH: path.format(
                        rule_index=rule_index - 1, index=index
                    ),
                }
            )
        index: int = 0
        for item in current:
            data.append(
                {
                    PatchField.OPERATION: PatchOperation.REPLACE
                    if index < len(previous)
                    else PatchOperation.ADD,
                    PatchField.PATH: path.format(
                        rule_index=rule_index - 1, index=index
                    ),
                    PatchField.VALUE: item.name if is_enum else item,
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

        Args
            previous: the field from the previous rule
            current: the field from the current rule
            rule_index: the index of the previous rule
            path: path string for the filed
        Returns
            list with one dict describing the operation to update the field
        """
        data: List[Dict] = []
        if current is None:
            if previous is not None:
                data = [
                    {
                        PatchField.OPERATION: PatchOperation.REMOVE,
                        PatchField.PATH: path.format(rule_index=rule_index),
                    }
                ]
        else:
            data = [
                {
                    PatchField.OPERATION: PatchOperation.ADD
                    if previous is None
                    else PatchOperation.REPLACE,
                    PatchField.PATH: path.format(rule_index=rule_index),
                    PatchField.VALUE: str(current.root),
                }
            ]
        return data

    @deprecated(
        message="Use metadata.patch instead as the new standard method that will create the jsonpatch dynamically",
        release="1.3",
    )
    def patch_role_policy(
        self,
        entity_id: Union[str, basic.Uuid],
        policy_id: Union[str, basic.Uuid],
        operation: Union[
            PatchOperation.ADD, PatchOperation.REMOVE
        ] = PatchOperation.ADD,
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
        instance: Role = self._fetch_entity_if_exists(
            entity=Role, entity_id=entity_id, fields=["policies"]
        )
        if not instance:
            return None

        policy_index: int = len(instance.policies.root) - 1
        data: List
        if operation is PatchOperation.REMOVE:
            if len(instance.policies.root) == 1:
                logger.error(
                    f"The Role with id [{model_str(entity_id)}] has only one (1)"
                    f" policy. Unable to remove."
                )
                return None

            data = [
                {
                    PatchField.OPERATION: PatchOperation.REMOVE,
                    PatchField.PATH: PatchPath.POLICIES.format(index=policy_index),
                }
            ]

            index: int = 0
            is_policy_found: bool = False
            for policy in instance.policies.root:
                if model_str(policy.id) == model_str(policy_id):
                    is_policy_found = True
                    continue
                data.append(
                    {
                        PatchField.OPERATION: PatchOperation.REPLACE,
                        PatchField.PATH: PatchPath.POLICIES_DESCRIPTION.format(
                            index=index
                        ),
                        PatchField.VALUE: model_str(policy.description.root),
                    }
                )
                data.append(
                    {
                        PatchField.OPERATION: PatchOperation.REPLACE
                        if policy.displayName
                        else PatchOperation.ADD,
                        PatchField.PATH: PatchPath.POLICIES_DISPLAY_NAME.format(
                            index=index
                        ),
                        PatchField.VALUE: model_str(
                            policy.displayName if policy.displayName else policy.name
                        ),
                    }
                )
                data.append(
                    {
                        PatchField.OPERATION: PatchOperation.REPLACE,
                        PatchField.PATH: PatchPath.POLICIES_FQN.format(index=index),
                        PatchField.VALUE: model_str(policy.fullyQualifiedName),
                    }
                )
                data.append(
                    {
                        PatchField.OPERATION: PatchOperation.REPLACE,
                        PatchField.PATH: PatchPath.POLICIES_HREF.format(index=index),
                        PatchField.VALUE: model_str(policy.href),
                    }
                )
                data.append(
                    {
                        PatchField.OPERATION: PatchOperation.REPLACE,
                        PatchField.PATH: PatchPath.POLICIES_ID.format(index=index),
                        PatchField.VALUE: model_str(policy.id),
                    }
                )
                data.append(
                    {
                        PatchField.OPERATION: PatchOperation.REPLACE,
                        PatchField.PATH: PatchPath.POLICIES_NAME.format(index=index),
                        PatchField.VALUE: model_str(policy.name),
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
                    PatchField.OPERATION: operation,
                    PatchField.PATH: PatchPath.POLICIES.format(index=policy_index),
                    PatchField.VALUE: {
                        PatchValue.ID: model_str(policy_id),
                        PatchValue.TYPE: PatchValue.POLICY,
                    },
                }
            ]

        try:
            res = self.client.patch(
                path=PatchPath.ROLES.format(role_id=model_str(entity_id)),
                data=json.dumps(data),
            )
            return Role(**res)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error trying to PATCH policies for Role [{model_str(entity_id)}]: {exc}"
            )

        return None

    @deprecated(
        message="Use metadata.patch instead as the new standard method that will create the jsonpatch dynamically",
        release="1.3",
    )
    def patch_policy_rule(
        self,
        entity_id: Union[str, basic.Uuid],
        rule: Optional[Rule] = None,
        operation: Union[
            PatchOperation.ADD, PatchOperation.REMOVE
        ] = PatchOperation.ADD,
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
        instance: Policy = self._fetch_entity_if_exists(
            entity=Policy, entity_id=entity_id
        )
        if not instance:
            return None

        rule_index: int = len(instance.rules.root) - 1
        data: List[Dict]
        if operation == PatchOperation.ADD:
            data = [
                {
                    PatchField.OPERATION: PatchOperation.ADD,
                    PatchField.PATH: PatchPath.RULES.format(rule_index=rule_index + 1),
                    PatchField.VALUE: {
                        PatchValue.NAME: rule.name,
                        PatchValue.CONDITION: rule.condition.root,
                        PatchValue.EFFECT: rule.effect.name,
                        PatchValue.OPERATIONS: [
                            operation.name for operation in rule.operations
                        ],
                        PatchValue.RESOURCES: list(rule.resources),
                    },
                }
            ]
            if rule.description is not None:
                data[0][PatchField.VALUE][PatchValue.DESCRIPTION] = str(
                    rule.description.root
                )

            if rule.fullyQualifiedName is not None:
                data[0][PatchField.VALUE][PatchValue.FQN] = str(
                    rule.fullyQualifiedName.root
                )

        else:
            if rule_index == 0:
                logger.error(f"Unable to remove only rule from Policy [{entity_id}].")
                return None

            data = [
                {
                    PatchField.OPERATION: PatchOperation.REMOVE,
                    PatchField.PATH: PatchPath.RULES.format(rule_index=rule_index),
                }
            ]

            for rule_index in range(len(instance.rules.root) - 1, -1, -1):
                current_rule: Rule = instance.rules.root[rule_index]
                if current_rule.name == rule.name:
                    break

                if rule_index == 0:
                    logger.error(
                        f"Rule [{rule.name}] not found in Policy [{entity_id}]. Unable to remove rule."
                    )
                    return None

                previous_rule: Rule = instance.rules.root[rule_index - 1]
                # Condition
                data.append(
                    {
                        PatchField.OPERATION: PatchOperation.REPLACE,
                        PatchField.PATH: PatchPath.RULES_CONDITION.format(
                            rule_index=rule_index - 1
                        ),
                        PatchField.VALUE: current_rule.condition.root,
                    }
                )
                # Description - Optional
                data += OMetaRolePolicyMixin._get_optional_rule_patch(
                    previous=previous_rule.description,
                    current=current_rule.description,
                    rule_index=rule_index - 1,
                    path=PatchPath.RULES_DESCRIPTION,
                )

                # Effect
                data.append(
                    {
                        PatchField.OPERATION: PatchOperation.REPLACE,
                        PatchField.PATH: PatchPath.RULES_EFFECT.format(
                            rule_index=rule_index - 1
                        ),
                        PatchField.VALUE: current_rule.effect.name,
                    }
                )

                # Fully qualified name - Optional
                data += OMetaRolePolicyMixin._get_optional_rule_patch(
                    previous=previous_rule.fullyQualifiedName,
                    current=current_rule.fullyQualifiedName,
                    rule_index=rule_index - 1,
                    path=PatchPath.RULES_FQN,
                )

                # Name
                data.append(
                    {
                        PatchField.OPERATION: PatchOperation.REPLACE,
                        PatchField.PATH: PatchPath.RULES_NAME.format(
                            rule_index=rule_index - 1
                        ),
                        PatchField.VALUE: current_rule.name,
                    }
                )
                # Operations
                data += OMetaRolePolicyMixin._get_rule_merge_patches(
                    previous=previous_rule.operations,
                    current=current_rule.operations,
                    rule_index=rule_index,
                    path=PatchPath.RULES_OPERATIONS,
                    is_enum=True,
                )
                # Resources
                data += OMetaRolePolicyMixin._get_rule_merge_patches(
                    previous=previous_rule.resources,
                    current=current_rule.resources,
                    rule_index=rule_index,
                    path=PatchPath.RULES_RESOURCES,
                    is_enum=False,
                )

        try:
            res = self.client.patch(
                path=PatchPath.POLICIES.format(index=model_str(entity_id)),
                data=json.dumps(data),
            )
            return Policy(**res)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error trying to PATCH description for Role [{model_str(entity_id)}]: {exc}"
            )

        return None
