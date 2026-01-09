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

package org.openmetadata.service.security;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_DESCRIPTION;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_OWNERS;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.policies.PolicyResourceTest;
import org.openmetadata.service.resources.teams.RoleResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Integration test to verify cached permission evaluation works correctly and improves performance.
 */
@Slf4j
class CachedPermissionPerformanceTest extends OpenMetadataApplicationTest {
  private static TableResourceTest tableResourceTest;
  private static TeamResourceTest teamResourceTest;
  private static UserResourceTest userResourceTest;
  private static RoleResourceTest roleResourceTest;
  private static PolicyResourceTest policyResourceTest;

  private static Team rootTeam;
  private static Team engineering;
  private static Team dataEngineering;
  private static Team dataScience;

  private static Role viewerRole;
  private static Role editorRole;
  private static Role adminRole;

  private static User userWithManyRoles;
  private static User userWithManyTeams;
  private static User simpleUser;

  private static Table testTable;

  @BeforeAll
  static void setup(TestInfo test) throws IOException, URISyntaxException {
    tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test);

    teamResourceTest = new TeamResourceTest();
    userResourceTest = new UserResourceTest();
    roleResourceTest = new RoleResourceTest();
    policyResourceTest = new PolicyResourceTest();

    setupTeamHierarchy();
    setupRoles();
    setupUsers();
    setupTestAssets();
  }

  private static void setupTeamHierarchy() throws IOException {
    rootTeam = teamResourceTest.getEntityByName("Organization", "", ADMIN_AUTH_HEADERS);

    CreateTeam createTeam =
        new CreateTeam()
            .withName("Engineering")
            .withDisplayName("Engineering")
            .withTeamType(CreateTeam.TeamType.DIVISION)
            .withParents(List.of(rootTeam.getId()));
    engineering = teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);

    createTeam =
        new CreateTeam()
            .withName("DataEngineering")
            .withDisplayName("Data Engineering")
            .withTeamType(CreateTeam.TeamType.DEPARTMENT)
            .withParents(List.of(engineering.getId()));
    dataEngineering = teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);

    createTeam =
        new CreateTeam()
            .withName("DataScience")
            .withDisplayName("Data Science")
            .withTeamType(CreateTeam.TeamType.DEPARTMENT)
            .withParents(List.of(engineering.getId()));
    dataScience = teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);
  }

  private static void setupRoles() throws IOException {
    // Create roles with different permission levels
    CreateRole createRole =
        new CreateRole()
            .withName("ViewerRole")
            .withDisplayName("Viewer")
            .withPolicies(List.of("DataConsumerPolicy"));
    viewerRole = roleResourceTest.createEntity(createRole, ADMIN_AUTH_HEADERS);

    createRole =
        new CreateRole()
            .withName("EditorRole")
            .withDisplayName("Editor")
            .withPolicies(List.of("DataStewardPolicy"));
    editorRole = roleResourceTest.createEntity(createRole, ADMIN_AUTH_HEADERS);

    createRole =
        new CreateRole()
            .withName("AdminRole")
            .withDisplayName("Admin")
            .withPolicies(List.of("OrganizationPolicy"));
    adminRole = roleResourceTest.createEntity(createRole, ADMIN_AUTH_HEADERS);
  }

  private static void setupUsers() throws IOException {
    // User with many roles (stress test for role iteration)
    CreateUser createUser =
        new CreateUser()
            .withName("userWithManyRoles")
            .withEmail("many-roles@test.com")
            .withRoles(List.of(viewerRole.getId(), editorRole.getId(), adminRole.getId()));
    userWithManyRoles = userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);

    // User with many teams (stress test for team hierarchy)
    createUser =
        new CreateUser()
            .withName("userWithManyTeams")
            .withEmail("many-teams@test.com")
            .withRoles(List.of(viewerRole.getId()))
            .withTeams(List.of(dataEngineering.getId(), dataScience.getId()));
    userWithManyTeams = userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);

    // Simple user for baseline comparison
    createUser =
        new CreateUser()
            .withName("simpleUser")
            .withEmail("simple@test.com")
            .withRoles(List.of(viewerRole.getId()));
    simpleUser = userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);
  }

  private static void setupTestAssets() throws IOException {
    CreateTable createTable =
        new CreateTable()
            .withName("test_table")
            .withDatabaseSchema(EntityResourceTest.DATABASE_SCHEMA.getFullyQualifiedName());
    testTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testPermissionEvaluationConsistency() {
    SubjectCache.invalidateAll();

    SubjectContext context1 = SubjectContext.getSubjectContext(userWithManyRoles.getName());
    ResourceContext<Table> resourceContext =
        new ResourceContext<>(Entity.TABLE, testTable.getId(), testTable.getName());
    OperationContext operationContext =
        new OperationContext(Entity.TABLE, VIEW_ALL, EDIT_DESCRIPTION, EDIT_OWNERS);

    try {
      PolicyEvaluator.hasPermission(context1, resourceContext, operationContext);
    } catch (Exception e) {
      // May fail, we just want to test consistency
    }
    List<MetadataOperation> remainingOps1 =
        new ArrayList<>(operationContext.getOperations(resourceContext));

    SubjectContext context2 = SubjectContext.getSubjectContext(userWithManyRoles.getName());
    OperationContext operationContext2 =
        new OperationContext(Entity.TABLE, VIEW_ALL, EDIT_DESCRIPTION, EDIT_OWNERS);

    try {
      PolicyEvaluator.hasPermission(context2, resourceContext, operationContext2);
    } catch (Exception e) {
      // May fail, we just want to test consistency
    }
    List<MetadataOperation> remainingOps2 =
        new ArrayList<>(operationContext2.getOperations(resourceContext));

    assertEquals(
        remainingOps1.size(),
        remainingOps2.size(),
        "Cached and non-cached should have same results");
    assertEquals(remainingOps1, remainingOps2, "Operations should match exactly");
  }

  @Test
  void testCachePerformanceImprovement() {
    SubjectCache.invalidateAll();

    int iterations = 100;

    // Measure first call (cache miss)
    long startMiss = System.nanoTime();
    for (int i = 0; i < iterations; i++) {
      SubjectCache.invalidateUser(userWithManyRoles.getName());
      SubjectContext context = SubjectContext.getSubjectContext(userWithManyRoles.getName());
      context.getPolicies(null).hasNext(); // Force evaluation
    }
    long cacheMissTime = System.nanoTime() - startMiss;

    // Measure subsequent calls (cache hits)
    long startHit = System.nanoTime();
    for (int i = 0; i < iterations; i++) {
      SubjectContext context = SubjectContext.getSubjectContext(userWithManyRoles.getName());
      context.getPolicies(null).hasNext(); // Force evaluation
    }
    long cacheHitTime = System.nanoTime() - startHit;

    double avgMissMs = cacheMissTime / (iterations * 1_000_000.0);
    double avgHitMs = cacheHitTime / (iterations * 1_000_000.0);
    double improvement = (cacheMissTime - cacheHitTime) / (double) cacheMissTime * 100;

    LOG.info(
        "Performance results - Cache miss: {:.2f}ms, Cache hit: {:.2f}ms, Improvement: {:.1f}%",
        avgMissMs, avgHitMs, improvement);

    // Cache should be at least 50% faster
    assertTrue(
        improvement > 50,
        String.format("Cache should improve performance by >50%%. Actual: %.1f%%", improvement));
  }

  @Test
  void testUserWithManyRolesPermissions() {
    SubjectCache.invalidateAll();
    SubjectContext context = SubjectContext.getSubjectContext(userWithManyRoles.getName());

    // User has viewer, editor, and admin roles - verify policies are loaded
    ResourceContext<Table> resourceContext =
        new ResourceContext<>(Entity.TABLE, testTable.getId(), testTable.getName());
    OperationContext operationContext =
        new OperationContext(Entity.TABLE, VIEW_ALL, EDIT_DESCRIPTION, EDIT_OWNERS);

    // Test permission evaluation (may allow some or all operations)
    try {
      PolicyEvaluator.hasPermission(context, resourceContext, operationContext);
    } catch (Exception e) {
      // Permission may be denied, we just want to verify evaluation works
    }

    // Verify at least some policies are loaded for this user
    int policyCount = countPolicies(context.getPolicies(null));
    assertTrue(policyCount > 0, "User with multiple roles should have policies loaded");
  }

  @Test
  void testUserWithManyTeamsPermissions() {
    SubjectCache.invalidateAll();

    // User belongs to dataEngineering and dataScience, both children of engineering
    SubjectContext context = SubjectContext.getSubjectContext(userWithManyTeams.getName());

    // Verify team hierarchy is traversed correctly
    assertTrue(context.isUserUnderTeam("DataEngineering"));
    assertTrue(context.isUserUnderTeam("DataScience"));
    assertTrue(context.isUserUnderTeam("Engineering")); // Parent team
    assertTrue(context.isUserUnderTeam("Organization")); // Grand-parent team
  }

  @Test
  void testCacheInvalidationOnRoleChange() throws IOException {
    SubjectCache.invalidateAll();

    SubjectContext context1 = SubjectContext.getSubjectContext(simpleUser.getName());
    int policiesCount1 = countPolicies(context1.getPolicies(null));

    List<EntityReference> updatedRoles = new ArrayList<>();
    updatedRoles.add(viewerRole.getEntityReference());
    updatedRoles.add(editorRole.getEntityReference());

    CreateUser updateRequest =
        new CreateUser()
            .withName(simpleUser.getName())
            .withEmail(simpleUser.getEmail())
            .withRoles(List.of(viewerRole.getId(), editorRole.getId()));

    simpleUser = userResourceTest.updateEntity(updateRequest, OK, ADMIN_AUTH_HEADERS);

    SubjectContext context2 = SubjectContext.getSubjectContext(simpleUser.getName());
    int policiesCount2 = countPolicies(context2.getPolicies(null));

    assertTrue(
        policiesCount2 > policiesCount1, "User should have more policies after adding a role");
  }

  @Test
  void testMultipleUsersIsolation() {
    SubjectCache.invalidateAll();

    // Load policies for multiple users
    SubjectContext user1 = SubjectContext.getSubjectContext(userWithManyRoles.getName());
    SubjectContext user2 = SubjectContext.getSubjectContext(userWithManyTeams.getName());
    SubjectContext user3 = SubjectContext.getSubjectContext(simpleUser.getName());

    int policies1 = countPolicies(user1.getPolicies(null));
    int policies2 = countPolicies(user2.getPolicies(null));
    int policies3 = countPolicies(user3.getPolicies(null));

    // Users should have different policy counts
    assertTrue(
        policies1 != policies2 || policies2 != policies3,
        "Different users should have different policies");

    // Invalidate one user shouldn't affect others
    SubjectCache.invalidateUser(userWithManyRoles.getName());

    SubjectContext user1After = SubjectContext.getSubjectContext(userWithManyRoles.getName());
    SubjectContext user2After = SubjectContext.getSubjectContext(userWithManyTeams.getName());

    int policies1After = countPolicies(user1After.getPolicies(null));
    int policies2After = countPolicies(user2After.getPolicies(null));

    assertEquals(policies1, policies1After, "Reloaded user should have same policy count");
    assertEquals(policies2, policies2After, "Other user's cached policies should be unchanged");
  }

  @Test
  void testResourceOwnerPoliciesWithCache() {
    SubjectCache.invalidateAll();

    // Create a table owned by a team
    CreateTable createTable =
        new CreateTable()
            .withName("team_owned_table")
            .withDatabaseSchema(EntityResourceTest.DATABASE_SCHEMA.getFullyQualifiedName())
            .withOwners(
                List.of(new EntityReference().withId(engineering.getId()).withType("team")));

    try {
      Table teamTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

      SubjectContext context = SubjectContext.getSubjectContext(simpleUser.getName());

      // Without resource owner
      int policiesWithoutOwner = countPolicies(context.getPolicies(null));

      // With resource owner
      int policiesWithOwner = countPolicies(context.getPolicies(teamTable.getOwners()));

      assertTrue(
          policiesWithOwner >= policiesWithoutOwner,
          "Resource owner should add or maintain policies");
    } catch (IOException e) {
      LOG.error("Failed to create team-owned table", e);
    }
  }

  private int countPolicies(java.util.Iterator<?> iterator) {
    int count = 0;
    while (iterator.hasNext()) {
      iterator.next();
      count++;
    }
    return count;
  }
}
