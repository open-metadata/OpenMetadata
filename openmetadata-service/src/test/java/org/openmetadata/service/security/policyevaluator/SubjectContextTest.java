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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
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

  // Track parent->child relationships for mock DAO
  private static final Map<UUID, List<UUID>> parentToChildren = new HashMap<>();
  // Track team->role relationships
  private static final Map<UUID, List<UUID>> teamToRoleIds = new HashMap<>();
  // Track team->policy relationships
  private static final Map<UUID, List<UUID>> teamToPolicyIds = new HashMap<>();
  // Track role->policy relationships
  private static final Map<UUID, List<UUID>> roleToPolicyIds = new HashMap<>();

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
    Mockito.when(teamRepository.getReference(any(UUID.class), any(Include.class)))
        .thenAnswer(
            i -> {
              UUID id = i.getArgument(0);
              EntityInterface entity =
                  EntityRepository.CACHE_WITH_ID.getIfPresent(new ImmutablePair<>(Entity.TEAM, id));
              return entity != null ? entity.getEntityReference() : null;
            });
    Mockito.when(teamRepository.getReferences(anyList(), any(Include.class)))
        .thenAnswer(
            i -> {
              List<UUID> ids = i.getArgument(0);
              List<EntityReference> refs = new ArrayList<>();
              for (UUID id : ids) {
                EntityInterface entity =
                    EntityRepository.CACHE_WITH_ID.getIfPresent(
                        new ImmutablePair<>(Entity.TEAM, id));
                if (entity != null) {
                  refs.add(entity.getEntityReference());
                }
              }
              return refs;
            });

    RoleRepository roleRepository = mock(RoleRepository.class);
    Entity.registerEntity(Role.class, Entity.ROLE, roleRepository);
    Mockito.when(
            roleRepository.get(
                isNull(), any(UUID.class), isNull(), any(Include.class), anyBoolean()))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_ID.get(
                    new ImmutablePair<>(Entity.ROLE, i.getArgument(1))));
    Mockito.when(roleRepository.getReference(any(UUID.class), any(Include.class)))
        .thenAnswer(
            i -> {
              UUID id = i.getArgument(0);
              EntityInterface entity =
                  EntityRepository.CACHE_WITH_ID.getIfPresent(new ImmutablePair<>(Entity.ROLE, id));
              return entity != null ? entity.getEntityReference() : null;
            });

    PolicyRepository policyRepository = mock(PolicyRepository.class);
    Entity.registerEntity(Policy.class, Entity.POLICY, policyRepository);
    Mockito.when(
            policyRepository.get(
                isNull(), any(UUID.class), isNull(), any(Include.class), anyBoolean()))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_ID.get(
                    new ImmutablePair<>(Entity.POLICY, i.getArgument(1))));
    Mockito.when(policyRepository.getReference(any(UUID.class), any(Include.class)))
        .thenAnswer(
            i -> {
              UUID id = i.getArgument(0);
              EntityInterface entity =
                  EntityRepository.CACHE_WITH_ID.getIfPresent(
                      new ImmutablePair<>(Entity.POLICY, id));
              return entity != null ? entity.getEntityReference() : null;
            });

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
    user =
        new User()
            .withName("user")
            .withRoles(userRolesRef)
            .withTeams(List.of(team111.getEntityReference()));
    EntityRepository.CACHE_WITH_NAME.put(new ImmutablePair<>(Entity.USER, "user"), user);

    // Set up mock CollectionDAO for batch relationship queries
    setupMockCollectionDAO();
  }

  private static void setupMockCollectionDAO() {
    CollectionDAO mockDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO mockRelDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    Mockito.when(mockDAO.relationshipDAO()).thenReturn(mockRelDAO);
    Entity.setCollectionDAO(mockDAO);

    // Mock findFromBatch with 5 params (for batchLoadAncestorTeamIds) - uses Include
    Mockito.when(
            mockRelDAO.findFromBatch(
                anyList(), anyInt(), anyString(), anyString(), any(Include.class)))
        .thenAnswer(
            invocation -> {
              List<String> toIds = invocation.getArgument(0);
              int relation = invocation.getArgument(1);
              if (relation != Relationship.PARENT_OF.ordinal()) {
                return new ArrayList<>();
              }
              List<CollectionDAO.EntityRelationshipObject> results = new ArrayList<>();
              for (String toIdStr : toIds) {
                UUID childId = UUID.fromString(toIdStr);
                for (Map.Entry<UUID, List<UUID>> entry : parentToChildren.entrySet()) {
                  UUID parentId = entry.getKey();
                  if (entry.getValue().contains(childId)) {
                    results.add(
                        CollectionDAO.EntityRelationshipObject.builder()
                            .fromId(parentId.toString())
                            .toId(toIdStr)
                            .fromEntity(Entity.TEAM)
                            .toEntity(Entity.TEAM)
                            .relation(relation)
                            .build());
                  }
                }
              }
              return results;
            });

    // Mock findToBatch for team->role and team->policy and role->policy
    Mockito.when(mockRelDAO.findToBatch(anyList(), anyInt(), anyString(), anyString()))
        .thenAnswer(
            invocation -> {
              List<String> fromIds = invocation.getArgument(0);
              int relation = invocation.getArgument(1);
              String fromEntityType = invocation.getArgument(2);
              String toEntityType = invocation.getArgument(3);
              if (relation != Relationship.HAS.ordinal()) {
                return new ArrayList<>();
              }
              List<CollectionDAO.EntityRelationshipObject> results = new ArrayList<>();
              for (String fromIdStr : fromIds) {
                UUID fromId = UUID.fromString(fromIdStr);
                Map<UUID, List<UUID>> sourceMap = null;
                if (Entity.TEAM.equals(fromEntityType) && Entity.ROLE.equals(toEntityType)) {
                  sourceMap = teamToRoleIds;
                } else if (Entity.TEAM.equals(fromEntityType)
                    && Entity.POLICY.equals(toEntityType)) {
                  sourceMap = teamToPolicyIds;
                } else if (Entity.ROLE.equals(fromEntityType)
                    && Entity.POLICY.equals(toEntityType)) {
                  sourceMap = roleToPolicyIds;
                }
                if (sourceMap != null && sourceMap.containsKey(fromId)) {
                  for (UUID toId : sourceMap.get(fromId)) {
                    results.add(
                        CollectionDAO.EntityRelationshipObject.builder()
                            .fromId(fromIdStr)
                            .toId(toId.toString())
                            .fromEntity(fromEntityType)
                            .toEntity(toEntityType)
                            .relation(relation)
                            .build());
                  }
                }
              }
              return results;
            });
  }

  @BeforeEach
  public void resetCache() {
    SubjectCache.invalidateAll();
  }

  @Test
  void testPolicyIterator() {
    // Check iteration order of the policies without resourceOwner
    SubjectContext subjectContext = SubjectContext.getSubjectContext(user.getName());
    Iterator<PolicyContext> policyContextIterator = subjectContext.getPolicies(null);

    // With batch loading, the policies are collected differently than with recursive iteration.
    // Verify all expected policies are present (order may differ due to batch loading).
    List<String> expectedPolicies = new ArrayList<>();
    expectedPolicies.addAll(getPolicyListFromRoles(userRoles));
    expectedPolicies.addAll(getAllTeamPolicies(team111Roles, team111Policies));
    expectedPolicies.addAll(getAllTeamPolicies(team11Roles, team11Policies));
    expectedPolicies.addAll(getAllTeamPolicies(team1Roles, team1Policies));
    expectedPolicies.addAll(getAllTeamPolicies(team12Roles, team12Policies));

    List<String> actualPolicies = new ArrayList<>();
    while (policyContextIterator.hasNext()) {
      actualPolicies.add(policyContextIterator.next().getPolicyName());
    }

    assertEquals(expectedPolicies.size(), actualPolicies.size());
    assertTrue(
        actualPolicies.containsAll(expectedPolicies),
        "All expected policies should be present. Missing: "
            + expectedPolicies.stream().filter(p -> !actualPolicies.contains(p)).toList());

    // Check policies with team13 as resource owner
    subjectContext = SubjectContext.getSubjectContext(user.getName());
    policyContextIterator = subjectContext.getPolicies(List.of(team13.getEntityReference()));
    List<String> expectedWithTeam13 = new ArrayList<>(expectedPolicies);
    expectedWithTeam13.addAll(getAllTeamPolicies(null, team13Policies));

    List<String> actualWithTeam13 = new ArrayList<>();
    while (policyContextIterator.hasNext()) {
      actualWithTeam13.add(policyContextIterator.next().getPolicyName());
    }
    assertEquals(expectedWithTeam13.size(), actualWithTeam13.size());
    assertTrue(actualWithTeam13.containsAll(expectedWithTeam13));

    // Check policies with team131 as resource owner
    subjectContext = SubjectContext.getSubjectContext(user.getName());
    policyContextIterator = subjectContext.getPolicies(List.of(team131.getEntityReference()));
    List<String> expectedWithTeam131 = new ArrayList<>(expectedPolicies);
    expectedWithTeam131.addAll(getAllTeamPolicies(null, team131Policies));
    expectedWithTeam131.addAll(getAllTeamPolicies(null, team13Policies));

    List<String> actualWithTeam131 = new ArrayList<>();
    while (policyContextIterator.hasNext()) {
      actualWithTeam131.add(policyContextIterator.next().getPolicyName());
    }
    assertEquals(expectedWithTeam131.size(), actualWithTeam131.size());
    assertTrue(actualWithTeam131.containsAll(expectedWithTeam131));
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
    assertTrue(subjectContext.isTeamAsset("team111", List.of(userOwner)));
    assertTrue(subjectContext.isTeamAsset("team11", List.of(userOwner)));
    assertTrue(subjectContext.isTeamAsset("team12", List.of(userOwner)));
    assertTrue(subjectContext.isTeamAsset("team1", List.of(userOwner)));
    assertFalse(subjectContext.isTeamAsset("team13", List.of(userOwner)));

    //
    // Given entity owner "team111", ensure isTeamAsset is true for 11, 12, 1 and not for 13
    //
    EntityReference teamOwner = new EntityReference().withId(team111.getId()).withType(Entity.TEAM);
    assertTrue(subjectContext.isTeamAsset("team11", List.of(teamOwner)));
    assertTrue(subjectContext.isTeamAsset("team12", List.of(teamOwner)));
    assertTrue(subjectContext.isTeamAsset("team1", List.of(teamOwner)));
    assertFalse(subjectContext.isTeamAsset("team13", List.of(teamOwner)));
  }

  private static List<Role> getRoles(String prefix) {
    // Create roles with 3 policies each and each policy with 3 rules
    List<Role> roles = new ArrayList<>(3);
    for (int i = 1; i <= 3; i++) {
      String name = prefix + "_role_" + i;
      List<Policy> rolePolicies = getPolicies(name);
      List<EntityReference> policyRefs = toEntityReferences(rolePolicies);
      Role role = new Role().withName(name).withId(UUID.randomUUID()).withPolicies(policyRefs);
      EntityRepository.CACHE_WITH_ID.put(new ImmutablePair<>(Entity.ROLE, role.getId()), role);

      // Track role->policy relationships for mock DAO
      List<UUID> policyIds = rolePolicies.stream().map(Policy::getId).toList();
      roleToPolicyIds.put(role.getId(), policyIds);

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
      rules.add(new Rule().withName(prefix + "rule" + 3));
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

    // Track parent->child relationships for mock DAO
    if (parents != null) {
      for (Team parent : parents) {
        parentToChildren.computeIfAbsent(parent.getId(), k -> new ArrayList<>()).add(team.getId());
      }
    }

    // Track team->role and team->policy relationships for mock DAO
    teamToRoleIds.put(team.getId(), roles.stream().map(Role::getId).toList());
    teamToPolicyIds.put(team.getId(), policies.stream().map(Policy::getId).toList());

    return team;
  }

  void assertPolicyIterator(
      List<String> expectedPolicyOrder, Iterator<PolicyContext> actualPolicyIterator) {
    int count = 0;
    while (actualPolicyIterator.hasNext()) {
      PolicyContext policyContext = actualPolicyIterator.next();
      assertEquals(expectedPolicyOrder.get(count), policyContext.getPolicyName());
      count++;
    }
    assertEquals(expectedPolicyOrder.size(), count);
  }

  @Test
  void testIsReviewer() {
    SubjectContext subjectContext = SubjectContext.getSubjectContext(user.getName());

    // Case 1: reviewers list is null or empty
    assertFalse(subjectContext.isReviewer(null), "Expected false when reviewers is null");
    assertFalse(
        subjectContext.isReviewer(new ArrayList<>()), "Expected false when reviewers is empty");

    // Case 2: reviewer is same user
    List<EntityReference> reviewers =
        List.of(new EntityReference().withType(Entity.USER).withName("user"));
    assertTrue(subjectContext.isReviewer(reviewers), "User should be reviewer if listed as USER");

    // Case 3: reviewer is one of the user's teams
    reviewers = List.of(new EntityReference().withType(Entity.TEAM).withName("team111"));
    assertTrue(
        subjectContext.isReviewer(reviewers),
        "User should be reviewer if their team is in reviewers list");

    // Case 4: reviewer list does not match user or their team
    reviewers =
        List.of(
            new EntityReference().withType(Entity.USER).withName("someone_else"),
            new EntityReference().withType(Entity.TEAM).withName("team13"));
    assertFalse(
        subjectContext.isReviewer(reviewers), "User should not be reviewer if no match found");
  }

  @Test
  void testCircularDependencyInTeamHierarchy() {
    // Test case 1: Direct circular dependency - team pointing to itself
    List<Role> circularTeamRoles = getRoles("circularTeam");
    List<Policy> circularTeamPolicies = getPolicies("circularTeam");
    Team circularTeam =
        new Team()
            .withName("circularTeam")
            .withId(UUID.randomUUID())
            .withDefaultRoles(toEntityReferences(circularTeamRoles))
            .withPolicies(toEntityReferences(circularTeamPolicies));
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.TEAM, circularTeam.getId()), circularTeam);
    teamToRoleIds.put(circularTeam.getId(), circularTeamRoles.stream().map(Role::getId).toList());
    teamToPolicyIds.put(
        circularTeam.getId(), circularTeamPolicies.stream().map(Policy::getId).toList());

    // Create circular reference - team points to itself as parent
    circularTeam.setParents(List.of(circularTeam.getEntityReference()));
    parentToChildren
        .computeIfAbsent(circularTeam.getId(), k -> new ArrayList<>())
        .add(circularTeam.getId());

    // Test getRolesForTeams - should not cause StackOverflowError
    List<EntityReference> roles =
        SubjectContext.getRolesForTeams(List.of(circularTeam.getEntityReference()));
    assertFalse(roles.isEmpty(), "Should return roles even with circular dependency");

    // Test isInTeam - should not cause infinite loop
    boolean result = SubjectContext.isInTeam("circularTeam", circularTeam.getEntityReference());
    assertTrue(result, "Team should be found in its own hierarchy");

    // Test case 2: Indirect circular dependency - teamA -> teamB -> teamA
    List<Role> teamARoles = getRoles("teamA");
    List<Policy> teamAPolicies = getPolicies("teamA");
    Team teamA =
        new Team()
            .withName("teamA")
            .withId(UUID.randomUUID())
            .withDefaultRoles(toEntityReferences(teamARoles))
            .withPolicies(toEntityReferences(teamAPolicies));
    EntityRepository.CACHE_WITH_ID.put(new ImmutablePair<>(Entity.TEAM, teamA.getId()), teamA);
    teamToRoleIds.put(teamA.getId(), teamARoles.stream().map(Role::getId).toList());
    teamToPolicyIds.put(teamA.getId(), teamAPolicies.stream().map(Policy::getId).toList());

    List<Role> teamBRoles = getRoles("teamB");
    List<Policy> teamBPolicies = getPolicies("teamB");
    Team teamB =
        new Team()
            .withName("teamB")
            .withId(UUID.randomUUID())
            .withDefaultRoles(toEntityReferences(teamBRoles))
            .withPolicies(toEntityReferences(teamBPolicies));
    EntityRepository.CACHE_WITH_ID.put(new ImmutablePair<>(Entity.TEAM, teamB.getId()), teamB);
    teamToRoleIds.put(teamB.getId(), teamBRoles.stream().map(Role::getId).toList());
    teamToPolicyIds.put(teamB.getId(), teamBPolicies.stream().map(Policy::getId).toList());

    // Create circular dependency: teamA -> teamB -> teamA
    teamA.setParents(List.of(teamB.getEntityReference()));
    teamB.setParents(List.of(teamA.getEntityReference()));
    parentToChildren.computeIfAbsent(teamB.getId(), k -> new ArrayList<>()).add(teamA.getId());
    parentToChildren.computeIfAbsent(teamA.getId(), k -> new ArrayList<>()).add(teamB.getId());

    // Test getRolesForTeams - should not cause StackOverflowError
    List<EntityReference> rolesA =
        SubjectContext.getRolesForTeams(List.of(teamA.getEntityReference()));
    assertFalse(rolesA.isEmpty(), "Should return roles even with circular dependency");

    // Test isInTeam - should not cause infinite loop
    boolean resultA = SubjectContext.isInTeam("teamA", teamB.getEntityReference());
    assertTrue(resultA, "Team B should be found in team A hierarchy due to circular dependency");

    // Test hasRole with circular dependency
    User userWithCircularTeam =
        new User()
            .withName("circularUser")
            .withRoles(new ArrayList<>())
            .withTeams(List.of(teamA.getEntityReference()));
    EntityRepository.CACHE_WITH_NAME.put(
        new ImmutablePair<>(Entity.USER, "circularUser"), userWithCircularTeam);

    // Should not throw StackOverflowError
    boolean hasRoleResult = SubjectContext.hasRole(userWithCircularTeam, "teamA_role_1");
    assertTrue(
        hasRoleResult, "User should have role from team hierarchy even with circular dependency");

    // Test policy iteration with circular dependency - should not cause infinite loop
    SubjectContext subjectContext = SubjectContext.getSubjectContext("circularUser");
    Iterator<PolicyContext> policyIterator = subjectContext.getPolicies(null);
    int policyCount = 0;
    int maxPolicies = 1000; // Safety limit to prevent infinite loop in test
    while (policyIterator.hasNext() && policyCount < maxPolicies) {
      policyIterator.next();
      policyCount++;
    }
    assertTrue(
        policyCount < maxPolicies,
        "Policy iteration should terminate without infinite loop with circular dependency");
  }
}
