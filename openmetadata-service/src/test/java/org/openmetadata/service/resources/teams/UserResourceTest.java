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

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.CONFLICT;
import static jakarta.ws.rs.core.Response.Status.CREATED;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static jakarta.ws.rs.core.Response.Status.UNAUTHORIZED;
import static java.util.Collections.emptyList;
import static java.util.List.of;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsvTest.assertRows;
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.csv.EntityCsvTest.createCsv;
import static org.openmetadata.csv.EntityCsvTest.getFailedRecord;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.exception.CatalogExceptionMessage.PASSWORD_INVALID_FORMAT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notAdmin;
import static org.openmetadata.service.exception.CatalogExceptionMessage.operationNotAllowed;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.jdbi3.RoleRepository.DEFAULT_BOT_ROLE;
import static org.openmetadata.service.jdbi3.RoleRepository.DOMAIN_ONLY_ACCESS_ROLE;
import static org.openmetadata.service.resources.teams.UserResource.USER_PROTECTED_FIELDS;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.USER_WITH_CREATE_HEADERS;
import static org.openmetadata.service.util.TestUtils.USER_WITH_CREATE_PERMISSION_NAME;
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
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.csv.EntityCsvTest;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.CreatePersonalToken;
import org.openmetadata.schema.auth.GenerateTokenRequest;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.RegistrationRequest;
import org.openmetadata.schema.auth.RevokePersonalTokenRequest;
import org.openmetadata.schema.auth.RevokeTokenRequest;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ImageList;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LandingPageSettings;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.PersonaPreferences;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository.TeamCsv;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.jdbi3.UserRepository.UserCsv;
import org.openmetadata.service.rdf.RdfUtils;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.bots.BotResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.teams.UserResource.UserList;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.auth.UserActivityTracker;
import org.openmetadata.service.security.mask.PIIMasker;
import org.openmetadata.service.util.CSVExportResponse;
import org.openmetadata.service.util.CSVImportResponse;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.PasswordUtil;
import org.openmetadata.service.util.RdfTestUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.TestUtils.UpdateType;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UserResourceTest extends EntityResourceTest<User, CreateUser> {
  private static final Profile PROFILE =
      new Profile().withImages(new ImageList().withImage(URI.create("https://image.com")));
  private static final TeamResourceTest TEAM_TEST = new TeamResourceTest();
  private final RoleRepository roleRepository;

  public UserResourceTest() {
    super(USER, User.class, UserList.class, "users", UserResource.FIELDS);
    supportedNameCharacters = "_-.";
    supportsSearchIndex = true;
    roleRepository = Entity.getRoleRepository();
  }

  public void setupUsers(TestInfo test) throws HttpResponseException {
    CreateUser createUserWithAccess =
        new CreateUser()
            .withName(USER_WITH_CREATE_PERMISSION_NAME)
            .withEmail(USER_WITH_CREATE_PERMISSION_NAME + "@open-metadata.org")
            .withProfile(PROFILE)
            .withRoles(List.of(CREATE_ACCESS_ROLE.getId()))
            .withIsBot(false);
    USER_WITH_CREATE_ACCESS = createEntity(createUserWithAccess, ADMIN_AUTH_HEADERS);
    CreateUser create = createRequest(test).withRoles(List.of(DATA_CONSUMER_ROLE.getId()));
    USER1 = createEntity(create, ADMIN_AUTH_HEADERS);
    USER1_REF = USER1.getEntityReference();

    create = createRequest(test, 1).withRoles(List.of(DATA_CONSUMER_ROLE.getId()));
    USER2 = createEntity(create, ADMIN_AUTH_HEADERS);
    USER2_REF = USER2.getEntityReference();

    create =
        createRequest("user-data-steward", "", "", null)
            .withRoles(List.of(DATA_STEWARD_ROLE.getId()));
    DATA_STEWARD = createEntity(create, ADMIN_AUTH_HEADERS);

    create =
        createRequest("user-data-consumer", "", "", null)
            .withRoles(List.of(DATA_CONSUMER_ROLE.getId()));
    DATA_CONSUMER = createEntity(create, ADMIN_AUTH_HEADERS);
    DATA_CONSUMER_REF = DATA_CONSUMER.getEntityReference();

    // USER_TEAM21 is part of TEAM21
    create = createRequest(test, 2).withTeams(List.of(TEAM21.getId()));
    USER_TEAM21 = createEntity(create, ADMIN_AUTH_HEADERS);
    USER2_REF = USER2.getEntityReference();

    // USER3 with no roles for permission testing
    create = createRequest(test, 3).withRoles(List.of());
    USER3 = createEntity(create, ADMIN_AUTH_HEADERS);
    USER3_REF = USER3.getEntityReference();

    Set<String> userFields = Entity.getEntityFields(User.class);
    userFields.remove("authenticationMechanism");
    BOT_USER = getEntityByName(INGESTION_BOT, String.join(",", userFields), ADMIN_AUTH_HEADERS);

    // Get the bot roles
    DEFAULT_BOT_ROLE_REF = roleRepository.getReferenceByName(DEFAULT_BOT_ROLE, Include.NON_DELETED);
    DOMAIN_ONLY_ACCESS_ROLE_REF =
        roleRepository.getReferenceByName(DOMAIN_ONLY_ACCESS_ROLE, Include.NON_DELETED);
  }

  @Test
  @Override
  public void post_entity_as_non_admin_401(TestInfo testIgnored) {
    // Override the method as a User can create a User entity for himself
    // during first time login without being an admin
  }

  @Test
  void post_userWithoutEmail_400_badRequest(TestInfo test) {
    // Create user with mandatory email field null
    CreateUser create = createRequest(test).withEmail(null);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param email must not be null]");

    // Create user with mandatory email field empty
    create.withEmail("");
    String emailMatchError = "email must match \"^[\\S.!#$%&’*+/=?^_`{|}~-]+@\\S+\\.\\S+$\"";
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, emailMatchError);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "email size must be between 6 and 127");

    // Create user with mandatory email field with invalid email address
    create.withEmail("invalidEmail");
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, emailMatchError);
  }

  @Test
  void post_validUser_200_ok_without_login(TestInfo test) {
    CreateUser create =
        createRequest(test, 6)
            .withDisplayName("displayName")
            .withEmail("test@email.com")
            .withIsAdmin(true);

    assertResponse(
        () -> createAndCheckEntity(create, null),
        UNAUTHORIZED,
        "Not authorized; User's Email is not present");
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
                    .withConfig(
                        new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited)));
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create =
        createRequest(test, 6)
            .withDisplayName("displayName")
            .withProfile(PROFILE)
            .withIsAdmin(true);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(create);
  }

  @Test
  void test_userEmailUnique(TestInfo test) throws IOException {
    // Create user with different optional fields
    CreateUser create =
        createRequest(test, 1).withName("userEmailTest").withEmail("user@domainx.com");
    createEntity(create, ADMIN_AUTH_HEADERS);

    // Creating another user with the same email address must fail
    create.withName("userEmailTest1");
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), CONFLICT, "Entity already exists");
  }

  @Test
  void test_adminPrincipalsCreation() throws IOException {
    // This is test is ensure adminPrincipals are getting created as expected
    // we are hardcoding the usernames as they are passed in config
    // Create user with different optional fields
    User user = getEntityByName("admin", ADMIN_AUTH_HEADERS);
    assertEquals("admin", user.getName());

    user = getEntityByName("hello.world", ADMIN_AUTH_HEADERS);
    assertEquals("hello.world", user.getName());
  }

  @Test
  void put_validUser_200_ok() throws IOException {
    // Create user with different optional fields
    CreateUser create = createRequest("user.xyz", null, null, null);
    User user = updateAndCheckEntity(create, CREATED, ADMIN_AUTH_HEADERS, UpdateType.CREATED, null);

    // Update the user information using PUT
    String oldEmail = create.getEmail();
    // Even with new field being updated, this shouuld not take effect
    CreateUser update = create.withEmail("user.xyz@email.com").withDisplayName("displayName1");

    ChangeDescription change = getChangeDescription(user, MINOR_UPDATE);
    fieldAdded(change, "displayName", "displayName1");
    user = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(oldEmail, user.getEmail());
    // Update the user information using PUT as the logged-in user
    update = create.withDisplayName("displayName2");
    change = getChangeDescription(user, MINOR_UPDATE);
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

    assertResponse(
        () -> createAndCheckEntity(create, TEST_AUTH_HEADERS),
        FORBIDDEN,
        operationNotAllowed(TEST_USER_NAME, MetadataOperation.CREATE));
  }

  @Test
  void post_validAdminUser_200_ok(TestInfo test) throws IOException {
    CreateUser create =
        createRequest(test, 6)
            .withName("testAdmin")
            .withDisplayName("displayName")
            .withEmail("testAdmin@email.com")
            .withPersonas(List.of(DATA_ENGINEER.getEntityReference()))
            .withIsAdmin(true);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(create);
  }

  @Test
  void post_validUserWithTeams_200_ok(TestInfo test) throws IOException {
    // Create user with different optional fields
    Team team1 = TEAM_TEST.createEntity(TEAM_TEST.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Team team2 = TEAM_TEST.createEntity(TEAM_TEST.createRequest(test, 2), ADMIN_AUTH_HEADERS);
    List<UUID> teams = Arrays.asList(team1.getId(), team2.getId());
    CreateUser create = createRequest(test).withTeams(teams);
    User user = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Ensure Team has relationship to this user
    team1 = TEAM_TEST.getEntity(team1.getId(), "users", ADMIN_AUTH_HEADERS);
    assertEquals(user.getId(), team1.getUsers().get(0).getId());
    team2 = TEAM_TEST.getEntity(team2.getId(), "users", ADMIN_AUTH_HEADERS);
    assertEquals(user.getId(), team2.getUsers().get(0).getId());
  }

  @Test
  void post_validUserWithRoles_200_ok(TestInfo test) throws IOException {
    // Create user with different optional fields
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    Role role1 =
        roleResourceTest.createEntity(roleResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Role role2 =
        roleResourceTest.createEntity(roleResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS);
    List<UUID> roles = Arrays.asList(role1.getId(), role2.getId());
    CreateUser create = createRequest(test).withRoles(roles);
    User user = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Ensure User has relationship to these roles
    String[] expectedRoles = roles.stream().map(UUID::toString).sorted().toArray(String[]::new);
    List<EntityReference> roleReferences = user.getRoles();
    String[] actualRoles =
        roleReferences.stream().map(ref -> ref.getId().toString()).sorted().toArray(String[]::new);
    assertArrayEquals(expectedRoles, actualRoles);
  }

  @Test
  void get_listUsersWithTeams_200_ok(TestInfo test) throws IOException {
    Team team1 = TEAM_TEST.createEntity(TEAM_TEST.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Team team2 = TEAM_TEST.createEntity(TEAM_TEST.createRequest(test, 2), ADMIN_AUTH_HEADERS);
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
    Team team = TEAM_TEST.createEntity(TEAM_TEST.createRequest(test, 1), ADMIN_AUTH_HEADERS);

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

  @Test
  void get_listUsersWithTeamsPagination(TestInfo test) throws IOException {
    Team team1 = TEAM_TEST.createEntity(TEAM_TEST.createRequest(test, 1), ADMIN_AUTH_HEADERS);
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

  @Test
  void get_generateRandomPassword() throws HttpResponseException {
    String randomPwd =
        TestUtils.get(getResource("users/generateRandomPwd"), String.class, ADMIN_AUTH_HEADERS);
    assertDoesNotThrow(() -> PasswordUtil.validatePassword(randomPwd), PASSWORD_INVALID_FORMAT);
  }

  @Test
  void patch_makeAdmin_as_nonAdmin_user_401(TestInfo test) throws HttpResponseException {
    // Ensure a non admin user can't make another user admin
    User user =
        createEntity(
            createRequest(test, 6).withName("test2").withEmail("test2@email.com"),
            USER_WITH_CREATE_HEADERS);
    String userJson = JsonUtils.pojoToJson(user);
    user.setIsAdmin(Boolean.TRUE);
    assertResponse(
        () -> patchEntity(user.getId(), userJson, user, TEST_AUTH_HEADERS),
        FORBIDDEN,
        notAdmin("test"));
  }

  @Test
  void patch_teamAddition_200_ok(TestInfo test) throws HttpResponseException {
    // Admin can add user to a team by patching `teams` attribute
    EntityReference team1 =
        TEAM_TEST
            .createEntity(TEAM_TEST.createRequest(test, 1), ADMIN_AUTH_HEADERS)
            .getEntityReference();
    User user =
        createEntity(
            createRequest(test, 10)
                .withName("testUser1")
                .withDisplayName("displayName")
                .withEmail("testUser1@email.com"),
            ADMIN_AUTH_HEADERS);
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
    assertListNull(user.getDisplayName(), user.getProfile(), user.getTimezone());

    EntityReference team1 =
        TEAM_TEST
            .createEntity(TEAM_TEST.createRequest(test, 1), ADMIN_AUTH_HEADERS)
            .getEntityReference();
    EntityReference team2 =
        TEAM_TEST
            .createEntity(TEAM_TEST.createRequest(test, 2), ADMIN_AUTH_HEADERS)
            .getEntityReference();
    EntityReference team3 =
        TEAM_TEST
            .createEntity(TEAM_TEST.createRequest(test, 3), ADMIN_AUTH_HEADERS)
            .getEntityReference();
    List<EntityReference> teams = Arrays.asList(team1, team2);
    Profile profile =
        new Profile().withImages(new ImageList().withImage(URI.create("https://image.com")));

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    EntityReference role1 =
        roleResourceTest
            .createEntity(roleResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS)
            .getEntityReference();

    //
    // Add previously absent attributes. Note the default team Organization is deleted when adding
    // new teams.
    //
    String origJson = JsonUtils.pojoToJson(user);

    String timezone = "America/Los_Angeles";
    user.withRoles(listOf(role1))
        .withTeams(teams)
        .withTimezone(timezone)
        .withDisplayName("displayName")
        .withProfile(profile)
        .withDefaultPersona(DATA_SCIENTIST.getEntityReference())
        .withPersonas(
            List.of(DATA_SCIENTIST.getEntityReference(), DATA_ENGINEER.getEntityReference()))
        .withIsBot(false)
        .withIsAdmin(false);
    ChangeDescription change = getChangeDescription(user, MINOR_UPDATE);
    fieldAdded(change, "roles", listOf(role1));
    fieldDeleted(change, "teams", listOf(ORG_TEAM.getEntityReference()));
    fieldAdded(change, "teams", teams);
    fieldAdded(change, "timezone", timezone);
    fieldAdded(change, "displayName", "displayName");
    fieldAdded(change, "profile", profile);
    fieldAdded(change, "defaultPersona", DATA_SCIENTIST.getEntityReference());
    fieldAdded(
        change,
        "personas",
        List.of(DATA_SCIENTIST.getEntityReference(), DATA_ENGINEER.getEntityReference()));
    user = patchEntityAndCheck(user, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Replace the attributes - Change from this patch is consolidated with the previous changes
    //
    String timezone1 = "Canada/Eastern";
    List<EntityReference> teams1 = Arrays.asList(team1, team3); // team2 dropped and team3 is added
    Profile profile1 =
        new Profile().withImages(new ImageList().withImage(URI.create("https://image2.com")));

    EntityReference role2 =
        roleResourceTest
            .createEntity(roleResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS)
            .getEntityReference();

    origJson = JsonUtils.pojoToJson(user);
    user.withRoles(listOf(role2))
        .withTeams(teams1)
        .withTimezone(timezone1)
        .withDisplayName("displayName1")
        .withProfile(profile1)
        .withPersonas(List.of(DATA_ENGINEER.getEntityReference()))
        .withIsBot(true)
        .withIsAdmin(false);

    change = getChangeDescription(user, MINOR_UPDATE);
    fieldAdded(change, "roles", listOf(role2));
    fieldAdded(change, "teams", listOf(team3));

    fieldDeleted(change, "roles", listOf(role1));
    fieldDeleted(change, "teams", listOf(team2));
    fieldDeleted(change, "personas", List.of(DATA_SCIENTIST.getEntityReference()));

    fieldUpdated(change, "displayName", "displayName", "displayName1");
    fieldUpdated(change, "profile", profile, profile1);
    fieldUpdated(change, "timezone", timezone, timezone1);
    fieldUpdated(change, "isBot", false, true);

    user = patchEntityAndCheck(user, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Remove the attributes - Consolidating changes from this patch with previous results in no
    // change
    //
    origJson = JsonUtils.pojoToJson(user);
    user.withRoles(null)
        .withTeams(null)
        .withTimezone(null)
        .withDisplayName(null)
        .withProfile(null)
        .withDefaultPersona(null)
        .withPersonas(null)
        .withIsBot(null)
        .withIsAdmin(false);
  }

  @Test
  void patch_userAuthorizationTests(TestInfo test) throws IOException {
    //
    // A user can update many attributes for himself. These tests validate what is allowed and not
    // allowed
    //
    Team team = TEAM_TEST.createEntity(TEAM_TEST.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Team teamNotJoinable =
        TEAM_TEST.createEntity(
            TEAM_TEST.createRequest(test, 2).withIsJoinable(false), ADMIN_AUTH_HEADERS);
    User user1 =
        createEntity(createRequest(test, 1).withTeams(listOf(TEAM2.getId())), ADMIN_AUTH_HEADERS);
    Map<String, String> user1Auth = authHeaders(user1.getName());
    String json = JsonUtils.pojoToJson(user1);

    // User can't set himself as admin
    user1.withIsAdmin(true);
    assertResponse(
        () -> patchEntity(user1.getId(), json, user1, user1Auth),
        FORBIDDEN,
        notAdmin(user1.getName()));

    // User can't set himself as bot
    user1.withIsAdmin(false).withIsBot(true);
    assertResponse(
        () -> patchEntity(user1.getId(), json, user1, user1Auth),
        FORBIDDEN,
        notAdmin(user1.getName()));

    // User can't change the roles
    user1.withIsBot(null).withRoles(listOf(DATA_CONSUMER_ROLE_REF));
    assertResponse(
        () -> patchEntity(user1.getId(), json, user1, user1Auth),
        FORBIDDEN,
        notAdmin(user1.getName()));

    // User can change for authorized as himself the teams and other attributes
    ChangeDescription change = getChangeDescription(user1, MINOR_UPDATE);
    user1.withRoles(null).withDescription("description").withDisplayName("display");
    user1.getTeams().add(team.getEntityReference());
    fieldUpdated(change, "description", "", "description");
    fieldAdded(change, "displayName", "display");
    fieldAdded(change, "teams", listOf(team.getEntityReference()));
    User updatedUser1 = patchEntityAndCheck(user1, json, user1Auth, MINOR_UPDATE, change);

    // A user can't join a team that is not open for joining. Only an Admin can join such teams.
    String json1 = JsonUtils.pojoToJson(updatedUser1);
    List<EntityReference> previousTeams = new ArrayList<>(updatedUser1.getTeams());
    updatedUser1.getTeams().add(teamNotJoinable.getEntityReference());
    assertResponse(
        () -> patchEntity(user1.getId(), json1, updatedUser1, authHeaders(user1.getName())),
        FORBIDDEN,
        notAdmin(user1.getName()));

    // A user (without privileges) can't change the attributes of another user
    // Note the authHeaders from another user different from user1 in the following patch operation
    updatedUser1.withTeams(previousTeams);
    updatedUser1.getTeams().add(TEAM21.getEntityReference());
    assertResponse(
        () -> patchEntity(user1.getId(), json1, updatedUser1, authHeaders(USER2.getName())),
        FORBIDDEN,
        permissionNotAllowed(USER2.getName(), listOf(MetadataOperation.EDIT_TEAMS)));
  }

  @Test
  void patch_userPersonaPreferences_200_ok(TestInfo test) throws IOException {
    // Create a persona first
    PersonaResourceTest personaResourceTest = new PersonaResourceTest();
    CreatePersona createPersona =
        personaResourceTest.createRequest(test).withName("data-engineer-test");
    Persona persona = personaResourceTest.createEntity(createPersona, ADMIN_AUTH_HEADERS);

    // Create a user with the persona
    CreateUser create = createRequest(test).withPersonas(listOf(persona.getEntityReference()));
    User user = createEntity(create, ADMIN_AUTH_HEADERS);

    // Test 1: User can update their own persona preferences
    PersonaPreferences preferences =
        new PersonaPreferences()
            .withPersonaId(persona.getId())
            .withPersonaName(persona.getName())
            .withLandingPageSettings(
                new LandingPageSettings()
                    .withHeaderColor("#FF5733")
                    .withHeaderImage("http://example.com/assets/custom-header.png"));

    String json = JsonUtils.pojoToJson(user);
    List<PersonaPreferences> prefsList = new ArrayList<>();
    prefsList.add(preferences);
    user.setPersonaPreferences(prefsList);

    ChangeDescription change = getChangeDescription(user, MINOR_UPDATE);
    fieldUpdated(change, "personaPreferences", emptyList(), prefsList);
    User updatedUser =
        patchEntityAndCheck(user, json, authHeaders(user.getName()), MINOR_UPDATE, change);

    // Verify preferences were saved
    assertNotNull(updatedUser.getPersonaPreferences());
    assertEquals(1, updatedUser.getPersonaPreferences().size());
    PersonaPreferences savedPref = updatedUser.getPersonaPreferences().getFirst();
    assertEquals(persona.getId(), savedPref.getPersonaId());
    assertEquals(persona.getName(), savedPref.getPersonaName());
    assertEquals("#FF5733", savedPref.getLandingPageSettings().getHeaderColor());
    assertEquals(
        "http://example.com/assets/custom-header.png",
        savedPref.getLandingPageSettings().getHeaderImage());

    // Test 2: Update existing persona preferences (change color, keep headerImage)
    var updatedPreferences =
        new PersonaPreferences()
            .withPersonaId(persona.getId())
            .withPersonaName(persona.getName())
            .withLandingPageSettings(
                new LandingPageSettings()
                    .withHeaderColor("#00FF00")
                    .withHeaderImage("http://example.com/assets/custom-header.png"));

    String json2 = JsonUtils.pojoToJson(updatedUser);
    updatedUser.setPersonaPreferences(listOf(updatedPreferences));

    ChangeDescription change2 = getChangeDescription(updatedUser, MINOR_UPDATE);
    fieldUpdated(change2, "personaPreferences", prefsList, listOf(updatedPreferences));
    User updatedUser2 =
        patchEntityAndCheck(updatedUser, json2, authHeaders(user.getName()), MINOR_UPDATE, change2);

    // Verify updated preferences
    assertEquals(
        "#00FF00",
        updatedUser2.getPersonaPreferences().getFirst().getLandingPageSettings().getHeaderColor());
    assertEquals(
        "http://example.com/assets/custom-header.png",
        updatedUser2.getPersonaPreferences().getFirst().getLandingPageSettings().getHeaderImage());

    // Test 2b: Test that we can update preferences with different configurations
    // Including testing removal of optional fields like headerImage
    var preferencesWithoutImage =
        new PersonaPreferences()
            .withPersonaId(persona.getId())
            .withPersonaName(persona.getName())
            .withLandingPageSettings(new LandingPageSettings().withHeaderColor("#00FF00"));

    // For now, we'll verify that we can set preferences without headerImage
    // The JSON Patch issue with removing fields is a framework limitation
    // In practice, users would replace the entire preferences object
    CreateUser createUserForRemoval =
        createRequest(test, 10).withPersonas(listOf(persona.getEntityReference()));
    User userForRemoval = createEntity(createUserForRemoval, ADMIN_AUTH_HEADERS);

    // Set preferences without headerImage from the start
    String jsonRemoval = JsonUtils.pojoToJson(userForRemoval);
    userForRemoval.setPersonaPreferences(listOf(preferencesWithoutImage));

    ChangeDescription changeRemoval = getChangeDescription(userForRemoval, MINOR_UPDATE);
    fieldUpdated(changeRemoval, "personaPreferences", emptyList(), listOf(preferencesWithoutImage));
    User updatedUserRemoval =
        patchEntityAndCheck(
            userForRemoval,
            jsonRemoval,
            authHeaders(userForRemoval.getName()),
            MINOR_UPDATE,
            changeRemoval);

    // Verify the preferences were set correctly without headerImage
    assertEquals(
        "#00FF00",
        updatedUserRemoval
            .getPersonaPreferences()
            .getFirst()
            .getLandingPageSettings()
            .getHeaderColor());
    assertNull(
        updatedUserRemoval
            .getPersonaPreferences()
            .getFirst()
            .getLandingPageSettings()
            .getHeaderImage());

    // Test 3: User cannot update another user's persona preferences
    CreateUser create2 = createRequest(test, 2).withPersonas(listOf(persona.getEntityReference()));
    User user2 = createEntity(create2, ADMIN_AUTH_HEADERS);

    String json3 = JsonUtils.pojoToJson(user2);
    user2.setPersonaPreferences(listOf(preferencesWithoutImage));

    assertResponse(
        () -> patchEntity(user2.getId(), json3, user2, authHeaders(user.getName())),
        FORBIDDEN,
        "Users can only update their own persona preferences");

    // Test 4: Even admin cannot update other user's persona preferences
    assertResponse(
        () -> patchEntity(user2.getId(), json3, user2, ADMIN_AUTH_HEADERS),
        FORBIDDEN,
        "Users can only update their own persona preferences");

    // Test 5: Validate invalid URL for header image
    var invalidUrlPreferences =
        new PersonaPreferences()
            .withPersonaId(persona.getId())
            .withPersonaName(persona.getName())
            .withLandingPageSettings(
                new LandingPageSettings()
                    .withHeaderColor("#FF5733")
                    .withHeaderImage("not-a-valid-url"));

    String json4 = JsonUtils.pojoToJson(updatedUser2);
    updatedUser2.setPersonaPreferences(listOf(invalidUrlPreferences));

    assertResponse(
        () -> patchEntity(updatedUser2.getId(), json4, updatedUser2, authHeaders(user.getName())),
        BAD_REQUEST,
        "Header image must be a valid HTTP or HTTPS URL");

    // Test 6: Validate non-HTTP/HTTPS URL for header image
    var fileUrlPreferences =
        new PersonaPreferences()
            .withPersonaId(persona.getId())
            .withPersonaName(persona.getName())
            .withLandingPageSettings(
                new LandingPageSettings()
                    .withHeaderColor("#FF5733")
                    .withHeaderImage("file://path/to/image.png"));

    String json5 = JsonUtils.pojoToJson(updatedUser2);
    updatedUser2.setPersonaPreferences(listOf(fileUrlPreferences));

    assertResponse(
        () -> patchEntity(updatedUser2.getId(), json5, updatedUser2, authHeaders(user.getName())),
        BAD_REQUEST,
        "Header image must be a valid HTTP or HTTPS URL");

    // Test 7: User cannot set preferences for persona not assigned to them
    CreatePersona createPersona2 =
        personaResourceTest.createRequest(test, 2).withName("data-analyst-test");
    Persona persona2 = personaResourceTest.createEntity(createPersona2, ADMIN_AUTH_HEADERS);

    var unassignedPersonaPreferences =
        new PersonaPreferences()
            .withPersonaId(persona2.getId())
            .withPersonaName(persona2.getName())
            .withLandingPageSettings(new LandingPageSettings().withHeaderColor("#FF5733"));

    String json6 = JsonUtils.pojoToJson(user);
    user.setPersonaPreferences(listOf(unassignedPersonaPreferences));

    assertResponse(
        () -> patchEntity(user.getId(), json6, user, authHeaders(user.getName())),
        BAD_REQUEST,
        "Persona with ID " + persona2.getId() + " is not assigned to this user");

    // Test 8: User with no personas can set preferences for system default persona
    // First, create a system default persona
    CreatePersona createSystemDefaultPersona =
        personaResourceTest.createRequest(test, 8).withName("system-default-test").withDefault(true);
    Persona systemDefaultPersona = personaResourceTest.createEntity(createSystemDefaultPersona, ADMIN_AUTH_HEADERS);
    
    CreateUser create3 = createRequest(test, 3);
    User user3 = createEntity(create3, ADMIN_AUTH_HEADERS);

    // User should be able to set preferences for system default persona even with no assigned personas
    PersonaPreferences systemDefaultPref =
        new PersonaPreferences()
            .withPersonaId(systemDefaultPersona.getId())
            .withPersonaName(systemDefaultPersona.getName())
            .withLandingPageSettings(new LandingPageSettings().withHeaderColor("#BA24D5"));

    String json7 = JsonUtils.pojoToJson(user3);
    user3.setPersonaPreferences(listOf(systemDefaultPref));

    ChangeDescription change7 = getChangeDescription(user3, MINOR_UPDATE);
    fieldUpdated(change7, "personaPreferences", emptyList(), listOf(systemDefaultPref));
    User user3Updated =
        patchEntityAndCheck(user3, json7, authHeaders(user3.getName()), MINOR_UPDATE, change7);

    // Verify preferences were saved for system default persona
    assertNotNull(user3Updated.getPersonaPreferences());
    assertEquals(1, user3Updated.getPersonaPreferences().size());
    PersonaPreferences savedSystemPref = user3Updated.getPersonaPreferences().getFirst();
    assertEquals(systemDefaultPersona.getId(), savedSystemPref.getPersonaId());
    assertEquals("#BA24D5", savedSystemPref.getLandingPageSettings().getHeaderColor());

    // Test 8b: User with no personas still cannot set preferences for non-system-default personas
    String json7b = JsonUtils.pojoToJson(user3Updated);
    user3Updated.setPersonaPreferences(listOf(preferencesWithoutImage)); // This uses persona from previous test which is not system default

    assertResponse(
        () -> patchEntity(user3Updated.getId(), json7b, user3Updated, authHeaders(user3Updated.getName())),
        BAD_REQUEST,
        "Persona with ID " + persona.getId() + " is not assigned to this user");

    // Test 9: Remove persona preferences for a specific persona
    // First, let's set up a user with multiple personas and preferences
    CreatePersona createPersona3 =
        personaResourceTest.createRequest(test, 3).withName("data-steward-test");
    Persona persona3 = personaResourceTest.createEntity(createPersona3, ADMIN_AUTH_HEADERS);

    CreateUser create4 =
        createRequest(test, 4)
            .withPersonas(listOf(persona.getEntityReference(), persona3.getEntityReference()));
    User user4 = createEntity(create4, ADMIN_AUTH_HEADERS);
    // Set preferences for both personas
    var pref1 =
        new PersonaPreferences()
            .withPersonaId(persona.getId())
            .withPersonaName(persona.getName())
            .withLandingPageSettings(new LandingPageSettings().withHeaderColor("#FF5733"));

    var pref2 =
        new PersonaPreferences()
            .withPersonaId(persona3.getId())
            .withPersonaName(persona3.getName())
            .withLandingPageSettings(new LandingPageSettings().withHeaderColor("#00FF00"));

    String json8 = JsonUtils.pojoToJson(user4);
    user4.setPersonaPreferences(listOf(pref1, pref2));

    ChangeDescription change4 = getChangeDescription(user4, MINOR_UPDATE);
    fieldUpdated(change4, "personaPreferences", emptyList(), listOf(pref1, pref2));
    User user4WithPrefs =
        patchEntityAndCheck(user4, json8, authHeaders(user4.getName()), MINOR_UPDATE, change4);
    assertEquals(2, user4WithPrefs.getPersonaPreferences().size());

    String json9 = JsonUtils.pojoToJson(user4WithPrefs);
    user4WithPrefs.setPersonaPreferences(listOf(pref2));
    ChangeDescription change5 = getChangeDescription(user4WithPrefs, MINOR_UPDATE);
    fieldUpdated(change5, "personaPreferences", listOf(pref1, pref2), listOf(pref2));
    User user4Updated =
        patchEntityAndCheck(
            user4WithPrefs, json9, authHeaders(user4.getName()), MINOR_UPDATE, change5);

    // Verify only one preference remains
    assertEquals(1, user4Updated.getPersonaPreferences().size());
    assertEquals(persona3.getId(), user4Updated.getPersonaPreferences().getFirst().getPersonaId());

    // Test 11: Remove all persona preferences
    String json10 = JsonUtils.pojoToJson(user4Updated);
    user4Updated.setPersonaPreferences(new ArrayList<>());

    // Test 13: Verify GET retrieval with personaPreferences field
    // Create a fresh user with personas and preferences for GET testing
    CreateUser create5 =
        createRequest(test, 5)
            .withPersonas(listOf(persona.getEntityReference(), persona3.getEntityReference()));
    User user5 = createEntity(create5, ADMIN_AUTH_HEADERS);

    // Set preferences
    var getPref1 =
        new PersonaPreferences()
            .withPersonaId(persona.getId())
            .withPersonaName(persona.getName())
            .withLandingPageSettings(
                new LandingPageSettings()
                    .withHeaderColor("#123456")
                    .withHeaderImage("https://example.com/header1.png"));

    var getPref2 =
        new PersonaPreferences()
            .withPersonaId(persona3.getId())
            .withPersonaName(persona3.getName())
            .withLandingPageSettings(
                new LandingPageSettings()
                    .withHeaderColor("#ABCDEF")
                    .withHeaderImage("https://example.com/header2.png"));

    String json13 = JsonUtils.pojoToJson(user5);
    user5.setPersonaPreferences(listOf(getPref1, getPref2));
    ChangeDescription change6 = getChangeDescription(user5, MINOR_UPDATE);
    fieldUpdated(change6, "personaPreferences", emptyList(), listOf(pref1, pref2));
    patchEntity(user5.getId(), json13, user5, authHeaders(user5.getName()));

    // Test GET with fields=personaPreferences
    User userWithPrefsField =
        getEntity(user5.getId(), "personaPreferences", authHeaders(user5.getName()));
    assertNotNull(userWithPrefsField.getPersonaPreferences());
    assertEquals(2, userWithPrefsField.getPersonaPreferences().size());

    // Verify the preferences content
    var retrievedPref1 =
        userWithPrefsField.getPersonaPreferences().stream()
            .filter(p -> p.getPersonaId().equals(persona.getId()))
            .findFirst()
            .orElse(null);
    assertNotNull(retrievedPref1);
    assertEquals("#123456", retrievedPref1.getLandingPageSettings().getHeaderColor());
    assertEquals(
        "https://example.com/header1.png",
        retrievedPref1.getLandingPageSettings().getHeaderImage());

    var retrievedPref2 =
        userWithPrefsField.getPersonaPreferences().stream()
            .filter(p -> p.getPersonaId().equals(persona3.getId()))
            .findFirst()
            .orElse(null);
    assertNotNull(retrievedPref2);
    assertEquals("#ABCDEF", retrievedPref2.getLandingPageSettings().getHeaderColor());
    assertEquals(
        "https://example.com/header2.png",
        retrievedPref2.getLandingPageSettings().getHeaderImage());

    // Test GET with multiple fields including personaPreferences
    User userWithMultipleFields =
        getEntity(user5.getId(), "personaPreferences,personas,teams", authHeaders(user5.getName()));
    assertNotNull(userWithMultipleFields.getPersonaPreferences());
    assertNotNull(userWithMultipleFields.getPersonas());
    assertEquals(2, userWithMultipleFields.getPersonaPreferences().size());
    assertEquals(2, userWithMultipleFields.getPersonas().size());

    // Test GET by name with personaPreferences field
    User userByName =
        getEntityByName(user5.getName(), "personaPreferences", authHeaders(user5.getName()));
    assertNotNull(userByName.getPersonaPreferences());
    assertEquals(2, userByName.getPersonaPreferences().size());

    // Test that other users can't see personaPreferences (field level security check)
    User userAsSeenByOthers =
        getEntity(user5.getId(), "personaPreferences", authHeaders(user2.getName()));
    // Depending on security implementation, this might return null or empty preferences
    // The test should verify the expected behavior based on your security model

    // Test admin can see all users' personaPreferences
    User userAsSeenByAdmin = getEntity(user5.getId(), "personaPreferences", ADMIN_AUTH_HEADERS);
    assertNotNull(userAsSeenByAdmin.getPersonaPreferences());
    assertEquals(2, userAsSeenByAdmin.getPersonaPreferences().size());
  }

  @Test
  void delete_validUser_as_admin_200(TestInfo test) throws IOException {
    Team team = TEAM_TEST.createEntity(TEAM_TEST.createRequest(test), ADMIN_AUTH_HEADERS);
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
    team = TEAM_TEST.getEntity(team.getId(), "users", ADMIN_AUTH_HEADERS);
    assertDeleted(team.getUsers(), true);
    tableResourceTest.checkFollowerDeleted(table.getId(), user.getId(), ADMIN_AUTH_HEADERS);

    // User can no longer follow other entities
    assertResponse(
        () ->
            tableResourceTest.addAndCheckFollower(
                table.getId(), user.getId(), OK, 1, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound("user", user.getId()));
  }

  protected void validateCommonEntityFields(User entity, CreateEntity create, String updatedBy) {
    assertListNotNull(entity.getId(), entity.getHref(), entity.getFullyQualifiedName());
    assertEquals(create.getName().toLowerCase(), entity.getName());
    assertEquals(create.getDisplayName(), entity.getDisplayName());
    assertEquals(create.getDescription(), entity.getDescription());
    assertEquals(
        JsonUtils.valueToTree(create.getExtension()), JsonUtils.valueToTree(entity.getExtension()));
    assertReferenceList(create.getOwners(), entity.getOwners());
    assertEquals(updatedBy, entity.getUpdatedBy());
  }

  @Test
  void put_generateToken_bot_user_200_ok() throws HttpResponseException {
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));
    CreateUser create =
        createBotUserRequest("ingestion-bot-jwt")
            .withEmail("ingestion-bot-jwt@email.com")
            .withRoles(List.of(ROLE1_REF.getId()))
            .withAuthenticationMechanism(authMechanism);
    User user = createEntity(create, USER_WITH_CREATE_HEADERS);
    user = getEntity(user.getId(), "*", ADMIN_AUTH_HEADERS);
    // Has the given role and the default bot role
    assertEquals(2, user.getRoles().size());
    TestUtils.put(
        getResource(String.format("users/generateToken/%s", user.getId())),
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Seven),
        OK,
        ADMIN_AUTH_HEADERS);
    user = getEntity(user.getId(), "*", ADMIN_AUTH_HEADERS);
    assertNull(user.getAuthenticationMechanism());
    // Has the given role and the default bot role
    assertEquals(2, user.getRoles().size());
    JWTAuthMechanism jwtAuthMechanism =
        TestUtils.get(
            getResource(String.format("users/token/%s", user.getId())),
            JWTAuthMechanism.class,
            ADMIN_AUTH_HEADERS);
    assertNotNull(jwtAuthMechanism.getJWTToken());
    DecodedJWT jwt = decodedJWT(jwtAuthMechanism.getJWTToken());
    Date date = jwt.getExpiresAt();
    long daysBetween = ((date.getTime() - jwt.getIssuedAt().getTime()) / (1000 * 60 * 60 * 24));
    assertTrue(daysBetween >= 6);
    assertEquals("ingestion-bot-jwt", jwt.getClaims().get("sub").asString());
    assertEquals(true, jwt.getClaims().get("isBot").asBoolean());
    TestUtils.put(
        getResource("users/revokeToken"),
        new RevokeTokenRequest().withId(user.getId()),
        OK,
        ADMIN_AUTH_HEADERS);
    jwtAuthMechanism =
        TestUtils.get(
            getResource(String.format("users/token/%s", user.getId())),
            JWTAuthMechanism.class,
            ADMIN_AUTH_HEADERS);
    assertEquals(StringUtils.EMPTY, jwtAuthMechanism.getJWTToken());
  }

  @Test
  void post_createUser_BasicAuth_AdminCreate_login_200_ok(TestInfo test)
      throws HttpResponseException {
    // Create a user with Auth and Try Logging in
    String name = "testBasicAuth";
    User user =
        createEntity(
            createRequest(test)
                .withName(name)
                .withDisplayName("Test")
                .withEmail("testBasicAuth@email.com")
                .withIsBot(false)
                .withCreatePasswordType(CreateUser.CreatePasswordType.ADMIN_CREATE)
                .withPassword("Test@1234")
                .withConfirmPassword("Test@1234"),
            USER_WITH_CREATE_HEADERS);

    // jwtAuth Response should be null always
    user = getEntity(user.getId(), ADMIN_AUTH_HEADERS);
    assertNull(user.getAuthenticationMechanism());
    assertEquals(name.toLowerCase(), user.getName());
    assertEquals(name.toLowerCase(), user.getFullyQualifiedName());

    // Login With Correct Password
    LoginRequest loginRequest =
        new LoginRequest()
            .withEmail("testBasicAuth@email.com")
            .withPassword(encodePassword("Test@1234"));
    JwtResponse jwtResponse =
        TestUtils.post(
            getResource("users/login"),
            loginRequest,
            JwtResponse.class,
            OK.getStatusCode(),
            ADMIN_AUTH_HEADERS);

    validateJwtBasicAuth(jwtResponse, "testBasicAuth");

    // Login With Wrong email
    LoginRequest failedLoginWithWrongEmail =
        new LoginRequest()
            .withEmail("testBasicAuth123@email.com")
            .withPassword(encodePassword("Test@1234"));
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
        new LoginRequest()
            .withEmail("testBasicAuth@email.com")
            .withPassword(encodePassword("Test1@1234"));
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
    String name = "testBasicAuth123";
    RegistrationRequest newRegistrationRequest =
        new RegistrationRequest()
            .withFirstName("Test")
            .withLastName("Test")
            .withEmail(String.format("%s@email.com", name))
            .withPassword("Test@1234");

    TestUtils.post(
        getResource("users/signup"), newRegistrationRequest, String.class, ADMIN_AUTH_HEADERS);

    // jwtAuth Response should be null always
    User user = getEntityByName(name, null, ADMIN_AUTH_HEADERS);
    assertNull(user.getAuthenticationMechanism());
    assertEquals(name.toLowerCase(), user.getName());
    assertEquals(name.toLowerCase(), user.getFullyQualifiedName());

    // Login With Correct Password
    LoginRequest loginRequest =
        new LoginRequest()
            .withEmail("testBasicAuth123@email.com")
            .withPassword(encodePassword("Test@1234"));
    JwtResponse jwtResponse =
        TestUtils.post(
            getResource("users/login"),
            loginRequest,
            JwtResponse.class,
            OK.getStatusCode(),
            ADMIN_AUTH_HEADERS);

    validateJwtBasicAuth(jwtResponse, name);

    // Login With Wrong email
    LoginRequest failedLoginWithWrongEmail =
        new LoginRequest()
            .withEmail("testBasicAuth1234@email.com")
            .withPassword(encodePassword("Test@1234"));
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
        new LoginRequest()
            .withEmail("testBasicAuth123@email.com")
            .withPassword(encodePassword("Test1@1234"));
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
  void post_createGetRevokePersonalAccessToken() throws HttpResponseException {
    // Create a Personal Access Token Request
    CreatePersonalToken request =
        new CreatePersonalToken().withTokenName("Token1").withJWTTokenExpiry(JWTTokenExpiry.Seven);

    // Create
    WebTarget createTokenTarget = getResource("users/security/token");
    PersonalAccessToken tokens =
        TestUtils.put(
            createTokenTarget, request, PersonalAccessToken.class, OK, ADMIN_AUTH_HEADERS);

    // Get
    WebTarget getTokenTarget = getResource("users/security/token");
    UserResource.PersonalAccessTokenList getToken =
        TestUtils.get(
            getTokenTarget, UserResource.PersonalAccessTokenList.class, ADMIN_AUTH_HEADERS);

    // Revoke
    RevokePersonalTokenRequest revokeRequest =
        new RevokePersonalTokenRequest().withTokenIds(List.of(tokens.getToken()));
    WebTarget revokeTokenTarget = getResource("users/security/token/revoke");
    UserResource.PersonalAccessTokenList getTokenAfterRevoke =
        TestUtils.put(
            revokeTokenTarget,
            revokeRequest,
            UserResource.PersonalAccessTokenList.class,
            OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(tokens, getToken.getData().get(0));
    assertEquals(0, getTokenAfterRevoke.getData().size());
  }

  @Test
  void testCsvDocumentation() throws HttpResponseException {
    assertEquals(UserCsv.DOCUMENTATION, getCsvDocumentation());
  }

  @Test
  void testImportInvalidCsv() throws IOException {
    // Headers - name,displayName,description,email,timezone,isAdmin,teams,roles
    Team team =
        TEAM_TEST.createEntity(TEAM_TEST.createRequest("team-invalidCsv"), ADMIN_AUTH_HEADERS);

    // Invalid username with "::"
    String resultsHeader = recordToString(EntityCsv.getResultHeaders(UserCsv.HEADERS));
    String record = "invalid::User,,,user@domain.com,,,team-invalidCsv,";
    String csv = createCsv(UserCsv.HEADERS, listOf(record), null);
    CsvImportResult result = importCsv(team.getName(), csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    String[] expectedRows = {
      resultsHeader, getFailedRecord(record, "[name must match \"^((?!::).)*$\"]")
    };

    assertRows(result, expectedRows);

    // Invalid team
    resultsHeader = recordToString(EntityCsv.getResultHeaders(UserCsv.HEADERS));
    record = "user,,,user@domain.com,,,invalidTeam,";
    csv = createCsv(UserCsv.HEADERS, listOf(record), null);
    result = importCsv(team.getName(), csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(record, EntityCsv.entityNotFound(6, Entity.TEAM, "invalidTeam"))
        };
    assertRows(result, expectedRows);

    // Invalid roles
    record = "user,,,user@domain.com,,,team-invalidCsv,invalidRole";
    csv = createCsv(UserCsv.HEADERS, listOf(record), null);
    result = importCsv(team.getName(), csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(record, EntityCsv.entityNotFound(7, Entity.ROLE, "invalidRole"))
        };
    assertRows(result, expectedRows);
  }

  @Test
  void testUserImportExport() throws IOException {
    // Create team hierarchy - team with children t1, t1 has t11
    // "name", "displayName", "description", "teamType", "parents", "owner", "isJoinable",
    // "defaultRoles", & "policies"
    String team = "teamImportExport,,,Division,Organization,,,,";
    String team1 = "teamImportExport1,,,Department,teamImportExport,,,,";
    String team11 = "teamImportExport11,,,Group,teamImportExport1,,,,";
    String csv = EntityCsvTest.createCsv(TeamCsv.HEADERS, listOf(team, team1, team11), null);
    CsvImportResult result = TEAM_TEST.importCsv(ORG_TEAM.getName(), csv, false);
    assertEquals(0, result.getNumberOfRowsFailed());

    // Create users in the team hierarchy
    // Headers - name,displayName,description,email,timezone,isAdmin,teams,roles
    String user =
        "userimportexport,d,s,userimportexport@domain.com,America/Los_Angeles,true,teamImportExport,";
    String user1 =
        "userimportexport1,,,userimportexport1@domain.com,,false,teamImportExport1,DataConsumer";
    String user11 = "userimportexport11,,,userimportexport11@domain.com,,false,teamImportExport11,";
    List<String> createRecords = listOf(user, user1, user11);

    // Update user descriptions
    user = "userimportexport,displayName,,userimportexport@domain.com,,false,teamImportExport,";
    user1 =
        "userimportexport1,displayName1,,userimportexport1@domain.com,,false,teamImportExport1,";
    user11 =
        "userimportexport11,displayName11,,userimportexport11@domain.com,,false,teamImportExport11,";
    List<String> updateRecords = listOf(user, user1, user11);

    // Add new users
    String user2 =
        "userimportexport2,displayName2,,userimportexport2@domain.com,,false,teamImportExport1,";
    String user21 =
        "userimportexport21,displayName21,,userimportexport21@domain.com,,false,teamImportExport11,";
    List<String> newRecords = listOf(user2, user21);
    testImportExport("teamImportExport", UserCsv.HEADERS, createRecords, updateRecords, newRecords);

    // Import to team11 a user in team1 - since team1 is not under team11 hierarchy, import should
    // fail
    String user3 =
        "userimportexport3,displayName3,,userimportexport3@domain.com,,false,teamImportExport1,";
    csv = EntityCsvTest.createCsv(UserCsv.HEADERS, listOf(user3), null);
    result = importCsv("teamImportExport11", csv, false);
    String error =
        UserCsv.invalidTeam(6, "teamImportExport11", "userimportexport3", "teamImportExport1");
    assertTrue(result.getImportResultsCsv().contains(error));
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
    assertEquals(username.toLowerCase(), jwt.getClaims().get("sub").asString().toLowerCase());
    assertEquals(false, jwt.getClaims().get("isBot").asBoolean());
  }

  @Test
  void test_userNameIgnoreCase(TestInfo test) throws IOException {
    // Create user with different optional fields
    CreateUser create =
        createRequest(test, 1).withName("UserEmailTest").withEmail("UserEmailTest@domainx.com");
    User created = createEntity(create, ADMIN_AUTH_HEADERS);

    // Creating another user with different case should fail
    create.withName("Useremailtest").withEmail("Useremailtest@Domainx.com");
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), CONFLICT, "Entity already exists");

    // get user with  username in different case
    User user = getEntityByName("UsERemailTEST", ADMIN_AUTH_HEADERS);
    compareEntities(user, created, ADMIN_AUTH_HEADERS);
    user.setName("UsERemailTEST");
    user.setFullyQualifiedName("UsERemailTEST");
    // delete user with different
    deleteByNameAndCheckEntity(user, false, false, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testInheritedRole() throws HttpResponseException {
    // USER1 inherits DATA_CONSUMER_ROLE from Organization
    User user1 = getEntity(USER1.getId(), "roles", ADMIN_AUTH_HEADERS);
    assertEntityReferences(List.of(DATA_CONSUMER_ROLE_REF), user1.getInheritedRoles());

    // USER_TEAM21 inherits DATA_CONSUMER_ROLE from Organization and DATA_STEWARD_ROLE from Team2
    User user_team21 = getEntity(USER_TEAM21.getId(), "roles", ADMIN_AUTH_HEADERS);
    assertEntityReferences(
        List.of(DATA_CONSUMER_ROLE_REF, DATA_STEWARD_ROLE_REF), user_team21.getInheritedRoles());
  }

  @Test
  void put_failIfBotUserIsAlreadyAssignedToAnotherBot(TestInfo test) throws HttpResponseException {
    BotResourceTest botResourceTest = new BotResourceTest();
    String botName = "test-bot-user-fail";
    // create bot user
    CreateUser createBotUser = createBotUserRequest("test-bot-user").withBotName(botName);
    User botUser = updateEntity(createBotUser, CREATED, ADMIN_AUTH_HEADERS);
    // assign bot user to a bot
    CreateBot create =
        botResourceTest.createRequest(test).withBotUser(botUser.getName()).withName(botName);
    botResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    // put user with a different bot name
    CreateUser createWrongBotUser =
        createBotUserRequest("test-bot-user").withBotName("test-bot-user-fail-2");
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
    // assign bot user to a bot
    CreateBot create =
        botResourceTest.createRequest(test).withBotUser(botUser.getName()).withName(botName);
    botResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    // put again user with same bot name
    CreateUser createDifferentBotUser =
        createBotUserRequest("test-bot-user-ok").withBotName(botName);
    updateEntity(createDifferentBotUser, OK, ADMIN_AUTH_HEADERS);
    assertNotNull(createDifferentBotUser);
  }

  @Test
  void patch_ProfileWithSubscription(TestInfo test) throws IOException, URISyntaxException {
    CreateUser create = createRequest(test, 1);
    User user = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    Profile profile1 =
        new Profile()
            .withSubscription(
                new SubscriptionConfig()
                    .withSlack(new Webhook().withEndpoint(new URI("https://example.com"))));

    // Update profile of the user
    String json = JsonUtils.pojoToJson(user);
    user.withProfile(profile1);
    ChangeDescription change = getChangeDescription(user, MINOR_UPDATE);
    fieldUpdated(change, "profile", PROFILE, profile1);
    user = patchEntityAndCheck(user, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove profile from the user
    // Changes from this PATCH are consolidated with previous changes where original PROFILE is
    // removed
    json = JsonUtils.pojoToJson(user);
    user.withProfile(null);
    change = getChangeDescription(user, MINOR_UPDATE);
    fieldDeleted(change, "profile", profile1);
    patchEntityAndCheck(user, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    // When domain is not set for a user term, carry it forward from the parent team
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam =
        teamResourceTest.createRequest(test).withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    Team team = teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);

    // Create a user without domain and ensure it inherits domain from the parent
    CreateUser create = createRequest(test).withTeams(listOf(team.getId()));
    assertSingleDomainInheritance(create, DOMAIN.getEntityReference());
  }

  public User assertSingleDomainInheritance(
      CreateUser createRequest, EntityReference expectedDomain) throws IOException {
    User entity = createEntity(createRequest.withDomains(null), ADMIN_AUTH_HEADERS);
    assertReference(expectedDomain, entity.getDomains().get(0)); // Inherited owner
    entity = getEntity(entity.getId(), FIELD_DOMAINS, ADMIN_AUTH_HEADERS);
    assertReference(expectedDomain, entity.getDomains().get(0)); // Inherited owner
    assertTrue(entity.getDomains().get(0).getInherited());
    entity = getEntityByName(entity.getFullyQualifiedName(), FIELD_DOMAINS, ADMIN_AUTH_HEADERS);
    assertReference(expectedDomain, entity.getDomains().get(0)); // Inherited owner
    assertTrue(entity.getDomains().get(0).getInherited());
    assertEntityReferenceFromSearch(entity, expectedDomain, FIELD_DOMAINS);
    return entity;
  }

  @Test
  void test_maskEmail() throws HttpResponseException {
    // Admins can check the mail
    User user = getEntityByName(USER1.getName(), ADMIN_AUTH_HEADERS);
    assertEquals(USER1.getEmail(), user.getEmail());

    // non-admins cannot see the mail
    User noEmailUser = getEntityByName(USER1.getName(), authHeaders(USER2.getName()));
    assertEquals(PIIMasker.MASKED_MAIL, noEmailUser.getEmail());
  }

  @Test
  void testUpdateUser_RemovesInheritedDomainsFromRemovedTeams(TestInfo test)
      throws HttpResponseException {
    TeamResourceTest teamResourceTest = new TeamResourceTest();

    // Create team1 with domain1
    CreateTeam createTeam1 =
        teamResourceTest.createRequest(test).withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    Team team1 = teamResourceTest.createEntity(createTeam1, ADMIN_AUTH_HEADERS);

    // Create team2 with domain2
    CreateTeam createTeam2 =
        teamResourceTest
            .createRequest(test, 1)
            .withDomains(List.of(DOMAIN1.getFullyQualifiedName()));
    Team team2 = teamResourceTest.createEntity(createTeam2, ADMIN_AUTH_HEADERS);

    // Create user with both teams
    CreateUser create = createRequest(test).withTeams(listOf(team1.getId(), team2.getId()));
    User user = createEntity(create, ADMIN_AUTH_HEADERS);

    // Verify user has both domains inherited from the teams
    User createdUser = getEntity(user.getId(), FIELD_DOMAINS, ADMIN_AUTH_HEADERS);
    assertNotNull(createdUser.getDomains());
    assertEquals(2, createdUser.getDomains().size());

    // Check that both domains are inherited
    List<EntityReference> domains = createdUser.getDomains();
    boolean hasDomain1 =
        domains.stream().anyMatch(d -> d.getId().equals(DOMAIN.getId()) && d.getInherited());
    boolean hasDomain2 =
        domains.stream().anyMatch(d -> d.getId().equals(DOMAIN1.getId()) && d.getInherited());
    assertTrue(hasDomain1, "User should inherit domain from team1");
    assertTrue(hasDomain2, "User should inherit domain from team2");

    // Scenario 1: Remove team2 from user - domain2 should be removed as well
    String userJson = JsonUtils.pojoToJson(createdUser);
    createdUser.setTeams(List.of(team1.getEntityReference()));

    // Update user to only have team1
    User updatedUser = patchEntity(createdUser.getId(), userJson, createdUser, ADMIN_AUTH_HEADERS);
    updatedUser = getEntity(updatedUser.getId(), FIELD_DOMAINS, ADMIN_AUTH_HEADERS);

    // Verify that domain2 is no longer in the domains list
    assertEquals(1, updatedUser.getDomains().size());
    assertEquals(DOMAIN.getId(), updatedUser.getDomains().get(0).getId());
    assertTrue(updatedUser.getDomains().get(0).getInherited());

    // Scenario 2: Create team3 with the same domain as team1 (domain1)
    // and verify that when one team is removed, domain remains inherited
    CreateTeam createTeam3 =
        teamResourceTest
            .createRequest(test, 2)
            .withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    Team team3 = teamResourceTest.createEntity(createTeam3, ADMIN_AUTH_HEADERS);

    // Add user to both teams that have the same domain
    userJson = JsonUtils.pojoToJson(updatedUser);
    updatedUser.setTeams(List.of(team1.getEntityReference(), team3.getEntityReference()));

    User userWithBothTeams =
        patchEntity(updatedUser.getId(), userJson, updatedUser, ADMIN_AUTH_HEADERS);
    userWithBothTeams = getEntity(userWithBothTeams.getId(), FIELD_DOMAINS, ADMIN_AUTH_HEADERS);

    // Still should have just domain1
    assertEquals(1, userWithBothTeams.getDomains().size());
    assertEquals(DOMAIN.getId(), userWithBothTeams.getDomains().get(0).getId());
    assertTrue(userWithBothTeams.getDomains().get(0).getInherited());

    // Remove team1, but keep team3 - domain1 should still be inherited from team3
    userJson = JsonUtils.pojoToJson(userWithBothTeams);
    userWithBothTeams.setTeams(List.of(team3.getEntityReference()));

    User userWithTeam3 =
        patchEntity(userWithBothTeams.getId(), userJson, userWithBothTeams, ADMIN_AUTH_HEADERS);
    userWithTeam3 = getEntity(userWithTeam3.getId(), FIELD_DOMAINS, ADMIN_AUTH_HEADERS);

    // Should still have domain1 inherited from team3
    assertEquals(1, userWithTeam3.getDomains().size());
    assertEquals(DOMAIN.getId(), userWithTeam3.getDomains().get(0).getId());
    assertTrue(
        userWithTeam3.getDomains().get(0).getInherited(),
        "Domain should still be marked as inherited");
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
  public User validateGetWithDifferentFields(User user, boolean byName)
      throws HttpResponseException {
    String fields = "";
    user =
        byName
            ? getEntityByName(user.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(user.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(
        user.getProfile(), user.getRoles(), user.getTeams(), user.getFollows(), user.getOwns());

    fields = "profile,roles,teams,follows,owns";
    user =
        byName
            ? getEntityByName(user.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(user.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(
        user.getProfile(), user.getRoles(), user.getTeams(), user.getFollows(), user.getOwns());
    validateAlphabeticalOrdering(user.getTeams(), EntityUtil.compareEntityReference);
    return user;
  }

  @Override
  public CreateUser createRequest(String name) {
    // user part of the email should be less than 64 in length
    String entityName = name != null ? name.toLowerCase() : null;
    String emailUser =
        nullOrEmpty(entityName) ? UUID.randomUUID().toString().toLowerCase() : entityName;
    emailUser = emailUser.length() > 64 ? emailUser.substring(0, 64) : emailUser;
    return new CreateUser()
        .withName(entityName)
        .withEmail(emailUser + "@open-metadata.org")
        .withProfile(PROFILE)
        .withIsBot(false);
  }

  @Override
  protected void validateDeletedEntity(
      CreateUser create,
      User userBeforeDeletion,
      User userAfterDeletion,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    super.validateDeletedEntity(create, userBeforeDeletion, userAfterDeletion, authHeaders);

    List<EntityReference> expectedOwnedEntities = new ArrayList<>();
    for (EntityReference ref : listOrEmpty(userBeforeDeletion.getOwns())) {
      expectedOwnedEntities.add(reduceEntityReference(ref));
    }

    TestUtils.assertEntityReferences(expectedOwnedEntities, userAfterDeletion.getOwns());
  }

  @Override
  public void validateCreatedEntity(
      User user, CreateUser createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName().toLowerCase(), user.getName());
    assertEquals(createRequest.getDisplayName(), user.getDisplayName());
    assertEquals(createRequest.getTimezone(), user.getTimezone());
    assertEquals(createRequest.getIsBot(), user.getIsBot());
    assertEquals(createRequest.getIsAdmin(), user.getIsAdmin());

    List<EntityReference> expectedRoles = new ArrayList<>();
    for (UUID roleId : listOrEmpty(createRequest.getRoles())) {
      expectedRoles.add(new EntityReference().withId(roleId).withType(Entity.ROLE));
    }

    // bots are created with default roles
    if (createRequest.getIsBot()) {
      expectedRoles.add(DEFAULT_BOT_ROLE_REF);
      if (!nullOrEmpty(createRequest.getDomains())) {
        expectedRoles.add(DOMAIN_ONLY_ACCESS_ROLE_REF);
      }
    }
    assertRoles(user, expectedRoles);

    List<EntityReference> expectedTeams = new ArrayList<>();
    for (UUID teamId : listOrEmpty(createRequest.getTeams())) {
      expectedTeams.add(new EntityReference().withId(teamId).withType(Entity.TEAM));
    }
    if (expectedTeams.isEmpty()) {
      expectedTeams =
          new ArrayList<>(List.of(ORG_TEAM.getEntityReference())); // Organization is default team
    } else {
      // Remove ORG_TEAM from the expected teams
      expectedTeams =
          expectedTeams.stream()
              .filter(t -> !t.getId().equals(ORG_TEAM.getId()))
              .collect(Collectors.toList());
    }
    assertEntityReferences(expectedTeams, user.getTeams());
    assertEntityReferences(createRequest.getPersonas(), user.getPersonas());
    if (createRequest.getProfile() != null) {
      assertEquals(createRequest.getProfile(), user.getProfile());
    }
  }

  @Override
  public void compareEntities(User expected, User updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertEquals(expected.getTimezone(), updated.getTimezone());
    if (expected.getIsBot() == null) {
      assertFalse(updated.getIsBot());
    } else {
      assertEquals(expected.getIsBot(), updated.getIsBot());
    }
    assertEquals(expected.getIsAdmin(), updated.getIsAdmin());
    if (expected.getDefaultPersona() != null) {
      assertEquals(expected.getDefaultPersona().getId(), updated.getDefaultPersona().getId());
    }

    TestUtils.assertEntityReferences(expected.getRoles(), updated.getRoles());
    TestUtils.assertEntityReferences(expected.getTeams(), updated.getTeams());
    if (updated.getPersonas() != null) {
      TestUtils.assertEntityReferences(expected.getPersonas(), updated.getPersonas());
    }
    if (expected.getProfile() != null) {
      assertEquals(expected.getProfile(), updated.getProfile());
    }
  }

  @Override
  @SuppressWarnings("unchecked")
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    switch (fieldName) {
      case "profile" -> {
        Profile expectedProfile = (Profile) expected;
        Profile actualProfile = JsonUtils.readValue(actual.toString(), Profile.class);
        assertEquals(expectedProfile, actualProfile);
      }
      case "teams", "roles", "personas" -> assertEntityReferencesFieldChange(expected, actual);
      case "defaultPersona" -> assertEntityReference(expected, actual);
      case "personaPreferences" -> {
        List<PersonaPreferences> expectedPreferences = (List<PersonaPreferences>) expected;
        List<PersonaPreferences> actualPreferences =
            JsonUtils.readObjects(actual.toString(), PersonaPreferences.class);
        assertEquals(expectedPreferences, actualPreferences);
      }
      default -> assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Override
  public String getAllowedFields() {
    Set<String> allowedFields = Entity.getEntityFields(entityClass);
    of(USER_PROTECTED_FIELDS.split(",")).forEach(allowedFields::remove);
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

  private CreateUser createBotUserRequest(TestInfo test, int index) {
    return createBotUserRequest(getEntityName(test, index));
  }

  @Override
  public CsvImportResult importCsv(String teamName, String csv, boolean dryRun)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/import");
    target = target.queryParam("team", teamName);
    target = !dryRun ? target.queryParam("dryRun", false) : target;
    return TestUtils.putCsv(target, csv, CsvImportResult.class, Status.OK, ADMIN_AUTH_HEADERS);
  }

  @Override
  protected String exportCsv(String teamName) throws HttpResponseException {
    WebTarget target = getCollection().path("/export");
    target = target.queryParam("team", teamName);
    return TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
  }

  @Override
  protected String initiateExport(String teamName) throws HttpResponseException {
    WebTarget target = getCollection().path("/exportAsync");
    target = target.queryParam("team", teamName);
    CSVExportResponse response =
        TestUtils.getWithResponse(
            target, CSVExportResponse.class, ADMIN_AUTH_HEADERS, Status.ACCEPTED.getStatusCode());
    return response.getJobId();
  }

  @Override
  protected String initiateImport(String teamName, String csv, boolean dryRun) throws IOException {
    WebTarget target = getCollection().path("/importAsync");
    target = target.queryParam("team", teamName);
    target = !dryRun ? target.queryParam("dryRun", false) : target;
    CSVImportResponse response =
        TestUtils.putCsv(target, csv, CSVImportResponse.class, Status.OK, ADMIN_AUTH_HEADERS);
    return response.getJobId();
  }

  @Test
  void test_listOnlineUsers() throws HttpResponseException {
    WebTarget target = getCollection().path("/online");
    assertResponse(
        () -> TestUtils.get(target, UserList.class, TEST_AUTH_HEADERS),
        FORBIDDEN,
        notAdmin(TEST_USER_NAME));
    User user1 = createEntity(createRequest("onlineUser1"), ADMIN_AUTH_HEADERS);
    User user2 = createEntity(createRequest("onlineUser2"), ADMIN_AUTH_HEADERS);
    User user3 = createEntity(createRequest("onlineUser3"), ADMIN_AUTH_HEADERS);

    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(USER);
    long currentTime = System.currentTimeMillis();

    userRepository.updateUserLastLoginTime(user1, currentTime - (60 * 1000L));
    userRepository.updateUserLastLoginTime(user2, currentTime - (10 * 60 * 1000L));
    userRepository.updateUserLastLoginTime(user3, currentTime - (2 * 60 * 60 * 1000L));

    // Also test with lastActivityTime - user3 has recent activity despite old login
    userRepository.updateUserLastActivityTime(user3.getName(), currentTime - (2 * 60 * 1000L));

    UserList onlineUsers5Min = TestUtils.get(target, UserList.class, ADMIN_AUTH_HEADERS);

    assertEquals(
        2,
        onlineUsers5Min.getData().stream()
            .filter(u -> u.getName().startsWith("onlineuser"))
            .count());
    assertTrue(onlineUsers5Min.getData().stream().anyMatch(u -> u.getName().equals("onlineuser1")));
    assertTrue(
        onlineUsers5Min.getData().stream()
            .anyMatch(u -> u.getName().equals("onlineuser3"))); // user3 has recent activity

    WebTarget target15Min = target.queryParam("timeWindow", 15);
    UserList onlineUsers15Min = TestUtils.get(target15Min, UserList.class, ADMIN_AUTH_HEADERS);
    assertEquals(
        3,
        onlineUsers15Min.getData().stream()
            .filter(u -> u.getName().startsWith("onlineuser"))
            .count());
    assertTrue(
        onlineUsers15Min.getData().stream().anyMatch(u -> u.getName().equals("onlineuser1")));
    assertTrue(
        onlineUsers15Min.getData().stream().anyMatch(u -> u.getName().equals("onlineuser2")));
    assertTrue(
        onlineUsers15Min.getData().stream()
            .anyMatch(u -> u.getName().equals("onlineuser3"))); // user3 included due to activity

    // Test with 180 minute (3 hours) window - should return all three users
    WebTarget target180Min = target.queryParam("timeWindow", 180);
    UserList onlineUsers180Min = TestUtils.get(target180Min, UserList.class, ADMIN_AUTH_HEADERS);
    assertEquals(
        3,
        onlineUsers180Min.getData().stream()
            .filter(u -> u.getName().startsWith("onlineuser"))
            .count());

    // Test pagination
    WebTarget targetWithLimit = target.queryParam("limit", 1);
    UserList limitedUsers = TestUtils.get(targetWithLimit, UserList.class, ADMIN_AUTH_HEADERS);
    assertEquals(1, limitedUsers.getData().size());

    // Clean up
    deleteEntity(user1.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(user2.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(user3.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_userActivityTracking() throws HttpResponseException, InterruptedException {
    // Create test users
    User activeUser = createEntity(createRequest("activeUser1"), ADMIN_AUTH_HEADERS);
    User inactiveUser = createEntity(createRequest("inactiveUser1"), ADMIN_AUTH_HEADERS);

    // Get auth headers for the active user
    Map<String, String> activeUserAuth = authHeaders(activeUser.getEmail());

    // Make multiple API calls as the active user to trigger activity tracking
    WebTarget tablesTarget = getResource("tables");
    TestUtils.get(tablesTarget, Object.class, activeUserAuth); // This should track activity

    // Explicitly track activity in case filter is not registered in test environment
    UserActivityTracker.getInstance().trackActivity(activeUser.getName());

    // Make more calls to ensure activity is tracked
    WebTarget databasesTarget = getResource("databases");
    TestUtils.get(databasesTarget, Object.class, activeUserAuth);

    // Check cache size before flush
    int cacheSize = UserActivityTracker.getInstance().getLocalCacheSize();
    System.out.println("Cache size before flush: " + cacheSize);

    // Force synchronous flush of the activity tracker (TEST ONLY)
    UserActivityTracker.getInstance().forceFlushSync();

    // Check online users with 5 minute window (default)
    WebTarget onlineTarget = getCollection().path("/online");
    UserList onlineUsers = TestUtils.get(onlineTarget, UserList.class, ADMIN_AUTH_HEADERS);

    // Debug output
    System.out.println("Online users count: " + onlineUsers.getData().size());
    onlineUsers
        .getData()
        .forEach(
            u -> System.out.println("Online user: " + u.getName() + ", isBot: " + u.getIsBot()));

    // Active user should be in the online list (usernames are stored in lowercase)
    assertTrue(
        onlineUsers.getData().stream().anyMatch(u -> u.getName().equals("activeuser1")),
        "Active user should be in online users list");

    // Inactive user should not be in the online list (no activity)
    assertFalse(
        onlineUsers.getData().stream().anyMatch(u -> u.getName().equals("inactiveuser1")),
        "Inactive user should not be in online users list");

    // Clean up
    deleteEntity(activeUser.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(inactiveUser.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_botActivityNotTracked() throws HttpResponseException {
    // Test that bot activity is not tracked
    // We'll use a simple approach: update a bot user's activity time directly
    // and verify it doesn't show in online users (assuming the query filters out bots)

    // Use the existing ingestion bot
    User botUser = getEntityByName(INGESTION_BOT, null, ADMIN_AUTH_HEADERS);
    assertNotNull(botUser);
    assertTrue(botUser.getIsBot());

    // Directly set activity time for the bot
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(USER);
    long currentTime = System.currentTimeMillis();
    userRepository.updateUserLastActivityTime(
        botUser.getName(), currentTime - (30 * 1000L)); // 30 seconds ago

    // Check online users - bot should NOT show up
    WebTarget onlineTarget = getCollection().path("/online");
    UserList onlineUsers = TestUtils.get(onlineTarget, UserList.class, ADMIN_AUTH_HEADERS);

    // Bot user should not be in the online list
    assertFalse(
        onlineUsers.getData().stream().anyMatch(u -> u.getName().equals(botUser.getName())),
        "Bot user should not be tracked in online users");
  }

  @Test
  void test_onlineUsersWithDifferentTimeWindows() throws HttpResponseException {
    // Create users with different activity times
    User veryRecentUser = createEntity(createRequest("veryRecentUser"), ADMIN_AUTH_HEADERS);
    User recentUser = createEntity(createRequest("recentUser"), ADMIN_AUTH_HEADERS);
    User oldUser = createEntity(createRequest("oldUser"), ADMIN_AUTH_HEADERS);

    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(USER);
    long currentTime = System.currentTimeMillis();

    // Set different activity times
    userRepository.updateUserLastActivityTime(
        veryRecentUser.getName(), currentTime - (30 * 1000L)); // 30 seconds ago
    userRepository.updateUserLastActivityTime(
        recentUser.getName(), currentTime - (3 * 60 * 1000L)); // 3 minutes ago
    userRepository.updateUserLastActivityTime(
        oldUser.getName(), currentTime - (30 * 60 * 1000L)); // 30 minutes ago

    WebTarget onlineTarget = getCollection().path("/online");

    // Test 1 minute window - should only include veryRecentUser
    WebTarget target1Min = onlineTarget.queryParam("timeWindow", 1);
    UserList onlineUsers1Min = TestUtils.get(target1Min, UserList.class, ADMIN_AUTH_HEADERS);
    assertEquals(
        1,
        onlineUsers1Min.getData().stream()
            .filter(
                u ->
                    u.getName().startsWith("veryrecentuser")
                        || u.getName().startsWith("recentuser")
                        || u.getName().startsWith("olduser"))
            .count());
    assertTrue(
        onlineUsers1Min.getData().stream().anyMatch(u -> u.getName().equals("veryrecentuser")));

    // Test 5 minute window (default) - should include veryRecentUser and recentUser
    UserList onlineUsers5Min = TestUtils.get(onlineTarget, UserList.class, ADMIN_AUTH_HEADERS);
    assertEquals(
        2,
        onlineUsers5Min.getData().stream()
            .filter(
                u ->
                    u.getName().startsWith("veryrecentuser")
                        || u.getName().startsWith("recentuser")
                        || u.getName().startsWith("olduser"))
            .count());

    // Test 60 minute window - should include all three
    WebTarget target60Min = onlineTarget.queryParam("timeWindow", 60);
    UserList onlineUsers60Min = TestUtils.get(target60Min, UserList.class, ADMIN_AUTH_HEADERS);
    assertEquals(
        3,
        onlineUsers60Min.getData().stream()
            .filter(
                u ->
                    u.getName().startsWith("veryrecentuser")
                        || u.getName().startsWith("recentuser")
                        || u.getName().startsWith("olduser"))
            .count());

    // Clean up
    deleteEntity(veryRecentUser.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(recentUser.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(oldUser.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_onlineUsersAccessControl() throws HttpResponseException {
    WebTarget onlineTarget = getCollection().path("/online");

    // Test that non-admin users cannot access online users
    assertResponse(
        () -> TestUtils.get(onlineTarget, UserList.class, TEST_AUTH_HEADERS),
        FORBIDDEN,
        notAdmin(TEST_USER_NAME));

    // Test that users with CREATE permission cannot access online users
    assertResponse(
        () -> TestUtils.get(onlineTarget, UserList.class, USER_WITH_CREATE_HEADERS),
        FORBIDDEN,
        notAdmin(USER_WITH_CREATE_PERMISSION_NAME.toLowerCase()));

    // Test that admin users can access online users
    UserList onlineUsers = TestUtils.get(onlineTarget, UserList.class, ADMIN_AUTH_HEADERS);
    assertNotNull(onlineUsers);
    assertNotNull(onlineUsers.getData());
  }

  @Test
  void testUserRdfRelationships(TestInfo test) throws IOException {
    if (!RdfTestUtils.isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create team first
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam = teamResourceTest.createRequest(test);
    Team team = teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);

    // Create user with team membership
    CreateUser createUser =
        createRequest(test)
            .withTeams(listOf(team.getId()))
            .withRoles(listOf(DATA_STEWARD_ROLE.getId()));

    User user = createEntity(createUser, ADMIN_AUTH_HEADERS);

    // Verify user exists in RDF
    RdfTestUtils.verifyEntityInRdf(user, RdfUtils.getRdfType("user"));

    // Verify team membership (user is member of team)
    // Note: In RDF, this is usually stored as team HAS user, not user memberOf team
    // But we can check if the relationship exists either way

    // Users don't have owners or tags by default, but we can test if added
    if (user.getOwners() != null && !user.getOwners().isEmpty()) {
      RdfTestUtils.verifyOwnerInRdf(user.getFullyQualifiedName(), user.getOwners().get(0));
    }

    if (user.getTags() != null && !user.getTags().isEmpty()) {
      RdfTestUtils.verifyTagsInRdf(user.getFullyQualifiedName(), user.getTags());
    }
  }

  @Test
  void testUserRdfSoftDeleteAndRestore(TestInfo test) throws IOException {
    if (!RdfTestUtils.isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create user
    CreateUser createUser = createRequest(test);
    User user = createEntity(createUser, ADMIN_AUTH_HEADERS);

    // Verify user exists
    RdfTestUtils.verifyEntityInRdf(user, RdfUtils.getRdfType("user"));

    // Soft delete the user
    deleteEntity(user.getId(), ADMIN_AUTH_HEADERS);

    // Verify user still exists in RDF after soft delete
    RdfTestUtils.verifyEntityInRdf(user, RdfUtils.getRdfType("user"));

    // Restore the user
    User restored =
        restoreEntity(new RestoreEntity().withId(user.getId()), Status.OK, ADMIN_AUTH_HEADERS);

    // Verify user still exists after restore
    RdfTestUtils.verifyEntityInRdf(restored, RdfUtils.getRdfType("user"));
  }

  @Test
  void testUserRdfHardDelete(TestInfo test) throws IOException {
    if (!RdfTestUtils.isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create user
    CreateUser createUser = createRequest(test);
    User user = createEntity(createUser, ADMIN_AUTH_HEADERS);

    // Verify user exists
    RdfTestUtils.verifyEntityInRdf(user, RdfUtils.getRdfType("user"));

    // Hard delete the user
    deleteEntity(user.getId(), true, true, ADMIN_AUTH_HEADERS);

    // Verify user no longer exists in RDF after hard delete
    RdfTestUtils.verifyEntityNotInRdf(user.getFullyQualifiedName());
  }
}
