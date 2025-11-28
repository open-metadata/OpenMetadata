/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;

/**
 * Tests to verify that cached permission evaluation produces identical results to non-cached
 * evaluation.
 */
public class CachedPermissionEvaluationTest {
  private static User testUser;
  private static Team teamA;
  private static Team teamB;
  private static Team teamC;
  private static Team resourceOwnerTeam;

  @BeforeAll
  public static void setup() {
    setupMocks();
    setupTeamHierarchy();
  }

  private static void setupMocks() {
    UserRepository userRepository = mock(UserRepository.class);
    Entity.registerEntity(User.class, Entity.USER, userRepository);
    Mockito.when(
            userRepository.getByName(
                isNull(), anyString(), isNull(), any(Include.class), anyBoolean()))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_NAME.get(
                    new ImmutablePair<>(Entity.USER, i.getArgument(1))));

    TeamRepository teamRepository = mock(TeamRepository.class);
    Entity.registerEntity(Team.class, Entity.TEAM, teamRepository);
    Mockito.when(
            teamRepository.get(
                isNull(), any(UUID.class), isNull(), any(Include.class), anyBoolean()))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_ID.get(
                    new ImmutablePair<>(Entity.TEAM, i.getArgument(1))));

    RoleRepository roleRepository = mock(RoleRepository.class);
    Entity.registerEntity(Role.class, Entity.ROLE, roleRepository);
    Mockito.when(
            roleRepository.get(
                isNull(), any(UUID.class), isNull(), any(Include.class), anyBoolean()))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_ID.get(
                    new ImmutablePair<>(Entity.ROLE, i.getArgument(1))));

    PolicyRepository policyRepository = mock(PolicyRepository.class);
    Entity.registerEntity(Policy.class, Entity.POLICY, policyRepository);
    Mockito.when(
            policyRepository.get(
                isNull(), any(UUID.class), isNull(), any(Include.class), anyBoolean()))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_ID.get(
                    new ImmutablePair<>(Entity.POLICY, i.getArgument(1))));
  }

  private static void setupTeamHierarchy() {
    // Hierarchy: teamC (parent) -> teamA, teamB (children) -> testUser
    List<Role> teamCRoles = createRoles("teamC");
    List<Policy> teamCPolicies = createPolicies("teamC");
    teamC = createTeam("teamC", teamCRoles, teamCPolicies, null);

    List<Role> teamARoles = createRoles("teamA");
    List<Policy> teamAPolicies = createPolicies("teamA");
    teamA = createTeam("teamA", teamARoles, teamAPolicies, List.of(teamC));

    List<Role> teamBRoles = createRoles("teamB");
    List<Policy> teamBPolicies = createPolicies("teamB");
    teamB = createTeam("teamB", teamBRoles, teamBPolicies, List.of(teamC));

    // Resource owner team with parent teamC
    List<Role> ownerRoles = createRoles("ownerTeam");
    List<Policy> ownerPolicies = createPolicies("ownerTeam");
    resourceOwnerTeam = createTeam("ownerTeam", ownerRoles, ownerPolicies, List.of(teamC));

    // User with direct roles and belongs to teamA and teamB
    List<Role> userRoles = createRoles("user");
    testUser =
        new User()
            .withName("testUser")
            .withRoles(toEntityReferences(userRoles))
            .withTeams(List.of(teamA.getEntityReference(), teamB.getEntityReference()));
    EntityRepository.CACHE_WITH_NAME.put(new ImmutablePair<>(Entity.USER, "testUser"), testUser);
  }

  @BeforeEach
  public void resetCache() {
    SubjectCache.invalidateAll();
  }

  @Test
  void testPolicyOrderConsistency() {
    SubjectContext subjectContext = SubjectContext.getSubjectContext("testUser");

    // Get policies multiple times and verify consistent order
    List<String> firstCall = collectPolicyNames(subjectContext.getPolicies(null));
    List<String> secondCall = collectPolicyNames(subjectContext.getPolicies(null));
    List<String> thirdCall = collectPolicyNames(subjectContext.getPolicies(null));

    assertEquals(firstCall, secondCall, "Second call should return same order as first");
    assertEquals(firstCall, thirdCall, "Third call should return same order as first");
  }

  @Test
  void testResourceOwnerPoliciesAddedCorrectly() {
    SubjectContext subjectContext = SubjectContext.getSubjectContext("testUser");

    List<String> withoutOwner = collectPolicyNames(subjectContext.getPolicies(null));
    List<String> withOwner =
        collectPolicyNames(
            subjectContext.getPolicies(List.of(resourceOwnerTeam.getEntityReference())));

    // With owner should have more policies
    assertEquals(
        true,
        withOwner.size() > withoutOwner.size(),
        "Resource owner should add additional policies");

    // Without owner policies should be prefix of with owner
    for (int i = 0; i < withoutOwner.size(); i++) {
      assertEquals(
          withoutOwner.get(i),
          withOwner.get(i),
          "User policies should appear in same order before owner policies");
    }

    // Owner team policies should be present (direct policies only, no roles due to skipRoles=true)
    boolean hasOwnerPolicies = false;
    for (String policyName : withOwner) {
      if (policyName.startsWith("ownerTeam_policy_")) {
        hasOwnerPolicies = true;
        break;
      }
    }
    assertEquals(true, hasOwnerPolicies, "Owner team policies should be included");
  }

  @Test
  void testSharedParentNotDuplicated() {
    // teamA and teamB both have teamC as parent
    // teamC policies should appear only once when loading user policies
    SubjectContext subjectContext = SubjectContext.getSubjectContext("testUser");
    List<String> policies = collectPolicyNames(subjectContext.getPolicies(null));

    // Count each unique policy
    int teamCRolePolicy = 0;
    int teamCDirectPolicy = 0;
    for (String policy : policies) {
      if (policy.matches("teamC_role_\\d+_policy_\\d+")) {
        teamCRolePolicy++;
      } else if (policy.matches("teamC_policy_\\d+")) {
        teamCDirectPolicy++;
      }
    }

    // teamC has 2 roles with 3 policies each = 6, plus 3 direct policies = 9 total
    // They should appear only once (not duplicated for teamA and teamB)
    assertEquals(6, teamCRolePolicy, "teamC role policies should appear only once, not duplicated");
    assertEquals(
        3, teamCDirectPolicy, "teamC direct policies should appear only once, not duplicated");
  }

  @Test
  void testResourceOwnerWithSharedParentNotDuplicated() {
    // resourceOwnerTeam has teamC as parent, which is already visited via user's teams
    SubjectContext subjectContext = SubjectContext.getSubjectContext("testUser");

    List<String> withOwner =
        collectPolicyNames(
            subjectContext.getPolicies(List.of(resourceOwnerTeam.getEntityReference())));

    // Count teamC policies - should still be 9 (6 role + 3 direct), not duplicated
    int teamCRolePolicy = 0;
    int teamCDirectPolicy = 0;
    for (String policy : withOwner) {
      if (policy.matches("teamC_role_\\d+_policy_\\d+")) {
        teamCRolePolicy++;
      } else if (policy.matches("teamC_policy_\\d+")) {
        teamCDirectPolicy++;
      }
    }

    assertEquals(
        6,
        teamCRolePolicy,
        "teamC role policies should not be duplicated when added via resource owner");
    assertEquals(
        3,
        teamCDirectPolicy,
        "teamC direct policies should not be duplicated when added via resource owner");
  }

  @Test
  void testMultipleCallsWithResourceOwner() {
    SubjectContext subjectContext = SubjectContext.getSubjectContext("testUser");

    // Simulate DENY and ALLOW evaluation (two calls with same resource owner)
    List<String> denyCall =
        collectPolicyNames(
            subjectContext.getPolicies(List.of(resourceOwnerTeam.getEntityReference())));
    List<String> allowCall =
        collectPolicyNames(
            subjectContext.getPolicies(List.of(resourceOwnerTeam.getEntityReference())));

    assertEquals(denyCall, allowCall, "Multiple calls should return identical policy lists");
  }

  private static List<String> collectPolicyNames(Iterator<PolicyContext> iterator) {
    List<String> names = new ArrayList<>();
    while (iterator.hasNext()) {
      names.add(iterator.next().getPolicyName());
    }
    return names;
  }

  private static List<Role> createRoles(String prefix) {
    List<Role> roles = new ArrayList<>(2);
    for (int i = 1; i <= 2; i++) {
      String name = prefix + "_role_" + i;
      List<EntityReference> policies = toEntityReferences(createPolicies(name));
      Role role = new Role().withName(name).withId(UUID.randomUUID()).withPolicies(policies);
      EntityRepository.CACHE_WITH_ID.put(new ImmutablePair<>(Entity.ROLE, role.getId()), role);
      roles.add(role);
    }
    return roles;
  }

  private static List<Policy> createPolicies(String prefix) {
    List<Policy> policies = new ArrayList<>(3);
    for (int i = 1; i <= 3; i++) {
      String name = prefix + "_policy_" + i;
      Policy policy =
          new Policy().withName(name).withId(UUID.randomUUID()).withRules(createRules(name));
      policies.add(policy);
      EntityRepository.CACHE_WITH_ID.put(
          new ImmutablePair<>(Entity.POLICY, policy.getId()), policy);
    }
    return policies;
  }

  private static List<Rule> createRules(String prefix) {
    List<Rule> rules = new ArrayList<>(2);
    for (int i = 1; i <= 2; i++) {
      rules.add(new Rule().withName(prefix + "_rule_" + i));
    }
    return rules;
  }

  private static <T extends EntityInterface> List<EntityReference> toEntityReferences(
      List<T> entities) {
    List<EntityReference> references = new ArrayList<>();
    for (T entity : entities) {
      references.add(entity.getEntityReference());
    }
    return references;
  }

  private static Team createTeam(
      String name, List<Role> roles, List<Policy> policies, List<Team> parents) {
    List<EntityReference> parentList = parents == null ? null : toEntityReferences(parents);
    Team team =
        new Team()
            .withName(name)
            .withId(UUID.randomUUID())
            .withDefaultRoles(toEntityReferences(roles))
            .withPolicies(toEntityReferences(policies))
            .withParents(parentList);
    EntityRepository.CACHE_WITH_ID.put(new ImmutablePair<>(Entity.TEAM, team.getId()), team);
    return team;
  }
}
