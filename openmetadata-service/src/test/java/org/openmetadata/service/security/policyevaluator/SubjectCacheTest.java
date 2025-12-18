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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
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

public class SubjectCacheTest {
  private static List<Role> team1Roles;
  private static List<Policy> team1Policies;
  private static List<Role> team11Roles;
  private static List<Policy> team11Policies;
  private static List<Role> userRoles;
  private static User user;
  private static Team team1;
  private static Team team11;

  @BeforeAll
  public static void setup() {
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

    // Create team hierarchy: team1 -> team11 -> user
    team1Roles = getRoles("team1");
    team1Policies = getPolicies("team1");
    team1 = createTeam("team1", team1Roles, team1Policies, null);

    team11Roles = getRoles("team11");
    team11Policies = getPolicies("team11");
    team11 = createTeam("team11", team11Roles, team11Policies, List.of(team1));

    userRoles = getRoles("user");
    List<EntityReference> userRolesRef = toEntityReferences(userRoles);
    user =
        new User()
            .withName("testUser")
            .withRoles(userRolesRef)
            .withTeams(List.of(team11.getEntityReference()));
    EntityRepository.CACHE_WITH_NAME.put(new ImmutablePair<>(Entity.USER, "testUser"), user);
  }

  @BeforeEach
  public void resetCache() {
    SubjectCache.invalidateAll();
  }

  @Test
  void testCachedPoliciesMatchExpectedOrder() {
    // Get policies through cache
    List<PolicyContext> cachedPolicies = SubjectCache.getPolicies("testUser");

    assertNotNull(cachedPolicies);
    assertTrue(cachedPolicies.size() > 0);

    // Build expected policy order: user roles -> team11 (roles + policies) -> team1 (roles +
    // policies)
    List<String> expectedPolicyNames = new ArrayList<>();
    // User's direct roles
    for (Role role : userRoles) {
      for (EntityReference policyRef : role.getPolicies()) {
        expectedPolicyNames.add(policyRef.getName());
      }
    }
    // Team11's roles and policies
    for (Role role : team11Roles) {
      for (EntityReference policyRef : role.getPolicies()) {
        expectedPolicyNames.add(policyRef.getName());
      }
    }
    for (Policy policy : team11Policies) {
      expectedPolicyNames.add(policy.getName());
    }
    // Team1's roles and policies
    for (Role role : team1Roles) {
      for (EntityReference policyRef : role.getPolicies()) {
        expectedPolicyNames.add(policyRef.getName());
      }
    }
    for (Policy policy : team1Policies) {
      expectedPolicyNames.add(policy.getName());
    }

    // Verify order matches
    assertEquals(expectedPolicyNames.size(), cachedPolicies.size());
    for (int i = 0; i < expectedPolicyNames.size(); i++) {
      assertEquals(expectedPolicyNames.get(i), cachedPolicies.get(i).getPolicyName());
    }
  }

  @Test
  void testCacheReturnsConsistentResults() {
    // First call - populates cache
    List<PolicyContext> firstCall = SubjectCache.getPolicies("testUser");

    // Second call - should return from cache
    List<PolicyContext> secondCall = SubjectCache.getPolicies("testUser");

    // Both should have same policies in same order
    assertEquals(firstCall.size(), secondCall.size());
    for (int i = 0; i < firstCall.size(); i++) {
      assertEquals(firstCall.get(i).getPolicyName(), secondCall.get(i).getPolicyName());
      assertEquals(firstCall.get(i).getRoleName(), secondCall.get(i).getRoleName());
    }
  }

  @Test
  void testCacheInvalidationForUser() {
    // Populate cache
    List<PolicyContext> beforeInvalidation = SubjectCache.getPolicies("testUser");
    assertNotNull(beforeInvalidation);

    // Invalidate specific user
    SubjectCache.invalidateUser("testUser");

    // Next call should reload from repositories
    List<PolicyContext> afterInvalidation = SubjectCache.getPolicies("testUser");
    assertNotNull(afterInvalidation);

    // Results should still be consistent
    assertEquals(beforeInvalidation.size(), afterInvalidation.size());
  }

  @Test
  void testCacheInvalidateAll() {
    // Populate cache
    SubjectCache.getPolicies("testUser");

    // Invalidate all
    SubjectCache.invalidateAll();

    // Should still work after invalidation
    List<PolicyContext> afterInvalidation = SubjectCache.getPolicies("testUser");
    assertNotNull(afterInvalidation);
    assertTrue(afterInvalidation.size() > 0);
  }

  @Test
  void testSubjectContextUsesCache() {
    // Get policies via SubjectContext (which now uses SubjectCache)
    SubjectContext subjectContext = SubjectContext.getSubjectContext("testUser");
    Iterator<PolicyContext> policyIterator = subjectContext.getPolicies(null);

    // Collect policies from iterator
    List<String> policiesFromContext = new ArrayList<>();
    while (policyIterator.hasNext()) {
      policiesFromContext.add(policyIterator.next().getPolicyName());
    }

    // Get policies directly from cache
    List<PolicyContext> cachedPolicies = SubjectCache.getPolicies("testUser");
    List<String> policiesFromCache = new ArrayList<>();
    for (PolicyContext pc : cachedPolicies) {
      policiesFromCache.add(pc.getPolicyName());
    }

    // Both should match
    assertEquals(policiesFromCache.size(), policiesFromContext.size());
    for (int i = 0; i < policiesFromCache.size(); i++) {
      assertEquals(policiesFromCache.get(i), policiesFromContext.get(i));
    }
  }

  @Test
  void testSubjectContextWithResourceOwner() {
    // Create a resource owner team that user doesn't belong to
    List<Role> ownerTeamRoles = getRoles("ownerTeam");
    List<Policy> ownerTeamPolicies = getPolicies("ownerTeam");
    Team ownerTeam = createTeam("ownerTeam", ownerTeamRoles, ownerTeamPolicies, null);

    SubjectContext subjectContext = SubjectContext.getSubjectContext("testUser");
    Iterator<PolicyContext> policyIterator =
        subjectContext.getPolicies(List.of(ownerTeam.getEntityReference()));

    List<String> allPolicies = new ArrayList<>();
    while (policyIterator.hasNext()) {
      allPolicies.add(policyIterator.next().getPolicyName());
    }

    // Should include user's cached policies plus owner team's policies
    List<PolicyContext> userPolicies = SubjectCache.getPolicies("testUser");

    // Owner team policies should be added
    assertTrue(allPolicies.size() > userPolicies.size());

    // Verify owner team policies are included
    for (Policy policy : ownerTeamPolicies) {
      assertTrue(allPolicies.contains(policy.getName()));
    }
  }

  @Test
  void testBotUserDoesNotInheritTeamPolicies() {
    // Create a bot user
    List<Role> botRoles = getRoles("bot");
    User botUser =
        new User()
            .withName("botUser")
            .withRoles(toEntityReferences(botRoles))
            .withTeams(List.of(team11.getEntityReference()))
            .withIsBot(true);
    EntityRepository.CACHE_WITH_NAME.put(new ImmutablePair<>(Entity.USER, "botUser"), botUser);

    List<PolicyContext> botPolicies = SubjectCache.getPolicies("botUser");

    // Bot should only have its direct role policies, not team policies
    int expectedPolicyCount = 0;
    for (Role role : botRoles) {
      expectedPolicyCount += role.getPolicies().size();
    }

    assertEquals(expectedPolicyCount, botPolicies.size());
  }

  private static List<Role> getRoles(String prefix) {
    List<Role> roles = new ArrayList<>(3);
    for (int i = 1; i <= 3; i++) {
      String name = prefix + "_role_" + i;
      List<EntityReference> policies = toEntityReferences(getPolicies(name));
      Role role = new Role().withName(name).withId(UUID.randomUUID()).withPolicies(policies);
      EntityRepository.CACHE_WITH_ID.put(new ImmutablePair<>(Entity.ROLE, role.getId()), role);
      roles.add(role);
    }
    return roles;
  }

  private static List<Policy> getPolicies(String prefix) {
    List<Policy> policies = new ArrayList<>(3);
    for (int i = 1; i <= 3; i++) {
      String name = prefix + "_policy_" + i;
      Policy policy =
          new Policy().withName(name).withId(UUID.randomUUID()).withRules(getRules(name));
      policies.add(policy);
      EntityRepository.CACHE_WITH_ID.put(
          new ImmutablePair<>(Entity.POLICY, policy.getId()), policy);
    }
    return policies;
  }

  private static List<Rule> getRules(String prefix) {
    List<Rule> rules = new ArrayList<>(3);
    for (int i = 1; i <= 3; i++) {
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
