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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
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
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamEntityInterface;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.locations.LocationResourceTest;
import org.openmetadata.catalog.resources.policies.PolicyResource;
import org.openmetadata.catalog.resources.policies.PolicyResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResource.TeamList;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.ImageList;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.Profile;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

@Slf4j
public class TeamResourceTest extends EntityResourceTest<Team, CreateTeam> {
  final Profile PROFILE = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

  public TeamResourceTest() {
    super(Entity.TEAM, Team.class, TeamList.class, "teams", TeamResource.FIELDS);
    this.supportsOwner = false; // TODO fix the test failures after removing this
    this.supportsDots = false;
    this.supportsAuthorizedMetadataOperations = false;
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

  @Test
  void get_teamWithInvalidFields_400_BadRequest(TestInfo test) throws HttpResponseException {
    CreateTeam create = createRequest(test);
    Team team = createEntity(create, ADMIN_AUTH_HEADERS);

    // Empty query field .../teams?fields=
    assertResponse(
        () -> getEntity(team.getId(), "test", ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidField("test"));

    // .../teams?fields=invalidField
    assertResponse(
        () -> getEntity(team.getId(), "invalidField", ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidField("invalidField"));
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
    assertTrue(user.getTeams().isEmpty());

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
      userRefs.add(new UserRepository.UserEntityInterface(user).getEntityReference());
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
        CatalogExceptionMessage.noPermission(randomUserName, "UpdateTeam"));

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

  private User createTeamManager(TestInfo testInfo) throws HttpResponseException, JsonProcessingException {
    // Create TeamManager role.
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    Role teamManager =
        roleResourceTest.createEntity(
            roleResourceTest.createRequest(testInfo).withName("TeamManager"), ADMIN_AUTH_HEADERS);

    // Ensure TeamManager has permission to UpdateTeam.
    PolicyResourceTest policyResourceTest = new PolicyResourceTest();
    Policy policy =
        policyResourceTest.getEntityByName(
            "TeamManagerRoleAccessControlPolicy", PolicyResource.FIELDS, ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(policy);
    Rule rule =
        new Rule()
            .withName("TeamManagerRoleAccessControlPolicy-UpdateTeam")
            .withAllow(true)
            .withUserRoleAttr("TeamManager")
            .withOperation(MetadataOperation.UpdateTeam);
    policy.setRules(List.of(rule));
    policyResourceTest.patchEntity(policy.getId(), originalJson, policy, ADMIN_AUTH_HEADERS);

    // Create a user with TeamManager role.
    UserResourceTest userResourceTest = new UserResourceTest();
    return userResourceTest.createEntity(
        userResourceTest
            .createRequest(testInfo)
            .withName(getEntityName(testInfo) + "manager")
            .withRoles(List.of(teamManager.getId())),
        ADMIN_AUTH_HEADERS);
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
    TestUtils.assertEntityReferenceList(expectedUsers, team.getUsers());
    TestUtils.assertEntityReferenceList(expectedDefaultRoles, team.getDefaultRoles());
    validateEntityReferences(team.getOwns());
  }

  /** Validate returned fields GET .../teams/{id}?fields="..." or GET .../teams/name/{name}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Team expectedTeam, boolean byName) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(ADMIN_AUTH_HEADERS);
    String fields = "";
    Team getTeam =
        byName
            ? getEntityByName(expectedTeam.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(expectedTeam.getId(), null, fields, ADMIN_AUTH_HEADERS);
    validateTeam(getTeam, expectedTeam.getDescription(), expectedTeam.getDisplayName(), null, null, null, updatedBy);
    assertNull(getTeam.getOwns());

    fields = "users,owns,profile,defaultRoles";
    getTeam =
        byName
            ? getEntityByName(expectedTeam.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(expectedTeam.getId(), fields, ADMIN_AUTH_HEADERS);
    assertNotNull(getTeam.getProfile());
    validateEntityReferences(getTeam.getOwns());
    validateEntityReferences(getTeam.getUsers());
    validateEntityReferences(getTeam.getDefaultRoles());
  }

  @Override
  public CreateTeam createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreateTeam()
        .withName(name)
        .withDescription(description)
        .withDisplayName(displayName)
        .withProfile(PROFILE);
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
    validateCommonEntityFields(
        getEntityInterface(team), createRequest.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    assertEquals(createRequest.getProfile(), team.getProfile());
    TestUtils.validateEntityReferences(team.getOwns());

    List<EntityReference> expectedUsers = new ArrayList<>();
    for (UUID userId : listOrEmpty(createRequest.getUsers())) {
      expectedUsers.add(new EntityReference().withId(userId).withType(Entity.USER));
    }
    expectedUsers = expectedUsers.isEmpty() ? null : expectedUsers;
    TestUtils.assertEntityReferenceList(expectedUsers, team.getUsers());

    List<EntityReference> expectedDefaultRoles = new ArrayList<>();
    for (UUID roleId : listOrEmpty(createRequest.getDefaultRoles())) {
      expectedDefaultRoles.add(new EntityReference().withId(roleId).withType(Entity.ROLE));
    }
    expectedDefaultRoles = expectedDefaultRoles.isEmpty() ? null : expectedDefaultRoles;
    TestUtils.assertEntityReferenceList(expectedDefaultRoles, team.getDefaultRoles());
  }

  @Override
  public void validateUpdatedEntity(Team updatedEntity, CreateTeam request, Map<String, String> authHeaders) {
    validateCreatedEntity(updatedEntity, request, authHeaders);
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
    TestUtils.assertEntityReferenceList(expectedOwnedEntities, teamAfterDeletion.getOwns());
  }

  @Override
  public void compareEntities(Team expected, Team updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(updated), expected.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertEquals(expected.getProfile(), updated.getProfile());
    TestUtils.validateEntityReferences(updated.getOwns());

    List<EntityReference> expectedUsers = listOrEmpty(expected.getUsers());
    List<EntityReference> actualUsers = listOrEmpty(updated.getUsers());
    TestUtils.assertEntityReferenceList(expectedUsers, actualUsers);

    List<EntityReference> expectedDefaultRoles = listOrEmpty(expected.getDefaultRoles());
    List<EntityReference> actualDefaultRoles = listOrEmpty(updated.getDefaultRoles());
    TestUtils.assertEntityReferenceList(expectedDefaultRoles, actualDefaultRoles);
  }

  @Override
  public EntityInterface<Team> getEntityInterface(Team entity) {
    return new TeamEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("users") || fieldName.equals("defaultRoles")) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedRefs = (List<EntityReference>) expected;
      List<EntityReference> actualRefs = JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertEntityReferencesFieldChange(expectedRefs, actualRefs);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
