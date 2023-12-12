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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import org.apache.commons.lang3.tuple.ImmutablePair;
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
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;

public class SubjectContextTest {

  private static List<Role> team1Roles;
  private static List<Policy> team1Policies;

  private static List<Role> team11Roles;
  private static List<Policy> team11Policies;

  private static List<Role> team12Roles;
  private static List<Policy> team12Policies;

  private static List<Policy> team13Policies;
  private static Team team13;

  private static List<Role> team111Roles;
  private static List<Policy> team111Policies;
  private static Team team111;

  private static List<Policy> team131Policies;
  private static Team team131;

  private static List<Role> userRoles;
  private static User user;

  @BeforeAll
  public static void setup() {
    UserRepository userRepository = mock(UserRepository.class);
    Entity.registerEntity(User.class, Entity.USER, userRepository);
    Mockito
      .when(userRepository.getByName(isNull(), anyString(), isNull(), any(Include.class), anyBoolean()))
      .thenAnswer(i -> EntityRepository.CACHE_WITH_NAME.get(new ImmutablePair<>(Entity.USER, i.getArgument(1))));

    TeamRepository teamRepository = mock(TeamRepository.class);
    Entity.registerEntity(Team.class, Entity.TEAM, teamRepository);
    Mockito
      .when(teamRepository.get(isNull(), any(UUID.class), isNull(), any(Include.class), anyBoolean()))
      .thenAnswer(i -> EntityRepository.CACHE_WITH_ID.get(new ImmutablePair<>(Entity.TEAM, i.getArgument(1))));

    RoleRepository roleRepository = mock(RoleRepository.class);
    Entity.registerEntity(Role.class, Entity.ROLE, roleRepository);
    Mockito
      .when(roleRepository.get(isNull(), any(UUID.class), isNull(), any(Include.class), anyBoolean()))
      .thenAnswer(i -> EntityRepository.CACHE_WITH_ID.get(new ImmutablePair<>(Entity.ROLE, i.getArgument(1))));

    PolicyRepository policyRepository = mock(PolicyRepository.class);
    Entity.registerEntity(Policy.class, Entity.POLICY, policyRepository);
    Mockito
      .when(policyRepository.get(isNull(), any(UUID.class), isNull(), any(Include.class), anyBoolean()))
      .thenAnswer(i -> EntityRepository.CACHE_WITH_ID.get(new ImmutablePair<>(Entity.POLICY, i.getArgument(1))));

    // Create team hierarchy:
    //                           team1
    //                      /      |      \
    //                   team11  team12  team13
    //                    /         /      \
    //               team111       /       team131
    //                    \      /
    //                      user
    // Each team has 3 roles and 3 policies
    team1Roles = getRoles("team1");
    team1Policies = getPolicies("team1");
    Team team1 = createTeam("team1", team1Roles, team1Policies, null);

    team11Roles = getRoles("team11");
    team11Policies = getPolicies("team11");
    Team team11 = createTeam("team11", team11Roles, team11Policies, List.of(team1));

    team12Roles = getRoles("team12");
    team12Policies = getPolicies("team12");
    Team team12 = createTeam("team12", team12Roles, team12Policies, List.of(team1));

    List<Role> team13Roles = getRoles("team13");
    team13Policies = getPolicies("team13");
    team13 = createTeam("team13", team13Roles, team13Policies, List.of(team1));

    team111Roles = getRoles("team111");
    team111Policies = getPolicies("team111");
    team111 = createTeam("team111", team111Roles, team111Policies, List.of(team11, team12));

    List<Role> team131Roles = getRoles("team131");
    team131Policies = getPolicies("team131");
    team131 = createTeam("team131", team131Roles, team131Policies, List.of(team13));

    // Add user to team111
    userRoles = getRoles("user");
    List<EntityReference> userRolesRef = toEntityReferences(userRoles);
    user = new User().withName("user").withRoles(userRolesRef).withTeams(List.of(team111.getEntityReference()));
    EntityRepository.CACHE_WITH_NAME.put(new ImmutablePair<>(Entity.USER, "user"), user);
  }

  @Test
  void testPolicyIterator() {
    // Check iteration order of the policies without resourceOwner
    SubjectContext subjectContext = SubjectContext.getSubjectContext(user.getName());
    Iterator<PolicyContext> policyContextIterator = subjectContext.getPolicies(null);
    List<String> expectedUserPolicyOrder = new ArrayList<>();
    expectedUserPolicyOrder.addAll(getPolicyListFromRoles(userRoles)); // First polices associated with user roles
    expectedUserPolicyOrder.addAll(getAllTeamPolicies(team111Roles, team111Policies)); // Next parent team111 policies
    expectedUserPolicyOrder.addAll(getAllTeamPolicies(team11Roles, team11Policies)); // Next team111 parent team11 policies
    expectedUserPolicyOrder.addAll(getAllTeamPolicies(team1Roles, team1Policies)); // Next team11 parent team1 policies
    expectedUserPolicyOrder.addAll(getAllTeamPolicies(team12Roles, team12Policies)); // Next team111 parent team12 policies
    assertPolicyIterator(expectedUserPolicyOrder, policyContextIterator);

    // Check iteration order of policies with team13 as the resource owner
    subjectContext = SubjectContext.getSubjectContext(user.getName());
    policyContextIterator = subjectContext.getPolicies(team13.getEntityReference());
    List<String> expectedUserAndTeam13PolicyOrder = new ArrayList<>();
    expectedUserAndTeam13PolicyOrder.addAll(expectedUserPolicyOrder);
    expectedUserAndTeam13PolicyOrder.addAll(getAllTeamPolicies(null, team13Policies));
    assertPolicyIterator(expectedUserAndTeam13PolicyOrder, policyContextIterator);

    // Check iteration order of policies with team131 as the resource owner
    subjectContext = SubjectContext.getSubjectContext(user.getName());
    policyContextIterator = subjectContext.getPolicies(team131.getEntityReference());
    // Roles & policies are inherited from resource owner team131
    List<String> expectedUserAndTeam131PolicyOrder = new ArrayList<>();
    expectedUserAndTeam131PolicyOrder.addAll(expectedUserPolicyOrder);
    expectedUserAndTeam131PolicyOrder.addAll(getAllTeamPolicies(null, team131Policies));
    expectedUserAndTeam131PolicyOrder.addAll(getAllTeamPolicies(null, team13Policies));
    assertPolicyIterator(expectedUserAndTeam131PolicyOrder, policyContextIterator);
  }

  @Test
  void testUserInHierarchy() {
    SubjectContext subjectContext = SubjectContext.getSubjectContext(user.getName());
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
    SubjectContext subjectContext = SubjectContext.getSubjectContext(user.getName());

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

  private static List<Role> getRoles(String prefix) {
    // Create roles with 3 policies each and each policy with 3 rules
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
      Policy policy = new Policy().withName(name).withId(UUID.randomUUID()).withRules(getRules(name));
      policies.add(policy);
      EntityRepository.CACHE_WITH_ID.put(new ImmutablePair<>(Entity.POLICY, policy.getId()), policy);
    }
    return policies;
  }

  private static List<Rule> getRules(String prefix) {
    List<Rule> rules = new ArrayList<>(3);
    for (int i = 1; i <= 3; i++) {
      rules.add(new Rule().withName(prefix + "rule" + 3));
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
    listOrEmpty(list).addAll(getPolicyListFromRoles(roles));
    listOrEmpty(list).addAll(getPolicyList(policies));
    return list;
  }

  private static List<String> getPolicyListFromRoles(List<Role> roles) {
    List<String> list = new ArrayList<>();
    listOrEmpty(roles).forEach(r -> list.addAll(getPolicyRefList(r.getPolicies())));
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
    Team team = new Team()
      .withName(name)
      .withId(UUID.randomUUID())
      .withDefaultRoles(toEntityReferences(roles))
      .withPolicies(toEntityReferences(policies))
      .withParents(parentList);
    EntityRepository.CACHE_WITH_ID.put(new ImmutablePair<>(Entity.TEAM, team.getId()), team);
    return team;
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
