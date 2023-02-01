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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.PolicyDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.RoleDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.TeamDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.UserDAO;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;
import org.openmetadata.service.util.ParallelizeTest;

@ParallelizeTest
public class SubjectContextTest {
  private static List<Role> team1Roles;
  private static List<Policy> team1Policies;
  private static Team team1;

  private static List<Role> team11Roles;
  private static List<Policy> team11Policies;
  private static Team team11;

  private static List<Role> team12Roles;
  private static List<Policy> team12Policies;

  private static List<Role> team111Roles;
  private static List<Policy> team111Policies;
  private static Team team111;

  private static List<Role> userRoles;
  private static User user;

  @BeforeAll
  public static void setup() {
    Entity.registerEntity(User.class, Entity.USER, Mockito.mock(UserDAO.class), Mockito.mock(UserRepository.class));
    Entity.registerEntity(Team.class, Entity.TEAM, Mockito.mock(TeamDAO.class), Mockito.mock(TeamRepository.class));
    Entity.registerEntity(
        Policy.class, Entity.POLICY, Mockito.mock(PolicyDAO.class), Mockito.mock(PolicyRepository.class));
    Entity.registerEntity(Role.class, Entity.ROLE, Mockito.mock(RoleDAO.class), Mockito.mock(RoleRepository.class));
    PolicyCache.initialize();
    RoleCache.initialize();
    SubjectCache.initialize();

    // Create team hierarchy:
    // team1, has  team11, team12, team13 as children
    // team11 has team111 as children
    // team111 has user as children
    // Each with 3 roles and 3 policies
    team1Roles = getRoles("team1", 3);
    team1Policies = getPolicies("team1", 3);
    team1 = createTeam("team1", team1Roles, team1Policies, null);

    team11Roles = getRoles("team11", 3);
    team11Policies = getPolicies("team11", 3);
    team11 = createTeam("team11", team11Roles, team11Policies, List.of(team1));

    team12Roles = getRoles("team12", 3);
    team12Policies = getPolicies("team12", 3);
    Team team12 = createTeam("team12", team12Roles, team12Policies, List.of(team1));

    List<Role> team13Roles = getRoles("team13", 3);
    List<Policy> team13Policies = getPolicies("team13", 3);
    createTeam("team13", team13Roles, team13Policies, List.of(team1));

    team111Roles = getRoles("team111", 3);
    team111Policies = getPolicies("team111", 3);
    team111 = createTeam("team111", team111Roles, team111Policies, List.of(team11, team12));

    // Add user to team111
    userRoles = getRoles("user", 3);
    List<EntityReference> userRolesRef = toEntityReferences(userRoles);
    user = new User().withName("user").withRoles(userRolesRef).withTeams(List.of(team111.getEntityReference()));
    SubjectCache.USER_CACHE.put("user", new SubjectContext(user));
  }

  @AfterAll
  public static void tearDown() {
    SubjectCache.cleanUp();
    PolicyCache.cleanUp();
    RoleCache.cleanUp();
  }

  @Test
  void testPolicyIterator() {
    //
    // Check iteration order of the policies
    //
    SubjectContext subjectContext = SubjectCache.getInstance().getSubjectContext(user.getName());
    Iterator<PolicyContext> policyContextIterator = subjectContext.getPolicies();
    assertUserPolicyIterator(policyContextIterator);
  }

  @Test
  void testUserInHierarchy() {
    SubjectContext subjectContext = SubjectCache.getInstance().getSubjectContext(user.getName());
    //
    // Now test given user is part of team hierarchy
    //
    // user is in team111, team11, team12, team1 and not in team13
    assertTrue(subjectContext.isUserUnderTeam("team111"));
    assertTrue(subjectContext.isUserUnderTeam("team11"));
    assertTrue(subjectContext.isUserUnderTeam("team12"));
    assertTrue(subjectContext.isUserUnderTeam("team1"));
    assertFalse(subjectContext.isUserUnderTeam("team13"));
  }

  @Test
  void testResourceIsTeamAsset() {
    SubjectContext subjectContext = SubjectCache.getInstance().getSubjectContext(user.getName());

    //
    // Given entity owner "user", ensure isTeamAsset is true for teams 111, 11, 12, 1 and not for 13
    //
    EntityReference userOwner = new EntityReference().withName("user").withType(Entity.USER);
    assertTrue(subjectContext.isTeamAsset("team111", userOwner));
    assertTrue(subjectContext.isTeamAsset("team11", userOwner));
    assertTrue(subjectContext.isTeamAsset("team12", userOwner));
    assertTrue(subjectContext.isTeamAsset("team1", userOwner));
    assertFalse(subjectContext.isTeamAsset("team13", userOwner));

    //
    // Given entity owner "team111", ensure isTeamAsset is true for 11, 12, 1 and not for 13
    //
    EntityReference teamOwner = new EntityReference().withId(team111.getId()).withType(Entity.TEAM);
    assertTrue(subjectContext.isTeamAsset("team11", teamOwner));
    assertTrue(subjectContext.isTeamAsset("team12", teamOwner));
    assertTrue(subjectContext.isTeamAsset("team1", teamOwner));
    assertFalse(subjectContext.isTeamAsset("team13", teamOwner));
  }

  @Test
  void testResourcePolicyIterator() {
    // A resource with user as owner and make sure all policies from user's hierarchy is in the iterator
    EntityReference userOwner = user.getEntityReference();
    SubjectContext subjectContext = SubjectCache.getInstance().getSubjectContext(user.getName());
    Iterator<PolicyContext> actualPolicyIterator = subjectContext.getResourcePolicies(userOwner);
    assertUserPolicyIterator(actualPolicyIterator);

    // A resource with team1 as owner and make sure all policies from user's hierarchy is in the iterator
    EntityReference team1Owner = team1.getEntityReference();
    actualPolicyIterator = subjectContext.getResourcePolicies(team1Owner);
    // add policies from team1
    List<String> expectedPolicyOrder = new ArrayList<>(getAllTeamPolicies(team1Roles, team1Policies));
    assertPolicyIterator(expectedPolicyOrder, actualPolicyIterator);

    // A resource with team11 as owner and make sure all policies from user's hierarchy is in the iterator
    EntityReference team11Owner = team11.getEntityReference();
    actualPolicyIterator = subjectContext.getResourcePolicies(team11Owner);
    List<String> list = new ArrayList<>(getAllTeamPolicies(team11Roles, team11Policies)); // add policies from team11
    list.addAll(expectedPolicyOrder); // Add all policies from parent team1 previously setup
    expectedPolicyOrder = list;
    assertPolicyIterator(expectedPolicyOrder, actualPolicyIterator);

    // A resource with team11 as owner and make sure all policies from user's hierarchy is in the iterator
    EntityReference team111Owner = team111.getEntityReference();
    actualPolicyIterator = subjectContext.getResourcePolicies(team111Owner);
    list = new ArrayList<>(getAllTeamPolicies(team111Roles, team111Policies)); // add policies from team111
    list.addAll(expectedPolicyOrder); // Add all policies form team11 and team1 previously setup
    list.addAll(getPolicyListFromRoles(team12Roles)); // add policies from team12 roles
    list.addAll(getPolicyList(team12Policies)); // add team12 policies
    assertPolicyIterator(list, actualPolicyIterator);
  }

  private static List<Role> getRoles(String prefix, int count) {
    // Create roles with 3 policies each and each policy with 3 rules
    List<Role> roles = new ArrayList<>(count);
    for (int i = 1; i <= count; i++) {
      String name = prefix + "_role_" + i;
      List<EntityReference> policies = toEntityReferences(getPolicies(name, 3));
      Role role = new Role().withName(name).withId(UUID.randomUUID()).withPolicies(policies);
      RoleCache.ROLE_CACHE.put(role.getId(), role);
      roles.add(role);
    }
    return roles;
  }

  private static List<Policy> getPolicies(String prefix, int count) {
    List<Policy> policies = new ArrayList<>(count);
    for (int i = 1; i <= count; i++) {
      String name = prefix + "_policy_" + i;
      Policy policy = new Policy().withName(name).withId(UUID.randomUUID()).withRules(getRules(name, 3));
      policies.add(policy);
      PolicyCache.POLICY_CACHE.put(policy.getId(), PolicyCache.getInstance().getRules(policy));
    }
    return policies;
  }

  private static List<Rule> getRules(String prefix, int count) {
    List<Rule> rules = new ArrayList<>(count);
    for (int i = 1; i <= count; i++) {
      rules.add(new Rule().withName(prefix + "rule" + count));
    }
    return rules;
  }

  private static <T extends EntityInterface> List<EntityReference> toEntityReferences(List<T> entities) {
    List<EntityReference> references = new ArrayList<>();
    for (T entity : entities) {
      references.add(entity.getEntityReference());
    }
    return references;
  }

  private static List<String> getAllTeamPolicies(List<Role> roles, List<Policy> policies) {
    List<String> list = new ArrayList<>();
    list.addAll(getPolicyListFromRoles(roles));
    list.addAll(getPolicyList(policies));
    return list;
  }

  private static List<String> getPolicyListFromRoles(List<Role> roles) {
    List<String> list = new ArrayList<>();
    roles.forEach(r -> list.addAll(getPolicyRefList(r.getPolicies())));
    return list;
  }

  private static List<String> getPolicyRefList(List<EntityReference> policies) {
    List<String> list = new ArrayList<>();
    policies.forEach(p -> list.add(p.getName()));
    return list;
  }

  private static List<String> getPolicyList(List<Policy> policies) {
    List<String> list = new ArrayList<>();
    policies.forEach(p -> list.add(p.getName()));
    return list;
  }

  private static Team createTeam(String name, List<Role> roles, List<Policy> policies, List<Team> parents) {
    List<EntityReference> parentList = parents == null ? null : toEntityReferences(parents);
    Team team =
        new Team()
            .withName(name)
            .withId(UUID.randomUUID())
            .withDefaultRoles(toEntityReferences(roles))
            .withPolicies(toEntityReferences(policies))
            .withParents(parentList);
    SubjectCache.TEAM_CACHE.put(team.getId(), team);
    return team;
  }

  void assertUserPolicyIterator(Iterator<PolicyContext> actualPolicyIterator) {
    //
    // Check iteration order of the policies
    //
    List<String> expectedPolicyOrder = new ArrayList<>();
    expectedPolicyOrder.addAll(getPolicyListFromRoles(userRoles)); // First polices associated with user roles
    expectedPolicyOrder.addAll(getAllTeamPolicies(team111Roles, team111Policies)); // Next parent team111 policies
    expectedPolicyOrder.addAll(getAllTeamPolicies(team11Roles, team11Policies)); // Next team111 parent team11 policies
    expectedPolicyOrder.addAll(getAllTeamPolicies(team1Roles, team1Policies)); // Next team11 parent team1 policies
    expectedPolicyOrder.addAll(getAllTeamPolicies(team12Roles, team12Policies)); // Next team111 parent team12 policies
    assertPolicyIterator(expectedPolicyOrder, actualPolicyIterator);
  }

  void assertPolicyIterator(List<String> expectedPolicyOrder, Iterator<PolicyContext> actualPolicyIterator) {
    int count = 0;
    while (actualPolicyIterator.hasNext()) {
      PolicyContext policyContext = actualPolicyIterator.next();
      assertEquals(expectedPolicyOrder.get(count), policyContext.getPolicyName());
      count++;
    }
    assertEquals(expectedPolicyOrder.size(), count);
  }
}
