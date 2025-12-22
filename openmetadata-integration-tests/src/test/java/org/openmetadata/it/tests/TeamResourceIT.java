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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ImageList;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Team entity operations.
 *
 * <p>Extends BaseEntityIT to inherit all common entity tests. Adds team-specific tests for
 * hierarchy, users, roles, policies, and team types.
 *
 * <p>Migrated from: org.openmetadata.service.resources.teams.TeamResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class TeamResourceIT extends BaseEntityIT<Team, CreateTeam> {

  private static final Profile PROFILE =
      new Profile().withImages(new ImageList().withImage(URI.create("https://image.com")));

  public TeamResourceIT() {
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = true;
    supportsDataProducts = false;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = true;
  }

  @Override
  protected CreateTeam createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    return new CreateTeam()
        .withName(ns.prefix("team"))
        .withTeamType(TeamType.GROUP)
        .withProfile(PROFILE)
        .withDescription("Test team created by integration test");
  }

  @Override
  protected CreateTeam createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    return new CreateTeam()
        .withName(name)
        .withTeamType(TeamType.GROUP)
        .withProfile(PROFILE)
        .withDescription("Test team");
  }

  @Override
  protected Team createEntity(CreateTeam createRequest, OpenMetadataClient client) {
    return client.teams().create(createRequest);
  }

  @Override
  protected Team getEntity(String id, OpenMetadataClient client) {
    return client.teams().get(id);
  }

  @Override
  protected Team getEntityByName(String fqn, OpenMetadataClient client) {
    return client.teams().getByName(fqn);
  }

  @Override
  protected Team patchEntity(String id, Team entity, OpenMetadataClient client) {
    entity.setChildrenCount(null);
    entity.setUserCount(null);
    return client.teams().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.teams().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.teams().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    client.teams().delete(id, java.util.Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "team";
  }

  @Override
  protected void validateCreatedEntity(Team entity, CreateTeam createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getTeamType(), entity.getTeamType());
    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected Team getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.teams().get(id, fields);
  }

  @Override
  protected Team getEntityByNameWithFields(String fqn, String fields, OpenMetadataClient client) {
    return client.teams().getByName(fqn, fields);
  }

  @Override
  protected Team getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.teams().get(id, null, "deleted");
  }

  @Override
  protected ListResponse<Team> listEntities(ListParams params, OpenMetadataClient client) {
    return client.teams().list(params);
  }

  // ===================================================================
  // TEAM-SPECIFIC TESTS
  // ===================================================================

  @Test
  void test_createTeamWithDifferentTypes(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TeamType[] types = {
      TeamType.GROUP, TeamType.DEPARTMENT, TeamType.DIVISION, TeamType.BUSINESS_UNIT
    };

    for (TeamType type : types) {
      CreateTeam create =
          new CreateTeam()
              .withName(ns.prefix("team_" + type.value()))
              .withTeamType(type)
              .withDescription("Team of type " + type.value());

      Team team = createEntity(create, client);
      assertEquals(type, team.getTeamType());
    }
  }

  @Test
  void test_createOrganizationNotAllowed(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("org_test"))
            .withTeamType(TeamType.ORGANIZATION)
            .withDescription("Organization team");

    assertThrows(
        Exception.class,
        () -> createEntity(create, client),
        "Creating an Organization team should not be allowed");
  }

  @Test
  void test_deleteOrganizationNotAllowed(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Team org = client.teams().getByName("Organization");
    assertNotNull(org);

    assertThrows(
        Exception.class,
        () -> deleteEntity(org.getId().toString(), client),
        "Deleting the Organization team should not be allowed");
  }

  @Test
  void test_createTeamWithUsers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    User user1 = createTestUser(ns, "teamUser1", client);
    User user2 = createTestUser(ns, "teamUser2", client);

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("teamWithUsers"))
            .withTeamType(TeamType.GROUP)
            .withUsers(List.of(user1.getId(), user2.getId()))
            .withDescription("Team with users");

    Team team = createEntity(create, client);
    assertNotNull(team.getId());

    Team fetched = client.teams().get(team.getId().toString(), "users");
    assertNotNull(fetched.getUsers());
    assertEquals(2, fetched.getUsers().size());
  }

  @Test
  void test_createTeamWithDefaultRoles(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    UUID roleId = dataStewardRole().getId();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("teamWithRoles"))
            .withTeamType(TeamType.GROUP)
            .withDefaultRoles(List.of(roleId))
            .withDescription("Team with default roles");

    Team team = createEntity(create, client);
    assertNotNull(team.getId());

    Team fetched = client.teams().get(team.getId().toString(), "defaultRoles");
    assertNotNull(fetched.getDefaultRoles());
    assertTrue(fetched.getDefaultRoles().size() >= 1);
    assertTrue(fetched.getDefaultRoles().stream().anyMatch(r -> r.getId().equals(roleId)));
  }

  @Test
  void test_createTeamWithPolicies(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    UUID policy1Id = shared().POLICY1.getId();
    UUID policy2Id = shared().POLICY2.getId();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("teamWithPolicies"))
            .withTeamType(TeamType.GROUP)
            .withPolicies(List.of(policy1Id, policy2Id))
            .withDescription("Team with policies");

    Team team = createEntity(create, client);
    assertNotNull(team.getId());

    Team fetched = client.teams().get(team.getId().toString(), "policies");
    assertNotNull(fetched.getPolicies());
    assertEquals(2, fetched.getPolicies().size());
  }

  @Test
  void test_createTeamWithProfile(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("teamWithProfile"))
            .withTeamType(TeamType.GROUP)
            .withProfile(PROFILE)
            .withDescription("Team with profile");

    Team team = createEntity(create, client);
    assertNotNull(team.getProfile());
    assertNotNull(team.getProfile().getImages());
  }

  @Test
  void test_createTeamWithEmail(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String email = toValidEmail(ns.prefix("emailTeam"));
    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("teamWithEmail"))
            .withTeamType(TeamType.GROUP)
            .withEmail(email)
            .withDescription("Team with email");

    Team team = createEntity(create, client);
    assertEquals(email, team.getEmail());
  }

  private String toValidEmail(String name) {
    String sanitized = name.replaceAll("[^a-zA-Z0-9._-]", "");
    sanitized = sanitized.replaceAll("^\\.+|\\.+$", "");
    sanitized = sanitized.replaceAll("\\.{2,}", ".");
    sanitized = sanitized.replaceAll("_{2,}", "_");
    sanitized = sanitized.replaceAll("-{2,}", "-");
    if (sanitized.length() > 60) {
      sanitized = sanitized.substring(0, 52) + UUID.randomUUID().toString().substring(0, 8);
    }
    return sanitized + "@openmetadata.org";
  }

  @Test
  void test_createTeamIsJoinable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam createJoinable =
        new CreateTeam()
            .withName(ns.prefix("joinableTeam"))
            .withTeamType(TeamType.GROUP)
            .withIsJoinable(true)
            .withDescription("Joinable team");

    Team joinableTeam = createEntity(createJoinable, client);
    assertTrue(joinableTeam.getIsJoinable());

    CreateTeam createNotJoinable =
        new CreateTeam()
            .withName(ns.prefix("notJoinableTeam"))
            .withTeamType(TeamType.GROUP)
            .withIsJoinable(false)
            .withDescription("Not joinable team");

    Team notJoinableTeam = createEntity(createNotJoinable, client);
    assertFalse(notJoinableTeam.getIsJoinable());
  }

  @Test
  void test_teamHierarchy_parentChild(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Team orgTeam = client.teams().getByName("Organization");

    CreateTeam createBu =
        new CreateTeam()
            .withName(ns.prefix("bu"))
            .withTeamType(TeamType.BUSINESS_UNIT)
            .withParents(List.of(orgTeam.getId()))
            .withDescription("Business unit");

    Team bu = createEntity(createBu, client);
    assertNotNull(bu.getId());

    CreateTeam createDiv =
        new CreateTeam()
            .withName(ns.prefix("div"))
            .withTeamType(TeamType.DIVISION)
            .withParents(List.of(bu.getId()))
            .withDescription("Division under BU");

    Team div = createEntity(createDiv, client);

    CreateTeam createDept =
        new CreateTeam()
            .withName(ns.prefix("dept"))
            .withTeamType(TeamType.DEPARTMENT)
            .withParents(List.of(div.getId()))
            .withDescription("Department under division");

    Team dept = createEntity(createDept, client);

    Team fetchedBu = client.teams().get(bu.getId().toString(), "children");
    assertNotNull(fetchedBu.getChildren());
    assertTrue(fetchedBu.getChildren().stream().anyMatch(c -> c.getId().equals(div.getId())));

    Team fetchedDiv = client.teams().get(div.getId().toString(), "parents,children");
    assertNotNull(fetchedDiv.getParents());
    assertTrue(fetchedDiv.getParents().stream().anyMatch(p -> p.getId().equals(bu.getId())));
    assertNotNull(fetchedDiv.getChildren());
    assertTrue(fetchedDiv.getChildren().stream().anyMatch(c -> c.getId().equals(dept.getId())));
  }

  @Test
  void test_invalidHierarchy_groupCannotHaveChildren(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam createGroup =
        new CreateTeam()
            .withName(ns.prefix("groupParent"))
            .withTeamType(TeamType.GROUP)
            .withDescription("Group team");

    Team group = createEntity(createGroup, client);

    CreateTeam createChild =
        new CreateTeam()
            .withName(ns.prefix("childOfGroup"))
            .withTeamType(TeamType.GROUP)
            .withChildren(List.of(group.getId()))
            .withDescription("Child of group");

    assertThrows(
        Exception.class,
        () -> createEntity(createChild, client),
        "Groups cannot have team children");
  }

  @Test
  void test_invalidHierarchy_departmentCannotBeParentOfDivision(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam createDept =
        new CreateTeam()
            .withName(ns.prefix("deptParent"))
            .withTeamType(TeamType.DEPARTMENT)
            .withDescription("Department team");

    Team dept = createEntity(createDept, client);

    CreateTeam createDiv =
        new CreateTeam()
            .withName(ns.prefix("divUnderDept"))
            .withTeamType(TeamType.DIVISION)
            .withParents(List.of(dept.getId()))
            .withDescription("Division under department");

    assertThrows(
        Exception.class,
        () -> createEntity(createDiv, client),
        "Department cannot be parent of Division");
  }

  @Test
  void test_updateTeamDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create = createMinimalRequest(ns, client);
    Team team = createEntity(create, client);

    team.setDisplayName("Updated Team Name");
    Team updated = patchEntity(team.getId().toString(), team, client);

    assertEquals("Updated Team Name", updated.getDisplayName());
  }

  @Test
  void test_updateTeamDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create = createMinimalRequest(ns, client);
    Team team = createEntity(create, client);

    team.setDescription("Updated description");
    Team updated = patchEntity(team.getId().toString(), team, client);

    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_updateTeamIsJoinable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("joinableUpdate"))
            .withTeamType(TeamType.GROUP)
            .withIsJoinable(false)
            .withDescription("Initially not joinable");

    Team team = createEntity(create, client);
    assertFalse(team.getIsJoinable());

    team.setIsJoinable(true);
    Team updated = patchEntity(team.getId().toString(), team, client);

    assertTrue(updated.getIsJoinable());
  }

  @Test
  void test_addUserToTeam(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("addUserTeam"))
            .withTeamType(TeamType.GROUP)
            .withDescription("Team to add user");

    Team team = createEntity(create, client);

    User user = createTestUser(ns, "addedUser", client);

    Team fetched = client.teams().get(team.getId().toString(), "users");
    fetched.setUsers(List.of(user.getEntityReference()));
    Team updated = patchEntity(fetched.getId().toString(), fetched, client);

    Team verifyFetch = client.teams().get(updated.getId().toString(), "users");
    assertNotNull(verifyFetch.getUsers());
    assertTrue(verifyFetch.getUsers().stream().anyMatch(u -> u.getId().equals(user.getId())));
  }

  @Test
  void test_addDefaultRoleToTeam(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("addRoleTeam"))
            .withTeamType(TeamType.GROUP)
            .withDescription("Team to add role");

    Team team = createEntity(create, client);

    EntityReference roleRef = dataStewardRole().getEntityReference();

    Team fetched = client.teams().get(team.getId().toString(), "defaultRoles");
    fetched.setDefaultRoles(List.of(roleRef));
    Team updated = patchEntity(fetched.getId().toString(), fetched, client);

    Team verifyFetch = client.teams().get(updated.getId().toString(), "defaultRoles");
    assertNotNull(verifyFetch.getDefaultRoles());
    assertTrue(
        verifyFetch.getDefaultRoles().stream().anyMatch(r -> r.getId().equals(roleRef.getId())));
  }

  @Test
  void test_addPolicyToTeam(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("addPolicyTeam"))
            .withTeamType(TeamType.GROUP)
            .withDescription("Team to add policy");

    Team team = createEntity(create, client);

    EntityReference policyRef = shared().POLICY1.getEntityReference();

    Team fetched = client.teams().get(team.getId().toString(), "policies");
    fetched.setPolicies(List.of(policyRef));
    Team updated = patchEntity(fetched.getId().toString(), fetched, client);

    Team verifyFetch = client.teams().get(updated.getId().toString(), "policies");
    assertNotNull(verifyFetch.getPolicies());
    assertTrue(
        verifyFetch.getPolicies().stream().anyMatch(p -> p.getId().equals(policyRef.getId())));
  }

  @Test
  void test_updateTeamEmail(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("emailUpdate"))
            .withTeamType(TeamType.GROUP)
            .withDescription("Team for email update");

    Team team = createEntity(create, client);
    assertNull(team.getEmail());

    String newEmail = toValidEmail("updated_" + ns.prefix("team"));
    team.setEmail(newEmail);
    Team updated = patchEntity(team.getId().toString(), team, client);

    assertEquals(newEmail, updated.getEmail());
  }

  @Test
  void test_deleteTeamRecursive(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Team orgTeam = client.teams().getByName("Organization");

    CreateTeam createBu =
        new CreateTeam()
            .withName(ns.prefix("deleteBu"))
            .withTeamType(TeamType.BUSINESS_UNIT)
            .withParents(List.of(orgTeam.getId()))
            .withDescription("BU for delete test");

    Team bu = createEntity(createBu, client);

    CreateTeam createDiv =
        new CreateTeam()
            .withName(ns.prefix("deleteDiv"))
            .withTeamType(TeamType.DIVISION)
            .withParents(List.of(bu.getId()))
            .withDescription("Division for delete test");

    Team div = createEntity(createDiv, client);

    hardDeleteEntity(bu.getId().toString(), client);

    String buId = bu.getId().toString();
    assertThrows(Exception.class, () -> getEntity(buId, client), "Parent team should be deleted");

    String divId = div.getId().toString();
    assertThrows(
        Exception.class, () -> getEntity(divId, client), "Child team should be cascade deleted");
  }

  @Test
  void test_softDeleteAndRestoreTeam(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create = createMinimalRequest(ns, client);
    Team team = createEntity(create, client);
    String teamId = team.getId().toString();

    deleteEntity(teamId, client);

    assertThrows(
        Exception.class, () -> getEntity(teamId, client), "Deleted team should not be retrievable");

    Team deleted = getEntityIncludeDeleted(teamId, client);
    assertTrue(deleted.getDeleted());

    restoreEntity(teamId, client);

    Team restored = getEntity(teamId, client);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_teamVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create = createMinimalRequest(ns, client);
    Team team = createEntity(create, client);
    assertEquals(0.1, team.getVersion(), 0.001);

    team.setDescription("Updated description v1");
    Team v2 = patchEntity(team.getId().toString(), team, client);
    assertEquals(0.2, v2.getVersion(), 0.001);

    v2.setDescription("Updated description v2");
    Team v3 = patchEntity(v2.getId().toString(), v2, client);
    assertTrue(v3.getVersion() >= 0.2);

    var history = client.teams().getVersionList(team.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_teamWithDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String domainFqn = testDomain().getFullyQualifiedName();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("teamWithDomain"))
            .withTeamType(TeamType.GROUP)
            .withDomains(List.of(domainFqn))
            .withDescription("Team with domain");

    Team team = createEntity(create, client);
    assertNotNull(team.getId());

    Team fetched = client.teams().get(team.getId().toString(), "domains");
    assertNotNull(fetched.getDomains());
    assertFalse(fetched.getDomains().isEmpty());
    assertTrue(
        fetched.getDomains().stream().anyMatch(d -> d.getFullyQualifiedName().equals(domainFqn)));
  }

  @Test
  void test_inheritedRoles(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Team orgTeam = client.teams().getByName("Organization", "defaultRoles");

    CreateTeam createDept =
        new CreateTeam()
            .withName(ns.prefix("inheritDept"))
            .withTeamType(TeamType.DEPARTMENT)
            .withDescription("Department to check role inheritance");

    Team dept = createEntity(createDept, client);

    Team fetchedDept = client.teams().get(dept.getId().toString(), "defaultRoles");
    assertNotNull(fetchedDept.getInheritedRoles());
    assertTrue(fetchedDept.getInheritedRoles().size() >= 1);
  }

  @Test
  void test_teamsDefaultToOrganizationParent(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("noParentTeam"))
            .withTeamType(TeamType.DEPARTMENT)
            .withDescription("Team without explicit parent");

    Team team = createEntity(create, client);

    Team fetched = client.teams().get(team.getId().toString(), "parents");
    assertNotNull(fetched.getParents());
    assertTrue(fetched.getParents().stream().anyMatch(p -> p.getName().equals("Organization")));
  }

  @Test
  void test_listTeams(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 3; i++) {
      CreateTeam create =
          new CreateTeam()
              .withName(ns.prefix("listTeam" + i))
              .withTeamType(TeamType.GROUP)
              .withDescription("Team for list test");
      createEntity(create, client);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Team> response = listEntities(params, client);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_listTeamsWithParentTeamFilter(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create parent team
    CreateTeam createParent =
        new CreateTeam()
            .withName(ns.prefix("parentForList"))
            .withTeamType(TeamType.DEPARTMENT)
            .withDescription("Parent team for filter test");
    Team parent = createEntity(createParent, client);

    // Create child teams
    CreateTeam createChild1 =
        new CreateTeam()
            .withName(ns.prefix("child1ForList"))
            .withTeamType(TeamType.GROUP)
            .withParents(List.of(parent.getId()))
            .withDescription("Child 1");
    Team child1 = createEntity(createChild1, client);

    CreateTeam createChild2 =
        new CreateTeam()
            .withName(ns.prefix("child2ForList"))
            .withTeamType(TeamType.GROUP)
            .withParents(List.of(parent.getId()))
            .withDescription("Child 2");
    Team child2 = createEntity(createChild2, client);

    // List teams with parent filter
    ListParams params = new ListParams();
    params.setLimit(100);
    params.addFilter("parentTeam", parent.getName());
    ListResponse<Team> response = listEntities(params, client);

    assertNotNull(response.getData());
    assertEquals(2, response.getData().size());
    assertTrue(response.getData().stream().anyMatch(t -> t.getId().equals(child1.getId())));
    assertTrue(response.getData().stream().anyMatch(t -> t.getId().equals(child2.getId())));
  }

  @Test
  void test_inheritDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create parent team with domain
    String domainFqn = testDomain().getFullyQualifiedName();
    CreateTeam createParent =
        new CreateTeam()
            .withName(ns.prefix("parentWithDomain"))
            .withTeamType(TeamType.DEPARTMENT)
            .withDomains(List.of(domainFqn))
            .withDescription("Parent with domain");
    Team parent = createEntity(createParent, client);

    // Create child team without domain - should inherit from parent
    CreateTeam createChild =
        new CreateTeam()
            .withName(ns.prefix("childInheritDomain"))
            .withTeamType(TeamType.GROUP)
            .withParents(List.of(parent.getId()))
            .withDescription("Child without explicit domain");
    Team child = createEntity(createChild, client);

    // Fetch child with domains field
    Team fetchedChild = client.teams().get(child.getId().toString(), "domains");
    assertNotNull(fetchedChild.getDomains());
    assertFalse(fetchedChild.getDomains().isEmpty());
    assertTrue(
        fetchedChild.getDomains().stream()
            .anyMatch(d -> d.getFullyQualifiedName().equals(domainFqn)));
  }

  @Test
  void test_updateTeamParent(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Team orgTeam = client.teams().getByName("Organization");

    // Create two business units
    CreateTeam createBu1 =
        new CreateTeam()
            .withName(ns.prefix("bu1ForParentUpdate"))
            .withTeamType(TeamType.BUSINESS_UNIT)
            .withParents(List.of(orgTeam.getId()))
            .withDescription("BU 1");
    Team bu1 = createEntity(createBu1, client);

    CreateTeam createBu2 =
        new CreateTeam()
            .withName(ns.prefix("bu2ForParentUpdate"))
            .withTeamType(TeamType.BUSINESS_UNIT)
            .withParents(List.of(orgTeam.getId()))
            .withDescription("BU 2");
    Team bu2 = createEntity(createBu2, client);

    // Create division under bu1
    CreateTeam createDiv =
        new CreateTeam()
            .withName(ns.prefix("divForParentUpdate"))
            .withTeamType(TeamType.DIVISION)
            .withParents(List.of(bu1.getId()))
            .withDescription("Division under BU1");
    Team div = createEntity(createDiv, client);

    // Verify initial parent
    Team fetchedDiv = client.teams().get(div.getId().toString(), "parents");
    assertTrue(fetchedDiv.getParents().stream().anyMatch(p -> p.getId().equals(bu1.getId())));

    // Update division parent from bu1 to bu2
    fetchedDiv.setParents(List.of(bu2.getEntityReference()));
    Team updated = patchEntity(fetchedDiv.getId().toString(), fetchedDiv, client);

    // Verify parent changed
    Team verifyDiv = client.teams().get(updated.getId().toString(), "parents");
    assertTrue(verifyDiv.getParents().stream().anyMatch(p -> p.getId().equals(bu2.getId())));
    assertFalse(verifyDiv.getParents().stream().anyMatch(p -> p.getId().equals(bu1.getId())));
  }

  @Test
  void test_teamWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("teamWithOwner"))
            .withTeamType(TeamType.GROUP)
            .withOwners(List.of(testUser1().getEntityReference()))
            .withDescription("Team with owner");

    Team team = createEntity(create, client);
    assertNotNull(team.getId());

    // Fetch with owners field
    Team fetched = client.teams().get(team.getId().toString(), "owners");
    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());
    assertEquals(testUser1().getId(), fetched.getOwners().get(0).getId());
  }

  @Test
  void test_departmentCanHaveMultipleParents(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Team orgTeam = client.teams().getByName("Organization");

    // Create two divisions
    CreateTeam createDiv1 =
        new CreateTeam()
            .withName(ns.prefix("div1MultiParent"))
            .withTeamType(TeamType.DIVISION)
            .withParents(List.of(orgTeam.getId()))
            .withDescription("Division 1");
    Team div1 = createEntity(createDiv1, client);

    CreateTeam createDiv2 =
        new CreateTeam()
            .withName(ns.prefix("div2MultiParent"))
            .withTeamType(TeamType.DIVISION)
            .withParents(List.of(orgTeam.getId()))
            .withDescription("Division 2");
    Team div2 = createEntity(createDiv2, client);

    // Create department with multiple parents
    CreateTeam createDept =
        new CreateTeam()
            .withName(ns.prefix("deptMultiParent"))
            .withTeamType(TeamType.DEPARTMENT)
            .withParents(List.of(div1.getId(), div2.getId()))
            .withDescription("Department with multiple parents");
    Team dept = createEntity(createDept, client);

    // Verify department has both parents
    Team fetched = client.teams().get(dept.getId().toString(), "parents");
    assertNotNull(fetched.getParents());
    assertEquals(2, fetched.getParents().size());
    assertTrue(fetched.getParents().stream().anyMatch(p -> p.getId().equals(div1.getId())));
    assertTrue(fetched.getParents().stream().anyMatch(p -> p.getId().equals(div2.getId())));
  }

  @Test
  void test_businessUnitCanOnlyHaveOneParent(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Team orgTeam = client.teams().getByName("Organization");

    // Create first BU
    CreateTeam createBu1 =
        new CreateTeam()
            .withName(ns.prefix("bu1SingleParent"))
            .withTeamType(TeamType.BUSINESS_UNIT)
            .withParents(List.of(orgTeam.getId()))
            .withDescription("BU 1");
    Team bu1 = createEntity(createBu1, client);

    // Try to create BU with multiple parents - should fail
    CreateTeam createBu2 =
        new CreateTeam()
            .withName(ns.prefix("buInvalidMultiParent"))
            .withTeamType(TeamType.BUSINESS_UNIT)
            .withParents(List.of(orgTeam.getId(), bu1.getId()))
            .withDescription("BU with multiple parents - invalid");

    assertThrows(
        Exception.class,
        () -> createEntity(createBu2, client),
        "Business Unit can only have one parent");
  }

  private User createTestUser(TestNamespace ns, String suffix, OpenMetadataClient client) {
    String name = ns.prefix(suffix);
    String sanitized = name.replaceAll("[^a-zA-Z0-9._-]", "");
    if (sanitized.length() > 60) {
      sanitized = sanitized.substring(0, 52) + UUID.randomUUID().toString().substring(0, 8);
    }
    String email = sanitized + "@test.openmetadata.org";

    CreateUser createUser =
        new CreateUser()
            .withName(name)
            .withEmail(email)
            .withDescription("Test user for team tests");

    return client.users().create(createUser);
  }

  // ===================================================================
  // VERSION HISTORY SUPPORT
  // ===================================================================

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.teams().getVersionList(id);
  }

  @Override
  protected Team getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.teams().getVersion(id.toString(), version);
  }
}
