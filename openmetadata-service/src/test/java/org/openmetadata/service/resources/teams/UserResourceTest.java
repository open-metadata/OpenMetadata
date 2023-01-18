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

package org.openmetadata.service.resources.teams;

import static java.util.List.of;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static javax.ws.rs.core.Response.Status.UNAUTHORIZED;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.exception.CatalogExceptionMessage.PASSWORD_INVALID_FORMAT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notAdmin;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.resources.teams.UserResource.USER_PROTECTED_FIELDS;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertDeleted;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;
import static org.openmetadata.service.util.TestUtils.validateAlphabeticalOrdering;

import com.auth0.jwt.JWT;
import com.auth0.jwt.exceptions.JWTDecodeException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TimeZone;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.GenerateTokenRequest;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.RegistrationRequest;
import org.openmetadata.schema.auth.RevokeTokenRequest;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.GoogleSSOClientConfig;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ImageList;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.service.Entity;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.bots.BotResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.locations.LocationResourceTest;
import org.openmetadata.service.resources.teams.UserResource.UserList;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.PasswordUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.TestUtils.UpdateType;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UserResourceTest extends EntityResourceTest<User, CreateUser> {
  final Profile PROFILE = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

  public UserResourceTest() {
    super(Entity.USER, User.class, UserList.class, "users", UserResource.FIELDS);
    supportedNameCharacters = supportedNameCharacters.replace(" ", ""); // Space not supported
  }

  public void setupUsers(TestInfo test) throws HttpResponseException {
    CreateUser create = createRequest(test).withRoles(List.of(DATA_CONSUMER_ROLE.getId()));
    USER1 = createEntity(create, ADMIN_AUTH_HEADERS);
    USER1_REF = USER1.getEntityReference();

    create = createRequest(test, 1).withRoles(List.of(DATA_CONSUMER_ROLE.getId()));
    USER2 = createEntity(create, ADMIN_AUTH_HEADERS);
    USER2_REF = USER2.getEntityReference();

    create = createRequest("user-data-steward", "", "", null).withRoles(List.of(DATA_STEWARD_ROLE.getId()));
    USER_WITH_DATA_STEWARD_ROLE = createEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest("user-data-consumer", "", "", null).withRoles(List.of(DATA_CONSUMER_ROLE.getId()));
    USER_WITH_DATA_CONSUMER_ROLE = createEntity(create, ADMIN_AUTH_HEADERS);

    // USER_TEAM21 is part of TEAM21
    create = createRequest(test, 2).withTeams(List.of(TEAM21.getId()));
    USER_TEAM21 = createEntity(create, ADMIN_AUTH_HEADERS);
    USER2_REF = USER2.getEntityReference();

    List<String> userFields = Entity.getEntityFields(User.class);
    userFields.remove("authenticationMechanism");
    BOT_USER = getEntityByName(INGESTION_BOT, String.join(",", userFields), ADMIN_AUTH_HEADERS);
  }

  @Test
  @Override
  public void post_entity_as_non_admin_401(TestInfo test) {
    // Override the method as a User can create a User entity for himself
    // during first time login without being an admin
  }

  @Test
  void post_userWithoutEmail_400_badRequest(TestInfo test) {
    // Create user with mandatory email field null
    CreateUser create = createRequest(test).withEmail(null);
    assertResponse(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "[email must not be null]");

    // Create user with mandatory email field empty
    create.withEmail("");
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "email must match \"^\\S+@\\S+\\.\\S+$\"");
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "email size must be between 6 and 127");

    // Create user with mandatory email field with invalid email address
    create.withEmail("invalidEmail");
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "[email must match \"^\\S+@\\S+\\.\\S+$\"]");
  }

  @Test
  void post_validUser_200_ok_without_login(TestInfo test) {
    CreateUser create =
        createRequest(test, 6).withDisplayName("displayName").withEmail("test@email.com").withIsAdmin(true);

    assertResponse(
        () -> createAndCheckEntity(create, null), UNAUTHORIZED, "Not authorized; User's Email is not present");
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

    create =
        createRequest(test, 5)
            .withDisplayName("displayName")
            .withProfile(PROFILE)
            .withIsBot(true)
            .withAuthenticationMechanism(
                new AuthenticationMechanism()
                    .withAuthType(AuthenticationMechanism.AuthType.JWT)
                    .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited)));
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 6).withDisplayName("displayName").withProfile(PROFILE).withIsAdmin(true);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(create);
  }

  @Test
  void put_validUser_200_ok() throws IOException {
    // Create user with different optional fields
    CreateUser create = createRequest("user.xyz", null, null, null);
    User user = updateAndCheckEntity(create, CREATED, ADMIN_AUTH_HEADERS, UpdateType.CREATED, null);

    // Update the user information using PUT
    String oldEmail = create.getEmail();
    CreateUser update = create.withEmail("user.xyz@email.com").withDisplayName("displayName1");

    ChangeDescription change = getChangeDescription(user.getVersion());
    fieldAdded(change, "displayName", "displayName1");
    fieldUpdated(change, "email", oldEmail, "user.xyz@email.com");
    user = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update the user information using PUT as the logged-in user
    update = create.withDisplayName("displayName2");
    change = getChangeDescription(user.getVersion());
    fieldUpdated(change, "displayName", "displayName1", "displayName2");
    updateAndCheckEntity(update, OK, authHeaders("user.xyz@email.com"), MINOR_UPDATE, change);
    assertNotNull(user);
  }

  @Test
  void post_validAdminUser_Non_Admin_401(TestInfo test) {
    CreateUser create =
        createRequest(test, 6)
            .withName("test")
            .withDisplayName("displayName")
            .withEmail("test@email.com")
            .withIsAdmin(true);

    assertResponse(() -> createAndCheckEntity(create, TEST_AUTH_HEADERS), FORBIDDEN, notAdmin(TEST_USER_NAME));
  }

  @Test
  void post_validAdminUser_200_ok(TestInfo test) throws IOException {
    CreateUser create =
        createRequest(test, 6)
            .withName("testAdmin")
            .withDisplayName("displayName")
            .withEmail("testAdmin@email.com")
            .withIsAdmin(true);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(create);
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
    List<UUID> teams = of(team1.getId(), team2.getId());
    List<UUID> team = of(team1.getId());

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

    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("team", team1.getName());

    ResultList<User> users = listEntities(queryParams, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(2, users.getData().size());
    assertTrue(users.getData().stream().anyMatch(isUser1));
    assertTrue(users.getData().stream().anyMatch(isUser2));

    queryParams = new HashMap<>();
    queryParams.put("team", team2.getName());

    users = listEntities(queryParams, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(1, users.getData().size());
    assertTrue(users.getData().stream().anyMatch(isUser2));

    users = listEntities(null, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertTrue(users.getData().stream().anyMatch(isUser0));
    assertTrue(users.getData().stream().anyMatch(isUser1));
    assertTrue(users.getData().stream().anyMatch(isUser2));
  }

  @Test
  void get_listUsersWithAdminFilter_200_ok(TestInfo test) throws IOException {
    ResultList<User> users = listEntities(null, 100_000, null, null, ADMIN_AUTH_HEADERS);
    int initialUserCount = users.getPaging().getTotal();
    Map<String, String> adminQueryParams = new HashMap<>();
    adminQueryParams.put("isAdmin", "true");
    users = listEntities(adminQueryParams, 100_000, null, null, ADMIN_AUTH_HEADERS);
    int initialAdminCount = users.getPaging().getTotal();

    // user0 is admin
    // user1 is not an admin
    // user2 is not an admin
    CreateUser create = createRequest(test, 0).withIsAdmin(true);
    User user0 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    create = createRequest(test, 1).withIsAdmin(false);
    User user1 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    create = createRequest(test, 2).withIsAdmin(false);
    User user2 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    Predicate<User> isUser0 = u -> u.getId().equals(user0.getId());
    Predicate<User> isUser1 = u -> u.getId().equals(user1.getId());
    Predicate<User> isUser2 = u -> u.getId().equals(user2.getId());

    users = listEntities(null, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(initialUserCount + 3, users.getPaging().getTotal());

    // list admin users
    users = listEntities(adminQueryParams, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(initialAdminCount + 1, users.getData().size());
    assertEquals(initialAdminCount + 1, users.getPaging().getTotal());
    assertTrue(users.getData().stream().anyMatch(isUser0));

    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("isAdmin", "false");

    // list non-admin users
    users = listEntities(queryParams, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(initialUserCount - initialAdminCount + 2, users.getPaging().getTotal());
    assertTrue(users.getData().stream().anyMatch(isUser1));
    assertTrue(users.getData().stream().anyMatch(isUser2));
  }

  @Test
  void get_listUsersWithBotFilter_200_ok(TestInfo test) throws IOException {
    ResultList<User> users = listEntities(null, 100_000, null, null, ADMIN_AUTH_HEADERS);
    int initialUserCount = users.getPaging().getTotal();
    Map<String, String> botQueryParams = new HashMap<>();
    botQueryParams.put("isBot", "true");
    ResultList<User> bots = listEntities(botQueryParams, 100_000, null, null, ADMIN_AUTH_HEADERS);
    int initialBotCount = bots.getPaging().getTotal();

    // Create 3 bot users
    CreateUser create = createBotUserRequest(test, 0);
    User bot0 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    create = createBotUserRequest(test, 1);
    User bot1 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    create = createBotUserRequest(test, 2);
    User bot2 = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    Predicate<User> isBot0 = u -> u.getId().equals(bot0.getId());
    Predicate<User> isBot1 = u -> u.getId().equals(bot1.getId());
    Predicate<User> isBot2 = u -> u.getId().equals(bot2.getId());

    users = listEntities(null, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(initialUserCount + 3, users.getPaging().getTotal());

    // list bot users
    bots = listEntities(botQueryParams, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(initialBotCount + 3, bots.getData().size());
    assertEquals(initialBotCount + 3, bots.getPaging().getTotal());
    assertTrue(bots.getData().stream().anyMatch(isBot0));
    assertTrue(bots.getData().stream().anyMatch(isBot1));
    assertTrue(bots.getData().stream().anyMatch(isBot2));

    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("isBot", "false");

    // list users (not bots)
    users = listEntities(queryParams, 100_000, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(initialUserCount - initialBotCount, users.getPaging().getTotal());
  }

  @Test
  void get_listUsersWithFalseBotFilterPagination(TestInfo test) throws IOException {
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    Team team = teamResourceTest.createEntity(teamResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);

    Map<String, String> queryParams = Map.of("isBot", "false", "team", team.getName());

    // create 5 bot users
    for (int i = 0; i < 5; i++) {
      CreateUser create = createBotUserRequest(test, i).withTeams(List.of(team.getId()));
      createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    }

    // create 10 non-bot users
    for (int i = 5; i < 15; i++) {
      CreateUser create = createRequest(test, i).withTeams(List.of(team.getId()));
      createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    }

    ResultList<User> users = listEntities(queryParams, 5, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(5, users.getData().size());
    assertEquals(10, users.getPaging().getTotal());
    // First page must contain "after" and should not have "before"
    assertNotNull(users.getPaging().getAfter());
    assertNull(users.getPaging().getBefore());
    User user1 = users.getData().get(0);

    String after = users.getPaging().getAfter();
    users = listEntities(queryParams, 5, null, after, ADMIN_AUTH_HEADERS);
    assertEquals(5, users.getData().size());
    assertEquals(10, users.getPaging().getTotal());
    // Third page must contain only "before" since it is the last page
    assertNull(users.getPaging().getAfter());
    assertNotNull(users.getPaging().getBefore());
    User user2 = users.getData().get(0);
    assertNotEquals(user1, user2);

    String before = users.getPaging().getBefore();
    users = listEntities(queryParams, 5, before, null, ADMIN_AUTH_HEADERS);
    assertEquals(5, users.getData().size());
    assertEquals(10, users.getPaging().getTotal());
    // First page must contain only "after"
    assertNotNull(users.getPaging().getAfter());
    assertNull(users.getPaging().getBefore());
    assertEquals(user1, users.getData().get(0));
  }

  private CreateUser createBotUserRequest(TestInfo test, int index) {
    return createBotUserRequest(getEntityName(test, index));
  }

  @Test
  void get_listUsersWithTeamsPagination(TestInfo test) throws IOException {
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    Team team1 = teamResourceTest.createEntity(teamResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    List<UUID> team = of(team1.getId());

    // create 15 users and add them to team1
    for (int i = 0; i < 15; i++) {
      CreateUser create = createRequest(test, i).withTeams(team);
      createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    }

    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("team", team1.getName());

    ResultList<User> users = listEntities(queryParams, 5, null, null, ADMIN_AUTH_HEADERS);
    assertEquals(5, users.getData().size());
    assertEquals(15, users.getPaging().getTotal());
    // First page must contain "after" and should not have "before"
    assertNotNull(users.getPaging().getAfter());
    assertNull(users.getPaging().getBefore());
    User user1 = users.getData().get(0);

    String after = users.getPaging().getAfter();
    users = listEntities(queryParams, 5, null, after, ADMIN_AUTH_HEADERS);
    assertEquals(5, users.getData().size());
    assertEquals(15, users.getPaging().getTotal());
    // Second page must contain both "after" and "before"
    assertNotNull(users.getPaging().getAfter());
    assertNotNull(users.getPaging().getBefore());
    User user2 = users.getData().get(0);

    after = users.getPaging().getAfter();
    users = listEntities(queryParams, 5, null, after, ADMIN_AUTH_HEADERS);
    assertEquals(5, users.getData().size());
    assertEquals(15, users.getPaging().getTotal());
    // Third page must contain only "before" since it is the last page
    assertNull(users.getPaging().getAfter());
    assertNotNull(users.getPaging().getBefore());
    User user3 = users.getData().get(0);
    assertNotEquals(user2, user3);

    // Now fetch previous pages using before pointer
    String before = users.getPaging().getBefore();
    users = listEntities(queryParams, 5, before, null, ADMIN_AUTH_HEADERS);
    assertEquals(5, users.getData().size());
    assertEquals(15, users.getPaging().getTotal());
    // Second page must contain both "after" and "before"
    assertNotNull(users.getPaging().getAfter());
    assertNotNull(users.getPaging().getBefore());
    assertEquals(user2, users.getData().get(0));

    before = users.getPaging().getBefore();
    users = listEntities(queryParams, 5, before, null, ADMIN_AUTH_HEADERS);
    assertEquals(5, users.getData().size());
    assertEquals(15, users.getPaging().getTotal());
    // First page must contain only "after"
    assertNotNull(users.getPaging().getAfter());
    assertNull(users.getPaging().getBefore());
    assertEquals(user1, users.getData().get(0));
  }

  /**
   * @see EntityResourceTest put_addDeleteFollower_200 test for tests related to GET user with owns field parameter
   * @see EntityResourceTest put_addDeleteFollower_200 for tests related getting user with follows list
   * @see TableResourceTest also tests GET user returns owns list
   */
  @Test
  void patch_userNameChange_as_another_user_401(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure user display can't be changed using patch by another user
    User user =
        createEntity(
            createRequest(test, 7).withName("test23").withDisplayName("displayName").withEmail("test23@email.com"),
            authHeaders("test23@email.com"));
    String userJson = JsonUtils.pojoToJson(user);
    user.setDisplayName("newName");
    assertResponse(
        () -> patchEntity(user.getId(), userJson, user, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.EDIT_DISPLAY_NAME)));
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
    assertResponse(() -> patchEntity(user.getId(), userJson, user, TEST_AUTH_HEADERS), FORBIDDEN, notAdmin("test"));
  }

  @Test
  void patch_userNameChange_as_same_user_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure username can't be changed using patch
    User user =
        createEntity(
            createRequest(test, 6).withName("test1").withDisplayName("displayName").withEmail("test1@email.com"),
            authHeaders("test1@email.com"));
    String userJson = JsonUtils.pojoToJson(user);
    String newDisplayName = "newDisplayName";
    user.setDisplayName(newDisplayName); // Update the name
    user = patchEntity(user.getId(), userJson, user, ADMIN_AUTH_HEADERS); // Patch the user
    assertEquals(newDisplayName, user.getDisplayName());
  }

  @Test
  void patch_teamAddition_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    EntityReference team1 =
        teamResourceTest.createEntity(teamResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS).getEntityReference();
    User user =
        createEntity(
            createRequest(test, 10)
                .withName("testUser1")
                .withDisplayName("displayName")
                .withEmail("testUser1@email.com"),
            authHeaders("test1@email.com"));
    String userJson = JsonUtils.pojoToJson(user);
    List<EntityReference> teams = user.getTeams();
    teams.add(team1);
    user.setTeams(teams); // Update the teams
    user = patchEntity(user.getId(), userJson, user, ADMIN_AUTH_HEADERS); // Patch the user
    // Ensure default "Organization" team is not part of the patch response
    assertEquals(1, user.getTeams().size());
    assertEquals(team1.getId(), user.getTeams().get(0).getId());
  }

  @Test
  void patch_userAttributes_as_admin_200_ok(TestInfo test) throws IOException {
    // Create user without any attributes - ***Note*** isAdmin by default is false.
    User user = createEntity(createRequest(test).withProfile(null), ADMIN_AUTH_HEADERS);
    assertListNull(user.getDisplayName(), user.getIsBot(), user.getProfile(), user.getTimezone());

    TeamResourceTest teamResourceTest = new TeamResourceTest();
    EntityReference team1 =
        teamResourceTest.createEntity(teamResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS).getEntityReference();
    EntityReference team2 =
        teamResourceTest.createEntity(teamResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS).getEntityReference();
    EntityReference team3 =
        teamResourceTest.createEntity(teamResourceTest.createRequest(test, 3), ADMIN_AUTH_HEADERS).getEntityReference();
    List<EntityReference> teams = Arrays.asList(team1, team2);
    Profile profile = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    EntityReference role1 =
        roleResourceTest.createEntity(roleResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS).getEntityReference();

    //
    // Add previously absent attributes. Note the default team Organization is deleted when adding new teams.
    //
    String origJson = JsonUtils.pojoToJson(user);

    String timezone = "America/Los_Angeles";
    user.withRoles(listOf(role1))
        .withTeams(teams)
        .withTimezone(timezone)
        .withDisplayName("displayName")
        .withProfile(profile)
        .withIsBot(false)
        .withIsAdmin(false);
    ChangeDescription change = getChangeDescription(user.getVersion());
    fieldAdded(change, "roles", listOf(role1));
    fieldDeleted(change, "teams", listOf(ORG_TEAM.getEntityReference()));
    fieldAdded(change, "teams", teams);
    fieldAdded(change, "timezone", timezone);
    fieldAdded(change, "displayName", "displayName");
    fieldAdded(change, "profile", profile);
    fieldAdded(change, "isBot", false);
    user = patchEntityAndCheck(user, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Replace the attributes
    //
    String timezone1 = "Canada/Eastern";
    List<EntityReference> teams1 = Arrays.asList(team1, team3); // team2 dropped and team3 is added
    Profile profile1 = new Profile().withImages(new ImageList().withImage(URI.create("http://image2.com")));

    EntityReference role2 =
        roleResourceTest.createEntity(roleResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS).getEntityReference();

    origJson = JsonUtils.pojoToJson(user);
    user.withRoles(listOf(role2))
        .withTeams(teams1)
        .withTimezone(timezone1)
        .withDisplayName("displayName1")
        .withProfile(profile1)
        .withIsBot(true)
        .withIsAdmin(false);

    change = getChangeDescription(user.getVersion());
    fieldDeleted(change, "roles", listOf(role1));
    fieldAdded(change, "roles", listOf(role2));
    fieldDeleted(change, "teams", listOf(team2));
    fieldAdded(change, "teams", listOf(team3));
    fieldUpdated(change, "timezone", timezone, timezone1);
    fieldUpdated(change, "displayName", "displayName", "displayName1");
    fieldUpdated(change, "profile", profile, profile1);
    fieldUpdated(change, "isBot", false, true);
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

    // Note non-empty display field is not deleted. When teams are deleted, Organization is added back as default team.
    change = getChangeDescription(user.getVersion());
    fieldDeleted(change, "roles", listOf(role2));
    fieldDeleted(change, "teams", teams1);
    fieldAdded(change, "teams", listOf(ORG_TEAM.getEntityReference()));
    fieldDeleted(change, "timezone", timezone1);
    fieldDeleted(change, "displayName", "displayName1");
    fieldDeleted(change, "profile", profile1);
    fieldDeleted(change, "isBot", true);
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
    tableResourceTest.addAndCheckFollower(table.getId(), user.getId(), OK, 1, ADMIN_AUTH_HEADERS);

    // Delete user
    deleteAndCheckEntity(user, ADMIN_AUTH_HEADERS);

    // Make sure the user is no longer following the table
    team = teamResourceTest.getEntity(team.getId(), "users", ADMIN_AUTH_HEADERS);
    assertDeleted(team.getUsers(), true);
    tableResourceTest.checkFollowerDeleted(table.getId(), user.getId(), ADMIN_AUTH_HEADERS);

    // User can no longer follow other entities
    assertResponse(
        () -> tableResourceTest.addAndCheckFollower(table.getId(), user.getId(), OK, 1, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("user", user.getId()));
  }

  @Test
  void put_generateToken_bot_user_200_ok() throws HttpResponseException {
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthType.SSO)
            .withConfig(
                new SSOAuthMechanism()
                    .withSsoServiceType(SSOAuthMechanism.SsoServiceType.GOOGLE)
                    .withAuthConfig(new GoogleSSOClientConfig().withSecretKey("/path/to/secret.json")));
    CreateUser create =
        createBotUserRequest("ingestion-bot-jwt")
            .withEmail("ingestion-bot-jwt@email.com")
            .withRoles(List.of(ROLE1_REF.getId()))
            .withAuthenticationMechanism(authMechanism);
    User user = createEntity(create, authHeaders("ingestion-bot-jwt@email.com"));
    user = getEntity(user.getId(), "*", ADMIN_AUTH_HEADERS);
    assertEquals(user.getRoles().size(), 1);
    TestUtils.put(
        getResource(String.format("users/generateToken/%s", user.getId())),
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Seven),
        OK,
        ADMIN_AUTH_HEADERS);
    user = getEntity(user.getId(), "*", ADMIN_AUTH_HEADERS);
    assertNull(user.getAuthenticationMechanism());
    assertEquals(user.getRoles().size(), 1);
    JWTAuthMechanism jwtAuthMechanism =
        TestUtils.get(
            getResource(String.format("users/token/%s", user.getId())), JWTAuthMechanism.class, ADMIN_AUTH_HEADERS);
    assertNotNull(jwtAuthMechanism.getJWTToken());
    DecodedJWT jwt = decodedJWT(jwtAuthMechanism.getJWTToken());
    Date date = jwt.getExpiresAt();
    long daysBetween = ((date.getTime() - jwt.getIssuedAt().getTime()) / (1000 * 60 * 60 * 24));
    assertTrue(daysBetween >= 6);
    assertEquals("ingestion-bot-jwt", jwt.getClaims().get("sub").asString());
    assertEquals(true, jwt.getClaims().get("isBot").asBoolean());
    TestUtils.put(
        getResource("users/revokeToken"), new RevokeTokenRequest().withId(user.getId()), OK, ADMIN_AUTH_HEADERS);
    jwtAuthMechanism =
        TestUtils.get(
            getResource(String.format("users/token/%s", user.getId())), JWTAuthMechanism.class, ADMIN_AUTH_HEADERS);
    assertEquals(StringUtils.EMPTY, jwtAuthMechanism.getJWTToken());
  }

  @Test
  void get_generateRandomPassword() throws HttpResponseException {
    String randomPwd = TestUtils.get(getResource("users/generateRandomPwd"), String.class, ADMIN_AUTH_HEADERS);
    assertDoesNotThrow(() -> PasswordUtil.validatePassword(randomPwd), PASSWORD_INVALID_FORMAT);
  }

  @Test
  void post_createUser_BasicAuth_AdminCreate_login_200_ok(TestInfo test) throws HttpResponseException {
    // Create a user with Auth and Try Logging in
    User user =
        createEntity(
            createRequest(test)
                .withName("testBasicAuth")
                .withDisplayName("Test")
                .withEmail("testBasicAuth@email.com")
                .withIsBot(false)
                .withCreatePasswordType(CreateUser.CreatePasswordType.ADMIN_CREATE)
                .withPassword("Test@1234")
                .withConfirmPassword("Test@1234"),
            authHeaders("testBasicAuth@email.com"));

    // jwtAuth Response should be null always
    user = getEntity(user.getId(), ADMIN_AUTH_HEADERS);
    assertNull(user.getAuthenticationMechanism());

    // Login With Correct Password
    LoginRequest loginRequest =
        new LoginRequest().withEmail("testBasicAuth@email.com").withPassword(encodePassword("Test@1234"));
    JwtResponse jwtResponse =
        TestUtils.post(
            getResource("users/login"), loginRequest, JwtResponse.class, OK.getStatusCode(), ADMIN_AUTH_HEADERS);

    validateJwtBasicAuth(jwtResponse, "testBasicAuth");

    // Login With Wrong email
    LoginRequest failedLoginWithWrongEmail =
        new LoginRequest().withEmail("testBasicAuth123@email.com").withPassword(encodePassword("Test@1234"));
    assertResponse(
        () ->
            TestUtils.post(
                getResource("users/login"),
                failedLoginWithWrongEmail,
                JwtResponse.class,
                BAD_REQUEST.getStatusCode(),
                ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.INVALID_USERNAME_PASSWORD);

    // Login With Wrong Password
    LoginRequest failedLoginWithWrongPwd =
        new LoginRequest().withEmail("testBasicAuth@email.com").withPassword(encodePassword("Test1@1234"));
    assertResponse(
        () ->
            TestUtils.post(
                getResource("users/login"),
                failedLoginWithWrongPwd,
                JwtResponse.class,
                UNAUTHORIZED.getStatusCode(),
                ADMIN_AUTH_HEADERS),
        UNAUTHORIZED,
        CatalogExceptionMessage.INVALID_USERNAME_PASSWORD);
  }

  @Test
  void post_createUser_BasicAuth_SignUp_200_ok() throws HttpResponseException {
    // Create a user with Auth and Try Logging in
    RegistrationRequest newRegistrationRequest =
        new RegistrationRequest()
            .withFirstName("Test")
            .withLastName("Test")
            .withEmail("testBasicAuth123@email.com")
            .withPassword("Test@1234");

    TestUtils.post(getResource("users/signup"), newRegistrationRequest, String.class, ADMIN_AUTH_HEADERS);

    // jwtAuth Response should be null always
    User user = getEntityByName("testBasicAuth123", null, ADMIN_AUTH_HEADERS);
    assertNull(user.getAuthenticationMechanism());

    // Login With Correct Password
    LoginRequest loginRequest =
        new LoginRequest().withEmail("testBasicAuth123@email.com").withPassword(encodePassword("Test@1234"));
    JwtResponse jwtResponse =
        TestUtils.post(
            getResource("users/login"), loginRequest, JwtResponse.class, OK.getStatusCode(), ADMIN_AUTH_HEADERS);

    validateJwtBasicAuth(jwtResponse, "testBasicAuth123");

    // Login With Wrong email
    LoginRequest failedLoginWithWrongEmail =
        new LoginRequest().withEmail("testBasicAuth1234@email.com").withPassword(encodePassword("Test@1234"));
    assertResponse(
        () ->
            TestUtils.post(
                getResource("users/login"),
                failedLoginWithWrongEmail,
                JwtResponse.class,
                BAD_REQUEST.getStatusCode(),
                ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.INVALID_USERNAME_PASSWORD);

    // Login With Wrong Password
    LoginRequest failedLoginWithWrongPwd =
        new LoginRequest().withEmail("testBasicAuth123@email.com").withPassword(encodePassword("Test1@1234"));
    assertResponse(
        () ->
            TestUtils.post(
                getResource("users/login"),
                failedLoginWithWrongPwd,
                JwtResponse.class,
                UNAUTHORIZED.getStatusCode(),
                ADMIN_AUTH_HEADERS),
        UNAUTHORIZED,
        CatalogExceptionMessage.INVALID_USERNAME_PASSWORD);
  }

  private String encodePassword(String password) {
    return Base64.getEncoder().encodeToString(password.getBytes());
  }

  private void validateJwtBasicAuth(JwtResponse jwtResponse, String username) {
    assertNotNull(jwtResponse.getAccessToken());
    DecodedJWT jwt = decodedJWT(jwtResponse.getAccessToken());
    Date date = jwt.getExpiresAt();
    long hours = ((date.getTime() - jwt.getIssuedAt().getTime()) / (1000 * 60 * 60));
    assertEquals(1, hours);
    assertEquals(username, jwt.getClaims().get("sub").asString());
    assertEquals(false, jwt.getClaims().get("isBot").asBoolean());
  }

  @Test
  void testInheritedRole() throws HttpResponseException {
    // USER1 inherits DATA_CONSUMER_ROLE from Organization
    User user1 = getEntity(USER1.getId(), "roles", ADMIN_AUTH_HEADERS);
    assertEntityReferences(List.of(DATA_CONSUMER_ROLE_REF), user1.getInheritedRoles());

    // USER_TEAM21 inherits DATA_CONSUMER_ROLE from Organization and DATA_STEWARD_ROLE from Team2
    User user_team21 = getEntity(USER_TEAM21.getId(), "roles", ADMIN_AUTH_HEADERS);
    assertEntityReferences(List.of(DATA_CONSUMER_ROLE_REF, DATA_STEWARD_ROLE_REF), user_team21.getInheritedRoles());
  }

  @Test
  void put_failIfBotUserIsAlreadyAssignedToAnotherBot(TestInfo test) throws HttpResponseException {
    BotResourceTest botResourceTest = new BotResourceTest();
    String botName = "test-bot-user-fail";
    // create bot user
    CreateUser createBotUser = createBotUserRequest("test-bot-user").withBotName(botName);
    User botUser = updateEntity(createBotUser, CREATED, ADMIN_AUTH_HEADERS);
    EntityReference botUserRef = Objects.requireNonNull(botUser).getEntityReference();
    // assign bot user to a bot
    CreateBot create = botResourceTest.createRequest(test).withBotUser(botUserRef).withName(botName);
    botResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    // put user with a different bot name
    CreateUser createWrongBotUser = createBotUserRequest("test-bot-user").withBotName("test-bot-user-fail-2");
    assertResponse(
        () -> updateEntity(createWrongBotUser, BAD_REQUEST, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.userAlreadyBot(botUser.getName(), create.getName()));
  }

  @Test
  void put_ok_ifBotUserIsBotUserOfBot(TestInfo test) throws HttpResponseException {
    BotResourceTest botResourceTest = new BotResourceTest();
    String botName = "test-bot-ok";
    // create bot user
    CreateUser createBotUser = createBotUserRequest("test-bot-user-ok").withBotName(botName);
    User botUser = updateEntity(createBotUser, CREATED, ADMIN_AUTH_HEADERS);
    EntityReference botUserRef = Objects.requireNonNull(botUser).getEntityReference();
    // assign bot user to a bot
    CreateBot create = botResourceTest.createRequest(test).withBotUser(botUserRef).withName(botName);
    botResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    // put again user with same bot name
    CreateUser createDifferentBotUser = createBotUserRequest("test-bot-user-ok").withBotName(botName);
    updateEntity(createDifferentBotUser, OK, ADMIN_AUTH_HEADERS);
    assertNotNull(createDifferentBotUser);
  }

  private DecodedJWT decodedJWT(String token) {
    DecodedJWT jwt;
    try {
      jwt = JWT.decode(token);
    } catch (JWTDecodeException e) {
      throw new AuthenticationException("Invalid token", e);
    }

    // Check if expired
    // if the expiresAt set to null, treat it as never expiring token
    if (jwt.getExpiresAt() != null
        && jwt.getExpiresAt().before(Calendar.getInstance(TimeZone.getTimeZone("UTC")).getTime())) {
      throw new AuthenticationException("Expired token!");
    }

    return jwt;
  }

  private void assertRoles(User user, List<EntityReference> expectedRoles) {
    TestUtils.assertEntityReferences(expectedRoles, user.getRoles());
  }

  @Override
  public User validateGetWithDifferentFields(User user, boolean byName) throws HttpResponseException {
    String fields = "";
    user =
        byName
            ? getEntityByName(user.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(user.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(user.getProfile(), user.getRoles(), user.getTeams(), user.getFollows(), user.getOwns());

    fields = "profile,roles,teams,follows,owns";
    user =
        byName
            ? getEntityByName(user.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(user.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(user.getProfile(), user.getRoles(), user.getTeams(), user.getFollows(), user.getOwns());
    validateAlphabeticalOrdering(user.getTeams(), EntityUtil.compareEntityReference);
    return user;
  }

  @Override
  public CreateUser createRequest(String name) {
    // user part of the email should be less than 64 in length
    String emailUser = nullOrEmpty(name) ? UUID.randomUUID().toString() : name;
    emailUser = emailUser.length() > 64 ? emailUser.substring(0, 64) : emailUser;
    return new CreateUser().withName(name).withEmail(emailUser + "@open-metadata.org").withProfile(PROFILE);
  }

  @Override
  public User beforeDeletion(TestInfo test, User user) throws HttpResponseException {
    LocationResourceTest locationResourceTest = new LocationResourceTest();
    EntityReference userRef = reduceEntityReference(user);
    locationResourceTest.createEntity(
        locationResourceTest.createRequest(getEntityName(test, 0), null, null, userRef), ADMIN_AUTH_HEADERS);
    locationResourceTest.createEntity(
        locationResourceTest.createRequest(getEntityName(test, 1), null, null, TEAM11_REF), ADMIN_AUTH_HEADERS);
    return user;
  }

  @Override
  protected void validateDeletedEntity(
      CreateUser create, User userBeforeDeletion, User userAfterDeletion, Map<String, String> authHeaders)
      throws HttpResponseException {
    super.validateDeletedEntity(create, userBeforeDeletion, userAfterDeletion, authHeaders);

    List<EntityReference> expectedOwnedEntities = new ArrayList<>();
    for (EntityReference ref : listOrEmpty(userBeforeDeletion.getOwns())) {
      expectedOwnedEntities.add(reduceEntityReference(ref));
    }

    TestUtils.assertEntityReferences(expectedOwnedEntities, userAfterDeletion.getOwns());
  }

  @Override
  public void validateCreatedEntity(User user, CreateUser createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), user.getName());
    assertEquals(createRequest.getDisplayName(), user.getDisplayName());
    assertEquals(createRequest.getTimezone(), user.getTimezone());
    assertEquals(createRequest.getIsBot(), user.getIsBot());
    assertEquals(createRequest.getIsAdmin(), user.getIsAdmin());

    List<EntityReference> expectedRoles = new ArrayList<>();
    for (UUID roleId : listOrEmpty(createRequest.getRoles())) {
      expectedRoles.add(new EntityReference().withId(roleId).withType(Entity.ROLE));
    }
    assertRoles(user, expectedRoles);

    List<EntityReference> expectedTeams = new ArrayList<>();
    for (UUID teamId : listOrEmpty(createRequest.getTeams())) {
      expectedTeams.add(new EntityReference().withId(teamId).withType(Entity.TEAM));
    }
    if (expectedTeams.isEmpty()) {
      expectedTeams = new ArrayList<>(List.of(ORG_TEAM.getEntityReference())); // Organization is default team
    } else {
      // Remove ORG_TEAM from the expected teams
      expectedTeams =
          expectedTeams.stream().filter(t -> !t.getId().equals(ORG_TEAM.getId())).collect(Collectors.toList());
    }
    assertEntityReferences(expectedTeams, user.getTeams());

    if (createRequest.getProfile() != null) {
      assertEquals(createRequest.getProfile(), user.getProfile());
    }
  }

  @Override
  public void compareEntities(User expected, User updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), expected.getName());
    assertEquals(expected.getDisplayName(), expected.getDisplayName());
    assertEquals(expected.getTimezone(), expected.getTimezone());
    assertEquals(expected.getIsBot(), expected.getIsBot());
    assertEquals(expected.getIsAdmin(), expected.getIsAdmin());

    TestUtils.assertEntityReferences(expected.getRoles(), updated.getRoles());
    TestUtils.assertEntityReferences(expected.getTeams(), updated.getTeams());

    if (expected.getProfile() != null) {
      assertEquals(expected.getProfile(), updated.getProfile());
    }
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
      assertEntityReferences(expectedList, actualList);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Override
  public String getAllowedFields() {
    List<String> allowedFields = Entity.getAllowedFields(entityClass);
    allowedFields.removeAll(of(USER_PROTECTED_FIELDS.split(",")));
    return String.join(",", allowedFields);
  }

  public User createUser(String userName, boolean isBot) {
    try {
      CreateUser createUser = createBotUserRequest(userName).withIsBot(isBot);
      return createEntity(createUser, ADMIN_AUTH_HEADERS);
    } catch (Exception ignore) {
      return null;
    }
  }

  private CreateUser createBotUserRequest(String botUserName) {
    return createRequest(botUserName, "", "", null)
        .withIsBot(true)
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.JWT)
                .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited)));
  }
}
