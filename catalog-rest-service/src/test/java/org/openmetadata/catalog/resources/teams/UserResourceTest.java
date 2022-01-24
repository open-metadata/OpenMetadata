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
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static javax.ws.rs.core.Response.Status.UNAUTHORIZED;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Predicate;
import javax.json.JsonPatch;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.teams.CreateUser;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.RoleRepository.RoleEntityInterface;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamEntityInterface;
import org.openmetadata.catalog.jdbi3.UserRepository.UserEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.resources.locations.LocationResourceTest;
import org.openmetadata.catalog.resources.teams.UserResource.UserList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.ImageList;
import org.openmetadata.catalog.type.Profile;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

@Slf4j
public class UserResourceTest extends EntityResourceTest<User, CreateUser> {
  final Profile PROFILE = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

  public UserResourceTest() {
    super(Entity.USER, User.class, UserList.class, "users", UserResource.FIELDS, false, false, false, false);
  }

  @Test
  void post_userWithoutEmail_400_badRequest(TestInfo test) {
    // Create user with mandatory email field null
    CreateUser create = createRequest(test).withEmail(null);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, "[email must not be null]");

    // Create user with mandatory email field empty
    create.withEmail("");
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "email must match \"^\\S+@\\S+\\.\\S+$\"");
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "email size must be between 6 and 127");

    // Create user with mandatory email field with invalid email address
    create.withEmail("invalidEmail");
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "[email must match \"^\\S+@\\S+\\.\\S+$\"]");
  }

  @Test
  void post_validUser_200_ok_without_login(TestInfo test) {
    CreateUser create =
        createRequest(test, 6).withDisplayName("displayName").withEmail("test@email.com").withIsAdmin(true);

    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createAndCheckEntity(create, null));
    assertResponse(exception, UNAUTHORIZED, "Not authorized; User's Email is not present");
  }

  @Test
  void post_validUser_200_ok(TestInfo test) throws IOException {
    // Create user with different optional fields
    CreateUser create = createRequest(test, 1);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 2).withDisplayName("displayName");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 3).withProfile(PROFILE);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 5).withDisplayName("displayName").withProfile(PROFILE).withIsBot(true);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 6).withDisplayName("displayName").withProfile(PROFILE).withIsAdmin(true);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_validUser_200_ok(TestInfo test) throws IOException {
    // Create user with different optional fields
    CreateUser create = createRequest(test, 1);
    User user = updateAndCheckEntity(create, CREATED, ADMIN_AUTH_HEADERS, UpdateType.CREATED, null);

    // Update the user information using PUT
    String oldEmail = create.getEmail();
    String oldDisplayName = create.getDisplayName();
    CreateUser update = create.withEmail("test1@email.com").withDisplayName("displayName1");

    ChangeDescription change = getChangeDescription(user.getVersion());
    change
        .getFieldsAdded()
        .add(new FieldChange().withName("displayName").withOldValue(oldDisplayName).withNewValue("displayName1"));
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("email").withOldValue(oldEmail).withNewValue("test1@email.com"));
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void post_validAdminUser_Non_Admin_401(TestInfo test) {
    CreateUser create =
        createRequest(test, 6)
            .withName("test")
            .withDisplayName("displayName")
            .withEmail("test@email.com")
            .withIsAdmin(true);

    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createAndCheckEntity(create, TEST_AUTH_HEADERS));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void post_validAdminUser_200_ok(TestInfo test) throws IOException {
    CreateUser create =
        createRequest(test, 6)
            .withName("test1")
            .withDisplayName("displayName")
            .withEmail("test1@email.com")
            .withIsAdmin(true);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_validUserWithTeams_200_ok(TestInfo test) throws IOException {
    // Create user with different optional fields
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    Team team1 = teamResourceTest.createEntity(teamResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Team team2 = teamResourceTest.createEntity(teamResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS);
    List<UUID> teams = Arrays.asList(team1.getId(), team2.getId());
    CreateUser create = createRequest(test).withTeams(teams);
    User user = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Ensure Team has relationship to this user
    team1 = teamResourceTest.getEntity(team1.getId(), "users", ADMIN_AUTH_HEADERS);
    assertEquals(user.getId(), team1.getUsers().get(0).getId());
    team2 = teamResourceTest.getEntity(team2.getId(), "users", ADMIN_AUTH_HEADERS);
    assertEquals(user.getId(), team2.getUsers().get(0).getId());
  }

  @Test
  void post_validUserWithRoles_200_ok(TestInfo test) throws IOException {
    // Create user with different optional fields
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    Role role1 = roleResourceTest.createEntity(roleResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Role role2 = roleResourceTest.createEntity(roleResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS);
    List<UUID> roles = Arrays.asList(role1.getId(), role2.getId());
    CreateUser create = createRequest(test).withRoles(roles);
    User user = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Ensure User has relationship to these roles
    String[] expectedRoles = roles.stream().map(UUID::toString).sorted().toArray(String[]::new);
    List<EntityReference> roleReferences = user.getRoles();
    String[] actualRoles = roleReferences.stream().map(ref -> ref.getId().toString()).sorted().toArray(String[]::new);
    assertArrayEquals(expectedRoles, actualRoles);
  }

  @Test
  void get_listUsersWithTeams_200_ok(TestInfo test) throws IOException {
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    Team team1 = teamResourceTest.createEntity(teamResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Team team2 = teamResourceTest.createEntity(teamResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS);
    List<UUID> teams = List.of(team1.getId(), team2.getId());
    List<UUID> team = List.of(team1.getId());

    // user0 is part of no teams
    // user1 is part of team1
    // user2 is part of team1, and team2
    CreateUser create = createRequest(test, 0);
    User user0 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    create = createRequest(test, 1).withTeams(team);
    User user1 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    create = createRequest(test, 2).withTeams(teams);
    User user2 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    Predicate<User> isUser0 = u -> u.getId().equals(user0.getId());
    Predicate<User> isUser1 = u -> u.getId().equals(user1.getId());
    Predicate<User> isUser2 = u -> u.getId().equals(user2.getId());

    Map<String, String> queryParams =
        new HashMap<>() {
          {
            put("team", team1.getName());
          }
        };
    ResultList<User> users = listEntities(queryParams, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(2, users.getData().size());
    assertTrue(users.getData().stream().anyMatch(isUser1));
    assertTrue(users.getData().stream().anyMatch(isUser2));

    queryParams =
        new HashMap<>() {
          {
            put("team", team2.getName());
          }
        };
    users = listEntities(queryParams, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(1, users.getData().size());
    assertTrue(users.getData().stream().anyMatch(isUser2));

    users = listEntities(null, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertTrue(users.getData().stream().anyMatch(isUser0));
    assertTrue(users.getData().stream().anyMatch(isUser1));
    assertTrue(users.getData().stream().anyMatch(isUser2));
  }

  @Test
  void get_userWithInvalidFields_400_BadRequest(TestInfo test) throws HttpResponseException {
    User user = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    // Empty query field .../users?fields=
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> getEntity(user.getId(), "test", ADMIN_AUTH_HEADERS));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "Invalid field name");

    // .../users?fields=invalidField
    exception =
        assertThrows(HttpResponseException.class, () -> getEntity(user.getId(), "invalidField", ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidField("invalidField"));
  }

  /**
   * @see EntityResourceTest put_addDeleteFollower_200 test for tests related to GET user with owns field parameter
   * @see EntityResourceTest put_addDeleteFollower_200 for tests related getting user with follows list
   * @see TableResourceTest also tests GET user returns owns list
   */
  @Test
  void patch_userNameChange_as_another_user_401(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure username can't be changed using patch
    User user =
        createEntity(
            createRequest(test, 7).withName("test23").withDisplayName("displayName").withEmail("test23@email.com"),
            authHeaders("test23@email.com"));
    String userJson = JsonUtils.pojoToJson(user);
    user.setDisplayName("newName");
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> patchUser(userJson, user, authHeaders("test100@email.com")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test100'} does not have permissions");
  }

  @Test
  void patch_makeAdmin_as_another_user_401(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure username can't be changed using patch
    User user =
        createEntity(
            createRequest(test, 6).withName("test2").withDisplayName("displayName").withEmail("test2@email.com"),
            authHeaders("test2@email.com"));
    String userJson = JsonUtils.pojoToJson(user);
    user.setIsAdmin(Boolean.TRUE);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> patchUser(userJson, user, authHeaders("test100@email.com")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test100'} is not admin");
  }

  @Test
  void patch_userNameChange_as_same_user_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure username can't be changed using patch
    User user =
        createEntity(
            createRequest(test, 6).withName("test").withDisplayName("displayName").withEmail("test@email.com"),
            authHeaders("test@email.com"));
    String userJson = JsonUtils.pojoToJson(user);
    String newDisplayName = "newDisplayName";
    user.setDisplayName(newDisplayName); // Update the name
    user = patchUser(userJson, user, ADMIN_AUTH_HEADERS); // Patch the user
    assertEquals(newDisplayName, user.getDisplayName());
  }

  @Test
  void patch_userAttributes_as_admin_200_ok(TestInfo test) throws IOException {
    // Create user without any attributes - ***Note*** isAdmin by default is false.
    User user = createEntity(createRequest(test).withProfile(null), ADMIN_AUTH_HEADERS);
    assertListNull(user.getDisplayName(), user.getIsBot(), user.getProfile(), user.getTimezone());

    TeamResourceTest teamResourceTest = new TeamResourceTest();
    EntityReference team1 =
        new TeamEntityInterface(
                teamResourceTest.createEntity(teamResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS))
            .getEntityReference()
            .withHref(null);
    EntityReference team2 =
        new TeamEntityInterface(
                teamResourceTest.createEntity(teamResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS))
            .getEntityReference()
            .withHref(null);
    EntityReference team3 =
        new TeamEntityInterface(
                teamResourceTest.createEntity(teamResourceTest.createRequest(test, 3), ADMIN_AUTH_HEADERS))
            .getEntityReference()
            .withHref(null);
    List<EntityReference> teams = Arrays.asList(team1, team2);
    Profile profile = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    EntityReference role1 =
        new RoleEntityInterface(
                roleResourceTest.createEntity(roleResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS))
            .getEntityReference()
            .withHref(null);
    List<EntityReference> roles1 = Arrays.asList(role1);

    //
    // Add previously absent attributes
    //
    String origJson = JsonUtils.pojoToJson(user);

    String timezone = "America/Los_Angeles";
    user.withRoles(roles1)
        .withTeams(teams)
        .withTimezone(timezone)
        .withDisplayName("displayName")
        .withProfile(profile)
        .withIsBot(false)
        .withIsAdmin(false);

    ChangeDescription change = getChangeDescription(user.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("roles").withNewValue(roles1));
    change.getFieldsAdded().add(new FieldChange().withName("teams").withNewValue(teams));
    change.getFieldsAdded().add(new FieldChange().withName("timezone").withNewValue(timezone));
    change.getFieldsAdded().add(new FieldChange().withName("displayName").withNewValue("displayName"));
    change.getFieldsAdded().add(new FieldChange().withName("profile").withNewValue(profile));
    change.getFieldsAdded().add(new FieldChange().withName("isBot").withNewValue(false));
    user = patchEntityAndCheck(user, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Replace the attributes
    //
    String timezone1 = "Canada/Eastern";
    List<EntityReference> teams1 = Arrays.asList(team1, team3); // team2 dropped and team3 is added
    Profile profile1 = new Profile().withImages(new ImageList().withImage(URI.create("http://image2.com")));

    EntityReference role2 =
        new RoleEntityInterface(
                roleResourceTest.createEntity(roleResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS))
            .getEntityReference()
            .withHref(null);
    List<EntityReference> roles2 = Arrays.asList(role2);

    origJson = JsonUtils.pojoToJson(user);
    user.withRoles(roles2)
        .withTeams(teams1)
        .withTimezone(timezone1)
        .withDisplayName("displayName1")
        .withProfile(profile1)
        .withIsBot(true)
        .withIsAdmin(false);

    change = getChangeDescription(user.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("roles").withOldValue(roles1));
    change.getFieldsAdded().add(new FieldChange().withName("roles").withNewValue(roles2));
    change.getFieldsDeleted().add(new FieldChange().withName("teams").withOldValue(List.of(team2)));
    change.getFieldsAdded().add(new FieldChange().withName("teams").withNewValue(List.of(team3)));
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("timezone").withOldValue(timezone).withNewValue(timezone1));
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("displayName").withOldValue("displayName").withNewValue("displayName1"));
    change.getFieldsUpdated().add(new FieldChange().withName("profile").withOldValue(profile).withNewValue(profile1));
    change.getFieldsUpdated().add(new FieldChange().withName("isBot").withOldValue(false).withNewValue(true));

    user = patchEntityAndCheck(user, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Remove the attributes
    //
    origJson = JsonUtils.pojoToJson(user);
    user.withRoles(null)
        .withTeams(null)
        .withTimezone(null)
        .withDisplayName(null)
        .withProfile(null)
        .withIsBot(null)
        .withIsAdmin(false);

    // Note non-empty display field is not deleted
    change = getChangeDescription(user.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("roles").withOldValue(roles2));
    change.getFieldsDeleted().add(new FieldChange().withName("teams").withOldValue(teams1));
    change.getFieldsDeleted().add(new FieldChange().withName("timezone").withOldValue(timezone1));
    change.getFieldsDeleted().add(new FieldChange().withName("displayName").withOldValue("displayName1"));
    change.getFieldsDeleted().add(new FieldChange().withName("profile").withOldValue(profile1));
    change.getFieldsDeleted().add(new FieldChange().withName("isBot").withOldValue(true).withNewValue(null));
    patchEntityAndCheck(user, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void delete_validUser_as_admin_200(TestInfo test) throws IOException {
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    Team team = teamResourceTest.createEntity(teamResourceTest.createRequest(test), ADMIN_AUTH_HEADERS);
    List<UUID> teamIds = Collections.singletonList(team.getId());

    // Create user with teams
    CreateUser create = createRequest(test).withProfile(PROFILE).withTeams(teamIds);
    User user = createEntity(create, ADMIN_AUTH_HEADERS);

    // Add user as follower to a table
    TableResourceTest tableResourceTest = new TableResourceTest();
    Table table = tableResourceTest.createEntity(test, 1);
    tableResourceTest.addAndCheckFollower(table.getId(), user.getId(), CREATED, 1, ADMIN_AUTH_HEADERS);

    // Delete user
    deleteAndCheckEntity(user, ADMIN_AUTH_HEADERS);

    // Make sure the user is no longer following the table
    team = teamResourceTest.getEntity(team.getId(), "users", ADMIN_AUTH_HEADERS);
    assertTrue(team.getUsers().isEmpty());
    tableResourceTest.checkFollowerDeleted(table.getId(), user.getId(), ADMIN_AUTH_HEADERS);

    // User can no longer follow other entities
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> tableResourceTest.addAndCheckFollower(table.getId(), user.getId(), CREATED, 1, ADMIN_AUTH_HEADERS));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("user", user.getId()));

    // TODO deactivated user can't be made owner
  }

  private User patchUser(UUID userId, String originalJson, User updated, Map<String, String> headers)
      throws JsonProcessingException, HttpResponseException {
    String updatedJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
    return TestUtils.patch(CatalogApplicationTest.getResource("users/" + userId), patch, User.class, headers);
  }

  private User patchUser(String originalJson, User updated, Map<String, String> headers)
      throws JsonProcessingException, HttpResponseException {
    return patchUser(updated.getId(), originalJson, updated, headers);
  }

  /** Validate returned fields GET .../users/{id}?fields="..." or GET .../users/name/{name}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(User user, boolean byName) throws HttpResponseException {
    // .../teams?fields=profile
    String fields = "profile";
    user =
        byName
            ? getEntityByName(user.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(user.getId(), fields, ADMIN_AUTH_HEADERS);
    assertNotNull(user.getProfile());
    assertNull(user.getTeams());

    // .../teams?fields=profile,teams
    fields = "profile, teams";
    user =
        byName
            ? getEntityByName(user.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(user.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(user.getProfile(), user.getTeams());
  }

  @Override
  public CreateUser createRequest(String name, String description, String displayName, EntityReference owner) {
    // user part of the email should be less than 64 in length
    String emailUser = name == null || name.isEmpty() ? UUID.randomUUID().toString() : name;
    emailUser = emailUser.length() > 64 ? emailUser.substring(0, 64) : emailUser;
    return new CreateUser()
        .withName(name)
        .withEmail(emailUser + "@open-metadata.org")
        .withDescription(description)
        .withDisplayName(displayName)
        .withProfile(PROFILE);
  }

  @Override
  public User beforeDeletion(TestInfo test, User user) throws HttpResponseException {
    LocationResourceTest locationResourceTest = new LocationResourceTest();
    EntityReference userRef = new EntityReference().withId(user.getId()).withType("user");
    locationResourceTest.createEntity(
        locationResourceTest.createRequest(getEntityName(test, 0), null, null, userRef), ADMIN_AUTH_HEADERS);
    locationResourceTest.createEntity(
        locationResourceTest.createRequest(getEntityName(test, 1), null, null, TEAM_OWNER1), ADMIN_AUTH_HEADERS);
    return user;
  }

  @Override
  protected void validateDeletedEntity(
      CreateUser create, User userBeforeDeletion, User userAfterDeletion, Map<String, String> authHeaders)
      throws HttpResponseException {
    super.validateDeletedEntity(create, userBeforeDeletion, userAfterDeletion, authHeaders);

    List<EntityReference> expectedOwnedEntities = new ArrayList<>();
    for (EntityReference ref : Optional.ofNullable(userBeforeDeletion.getOwns()).orElse(Collections.emptyList())) {
      expectedOwnedEntities.add(new EntityReference().withId(ref.getId()).withType(Entity.TABLE));
    }
    if (!expectedOwnedEntities.isEmpty()) {
      assertEquals(expectedOwnedEntities.size(), userAfterDeletion.getOwns().size());
      for (EntityReference ref : expectedOwnedEntities) {
        TestUtils.existsInEntityReferenceList(userAfterDeletion.getOwns(), ref.getId(), true);
      }
    }
  }

  @Override
  public void validateCreatedEntity(User user, CreateUser createRequest, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(user), createRequest.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    assertEquals(createRequest.getName(), user.getName());
    assertEquals(createRequest.getDisplayName(), user.getDisplayName());
    assertEquals(createRequest.getTimezone(), user.getTimezone());
    assertEquals(createRequest.getIsBot(), user.getIsBot());
    assertEquals(createRequest.getIsAdmin(), user.getIsAdmin());

    List<EntityReference> expectedRoles = new ArrayList<>();
    for (UUID roleId : Optional.ofNullable(createRequest.getRoles()).orElse(Collections.emptyList())) {
      expectedRoles.add(new EntityReference().withId(roleId).withType(Entity.ROLE));
    }
    if (!expectedRoles.isEmpty()) {
      assertEquals(expectedRoles.size(), user.getRoles().size());
      for (EntityReference role : expectedRoles) {
        TestUtils.existsInEntityReferenceList(user.getRoles(), role.getId(), true);
      }
    }

    List<EntityReference> expectedTeams = new ArrayList<>();
    for (UUID teamId : Optional.ofNullable(createRequest.getTeams()).orElse(Collections.emptyList())) {
      expectedTeams.add(new EntityReference().withId(teamId).withType(Entity.TEAM));
    }
    if (!expectedTeams.isEmpty()) {
      assertEquals(expectedTeams.size(), user.getTeams().size());
      for (EntityReference team : expectedTeams) {
        TestUtils.existsInEntityReferenceList(user.getTeams(), team.getId(), true);
      }
    }
    if (createRequest.getProfile() != null) {
      assertEquals(createRequest.getProfile(), user.getProfile());
    }
  }

  @Override
  public void validateUpdatedEntity(User user, CreateUser request, Map<String, String> authHeaders) {
    validateCreatedEntity(user, request, authHeaders);
  }

  @Override
  public void compareEntities(User expected, User updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(expected), expected.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    assertEquals(expected.getName(), expected.getName());
    assertEquals(expected.getDisplayName(), expected.getDisplayName());
    assertEquals(expected.getTimezone(), expected.getTimezone());
    assertEquals(expected.getIsBot(), expected.getIsBot());
    assertEquals(expected.getIsAdmin(), expected.getIsAdmin());

    compareEntityReferenceLists(expected.getRoles(), updated.getRoles());
    compareEntityReferenceLists(expected.getTeams(), updated.getTeams());

    if (expected.getProfile() != null) {
      assertEquals(expected.getProfile(), updated.getProfile());
    }
  }

  private void compareEntityReferenceLists(List<EntityReference> expected, List<EntityReference> updated) {
    List<EntityReference> expectedList = Optional.ofNullable(expected).orElse(Collections.emptyList());
    List<EntityReference> updatedList = new ArrayList<>(Optional.ofNullable(updated).orElse(Collections.emptyList()));

    updatedList.forEach(TestUtils::validateEntityReference);
    expectedList.sort(EntityUtil.compareEntityReference);
    updatedList.sort(EntityUtil.compareEntityReference);
    updatedList.forEach(t -> t.setHref(null));
    expectedList.forEach(t -> t.setHref(null));
    assertEquals(expectedList, updatedList);
  }

  @Override
  public EntityInterface<User> getEntityInterface(User entity) {
    return new UserEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == null && actual == null) {
      return;
    }
    if (fieldName.equals("profile")) {
      Profile expectedProfile = (Profile) expected;
      Profile actualProfile = JsonUtils.readValue(actual.toString(), Profile.class);
      assertEquals(expectedProfile, actualProfile);
    } else if (fieldName.equals("teams") || fieldName.equals("roles")) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedList = (List<EntityReference>) expected;
      List<EntityReference> actualList = JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertEquals(expectedList, actualList);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
