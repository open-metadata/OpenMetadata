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
OpenMetadata high-level API Policy test
"""
import uuid
from copy import deepcopy
from typing import List

import pytest

from metadata.generated.schema.api.policies.createPolicy import CreatePolicyRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.policies.accessControl.resourceDescriptor import (
    Operation,
)
from metadata.generated.schema.entity.policies.accessControl.rule import Effect, Rule
from metadata.generated.schema.entity.policies.policy import Policy, Rules
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.basic import (
    EntityName,
    Expression,
    FullyQualifiedEntityName,
    Markdown,
    Uuid,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.mixins.patch_mixin_utils import PatchOperation
from metadata.ingestion.ometa.utils import model_str

from ..integration_base import generate_name
from .conftest import _safe_delete

# Conditions
CONDITION_IS_OWNER = Expression(root="isOwner()")
CONDITION_IS_NOT_OWNER = Expression(root="!isOwner")
CONDITION_NO_OWNER_IS_OWNER = Expression(root="noOwner() || isOwner()")

# Resources
RESOURCE_BOT: str = "Bot"
RESOURCE_PIPELINE: str = "Pipeline"
RESOURCE_TABLE: str = "Table"

ROLE_FIELDS: List[str] = ["policies", "teams", "users"]

_RUN_ID = uuid.uuid4().hex[:8]
POLICY_NAME = f"test-policy-{_RUN_ID}"
ROLE_NAME = f"test-role-{_RUN_ID}"

RULE_1 = Rule(
    name="rule-1",
    description=Markdown("Description of rule-1"),
    resources=[RESOURCE_TABLE],
    operations=[Operation.EditAll, Operation.ViewAll],
    effect=Effect.allow,
    condition=CONDITION_IS_OWNER,
)

RULE_2 = Rule(
    name="rule-2",
    description=Markdown("Description of rule-2"),
    fullyQualifiedName=FullyQualifiedEntityName(f"{POLICY_NAME}.rule-2"),
    resources=[RESOURCE_BOT, RESOURCE_PIPELINE, RESOURCE_TABLE],
    operations=[Operation.EditCustomFields],
    effect=Effect.deny,
    condition=CONDITION_NO_OWNER_IS_OWNER,
)

RULE_3 = Rule(
    name="rule-3",
    fullyQualifiedName=FullyQualifiedEntityName(f"{POLICY_NAME}.rule-3"),
    resources=[RESOURCE_TABLE],
    operations=[Operation.EditAll, Operation.ViewAll],
    effect=Effect.allow,
    condition=CONDITION_IS_OWNER,
)


@pytest.fixture(scope="module")
def role_policy_1(metadata):
    """Policy used as a role's default policy."""
    policy = metadata.create_or_update(
        CreatePolicyRequest(
            name=EntityName(f"test-role-policy-1-{_RUN_ID}"),
            description=Markdown("Description of test role policy 1"),
            rules=Rules(root=[RULE_1, RULE_2]),
        )
    )
    yield policy

    _safe_delete(
        metadata,
        entity=Policy,
        entity_id=policy.id,
        hard_delete=True,
        recursive=True,
    )


@pytest.fixture(scope="module")
def role_policy_2(metadata):
    """Secondary policy used in role update/patch tests."""
    policy = metadata.create_or_update(
        CreatePolicyRequest(
            name=EntityName(f"test-role-policy-2-{_RUN_ID}"),
            description=Markdown("Description of test role policy 2"),
            rules=Rules(root=[RULE_1]),
        )
    )
    yield policy

    _safe_delete(
        metadata,
        entity=Policy,
        entity_id=policy.id,
        hard_delete=True,
        recursive=True,
    )


@pytest.fixture(scope="module")
def policy_entity():
    """Policy model object for name comparisons (not created via API)."""
    return Policy(
        id=Uuid(uuid.uuid4()),
        name=EntityName(POLICY_NAME),
        fullyQualifiedName=EntityName(POLICY_NAME),
        description=Markdown("Description of test policy 1"),
        rules=Rules(root=[RULE_1, RULE_2]),
    )


@pytest.fixture(scope="module")
def create_policy():
    """CreatePolicyRequest for policy tests."""
    return CreatePolicyRequest(
        name=EntityName(POLICY_NAME),
        description=Markdown("Description of test policy 1"),
        rules=Rules(root=[RULE_1, RULE_2]),
    )


@pytest.fixture(scope="module")
def role_entity(role_policy_1):
    """Role model object for name comparisons (not created via API)."""
    return Role(
        id=Uuid(uuid.uuid4()),
        name=EntityName(ROLE_NAME),
        fullyQualifiedName=FullyQualifiedEntityName(ROLE_NAME),
        policies=EntityReferenceList(
            root=[EntityReference(id=role_policy_1.id, type="policy")]
        ),
    )


@pytest.fixture(scope="module")
def create_role(role_policy_1):
    """CreateRoleRequest for role tests."""
    return CreateRoleRequest(
        name=EntityName(ROLE_NAME),
        policies=[role_policy_1.name],
    )


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_entities(metadata):
    """Clean up all test policies and roles after all tests complete."""
    yield

    policies = metadata.list_entities(entity=Policy)
    for policy in policies.entities:
        if model_str(policy.name).startswith(POLICY_NAME):
            _safe_delete(
                metadata,
                entity=Policy,
                entity_id=model_str(policy.id),
                hard_delete=True,
                recursive=True,
            )

    roles = metadata.list_entities(entity=Role)
    for role in roles.entities:
        if model_str(role.name.root).startswith(ROLE_NAME):
            _safe_delete(
                metadata,
                entity=Role,
                entity_id=model_str(role.id),
                hard_delete=True,
                recursive=True,
            )


class TestOMetaRolePolicyAPI:
    """
    Role and Policy API integration tests.
    Tests policy and role CRUD operations, patching, and role assignments.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_policy_create(self, metadata, create_policy, policy_entity):
        """We can create a Policy and we receive it back as Entity"""
        res: Policy = metadata.create_or_update(data=create_policy)

        assert res.name == policy_entity.name
        assert res.rules.root[0].name == RULE_1.name

    def test_policy_update(self, metadata, create_policy):
        """Updating it properly changes its properties"""
        res_create = metadata.create_or_update(data=create_policy)

        updated = create_policy.model_dump(exclude_unset=True)
        updated["rules"] = [RULE_3]
        updated_policy_entity = CreatePolicyRequest(**updated)

        res = metadata.create_or_update(data=updated_policy_entity)

        assert res_create.id == res.id
        assert res.rules.root[0].name == RULE_3.name

    def test_policy_get_name(self, metadata, create_policy, policy_entity):
        """We can fetch a Policy by name and get it back as Entity"""
        metadata.create_or_update(data=create_policy)

        res = metadata.get_by_name(
            entity=Policy, fqn=model_str(policy_entity.fullyQualifiedName)
        )
        assert res.name == policy_entity.name

    def test_policy_get_id(self, metadata, create_policy, policy_entity):
        """We can fetch a Policy by ID and get it back as Entity"""
        metadata.create_or_update(data=create_policy)

        res_name = metadata.get_by_name(
            entity=Policy, fqn=model_str(policy_entity.fullyQualifiedName)
        )
        res = metadata.get_by_id(entity=Policy, entity_id=model_str(res_name.id))

        assert res_name.id == res.id

    def test_policy_list(self, metadata, create_policy, policy_entity):
        """We can list all our Policies"""
        metadata.create_or_update(data=create_policy)

        res = metadata.list_entities(entity=Policy)

        data = next(
            iter(ent for ent in res.entities if ent.name == policy_entity.name),
            None,
        )
        assert data

    def test_policy_list_all(self, metadata, create_policy):
        """Validate generator utility to fetch all Policies"""
        fake_create = deepcopy(create_policy)
        for i in range(0, 10):
            fake_create.name = EntityName(create_policy.name.root + str(i))
            metadata.create_or_update(data=fake_create)

        all_entities = metadata.list_all_entities(entity=Policy, limit=2)
        assert len(list(all_entities)) >= 10

    def test_policy_delete(self, metadata, create_policy, policy_entity):
        """We can delete a Policy by ID"""
        metadata.create_or_update(data=create_policy)

        res_name = metadata.get_by_name(
            entity=Policy, fqn=model_str(policy_entity.fullyQualifiedName)
        )
        res_id = metadata.get_by_id(entity=Policy, entity_id=res_name.id)

        _safe_delete(
            metadata,
            entity=Policy,
            entity_id=model_str(res_id.id),
            hard_delete=True,
            recursive=True,
        )

        res = metadata.list_entities(entity=Policy)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == policy_entity.fullyQualifiedName
            ),
            None,
        )

    def test_policy_list_versions(self, metadata, create_policy, policy_entity):
        """test list policy entity versions"""
        metadata.create_or_update(data=create_policy)

        res_name = metadata.get_by_name(
            entity=Policy, fqn=model_str(policy_entity.fullyQualifiedName)
        )

        res = metadata.get_list_entity_versions(
            entity=Policy, entity_id=model_str(res_name.id)
        )
        assert res

    def test_policy_get_entity_version(self, metadata, create_policy, policy_entity):
        """test get policy entity version"""
        metadata.create_or_update(data=create_policy)

        res_name = metadata.get_by_name(
            entity=Policy, fqn=model_str(policy_entity.fullyQualifiedName)
        )
        res = metadata.get_entity_version(
            entity=Policy, entity_id=model_str(res_name.id), version=0.1
        )

        assert res.version.root == 0.1
        assert res.id == res_name.id

    def test_policy_get_entity_ref(self, metadata, create_policy):
        """test get EntityReference"""
        res = metadata.create_or_update(data=create_policy)
        entity_ref = metadata.get_entity_reference(
            entity=Policy, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id

    def test_policy_patch_rule(self, metadata, create_policy):
        """test PATCHing the rules of a policy"""
        policy: Policy = metadata.create_or_update(create_policy)
        dest_policy = deepcopy(policy)
        if dest_policy.rules is None:
            dest_policy.rules.root = list()
        dest_policy.rules.root.append(RULE_3)

        res: Policy = metadata.patch(
            entity=Policy, source=policy, destination=dest_policy
        )
        assert res is not None
        assert len(res.rules.root) == 3
        assert res.rules.root[2].name == RULE_3.name
        dest_policy = deepcopy(res)
        dest_policy.rules.root.pop(2)

        res = metadata.patch(entity=Policy, source=res, destination=dest_policy)
        assert res is not None
        assert len(res.rules.root) == 2
        assert res.rules.root[1].name == RULE_2.name
        dest_policy = deepcopy(res)
        dest_policy.rules.root.append(RULE_3)

        res: Policy = metadata.patch(
            entity=Policy, source=policy, destination=dest_policy
        )
        dest_policy = deepcopy(res)
        dest_policy.rules.root.remove(RULE_2)
        res: Policy = metadata.patch(entity=Policy, source=res, destination=dest_policy)
        assert res is not None
        assert len(res.rules.root) == 2
        assert res.rules.root[1].name == RULE_3.name
        assert len(res.rules.root[1].operations) == len(RULE_3.operations)
        assert res.rules.root[1].description is None

        policy = metadata.create_or_update(create_policy)
        dest_policy = deepcopy(policy)
        dest_policy.rules.root.remove(RULE_1)
        res = metadata.patch(entity=Policy, source=res, destination=dest_policy)
        assert res is not None
        assert len(res.rules.root) == 1
        assert res.rules.root[0].name == RULE_2.name
        assert len(res.rules.root[0].operations) == len(RULE_2.operations)
        assert res.rules.root[0].fullyQualifiedName == RULE_2.fullyQualifiedName

        dest_policy = deepcopy(res)
        dest_policy.rules.root.remove(RULE_2)
        res = metadata.patch(entity=Policy, source=res, destination=dest_policy)
        assert res is None

    def test_role_create(self, metadata, create_role, role_entity, role_policy_1):
        """We can create a Role and we receive it back as Entity"""
        res = metadata.create_or_update(data=create_role)

        assert res.name == role_entity.name
        assert res.policies.root[0].name == model_str(role_policy_1.name)

    def test_role_update(self, metadata, create_role, role_policy_2):
        """Updating it properly changes its properties"""
        res_create = metadata.create_or_update(data=create_role)

        updated = create_role.model_dump(exclude_unset=True)
        updated["policies"] = [role_policy_2.name]
        updated_entity = CreateRoleRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        assert res_create.id == res.id
        assert res.policies.root[0].name == model_str(role_policy_2.name)

    def test_role_get_name(self, metadata, create_role, role_entity):
        """We can fetch a Role by name and get it back as Entity"""
        metadata.create_or_update(data=create_role)

        res = metadata.get_by_name(entity=Role, fqn=role_entity.fullyQualifiedName)
        assert res.name == role_entity.name

    def test_role_get_id(self, metadata, create_role, role_entity):
        """We can fetch a Role by ID and get it back as Entity"""
        metadata.create_or_update(data=create_role)

        res_name = metadata.get_by_name(entity=Role, fqn=role_entity.fullyQualifiedName)
        res = metadata.get_by_id(entity=Role, entity_id=model_str(res_name.id))

        assert res_name.id == res.id

    def test_role_list(self, metadata, create_role, role_entity):
        """We can list all our Roles"""
        metadata.create_or_update(data=create_role)

        res = metadata.list_entities(entity=Role)

        data = next(
            iter(ent for ent in res.entities if ent.name == role_entity.name), None
        )
        assert data

    def test_role_list_all(self, metadata, create_role):
        """Validate generator utility to fetch all roles"""
        fake_create = deepcopy(create_role)
        for i in range(0, 10):
            fake_create.name = EntityName(create_role.name.root + str(i))
            metadata.create_or_update(data=fake_create)

        all_entities = metadata.list_all_entities(entity=Role, limit=2)
        assert len(list(all_entities)) >= 10

    def test_role_delete(self, metadata, create_role, role_entity):
        """We can delete a Role by ID"""
        metadata.create_or_update(data=create_role)

        res_name = metadata.get_by_name(entity=Role, fqn=role_entity.fullyQualifiedName)
        res_id = metadata.get_by_id(entity=Role, entity_id=res_name.id)

        _safe_delete(
            metadata,
            entity=Role,
            entity_id=str(res_id.id.root),
            hard_delete=True,
            recursive=True,
        )

        res = metadata.list_entities(entity=Role)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == role_entity.fullyQualifiedName
            ),
            None,
        )

    def test_role_list_versions(self, metadata, create_role, role_entity):
        """test list role entity versions"""
        metadata.create_or_update(data=create_role)

        res_name = metadata.get_by_name(entity=Role, fqn=role_entity.fullyQualifiedName)

        res = metadata.get_list_entity_versions(
            entity=Role, entity_id=model_str(res_name.id)
        )
        assert res

    def test_role_get_entity_version(self, metadata, create_role, role_entity):
        """test get role entity version"""
        metadata.create_or_update(data=create_role)

        res_name = metadata.get_by_name(entity=Role, fqn=role_entity.fullyQualifiedName)
        res = metadata.get_entity_version(
            entity=Role, entity_id=res_name.id.root, version=0.1
        )

        assert res.version.root == 0.1
        assert res.id == res_name.id

    def test_role_get_entity_ref(self, metadata, create_role):
        """test get EntityReference"""
        res = metadata.create_or_update(data=create_role)
        entity_ref = metadata.get_entity_reference(
            entity=Role, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id

    def test_role_add_user(self, metadata, create_role, role_entity):
        """test adding a role to a user"""
        role: Role = metadata.create_or_update(data=create_role)

        user_name = generate_name()
        user: User = metadata.create_or_update(
            data=CreateUserRequest(
                name=user_name,
                email=f"{user_name.root}@user.com",
                roles=[role.id],
            ),
        )

        try:
            res: Role = metadata.get_by_name(
                entity=Role,
                fqn=role_entity.fullyQualifiedName,
                fields=ROLE_FIELDS,
            )
            assert any(u.id == user.id for u in res.users.root)
        finally:
            _safe_delete(
                metadata,
                entity=User,
                entity_id=user.id,
                hard_delete=True,
                recursive=True,
            )

    def test_role_add_team(self, metadata, create_role, role_entity):
        """Test adding a role to a team"""
        role: Role = metadata.create_or_update(data=create_role)

        user_name = generate_name()
        user: User = metadata.create_or_update(
            data=CreateUserRequest(
                name=user_name,
                email=f"{user_name.root}@user.com",
            ),
        )

        team: Team = metadata.create_or_update(
            data=CreateTeamRequest(
                name=generate_name(),
                teamType="Group",
                users=[user.id],
                defaultRoles=[role.id],
            )
        )

        try:
            res: Role = metadata.get_by_name(
                entity=Role,
                fqn=role_entity.fullyQualifiedName,
                fields=ROLE_FIELDS,
            )
            assert any(t.id == team.id for t in res.teams.root)
        finally:
            _safe_delete(
                metadata,
                entity=Team,
                entity_id=team.id,
                hard_delete=True,
                recursive=True,
            )
            _safe_delete(
                metadata,
                entity=User,
                entity_id=user.id,
                hard_delete=True,
                recursive=True,
            )

    def test_role_patch_policies(
        self, metadata, create_role, role_policy_1, role_policy_2
    ):
        """test PATCHing the policies of a role"""
        role: Role = metadata.create_or_update(data=create_role)

        res: Role = metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=role_policy_2.id,
        )
        assert res
        assert res.id == role.id
        assert len(res.policies.root) == 2
        assert res.policies.root[0].id == role_policy_2.id

        res = metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=role_policy_2.id,
            operation=PatchOperation.REMOVE,
        )
        assert res
        assert res.id == role.id
        assert len(res.policies.root) == 1
        assert res.policies.root[0].id == role_policy_1.id

        res: Role = metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=role_policy_2.id,
            operation=PatchOperation.ADD,
        )
        res = metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=role_policy_1.id,
            operation=PatchOperation.REMOVE,
        )
        assert res
        assert res.id == role.id
        assert len(res.policies.root) == 1
        assert res.policies.root[0].id == role_policy_2.id

        res = metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=role_policy_2.id,
            operation=PatchOperation.REMOVE,
        )
        assert res is None

        res = metadata.patch_role_policy(
            entity_id=str(uuid.uuid4()),
            policy_id=role_policy_1.id,
            operation=PatchOperation.ADD,
        )
        assert res is None

        res: Role = metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=role_policy_1.id,
            operation=PatchOperation.ADD,
        )
        res = metadata.patch_role_policy(
            entity_id=role.id,
            policy_id=str(uuid.uuid4()),
            operation=PatchOperation.REMOVE,
        )
        assert res is None
