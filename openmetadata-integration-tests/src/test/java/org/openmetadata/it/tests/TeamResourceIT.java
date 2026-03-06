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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ImageList;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.csv.CsvImportResult;
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

  {
    supportsImportExport = true;
    supportsBatchImport = true;
    supportsRecursiveImport =
        true; // Team supports recursive import with hierarchical relationships
  }

  private static final Profile PROFILE =
      new Profile().withImages(new ImageList().withImage(URI.create("https://image.com")));

  private Team lastCreatedTeam;

  public TeamResourceIT() {
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = true;
    supportsDataProducts = false;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = true;
    supportsListHistoryByTimestamp = true;
  }

  @Override
  protected CreateTeam createMinimalRequest(TestNamespace ns) {
    return new CreateTeam()
        .withName(ns.prefix("team"))
        .withTeamType(TeamType.GROUP)
        .withProfile(PROFILE)
        .withDescription("Test team created by integration test");
  }

  @Override
  protected CreateTeam createRequest(String name, TestNamespace ns) {
    return new CreateTeam()
        .withName(name)
        .withTeamType(TeamType.GROUP)
        .withProfile(PROFILE)
        .withDescription("Test team");
  }

  @Override
  protected Team createEntity(CreateTeam createRequest) {
    return SdkClients.adminClient().teams().create(createRequest);
  }

  @Override
  protected Team getEntity(String id) {
    return SdkClients.adminClient().teams().get(id);
  }

  @Override
  protected Team getEntityByName(String fqn) {
    return SdkClients.adminClient().teams().getByName(fqn);
  }

  @Override
  protected Team patchEntity(String id, Team entity) {
    entity.setChildrenCount(null);
    entity.setUserCount(null);
    return SdkClients.adminClient().teams().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().teams().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().teams().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .teams()
        .delete(id, java.util.Map.of("hardDelete", "true", "recursive", "true"));
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
  protected Team getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().teams().get(id, fields);
  }

  @Override
  protected Team getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().teams().getByName(fqn, fields);
  }

  @Override
  protected Team getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().teams().get(id, null, "deleted");
  }

  @Override
  protected ListResponse<Team> listEntities(ListParams params) {
    return SdkClients.adminClient().teams().list(params);
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

      Team team = createEntity(create);
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
        () -> createEntity(create),
        "Creating an Organization team should not be allowed");
  }

  @Test
  void test_deleteOrganizationNotAllowed(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Team org = client.teams().getByName("Organization");
    assertNotNull(org);

    assertThrows(
        Exception.class,
        () -> deleteEntity(org.getId().toString()),
        "Deleting the Organization team should not be allowed");
  }

  @Test
  void test_createTeamWithUsers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    User user1 = createTestUser(ns, "teamUser1");
    User user2 = createTestUser(ns, "teamUser2");

    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix("teamWithUsers"))
            .withTeamType(TeamType.GROUP)
            .withUsers(List.of(user1.getId(), user2.getId()))
            .withDescription("Team with users");

    Team team = createEntity(create);
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

    Team team = createEntity(create);
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

    Team team = createEntity(create);
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

    Team team = createEntity(create);
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

    Team team = createEntity(create);
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

    Team joinableTeam = createEntity(createJoinable);
    assertTrue(joinableTeam.getIsJoinable());

    CreateTeam createNotJoinable =
        new CreateTeam()
            .withName(ns.prefix("notJoinableTeam"))
            .withTeamType(TeamType.GROUP)
            .withIsJoinable(false)
            .withDescription("Not joinable team");

    Team notJoinableTeam = createEntity(createNotJoinable);
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

    Team bu = createEntity(createBu);
    assertNotNull(bu.getId());

    CreateTeam createDiv =
        new CreateTeam()
            .withName(ns.prefix("div"))
            .withTeamType(TeamType.DIVISION)
            .withParents(List.of(bu.getId()))
            .withDescription("Division under BU");

    Team div = createEntity(createDiv);

    CreateTeam createDept =
        new CreateTeam()
            .withName(ns.prefix("dept"))
            .withTeamType(TeamType.DEPARTMENT)
            .withParents(List.of(div.getId()))
            .withDescription("Department under division");

    Team dept = createEntity(createDept);

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

    Team group = createEntity(createGroup);

    CreateTeam createChild =
        new CreateTeam()
            .withName(ns.prefix("childOfGroup"))
            .withTeamType(TeamType.GROUP)
            .withChildren(List.of(group.getId()))
            .withDescription("Child of group");

    assertThrows(
        Exception.class, () -> createEntity(createChild), "Groups cannot have team children");
  }

  @Test
  void test_invalidHierarchy_departmentCannotBeParentOfDivision(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam createDept =
        new CreateTeam()
            .withName(ns.prefix("deptParent"))
            .withTeamType(TeamType.DEPARTMENT)
            .withDescription("Department team");

    Team dept = createEntity(createDept);

    CreateTeam createDiv =
        new CreateTeam()
            .withName(ns.prefix("divUnderDept"))
            .withTeamType(TeamType.DIVISION)
            .withParents(List.of(dept.getId()))
            .withDescription("Division under department");

    assertThrows(
        Exception.class, () -> createEntity(createDiv), "Department cannot be parent of Division");
  }

  @Test
  void test_updateTeamDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create = createMinimalRequest(ns);
    Team team = createEntity(create);

    team.setDisplayName("Updated Team Name");
    Team updated = patchEntity(team.getId().toString(), team);

    assertEquals("Updated Team Name", updated.getDisplayName());
  }

  @Test
  void test_updateTeamDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create = createMinimalRequest(ns);
    Team team = createEntity(create);

    team.setDescription("Updated description");
    Team updated = patchEntity(team.getId().toString(), team);

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

    Team team = createEntity(create);
    assertFalse(team.getIsJoinable());

    team.setIsJoinable(true);
    Team updated = patchEntity(team.getId().toString(), team);

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

    Team team = createEntity(create);

    User user = createTestUser(ns, "addedUser");

    Team fetched = client.teams().get(team.getId().toString(), "users");
    fetched.setUsers(List.of(user.getEntityReference()));
    Team updated = patchEntity(fetched.getId().toString(), fetched);

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

    Team team = createEntity(create);

    EntityReference roleRef = dataStewardRole().getEntityReference();

    Team fetched = client.teams().get(team.getId().toString(), "defaultRoles");
    fetched.setDefaultRoles(List.of(roleRef));
    Team updated = patchEntity(fetched.getId().toString(), fetched);

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

    Team team = createEntity(create);

    EntityReference policyRef = shared().POLICY1.getEntityReference();

    Team fetched = client.teams().get(team.getId().toString(), "policies");
    fetched.setPolicies(List.of(policyRef));
    Team updated = patchEntity(fetched.getId().toString(), fetched);

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

    Team team = createEntity(create);
    assertNull(team.getEmail());

    String newEmail = toValidEmail("updated_" + ns.prefix("team"));
    team.setEmail(newEmail);
    Team updated = patchEntity(team.getId().toString(), team);

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

    Team bu = createEntity(createBu);

    CreateTeam createDiv =
        new CreateTeam()
            .withName(ns.prefix("deleteDiv"))
            .withTeamType(TeamType.DIVISION)
            .withParents(List.of(bu.getId()))
            .withDescription("Division for delete test");

    Team div = createEntity(createDiv);

    hardDeleteEntity(bu.getId().toString());

    String buId = bu.getId().toString();
    assertThrows(Exception.class, () -> getEntity(buId), "Parent team should be deleted");

    String divId = div.getId().toString();
    assertThrows(Exception.class, () -> getEntity(divId), "Child team should be cascade deleted");
  }

  @Test
  void test_softDeleteAndRestoreTeam(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create = createMinimalRequest(ns);
    Team team = createEntity(create);
    String teamId = team.getId().toString();

    deleteEntity(teamId);

    assertThrows(
        Exception.class, () -> getEntity(teamId), "Deleted team should not be retrievable");

    Team deleted = getEntityIncludeDeleted(teamId);
    assertTrue(deleted.getDeleted());

    restoreEntity(teamId);

    Team restored = getEntity(teamId);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_teamVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTeam create = createMinimalRequest(ns);
    Team team = createEntity(create);
    assertEquals(0.1, team.getVersion(), 0.001);

    team.setDescription("Updated description v1");
    Team v2 = patchEntity(team.getId().toString(), team);
    assertEquals(0.2, v2.getVersion(), 0.001);

    v2.setDescription("Updated description v2");
    Team v3 = patchEntity(v2.getId().toString(), v2);
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

    Team team = createEntity(create);
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

    Team dept = createEntity(createDept);

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

    Team team = createEntity(create);

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
      createEntity(create);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Team> response = listEntities(params);

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
    Team parent = createEntity(createParent);

    // Create child teams
    CreateTeam createChild1 =
        new CreateTeam()
            .withName(ns.prefix("child1ForList"))
            .withTeamType(TeamType.GROUP)
            .withParents(List.of(parent.getId()))
            .withDescription("Child 1");
    Team child1 = createEntity(createChild1);

    CreateTeam createChild2 =
        new CreateTeam()
            .withName(ns.prefix("child2ForList"))
            .withTeamType(TeamType.GROUP)
            .withParents(List.of(parent.getId()))
            .withDescription("Child 2");
    Team child2 = createEntity(createChild2);

    // List teams with parent filter
    ListParams params = new ListParams();
    params.setLimit(100);
    params.addFilter("parentTeam", parent.getName());
    ListResponse<Team> response = listEntities(params);

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
    Team parent = createEntity(createParent);

    // Create child team without domain - should inherit from parent
    CreateTeam createChild =
        new CreateTeam()
            .withName(ns.prefix("childInheritDomain"))
            .withTeamType(TeamType.GROUP)
            .withParents(List.of(parent.getId()))
            .withDescription("Child without explicit domain");
    Team child = createEntity(createChild);

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
    Team bu1 = createEntity(createBu1);

    CreateTeam createBu2 =
        new CreateTeam()
            .withName(ns.prefix("bu2ForParentUpdate"))
            .withTeamType(TeamType.BUSINESS_UNIT)
            .withParents(List.of(orgTeam.getId()))
            .withDescription("BU 2");
    Team bu2 = createEntity(createBu2);

    // Create division under bu1
    CreateTeam createDiv =
        new CreateTeam()
            .withName(ns.prefix("divForParentUpdate"))
            .withTeamType(TeamType.DIVISION)
            .withParents(List.of(bu1.getId()))
            .withDescription("Division under BU1");
    Team div = createEntity(createDiv);

    // Verify initial parent
    Team fetchedDiv = client.teams().get(div.getId().toString(), "parents");
    assertTrue(fetchedDiv.getParents().stream().anyMatch(p -> p.getId().equals(bu1.getId())));

    // Update division parent from bu1 to bu2
    fetchedDiv.setParents(List.of(bu2.getEntityReference()));
    Team updated = patchEntity(fetchedDiv.getId().toString(), fetchedDiv);

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

    Team team = createEntity(create);
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
    Team div1 = createEntity(createDiv1);

    CreateTeam createDiv2 =
        new CreateTeam()
            .withName(ns.prefix("div2MultiParent"))
            .withTeamType(TeamType.DIVISION)
            .withParents(List.of(orgTeam.getId()))
            .withDescription("Division 2");
    Team div2 = createEntity(createDiv2);

    // Create department with multiple parents
    CreateTeam createDept =
        new CreateTeam()
            .withName(ns.prefix("deptMultiParent"))
            .withTeamType(TeamType.DEPARTMENT)
            .withParents(List.of(div1.getId(), div2.getId()))
            .withDescription("Department with multiple parents");
    Team dept = createEntity(createDept);

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
    Team bu1 = createEntity(createBu1);

    // Try to create BU with multiple parents - should fail
    CreateTeam createBu2 =
        new CreateTeam()
            .withName(ns.prefix("buInvalidMultiParent"))
            .withTeamType(TeamType.BUSINESS_UNIT)
            .withParents(List.of(orgTeam.getId(), bu1.getId()))
            .withDescription("BU with multiple parents - invalid");

    assertThrows(
        Exception.class, () -> createEntity(createBu2), "Business Unit can only have one parent");
  }

  private User createTestUser(TestNamespace ns, String suffix) {
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

    return SdkClients.adminClient().users().create(createUser);
  }

  // ===================================================================
  // VERSION HISTORY SUPPORT
  // ===================================================================

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().teams().getVersionList(id);
  }

  @Override
  protected Team getVersion(UUID id, Double version) {
    return SdkClients.adminClient().teams().getVersion(id.toString(), version);
  }

  @Override
  protected org.openmetadata.sdk.services.EntityServiceBase<Team> getEntityService() {
    return SdkClients.adminClient().teams();
  }

  @Override
  protected String getImportExportContainerName(TestNamespace ns) {
    if (lastCreatedTeam == null) {
      CreateTeam request = createMinimalRequest(ns);
      request.setName(ns.prefix("export_team"));
      lastCreatedTeam = createEntity(request);
    }
    return lastCreatedTeam.getFullyQualifiedName();
  }

  @Test
  void test_importCsv_circularDependency_dryRun(TestNamespace ns) {
    String parentName = ns.prefix("ParentTeam");
    String childName = ns.prefix("ChildTeam");
    String eTeamName = ns.prefix("ETeam");

    String csv =
        "name*,displayName,description,teamType*,parents*,Owner,isJoinable,defaultRoles,policies\n"
            + String.format("%s,%s,,Department,Organization,,false,,\n", parentName, parentName)
            + String.format("%s,%s,,Department,%s,,false,,\n", childName, childName, parentName)
            + String.format("%s,%s,,Department,%s,,false,,\n", parentName, parentName, childName)
            + String.format("%s,%s,,Group,%s,,false,,", eTeamName, childName, eTeamName);

    OpenMetadataClient client = SdkClients.adminClient();
    String container = "Organization";

    // Dry Run
    try {
      String result = client.teams().importCsv(container, csv, true);
      assertNotNull(result);
      assertTrue(result.contains("failure"), "Result should contain failure status");
      assertTrue(
          result.contains("Circular reference detected")
              || result.contains("participates in a loop"),
          "Dry run should detect circular dependency. Result: " + result);
    } catch (Exception e) {
      assertTrue(
          e.getMessage().contains("Circular reference detected")
              || e.getMessage().contains("participates in a loop"),
          "Expected circular dependency error but got: " + e.getMessage());
    }
  }

  @Test
  void test_importCsv_circularDependency_trueRun(TestNamespace ns) {
    String parentName = ns.prefix("ParentTeamTrue");
    String childName = ns.prefix("ChildTeamTrue");
    String eTeamName = ns.prefix("ETeamTrue");

    String csv =
        "name*,displayName,description,teamType*,parents*,Owner,isJoinable,defaultRoles,policies\n"
            + String.format("%s,%s,,Department,Organization,,false,,\n", parentName, parentName)
            + String.format("%s,%s,,Department,%s,,false,,\n", childName, childName, parentName)
            + String.format("%s,%s,,Department,%s,,false,,\n", parentName, parentName, childName)
            + String.format("%s,%s,,Group,%s,,false,,", eTeamName, childName, eTeamName);

    OpenMetadataClient client = SdkClients.adminClient();
    String container = "Organization";

    // True Run
    // We expect it to NOT crash (StackOverflow) and report the error
    try {
      String result = client.teams().importCsv(container, csv, false);
      assertNotNull(result);
      assertTrue(result.contains("failure"), "Result should contain failure status");
      assertTrue(
          result.contains("Circular reference detected")
              || result.contains("participates in a loop"),
          "True run should detect circular dependency. Result: " + result);
    } catch (Exception e) {
      assertTrue(
          e.getMessage().contains("Circular reference detected")
              || e.getMessage().contains("participates in a loop"),
          "Expected circular dependency error but got: " + e.getMessage());
    }
  }

  // ===================================================================
  // CSV IMPORT/EXPORT SUPPORT
  // ===================================================================

  protected String generateValidCsvData(TestNamespace ns, List<Team> entities) {
    if (entities == null || entities.isEmpty()) {
      return null;
    }

    StringBuilder csv = new StringBuilder();
    csv.append(
        "name*,displayName,description,teamType*,parents*,Owner,isJoinable,defaultRoles,policies\n");

    for (Team team : entities) {
      csv.append(escapeCSVValue(team.getName())).append(",");
      csv.append(escapeCSVValue(team.getDisplayName())).append(",");
      csv.append(escapeCSVValue(team.getDescription())).append(",");
      csv.append(
              escapeCSVValue(team.getTeamType() != null ? team.getTeamType().toString() : "Group"))
          .append(",");
      csv.append(escapeCSVValue(formatParentsForCsv(team.getParents()))).append(",");
      csv.append(escapeCSVValue(formatOwnersForCsv(team.getOwners()))).append(",");
      csv.append(
              escapeCSVValue(
                  team.getIsJoinable() != null ? team.getIsJoinable().toString() : "false"))
          .append(",");
      csv.append(escapeCSVValue(formatDefaultRolesForCsv(team.getDefaultRoles()))).append(",");
      csv.append(escapeCSVValue(formatPoliciesForCsv(team.getPolicies())));
      csv.append("\n");
    }

    return csv.toString();
  }

  protected String generateInvalidCsvData(TestNamespace ns) {
    StringBuilder csv = new StringBuilder();
    csv.append(
        "name*,displayName,description,teamType*,parents*,Owner,isJoinable,defaultRoles,policies\n");
    // Row 1: Missing required name field
    csv.append(",Test Team,Description,Group,Organization,,false,,\n");
    // Row 2: Missing required teamType field
    csv.append("invalid_team,Invalid Team,Description,,Organization,,false,,\n");
    // Row 3: Missing required parents field
    csv.append("invalid_team2,Invalid Team 2,Description,Group,,,false,,\n");
    // Row 4: Invalid teamType value
    csv.append("invalid_team3,Invalid Team 3,Description,InvalidType,Organization,,false,,\n");
    return csv.toString();
  }

  protected List<String> getRequiredCsvHeaders() {
    return List.of("name", "teamType", "parents");
  }

  protected List<String> getAllCsvHeaders() {
    return List.of(
        "name*",
        "displayName",
        "description",
        "teamType*",
        "parents*",
        "Owner",
        "isJoinable",
        "defaultRoles",
        "policies");
  }

  protected boolean validateCsvRow(String[] row, List<String> headers) {
    if (row.length != headers.size()) {
      return false;
    }

    int nameIndex = headers.indexOf("name");
    int teamTypeIndex = headers.indexOf("teamType");
    int parentsIndex = headers.indexOf("parents");

    if (nameIndex >= 0 && (row[nameIndex] == null || row[nameIndex].trim().isEmpty())) {
      return false;
    }

    if (teamTypeIndex >= 0 && (row[teamTypeIndex] == null || row[teamTypeIndex].trim().isEmpty())) {
      return false;
    }

    if (parentsIndex >= 0 && (row[parentsIndex] == null || row[parentsIndex].trim().isEmpty())) {
      return false;
    }

    // Validate team type
    if (teamTypeIndex >= 0 && !row[teamTypeIndex].trim().isEmpty()) {
      String teamType = row[teamTypeIndex].trim();
      if (!teamType.equals("Group")
          && !teamType.equals("Department")
          && !teamType.equals("Division")
          && !teamType.equals("BusinessUnit")) {
        return false;
      }
    }

    return true;
  }

  private String formatParentsForCsv(List<EntityReference> parents) {
    if (parents == null || parents.isEmpty()) {
      return "Organization"; // Default parent
    }
    return parents.stream()
        .map(EntityReference::getName)
        .reduce((a, b) -> a + ";" + b)
        .orElse("Organization");
  }

  private String formatOwnersForCsv(List<EntityReference> owners) {
    if (owners == null || owners.isEmpty()) {
      return "";
    }
    return owners.stream().map(EntityReference::getName).reduce((a, b) -> a + ";" + b).orElse("");
  }

  private String formatDefaultRolesForCsv(List<EntityReference> defaultRoles) {
    if (defaultRoles == null || defaultRoles.isEmpty()) {
      return "";
    }
    return defaultRoles.stream()
        .map(EntityReference::getName)
        .reduce((a, b) -> a + ";" + b)
        .orElse("");
  }

  private String formatPoliciesForCsv(List<EntityReference> policies) {
    if (policies == null || policies.isEmpty()) {
      return "";
    }
    return policies.stream().map(EntityReference::getName).reduce((a, b) -> a + ";" + b).orElse("");
  }

  private String escapeCSVValue(String value) {
    if (value == null) {
      return "";
    }
    if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
      return "\"" + value.replace("\"", "\"\"") + "\"";
    }
    return value;
  }

  @Override
  protected void validateCsvDataPersistence(
      List<Team> originalEntities, String csvData, CsvImportResult result) {
    super.validateCsvDataPersistence(originalEntities, csvData, result);

    if (result.getStatus() != ApiStatus.SUCCESS) {
      return;
    }

    if (originalEntities != null) {
      for (Team originalEntity : originalEntities) {
        Team updatedEntity =
            getEntityByNameWithFields(
                originalEntity.getName(), "parents,owners,defaultRoles,policies");
        assertNotNull(
            updatedEntity, "Team " + originalEntity.getName() + " should exist after CSV import");

        validateTeamFieldsAfterImport(originalEntity, updatedEntity);
      }
    }
  }

  private void validateTeamFieldsAfterImport(Team original, Team imported) {
    assertEquals(original.getName(), imported.getName(), "Team name should match");
    assertEquals(original.getTeamType(), imported.getTeamType(), "Team type should match");

    if (original.getDisplayName() != null) {
      assertEquals(
          original.getDisplayName(),
          imported.getDisplayName(),
          "Team displayName should be preserved");
    }

    if (original.getDescription() != null) {
      assertEquals(
          original.getDescription(),
          imported.getDescription(),
          "Team description should be preserved");
    }

    if (original.getIsJoinable() != null) {
      assertEquals(
          original.getIsJoinable(),
          imported.getIsJoinable(),
          "Team isJoinable flag should be preserved");
    }

    if (original.getParents() != null && !original.getParents().isEmpty()) {
      assertNotNull(imported.getParents(), "Team parents should be preserved");
      assertEquals(
          original.getParents().size(),
          imported.getParents().size(),
          "Team parent count should match");
      assertEquals(
          original.getParents().get(0).getId(),
          imported.getParents().get(0).getId(),
          "Team parent should match");
    }

    if (original.getOwners() != null && !original.getOwners().isEmpty()) {
      assertNotNull(imported.getOwners(), "Team owners should be preserved");
      assertEquals(
          original.getOwners().size(),
          imported.getOwners().size(),
          "Team owner count should match");
    }

    if (original.getDefaultRoles() != null && !original.getDefaultRoles().isEmpty()) {
      assertNotNull(imported.getDefaultRoles(), "Team default roles should be preserved");
      assertEquals(
          original.getDefaultRoles().size(),
          imported.getDefaultRoles().size(),
          "Team default roles count should match");
    }

    if (original.getPolicies() != null && !original.getPolicies().isEmpty()) {
      assertNotNull(imported.getPolicies(), "Team policies should be preserved");
      assertEquals(
          original.getPolicies().size(),
          imported.getPolicies().size(),
          "Team policies count should match");
    }
  }
}
