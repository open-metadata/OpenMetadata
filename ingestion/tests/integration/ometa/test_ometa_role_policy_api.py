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
OpenMetadata high-level API Policy test
"""
import uuid
from copy import deepcopy
from typing import List
from unittest import TestCase

from metadata.generated.schema.api.policies.createPolicy import CreatePolicyRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.policies.accessControl.resourceDescriptor import (
    Operation,
)
from metadata.generated.schema.entity.policies.accessControl.rule import Effect, Rule
from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.mixins.patch_mixin_utils import PatchOperation
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str

# Conditions
CONDITION_IS_OWNER: str = "isOwner()"
CONDITION_IS_NOT_OWNER: str = "!isOwner"
CONDITION_NO_OWNER_IS_OWNER: str = "noOwner() || isOwner()"

# Resources
RESOURCE_BOT: str = "Bot"
RESOURCE_PIPELINE: str = "Pipeline"
RESOURCE_TABLE: str = "Table"

ROLE_FIELDS: List[str] = ["policies", "teams", "users"]


class OMetaRolePolicyTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None
    policy_entity: Policy = None
    role_entity: Role = None
    create_policy: CreatePolicyRequest = None
    create_role: CreateRoleRequest = None
    role_policy_1: Policy = None
    role_policy_2: Policy = None
    rule_1: Rule = None
    rule_2: Rule = None
    rule_3: Rule = None

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.rule_1: Rule = Rule(
            name="rule-1",
            description="Description of rule-1",
            resources=[
                RESOURCE_TABLE,
            ],
            operations=[
                Operation.EditAll,
                Operation.ViewAll,
            ],
            effect=Effect.allow,
            condition=CONDITION_IS_OWNER,
        )

        cls.rule_2: Rule = Rule(
            name="rule-2",
            description="Description of rule-2",
            fullyQualifiedName="test-policy-1.rule-2",
            resources=[
                RESOURCE_BOT,
                RESOURCE_PIPELINE,
                RESOURCE_TABLE,
            ],
            operations=[
                Operation.EditCustomFields,
            ],
            effect=Effect.deny,
            condition=CONDITION_NO_OWNER_IS_OWNER,
        )

        cls.rule_3: Rule = Rule(
            name="rule-3",
            fullyQualifiedName="test-policy-1.rule-3",
            resources=[
                RESOURCE_TABLE,
            ],
            operations=[
                Operation.EditAll,
                Operation.ViewAll,
            ],
            effect=Effect.allow,
            condition=CONDITION_IS_OWNER,
        )

        cls.policy_entity = Policy(
            id=uuid.uuid4(),
            name="test-policy-1",
            fullyQualifiedName="test-policy-1",
            description="Description of test policy 1",
            rules=[
                cls.rule_1,
                cls.rule_2,
            ],
        )

        cls.create_policy = CreatePolicyRequest(
            name="test-policy-1",
            description="Description of test policy 1",
            rules=[
                cls.rule_1,
                cls.rule_2,
            ],
        )

        cls.role_policy_1 = cls.metadata.create_or_update(
            CreatePolicyRequest(
                name="test-role-policy-1",
                description="Description of test role policy 1",
                rules=[
                    cls.rule_1,
                    cls.rule_2,
                ],
            )
        )

        cls.role_policy_2 = cls.metadata.create_or_update(
            data=CreatePolicyRequest(
                name="test-role-policy-2",
                description="Description of test role policy 2",
                rules=[
                    cls.rule_1,
                ],
            )
        )

        cls.role_entity = Role(
            id=uuid.uuid4(),
            name="test-role",
            fullyQualifiedName="test-role",
            policies=[
                EntityReference(id=model_str(cls.role_policy_1.id), type="policy"),
            ],
        )

        cls.create_role = CreateRoleRequest(
            name="test-role",
            policies=[
                cls.role_policy_1.name,
            ],
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        policies = cls.metadata.list_entities(entity=Policy)
        for policy in policies.entities:
            if model_str(policy.name).startswith(model_str(cls.policy_entity.name)):
                cls.metadata.delete(entity=Policy, entity_id=model_str(policy.id))

        cls.metadata.delete(entity=Policy, entity_id=model_str(cls.role_policy_1.id))
        cls.metadata.delete(entity=Policy, entity_id=model_str(cls.role_policy_2.id))

        roles = cls.metadata.list_entities(entity=Role)
        for role in roles.entities:
            if model_str(role.name.__root__).startswith(
                model_str(cls.role_entity.name.__root__)
            ):
                cls.metadata.delete(entity=Role, entity_id=model_str(role.id))

    def test_policy_create(self):
        """
        We can create a Policy and we receive it back as Entity
        """

        res: Policy = self.metadata.create_or_update(data=self.create_policy)

        self.assertEqual(res.name, self.policy_entity.name)
        self.assertEqual(res.rules.__root__[0].name, self.rule_1.name)

    def test_policy_update(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.create_policy)

        updated = self.create_policy.dict(exclude_unset=True)
        updated["rules"] = [self.rule_3]
        updated_policy_entity = CreatePolicyRequest(**updated)

        res = self.metadata.create_or_update(data=updated_policy_entity)

        # Same ID, updated owner
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.rules.__root__[0].name, self.rule_3.name)

    def test_policy_get_name(self):
        """
        We can fetch a Policy by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create_policy)

        res = self.metadata.get_by_name(
            entity=Policy, fqn=model_str(self.policy_entity.fullyQualifiedName)
        )
        self.assertEqual(res.name, self.policy_entity.name)

    def test_policy_get_id(self):
        """
        We can fetch a Policy by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create_policy)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=Policy, fqn=model_str(self.policy_entity.fullyQualifiedName)
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=Policy, entity_id=model_str(res_name.id))

        self.assertEqual(res_name.id, res.id)

    def test_policy_list(self):
        """
        We can list all our Policies
        """

        self.metadata.create_or_update(data=self.create_policy)

        res = self.metadata.list_entities(entity=Policy)

        # Fetch our test Database. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.policy_entity.name),
            None,
        )
        assert data

    def test_policy_list_all(self):
        """
        Validate generator utility to fetch all Policies
        """
        fake_create = deepcopy(self.create_policy)
        for i in range(0, 10):
            fake_create.name = model_str(self.create_policy.name) + str(i)
            self.metadata.create_or_update(data=fake_create)

        all_entities = self.metadata.list_all_entities(
            entity=Policy, limit=2  # paginate in batches of pairs
        )
        assert (
            len(list(all_entities)) >= 10
        )  # In case the default testing entity is not present

    def test_policy_delete(self):
        """
        We can delete a Policy by ID
        """

        self.metadata.create_or_update(data=self.create_policy)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Policy, fqn=model_str(self.policy_entity.fullyQualifiedName)
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(entity=Policy, entity_id=res_name.id)

        # Delete
        self.metadata.delete(entity=Policy, entity_id=model_str(res_id.id))

        # Then we should not find it
        res = self.metadata.list_entities(entity=Policy)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == self.policy_entity.fullyQualifiedName
            ),
            None,
        )

    def test_policy_list_versions(self):
        """
        test list policy entity versions
        """
        self.metadata.create_or_update(data=self.create_policy)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Policy, fqn=model_str(self.policy_entity.fullyQualifiedName)
        )

        res = self.metadata.get_list_entity_versions(
            entity=Policy, entity_id=model_str(res_name.id)
        )
        assert res

    def test_policy_get_entity_version(self):
        """
        test get policy entity version
        """
        self.metadata.create_or_update(data=self.create_policy)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Policy, fqn=model_str(self.policy_entity.fullyQualifiedName)
        )
        res = self.metadata.get_entity_version(
            entity=Policy, entity_id=model_str(res_name.id), version=0.1
        )

        # check we get the correct version requested and the correct entity ID
        assert res.version.__root__ == 0.1
        assert res.id == res_name.id

    def test_policy_get_entity_ref(self):
        """
        test get EntityReference
        """
        res = self.metadata.create_or_update(data=self.create_policy)
        entity_ref = self.metadata.get_entity_reference(
            entity=Policy, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id

    def test_policy_patch_rule(self):
        """
        test PATCHing the rules of a policy
        """
        policy: Policy = self.metadata.create_or_update(self.create_policy)

        # Add rule
        res: Policy = self.metadata.patch_policy_rule(
            entity_id=policy.id,
            rule=self.rule_3,
            operation=PatchOperation.ADD,
        )
        self.assertIsNotNone(res)
        self.assertEqual(len(res.rules.__root__), 3)
        self.assertEqual(res.rules.__root__[2].name, self.rule_3.name)

        # Remove last rule
        res = self.metadata.patch_policy_rule(
            entity_id=policy.id,
            rule=self.rule_3,
            operation=PatchOperation.REMOVE,
        )
        self.assertIsNotNone(res)
        self.assertEqual(len(res.rules.__root__), 2)
        self.assertEqual(res.rules.__root__[1].name, self.rule_2.name)

        # Remove rule with fewer operations
        self.metadata.patch_policy_rule(
            entity_id=policy.id,
            rule=self.rule_3,
            operation=PatchOperation.ADD,
        )

        res = self.metadata.patch_policy_rule(
            entity_id=policy.id,
            rule=self.rule_2,
            operation=PatchOperation.REMOVE,
        )
        self.assertIsNotNone(res)
        self.assertEqual(len(res.rules.__root__), 2)
        self.assertEqual(res.rules.__root__[1].name, self.rule_3.name)
        self.assertEqual(
            len(res.rules.__root__[1].operations), len(self.rule_3.operations)
        )
        self.assertIsNone(res.rules.__root__[1].description)

        # Remove rule with more operations
        policy = self.metadata.create_or_update(self.create_policy)
        res = self.metadata.patch_policy_rule(
            entity_id=policy.id,
            rule=self.rule_1,
            operation=PatchOperation.REMOVE,
        )
        self.assertIsNotNone(res)
        self.assertEqual(len(res.rules.__root__), 1)
        self.assertEqual(res.rules.__root__[0].name, self.rule_2.name)
        self.assertEqual(
            len(res.rules.__root__[0].operations), len(self.rule_2.operations)
        )
        self.assertEqual(
            res.rules.__root__[0].fullyQualifiedName, self.rule_2.fullyQualifiedName
        )

        # Try to remove the only rule - Fails
        res = self.metadata.patch_policy_rule(
            entity_id=policy.id,
            rule=self.rule_2,
            operation=PatchOperation.REMOVE,
        )
        self.assertIsNone(res)

        # Try to remove a nonexistent rule - Fails
        policy = self.metadata.create_or_update(self.create_policy)
        res = self.metadata.patch_policy_rule(
            entity_id=policy.id,
            rule=self.rule_3,
            operation=PatchOperation.REMOVE,
        )
        self.assertIsNone(res)

        # Try to patch a nonexistent policy - Fails
        res = self.metadata.patch_policy_rule(
            entity_id=str(uuid.uuid4()),
            rule=self.rule_3,
            operation=PatchOperation.ADD,
        )

    def test_role_create(self):
        """
        We can create a Role and we receive it back as Entity
        """

        res = self.metadata.create_or_update(data=self.create_role)

        self.assertEqual(res.name, self.role_entity.name)
        self.assertEqual(
            res.policies.__root__[0].name, model_str(self.role_policy_1.name)
        )

    def test_role_update(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.create_role)

        updated = self.create_role.dict(exclude_unset=True)
        updated["policies"] = [self.role_policy_2.name]
        updated_entity = CreateRoleRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated owner
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(
            res.policies.__root__[0].name, model_str(self.role_policy_2.name)
        )

    def test_role_get_name(self):
        """
        We can fetch a Role by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create_role)

        res = self.metadata.get_by_name(
            entity=Role, fqn=self.role_entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.role_entity.name)

    def test_role_get_id(self):
        """
        We can fetch a Role by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create_role)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=Role, fqn=self.role_entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=Role, entity_id=model_str(res_name.id))

        self.assertEqual(res_name.id, res.id)

    def test_role_list(self):
        """
        We can list all our Roles
        """

        self.metadata.create_or_update(data=self.create_role)

        res = self.metadata.list_entities(entity=Role)

        # Fetch our test Database. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.role_entity.name), None
        )
        assert data

    def test_role_list_all(self):
        """
        Validate generator utility to fetch all roles
        """
        fake_create = deepcopy(self.create_role)
        for i in range(0, 10):
            fake_create.name = f"{model_str(self.create_role.name.__root__)}-{str(i)}"
            self.metadata.create_or_update(data=fake_create)

        all_entities = self.metadata.list_all_entities(
            entity=Role, limit=2  # paginate in batches of pairs
        )
        assert (
            len(list(all_entities)) >= 10
        )  # In case the default testing entity is not present

    def test_role_delete(self):
        """
        We can delete a Role by ID
        """

        self.metadata.create_or_update(data=self.create_role)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Role, fqn=self.role_entity.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(entity=Role, entity_id=res_name.id)

        # Delete
        self.metadata.delete(entity=Role, entity_id=str(res_id.id.__root__))

        # Then we should not find it
        res = self.metadata.list_entities(entity=Role)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == self.role_entity.fullyQualifiedName
            ),
            None,
        )

    def test_role_list_versions(self):
        """
        test list role entity versions
        """
        self.metadata.create_or_update(data=self.create_role)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Role, fqn=self.role_entity.fullyQualifiedName
        )

        res = self.metadata.get_list_entity_versions(
            entity=Role, entity_id=model_str(res_name.id)
        )
        assert res

    def test_role_get_entity_version(self):
        """
        test get role entity version
        """
        self.metadata.create_or_update(data=self.create_role)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Role, fqn=self.role_entity.fullyQualifiedName
        )
        res = self.metadata.get_entity_version(
            entity=Role, entity_id=res_name.id.__root__, version=0.1
        )

        # check we get the correct version requested and the correct entity ID
        assert res.version.__root__ == 0.1
        assert res.id == res_name.id

    def test_role_get_entity_ref(self):
        """
        test get EntityReference
        """
        res = self.metadata.create_or_update(data=self.create_role)
        entity_ref = self.metadata.get_entity_reference(
            entity=Role, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id

    def test_role_add_user(self):
        """
        test adding a role to a user
        """
        role: Role = self.metadata.create_or_update(data=self.create_role)

        user: User = self.metadata.create_or_update(
            data=CreateUserRequest(
                name="test-role-user",
                email="test-role@user.com",
                roles=[role.id],
            ),
        )

        res: Role = self.metadata.get_by_name(
            entity=Role,
            fqn=self.role_entity.fullyQualifiedName,
            fields=ROLE_FIELDS,
        )
        assert res.users.__root__[0].id == user.id

        self.metadata.delete(entity=User, entity_id=user.id)

    def test_role_add_team(self):
        """
        Test adding a role to a team
        """
        role: Role = self.metadata.create_or_update(data=self.create_role)

        user: User = self.metadata.create_or_update(
            data=CreateUserRequest(
                name="test-role-user",
                email="test-role@user.com",
            ),
        )

        team: Team = self.metadata.create_or_update(
            data=CreateTeamRequest(
                name="test-role-team-1",
                teamType="Group",
                users=[user.id],
                defaultRoles=[role.id],
            )
        )

        res: Role = self.metadata.get_by_name(
            entity=Role,
            fqn=self.role_entity.fullyQualifiedName,
            fields=ROLE_FIELDS,
        )
        assert res.teams.__root__[0].id == team.id

        self.metadata.delete(entity=Team, entity_id=team.id)
        self.metadata.delete(entity=User, entity_id=user.id)

    def test_role_patch_policies(self):
        """
        test PATCHing the policies of a role
        """

        # Add policy to role
        role: Role = self.metadata.create_or_update(data=self.create_role)

        res: Role = self.metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=self.role_policy_2.id,
        )
        assert res
        assert res.id == role.id
        assert len(res.policies.__root__) == 2
        assert res.policies.__root__[1].id == self.role_policy_2.id

        # Remove last policy from role
        res = self.metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=self.role_policy_2.id,
            operation=PatchOperation.REMOVE,
        )
        assert res
        assert res.id == role.id
        assert len(res.policies.__root__) == 1
        assert res.policies.__root__[0].id == self.role_policy_1.id

        # Remove first policy from role
        res: Role = self.metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=self.role_policy_2.id,
            operation=PatchOperation.ADD,
        )
        res = self.metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=self.role_policy_1.id,
            operation=PatchOperation.REMOVE,
        )
        assert res
        assert res.id == role.id
        assert len(res.policies.__root__) == 1
        assert res.policies.__root__[0].id == self.role_policy_2.id

        # Try to remove the only policy - Fail
        res = self.metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=self.role_policy_2.id,
            operation=PatchOperation.REMOVE,
        )
        self.assertEqual(res, None)

        # Nonexistent role ID - Fail
        res = self.metadata.patch_role_policy(
            entity_id=str(uuid.uuid4()),
            policy_id=self.role_policy_1.id,
            operation=PatchOperation.ADD,
        )
        self.assertEqual(res, None)

        # Attempt to remove nonexistent policy - Fail
        res: Role = self.metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=self.role_policy_1.id,
            operation=PatchOperation.ADD,
        )
        res = self.metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=str(uuid.uuid4()),
            operation=PatchOperation.REMOVE,
        )
        self.assertEqual(res, None)
