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

package org.openmetadata.catalog.resources.teams;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.catalog.api.teams.CreateTeam.TeamType.BUSINESS_UNIT;
import static org.openmetadata.catalog.api.teams.CreateTeam.TeamType.DEPARTMENT;
import static org.openmetadata.catalog.api.teams.CreateTeam.TeamType.DIVISION;
import static org.openmetadata.catalog.api.teams.CreateTeam.TeamType.ORGANIZATION;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.invalidParent;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.invalidParentCount;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.unexpectedParent;
import static org.openmetadata.catalog.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.assertDeleted;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.validateEntityReferences;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.policies.CreatePolicy;
import org.openmetadata.catalog.api.teams.CreateRole;
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.api.teams.CreateTeam.TeamType;
import org.openmetadata.catalog.api.teams.CreateUser;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.locations.LocationResourceTest;
import org.openmetadata.catalog.resources.policies.PolicyResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResource.TeamList;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.ImageList;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.PolicyType;
import org.openmetadata.catalog.type.Profile;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

@Slf4j
public class TeamResourceTest extends EntityResourceTest<Team, CreateTeam> {
  final Profile PROFILE = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

  public TeamResourceTest() {
    super(Entity.TEAM, Team.class, TeamList.class, "teams", TeamResource.FIELDS);
    this.supportsAuthorizedMetadataOperations = false;
  }

  public void setupTeams(TestInfo test) throws HttpResponseException {
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    TEAM1 = teamResourceTest.createEntity(teamResourceTest.createRequest(test), ADMIN_AUTH_HEADERS);
    TEAM_OWNER1 = TEAM1.getEntityReference();

    ORG_TEAM = teamResourceTest.getEntityByName("organization", "", ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_initialization() throws HttpResponseException {
    // Ensure getting organization from team hierarchy is successful
    getEntityByName("organization", "", ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_validTeams_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateTeam create = createRequest(test, 1);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 2).withDisplayName("displayName");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 3).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 4).withProfile(PROFILE);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 5).withDisplayName("displayName").withDescription("description").withProfile(PROFILE);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_teamWithUsersAndDefaultRoles_200_OK(TestInfo test) throws IOException {
    // Add team to user relationships while creating a team
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = userResourceTest.createEntity(userResourceTest.createRequest(test, 1), TEST_AUTH_HEADERS);
    User user2 = userResourceTest.createEntity(userResourceTest.createRequest(test, 2), TEST_AUTH_HEADERS);
    List<UUID> users = Arrays.asList(user1.getId(), user2.getId());

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    Role role1 = roleResourceTest.createEntity(roleResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Role role2 = roleResourceTest.createEntity(roleResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS);
    List<UUID> roles = Arrays.asList(role1.getId(), role2.getId());

    CreateTeam create =
        createRequest(test)
            .withDisplayName("displayName")
            .withDescription("description")
            .withProfile(PROFILE)
            .withUsers(users)
            .withDefaultRoles(roles);
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Ensure that the user entity has relationship to the team
    user1 = userResourceTest.getEntity(user1.getId(), "teams", TEST_AUTH_HEADERS);
    assertEquals(team.getId(), user1.getTeams().get(0).getId());
    user2 = userResourceTest.getEntity(user2.getId(), "teams", TEST_AUTH_HEADERS);
    assertEquals(team.getId(), user2.getTeams().get(0).getId());
  }

  /**
   * @see EntityResourceTest put_addDeleteFollower_200 for tests related getting team with entities owned by the team
   */
  @Test
  void delete_validTeam_200_OK(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = userResourceTest.createEntity(userResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    List<UUID> users = Collections.singletonList(user1.getId());

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    Role role1 = roleResourceTest.createEntity(roleResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    List<UUID> roles = Collections.singletonList(role1.getId());

    CreateTeam create = createRequest(test).withUsers(users).withDefaultRoles(roles);
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Team with users and defaultRoles can be deleted
    // Team -- has --> User relationships are deleted
    // Team -- has --> Role relationships are deleted
    deleteAndCheckEntity(team, ADMIN_AUTH_HEADERS);

    // Ensure that the user does not have relationship to this team
    User user = userResourceTest.getEntity(user1.getId(), "teams", ADMIN_AUTH_HEADERS);
    assertDeleted(user.getTeams(), true);

    // Ensure that the role is not deleted
    Role role = roleResourceTest.getEntity(role1.getId(), "", ADMIN_AUTH_HEADERS);
    assertNotNull(role);
  }

  @Test
  void patch_teamAttributes_as_non_admin_403(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create table without any attributes
    Team team = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // Patching as a non-admin should is disallowed
    String originalJson = JsonUtils.pojoToJson(team);
    team.setDisplayName("newDisplayName");
    assertResponse(
        () -> patchEntity(team.getId(), originalJson, team, TEST_AUTH_HEADERS),
        FORBIDDEN,
        CatalogExceptionMessage.noPermission(TEST_USER_NAME));
  }

  @Test
  void patch_teamUsers_as_user_with_UpdateTeam_permission(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    List<EntityReference> userRefs = new ArrayList<>();
    for (int i = 0; i < 7; i++) {
      User user = userResourceTest.createEntity(userResourceTest.createRequest(test, i), ADMIN_AUTH_HEADERS);
      userRefs.add(user.getEntityReference());
    }

    Team team = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(team);
    team.setUsers(userRefs);

    // Ensure user without UpdateTeam permission cannot add users to a team.
    String randomUserName = userRefs.get(0).getName();
    assertResponse(
        () ->
            patchEntity(
                team.getId(), originalJson, team, SecurityUtil.authHeaders(randomUserName + "@open-metadata.org")),
        FORBIDDEN,
        CatalogExceptionMessage.noPermission(randomUserName, "EditUsers"));

    // Ensure user with UpdateTeam permission can add users to a team.
    User teamManagerUser = createTeamManager(test);
    FieldChange fieldChange = new FieldChange().withName("users").withNewValue(userRefs);
    ChangeDescription change =
        getChangeDescription(team.getVersion()).withFieldsAdded(Collections.singletonList(fieldChange));
    patchEntityAndCheck(
        team,
        originalJson,
        SecurityUtil.authHeaders(teamManagerUser.getName() + "@open-metadata.org"),
        MINOR_UPDATE,
        change);
  }

  @Test
  void post_hierarchicalTeamsWithParents() throws HttpResponseException {
    // Ensure teams created without any parent has Organization as the parent
    Team team = getEntity(TEAM1.getId(), "parents", ADMIN_AUTH_HEADERS);
    assertParents(team, List.of(ORG_TEAM.getEntityReference()));

    //
    // Create hierarchy of business unit, division, and department under organization:
    // Organization -- has children --> [ bu1, div2, dep3]
    Team bu1 = createWithParents("bu1", BUSINESS_UNIT, ORG_TEAM.getEntityReference());
    Team div2 = createWithParents("div2", DIVISION, ORG_TEAM.getEntityReference());
    Team dep3 = createWithParents("dep3", DEPARTMENT, ORG_TEAM.getEntityReference());

    // Ensure parent has all the newly created children
    ORG_TEAM = getEntity(ORG_TEAM.getId(), "children,parents", ADMIN_AUTH_HEADERS);
    assertEntityReferences(
        new ArrayList<>(List.of(bu1.getEntityReference(), div2.getEntityReference(), dep3.getEntityReference())),
        ORG_TEAM.getChildren());

    //
    // Create hierarchy of business unit, division, and department under business unit
    // bu1 -- has children --> [ bu11, div12, dep13]
    Team bu11 = createWithParents("bu11", BUSINESS_UNIT, bu1.getEntityReference());
    Team div12 = createWithParents("div12", DIVISION, bu1.getEntityReference());
    Team dep13 = createWithParents("dep13", DEPARTMENT, bu1.getEntityReference());

    // Ensure parent has all the newly created children
    bu1 = getEntity(bu1.getId(), "children,parents", ADMIN_AUTH_HEADERS);
    assertEntityReferences(
        new ArrayList<>(List.of(bu11.getEntityReference(), div12.getEntityReference(), dep13.getEntityReference())),
        bu1.getChildren());

    //
    // Create hierarchy of division, and department under division
    // div2 -- has children --> [ div21, dep22]
    Team div21 = createWithParents("div21", DIVISION, div2.getEntityReference());
    Team dep22 = createWithParents("dep22", DEPARTMENT, div2.getEntityReference());

    // Ensure parent has all the newly created children
    div2 = getEntity(div2.getId(), "children,parents", ADMIN_AUTH_HEADERS);
    assertEntityReferences(
        new ArrayList<>(List.of(div21.getEntityReference(), dep22.getEntityReference())), div2.getChildren());

    //
    // Create hierarchy of department under department
    // dep3 -- has children --> [ dep31]
    Team dep31 = createWithParents("dep31", DEPARTMENT, dep3.getEntityReference());

    // Ensure parent has all the newly created children
    dep3 = getEntity(dep3.getId(), "children,parents", ADMIN_AUTH_HEADERS);
    assertEntityReferences(new ArrayList<>(List.of(dep31.getEntityReference())), dep3.getChildren());

    //
    // Test incorrect hierarchy is not allowed and results in failure
    // Department can't be the parent of Division
    assertResponse(
        () -> createWithParents("divInvalid", DIVISION, dep22.getEntityReference()),
        BAD_REQUEST,
        invalidParent(dep22, "divInvalid", DIVISION));

    // Division or Department can't be the parent of Business Unit
    assertResponse(
        () -> createWithParents("buInvalid", BUSINESS_UNIT, dep22.getEntityReference()),
        BAD_REQUEST,
        invalidParent(dep22, "buInvalid", BUSINESS_UNIT));
    assertResponse(
        () -> createWithParents("buInvalid", BUSINESS_UNIT, div21.getEntityReference()),
        BAD_REQUEST,
        invalidParent(div21, "buInvalid", BUSINESS_UNIT));

    // There can be no parent for organization
    EntityReference bu11Ref = bu11.getEntityReference();
    assertResponse(
        () -> createWithParents("orgInvalid", ORGANIZATION, dep22.getEntityReference()),
        BAD_REQUEST,
        unexpectedParent());
    assertResponse(
        () -> createWithParents("orgInvalid", ORGANIZATION, div21.getEntityReference()),
        BAD_REQUEST,
        unexpectedParent());
    assertResponse(() -> createWithParents("orgInvalid", ORGANIZATION, bu11Ref), BAD_REQUEST, unexpectedParent());

    // Business Unit can have only one parent
    assertResponse(
        () -> createWithParents("buInvalid", BUSINESS_UNIT, bu11Ref, ORG_TEAM.getEntityReference()),
        BAD_REQUEST,
        invalidParentCount(1, BUSINESS_UNIT));

    // Division can have only one parent
    assertResponse(
        () -> createWithParents("divInvalid", DIVISION, dep22.getEntityReference(), ORG_TEAM.getEntityReference()),
        BAD_REQUEST,
        invalidParentCount(1, DIVISION));

    // Department can have more than one parent
    createWithParents(
        "dep", DEPARTMENT, div12.getEntityReference(), div21.getEntityReference(), ORG_TEAM.getEntityReference());

    //
    // Deletion tests to ensure no dangling parent/children relationship
    // Delete bu1 and ensure Organization does not have it a child and bu11, div12, dep13 don't change Org to parent
    deleteEntity(bu1.getId(), true, true, ADMIN_AUTH_HEADERS);
    ORG_TEAM = getEntity(ORG_TEAM.getId(), "children", ADMIN_AUTH_HEADERS);
    bu11 = getEntity(bu11.getId(), "parents", ADMIN_AUTH_HEADERS);
    div12 = getEntity(div12.getId(), "parents", ADMIN_AUTH_HEADERS);
    dep13 = getEntity(dep13.getId(), "parents", ADMIN_AUTH_HEADERS);

    assertEntityReferencesDoesNotContain(ORG_TEAM.getChildren(), bu1.getEntityReference());
    assertEntityReferencesDoesNotContain(bu11.getParents(), bu1.getEntityReference());
    assertEntityReferencesDoesNotContain(div12.getParents(), bu1.getEntityReference());
    assertEntityReferencesDoesNotContain(dep13.getParents(), bu1.getEntityReference());
    assertEntityReferencesContain(bu11.getParents(), ORG_TEAM.getEntityReference());
    assertEntityReferencesContain(div12.getParents(), ORG_TEAM.getEntityReference());
    assertEntityReferencesContain(dep13.getParents(), ORG_TEAM.getEntityReference());
  }

  @Test
  void post_hierarchicalTeamsWithChildren() throws HttpResponseException {
    Team bu11 = createEntity(createRequest("t11").withTeamType(BUSINESS_UNIT), ADMIN_AUTH_HEADERS);
    Team div12 = createEntity(createRequest("t12").withTeamType(DIVISION), ADMIN_AUTH_HEADERS);
    Team dep13 = createEntity(createRequest("t13").withTeamType(DEPARTMENT), ADMIN_AUTH_HEADERS);

    // Create a parent team with children t11, t12, t13 and verify parent and child relationships
    Team t1 =
        createWithChildren(
            "t1", BUSINESS_UNIT, bu11.getEntityReference(), div12.getEntityReference(), dep13.getEntityReference());
    assertEntityReferencesContain(t1.getParents(), ORG_TEAM.getEntityReference());

    //
    // Creating a parent with invalid children type is not allowed
    // Department can't have Business unit as a child
    assertResponse(
        () -> createWithChildren("invalidTeam", DEPARTMENT, bu11.getEntityReference()),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidChild("invalidTeam", DEPARTMENT, bu11));
    // Department can't have Division as a child
    assertResponse(
        () -> createWithChildren("invalidTeam", DEPARTMENT, div12.getEntityReference()),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidChild("invalidTeam", DEPARTMENT, div12));
    // Division can't have BU as a child
    assertResponse(
        () -> createWithChildren("invalidTeam", DIVISION, bu11.getEntityReference()),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidChild("invalidTeam", DIVISION, bu11));
  }

  @Test
  void put_patch_hierarchicalTeams() throws IOException {
    // Create hierarchy of business unit, division, and department under organization:
    // Organization -- has children --> [ bu1, bu2]
    Team bu1 = createWithParents("put1", BUSINESS_UNIT, ORG_TEAM.getEntityReference());
    Team bu2 = createWithParents("put2", BUSINESS_UNIT, ORG_TEAM.getEntityReference());

    // Change bu2 parent from Organization to bu1 using PUT operation
    CreateTeam create = createRequest("put2").withTeamType(BUSINESS_UNIT).withParents(List.of(bu1.getId()));
    ChangeDescription change1 = getChangeDescription(bu2.getVersion());
    change1
        .getFieldsDeleted()
        .add(new FieldChange().withName("parents").withOldValue(List.of(ORG_TEAM.getEntityReference())));
    change1.getFieldsAdded().add(new FieldChange().withName("parents").withNewValue(List.of(bu1.getEntityReference())));
    bu2 = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change1);

    // Remove bu2 parent. Default parent organization replaces it
    create = createRequest("put2").withTeamType(BUSINESS_UNIT).withParents(null);
    ChangeDescription change2 = getChangeDescription(bu2.getVersion());
    change2
        .getFieldsDeleted()
        .add(new FieldChange().withName("parents").withOldValue(List.of(bu1.getEntityReference())));
    change2
        .getFieldsAdded()
        .add(new FieldChange().withName("parents").withNewValue(List.of(ORG_TEAM.getEntityReference())));
    bu2 = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change2);

    // Change bu2 parent from Organization to bu1 using PATCH operation
    String json = JsonUtils.pojoToJson(bu2);
    change1.setPreviousVersion(bu2.getVersion());
    bu2.setParents(List.of(bu1.getEntityReference()));
    bu2 = patchEntityAndCheck(bu2, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change1);

    json = JsonUtils.pojoToJson(bu2);
    change2.setPreviousVersion(bu2.getVersion());
    bu2.setParents(List.of(ORG_TEAM.getEntityReference()));
    patchEntityAndCheck(bu2, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change2);
  }

  @Test
  void patch_isJoinable_200(TestInfo test) throws IOException {
    CreateTeam create =
        createRequest(getEntityName(test), "description", "displayName", null)
            .withProfile(PROFILE)
            .withIsJoinable(false);
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // patch the team with isJoinable set to true
    String json = JsonUtils.pojoToJson(team);
    team.setIsJoinable(true);
    ChangeDescription change = getChangeDescription(team.getVersion());
    change.getFieldsUpdated().add(new FieldChange().withName("isJoinable").withOldValue(false).withNewValue(true));
    team = patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // set isJoinable to false and check
    json = JsonUtils.pojoToJson(team);
    team.setIsJoinable(false);
    change = getChangeDescription(team.getVersion());
    change.getFieldsUpdated().add(new FieldChange().withName("isJoinable").withOldValue(true).withNewValue(false));
    patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void patch_deleteUserAndDefaultRoleFromTeam_200(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    final int totalUsers = 20;
    ArrayList<UUID> users = new ArrayList<>();
    for (int i = 0; i < totalUsers; i++) {
      User user = userResourceTest.createEntity(userResourceTest.createRequest(test, i), ADMIN_AUTH_HEADERS);
      users.add(user.getId());
    }

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    roleResourceTest.createRolesAndSetDefault(test, 5, 0);
    List<Role> roles = roleResourceTest.listEntities(Map.of(), ADMIN_AUTH_HEADERS).getData();
    List<UUID> rolesIds = roles.stream().map(Role::getId).collect(Collectors.toList());

    CreateTeam create =
        createRequest(getEntityName(test), "description", "displayName", null)
            .withProfile(PROFILE)
            .withUsers(users)
            .withDefaultRoles(rolesIds);
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Remove a user from the team using patch request
    String json = JsonUtils.pojoToJson(team);
    int removeUserIndex = new Random().nextInt(totalUsers);
    EntityReference deletedUser = team.getUsers().get(removeUserIndex);
    team.getUsers().remove(removeUserIndex);
    ChangeDescription change = getChangeDescription(team.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("users").withOldValue(Arrays.asList(deletedUser)));
    team = patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Remove a default role from the team using patch request
    json = JsonUtils.pojoToJson(team);
    int removeDefaultRoleIndex = new Random().nextInt(roles.size());
    EntityReference deletedRole = team.getDefaultRoles().get(removeDefaultRoleIndex);
    team.getDefaultRoles().remove(removeDefaultRoleIndex);
    change = getChangeDescription(team.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("defaultRoles").withOldValue(Arrays.asList(deletedRole)));
    patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void post_teamWithPolicies(TestInfo test) throws IOException {
    CreateTeam create = createRequest(getEntityName(test)).withPolicies(List.of(POLICY1.getId(), POLICY2.getId()));
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_teamWithPolicies(TestInfo test) throws IOException {
    CreateTeam create = createRequest(getEntityName(test));
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add policies to the team
    create = createRequest(getEntityName(test)).withPolicies(List.of(POLICY1.getId(), POLICY2.getId()));
    ChangeDescription change = getChangeDescription(team.getVersion());
    change
        .getFieldsAdded()
        .add(
            new FieldChange()
                .withName("policies")
                .withNewValue(List.of(POLICY1.getEntityReference(), POLICY2.getEntityReference())));
    team = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove policies from the team
    create = createRequest(getEntityName(test));
    change = getChangeDescription(team.getVersion());
    change
        .getFieldsDeleted()
        .add(
            new FieldChange()
                .withName("policies")
                .withOldValue(List.of(POLICY1.getEntityReference(), POLICY2.getEntityReference())));
    updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void patch_teamWithPolicies(TestInfo test) throws IOException {
    CreateTeam create = createRequest(getEntityName(test));
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add policies to the team
    String json = JsonUtils.pojoToJson(team);
    team.withPolicies(List.of(POLICY1.getEntityReference(), POLICY2.getEntityReference()));
    ChangeDescription change = getChangeDescription(team.getVersion());
    change
        .getFieldsAdded()
        .add(
            new FieldChange()
                .withName("policies")
                .withNewValue(List.of(POLICY1.getEntityReference(), POLICY2.getEntityReference())));
    team = patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove policies from the team
    json = JsonUtils.pojoToJson(team);
    team.withPolicies(null);
    change = getChangeDescription(team.getVersion());
    change
        .getFieldsDeleted()
        .add(
            new FieldChange()
                .withName("policies")
                .withOldValue(List.of(POLICY1.getEntityReference(), POLICY2.getEntityReference())));
    patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  private static void validateTeam(
      Team team,
      String expectedDescription,
      String expectedDisplayName,
      Profile expectedProfile,
      List<EntityReference> expectedUsers,
      List<EntityReference> expectedDefaultRoles,
      String expectedUpdatedBy) {
    assertListNotNull(team.getId(), team.getHref());
    assertEquals(expectedDescription, team.getDescription());
    assertEquals(expectedUpdatedBy, team.getUpdatedBy());
    assertEquals(expectedDisplayName, team.getDisplayName());
    assertEquals(expectedProfile, team.getProfile());
    TestUtils.assertEntityReferences(expectedUsers, team.getUsers());
    TestUtils.assertEntityReferences(expectedDefaultRoles, team.getDefaultRoles());
    validateEntityReferences(team.getOwns());
  }

  @Override
  public Team validateGetWithDifferentFields(Team expectedTeam, boolean byName) throws HttpResponseException {
    if (expectedTeam.getUsers() == null) {
      UserResourceTest userResourceTest = new UserResourceTest();
      CreateUser create = userResourceTest.createRequest("user", "", "", null).withTeams(List.of(expectedTeam.getId()));
      userResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    }

    String updatedBy = getPrincipalName(ADMIN_AUTH_HEADERS);
    String fields = "";
    Team getTeam =
        byName
            ? getEntityByName(expectedTeam.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(expectedTeam.getId(), null, fields, ADMIN_AUTH_HEADERS);
    validateTeam(getTeam, expectedTeam.getDescription(), expectedTeam.getDisplayName(), null, null, null, updatedBy);
    assertNull(getTeam.getOwns());

    fields = "users,owns,profile,defaultRoles,owner";
    getTeam =
        byName
            ? getEntityByName(expectedTeam.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(expectedTeam.getId(), fields, ADMIN_AUTH_HEADERS);
    assertNotNull(getTeam.getProfile());
    validateEntityReferences(getTeam.getOwns());
    validateEntityReferences(getTeam.getUsers(), true);
    validateEntityReferences(getTeam.getDefaultRoles());
    return getTeam;
  }

  @Override
  public CreateTeam createRequest(String name) {
    return new CreateTeam().withName(name).withProfile(PROFILE);
  }

  @Override
  public Team beforeDeletion(TestInfo test, Team team) throws HttpResponseException {
    LocationResourceTest locationResourceTest = new LocationResourceTest();
    EntityReference teamRef = new EntityReference().withId(team.getId()).withType("team");
    locationResourceTest.createEntity(
        locationResourceTest.createRequest(getEntityName(test), null, null, teamRef), ADMIN_AUTH_HEADERS);
    return team;
  }

  @Override
  public void validateCreatedEntity(Team team, CreateTeam createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getProfile(), team.getProfile());
    TestUtils.validateEntityReferences(team.getOwns());

    List<EntityReference> expectedUsers = new ArrayList<>();
    for (UUID userId : listOrEmpty(createRequest.getUsers())) {
      expectedUsers.add(new EntityReference().withId(userId).withType(Entity.USER));
    }
    expectedUsers = expectedUsers.isEmpty() ? null : expectedUsers;
    TestUtils.assertEntityReferences(expectedUsers, team.getUsers());
    TestUtils.assertEntityReferenceIds(createRequest.getDefaultRoles(), team.getDefaultRoles());
    TestUtils.assertEntityReferenceIds(createRequest.getParents(), team.getParents());
    TestUtils.assertEntityReferenceIds(createRequest.getChildren(), team.getChildren());
    TestUtils.assertEntityReferenceIds(createRequest.getPolicies(), team.getPolicies());
  }

  @Override
  protected void validateDeletedEntity(
      CreateTeam create, Team teamBeforeDeletion, Team teamAfterDeletion, Map<String, String> authHeaders)
      throws HttpResponseException {
    super.validateDeletedEntity(create, teamBeforeDeletion, teamAfterDeletion, authHeaders);

    List<EntityReference> expectedOwnedEntities = new ArrayList<>();
    for (EntityReference ref : listOrEmpty(teamBeforeDeletion.getOwns())) {
      expectedOwnedEntities.add(new EntityReference().withId(ref.getId()).withType(Entity.TABLE));
    }
    TestUtils.assertEntityReferences(expectedOwnedEntities, teamAfterDeletion.getOwns());
  }

  @Override
  public void compareEntities(Team expected, Team updated, Map<String, String> authHeaders) {
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertEquals(expected.getProfile(), updated.getProfile());
    TestUtils.validateEntityReferences(updated.getOwns());

    List<EntityReference> expectedUsers = listOrEmpty(expected.getUsers());
    List<EntityReference> actualUsers = listOrEmpty(updated.getUsers());
    TestUtils.assertEntityReferences(expectedUsers, actualUsers);

    List<EntityReference> expectedDefaultRoles = listOrEmpty(expected.getDefaultRoles());
    List<EntityReference> actualDefaultRoles = listOrEmpty(updated.getDefaultRoles());
    TestUtils.assertEntityReferences(expectedDefaultRoles, actualDefaultRoles);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (List.of("users", "defaultRoles", "parents", "children", "policies").contains(fieldName)) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedRefs = (List<EntityReference>) expected;
      List<EntityReference> actualRefs = JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertEntityReferences(expectedRefs, actualRefs);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private Team createWithParents(String teamName, TeamType teamType, EntityReference... parents)
      throws HttpResponseException {
    List<EntityReference> parentList = List.of(parents);
    List<UUID> parentIds = EntityUtil.toIds(parentList);
    Team team = createEntity(createRequest(teamName).withParents(parentIds).withTeamType(teamType), ADMIN_AUTH_HEADERS);
    assertParents(team, parentList);
    return team;
  }

  private Team createWithChildren(String teamName, TeamType teamType, EntityReference... children)
      throws HttpResponseException {
    List<EntityReference> childrenList = List.of(children);
    List<UUID> childIds = EntityUtil.toIds(childrenList);
    Team team = createEntity(createRequest(teamName).withChildren(childIds).withTeamType(teamType), ADMIN_AUTH_HEADERS);
    assertChildren(team, childrenList);
    return team;
  }

  private void assertParents(Team team, List<EntityReference> expectedParents) throws HttpResponseException {
    assertEquals(team.getParents().size(), expectedParents.size());
    assertEntityReferences(expectedParents, team.getParents());

    for (EntityReference expectedParent : expectedParents) {
      // Ensure parents have the given team as a child
      Team parent = getEntity(expectedParent.getId(), "children", ADMIN_AUTH_HEADERS);
      assertEntityReferencesContain(parent.getChildren(), team.getEntityReference());
    }
  }

  private void assertChildren(Team team, List<EntityReference> expectedChildren) throws HttpResponseException {
    assertEquals(team.getChildren().size(), expectedChildren.size());
    assertEntityReferences(expectedChildren, team.getChildren());

    for (EntityReference expectedChild : expectedChildren) {
      // Ensure children have the given team as a parent
      Team child = getEntity(expectedChild.getId(), "parents", ADMIN_AUTH_HEADERS);
      assertEntityReferencesContain(child.getParents(), team.getEntityReference());
    }
  }

  private User createTeamManager(TestInfo testInfo) throws HttpResponseException {
    // Create a rule that can update team
    Rule rule =
        new Rule().withName("TeamManagerPolicy-UpdateTeam").withAllow(true).withOperation(MetadataOperation.EDIT_USERS);

    // Create a policy with the rule
    PolicyResourceTest policyResourceTest = new PolicyResourceTest();
    CreatePolicy createPolicy =
        policyResourceTest
            .createRequest("TeamManagerPolicy", "", "", null)
            .withPolicyType(PolicyType.AccessControl)
            .withRules(List.of(rule));
    Policy policy = policyResourceTest.createEntity(createPolicy, ADMIN_AUTH_HEADERS);

    // Create TeamManager role with the policy to update team
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    CreateRole createRole =
        roleResourceTest
            .createRequest(testInfo)
            .withName("TeamManager")
            .withPolicies(List.of(policy.getEntityReference()));
    Role teamManager = roleResourceTest.createEntity(createRole, ADMIN_AUTH_HEADERS);

    // Create a user with TeamManager role.
    UserResourceTest userResourceTest = new UserResourceTest();
    return userResourceTest.createEntity(
        userResourceTest
            .createRequest(testInfo)
            .withName(getEntityName(testInfo) + "manager")
            .withRoles(List.of(teamManager.getId())),
        ADMIN_AUTH_HEADERS);
  }
}
