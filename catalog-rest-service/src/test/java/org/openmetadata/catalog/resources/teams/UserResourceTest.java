/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.teams;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.teams.CreateUser;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamEntityInterface;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.resources.teams.UserResource.UserList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.ImageList;
import org.openmetadata.catalog.type.Profile;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;
import org.openmetadata.common.utils.JsonSchemaUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static javax.ws.rs.core.Response.Status.UNAUTHORIZED;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.deactivatedUser;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.readOnlyAttribute;
import static org.openmetadata.catalog.resources.teams.TeamResourceTest.createTeam;
import static org.openmetadata.catalog.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class UserResourceTest extends CatalogApplicationTest {
  public static final Logger LOG = LoggerFactory.getLogger(UserResourceTest.class);
  final Profile PROFILE = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

  @Test
  public void post_userWithLongName_400_badRequest(TestInfo test) {
    // Create team with mandatory name field empty
    CreateUser create = create(test).withName(LONG_ENTITY_NAME);
    HttpResponseException exception =
            assertThrows(HttpResponseException.class, () -> createUser(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_userWithoutName_400_badRequest(TestInfo test) {
    // Create user with mandatory name field null
    CreateUser create = create(test).withName(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createUser(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name must not be null]");

    // Create user with mandatory name field empty
    create.withName("");
    exception = assertThrows(HttpResponseException.class, () -> createUser(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_userWithoutEmail_400_badRequest(TestInfo test) {
    // Create user with mandatory email field null
    CreateUser create = create(test).withEmail(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createUser(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[email must not be null]");

    // Create user with mandatory email field empty
    create.withEmail("");
    exception = assertThrows(HttpResponseException.class, () -> createUser(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "email must match \"^\\S+@\\S+\\.\\S+$\"");
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "email size must be between 6 and 127");

    // Create user with mandatory email field with invalid email address
    create.withEmail("invalidEmail");
    exception = assertThrows(HttpResponseException.class, () -> createUser(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "[email must match \"^\\S+@\\S+\\.\\S+$\"]");
  }

  @Test
  public void post_userAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateUser create = create(test);
    createUser(create, adminAuthHeaders()); // Create user first
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createUser(create, adminAuthHeaders())); // Creating again must fail
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validUser_200_ok_without_login(TestInfo test) {
    CreateUser create = create(test, 6).withDisplayName("displayName")
            .withEmail("test@email.com")
            .withIsAdmin(true);

    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createAndCheckUser(create, null));
    assertResponse(exception, UNAUTHORIZED, "Not authorized; User's Email is not present");
  }

  @Test
  public void post_validUser_200_ok(TestInfo test) throws HttpResponseException {
    // Create user with different optional fields
    CreateUser create = create(test, 1);
    createAndCheckUser(create, adminAuthHeaders());

    create = create(test, 2).withDisplayName("displayName");
    createAndCheckUser(create, adminAuthHeaders());

    create = create(test, 3).withProfile(PROFILE);
    createAndCheckUser(create, adminAuthHeaders());

    create = create(test, 5).withDisplayName("displayName").withProfile(PROFILE).withIsBot(true);
    createAndCheckUser(create, adminAuthHeaders());

    create = create(test, 6).withDisplayName("displayName").withProfile(PROFILE).withIsAdmin(true);
    createAndCheckUser(create, adminAuthHeaders());
  }

  @Test
  public void put_validUser_200_ok(TestInfo test) throws HttpResponseException {
    // Create user with different optional fields
    CreateUser create = create(test, 1);
    User user = createOrUpdateAndCheckUser(null, create, CREATED, adminAuthHeaders(), NO_CHANGE);

    // Update the user information using PUT
    CreateUser update = create.withEmail("test1@email.com").withDisplayName("displayName1");
    createOrUpdateAndCheckUser(user, update, OK, adminAuthHeaders(), MINOR_UPDATE);
  }


  @Test
  public void post_validAdminUser_Non_Admin_401(TestInfo test) {
    CreateUser create = create(test, 6)
            .withName("test")
            .withDisplayName("displayName")
            .withEmail("test@email.com").withIsAdmin(true);

    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createAndCheckUser(create,
            authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_validAdminUser_200_ok(TestInfo test) throws HttpResponseException {
    CreateUser create = create(test, 6)
            .withName("test1")
            .withDisplayName("displayName")
            .withEmail("test1@email.com").withIsAdmin(true);
    createAndCheckUser(create, adminAuthHeaders());
  }

  @Test
  public void post_validUserWithTeams_200_ok(TestInfo test) throws HttpResponseException {
    // Create user with different optional fields
    Team team1 = createTeam(TeamResourceTest.create(test, 1), adminAuthHeaders());
    Team team2 = createTeam(TeamResourceTest.create(test, 2), adminAuthHeaders());
    List<UUID> teams = Arrays.asList(team1.getId(), team2.getId());
    CreateUser create = create(test).withTeams(teams);
    User user = createAndCheckUser(create, adminAuthHeaders());

    // Make sure Team has relationship to this user
    team1 = TeamResourceTest.getTeam(team1.getId(), "users", adminAuthHeaders());
    assertEquals(user.getId(), team1.getUsers().get(0).getId());
    team2 = TeamResourceTest.getTeam(team2.getId(), "users", adminAuthHeaders());
    assertEquals(user.getId(), team2.getUsers().get(0).getId());
  }

  @Test
  public void get_nonExistentUser_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getUser(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_userWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    // Create team and role for the user
    Team team = createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    List<UUID> teamIds = Collections.singletonList(team.getId());

    CreateUser create = create(test).withDisplayName("displayName").withTeams(teamIds).withProfile(PROFILE);
    User user = createUser(create, adminAuthHeaders());
    validateGetWithDifferentField(user, false);
  }

  @Test
  public void get_userByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    // Create team and role for the user
    Team team = createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    List<UUID> teamIds = Collections.singletonList(team.getId());

    CreateUser create = create(test).withDisplayName("displayName").withTeams(teamIds).withProfile(PROFILE);
    User user = createUser(create, adminAuthHeaders());
    validateGetWithDifferentField(user, true);
  }

  @Test
  public void get_userWithInvalidFields_400_BadRequest(TestInfo test) throws HttpResponseException {
    User user = createUser(create(test), adminAuthHeaders());

    // Empty query field .../users?fields=
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getUser(user.getId(), "", adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "Invalid field name");

    // .../users?fields=invalidField
    exception = assertThrows(HttpResponseException.class, () ->
            getUser(user.getId(), "invalidField", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidField("invalidField"));
  }

  @Test
  public void get_userListWithInvalidLimit_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listUsers(null, -1, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listUsers(null, 0, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listUsers(null, 1000001, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_userListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listUsers(null, 1, "", "", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  /**
   * For cursor based pagination and implementation details:
   * @see org.openmetadata.catalog.util.ResultList
   *
   * The tests and various CASES referenced are base on that.
   */
  @Test
  public void get_userListWithPagination_200(TestInfo test) throws HttpResponseException {
    // Create a large number of users
    int maxUsers = 40;
    for (int i = 0; i < maxUsers; i++) {
      createUser(create(test, i), adminAuthHeaders());
    }

    // List all users and use it for checking pagination
    UserList allUsers = listUsers(null, 1000000, null, null, adminAuthHeaders());
    int totalRecords = allUsers.getData().size();
    printUsers(allUsers);

    // List tables with limit set from 1 to maxTables size
    // Each time compare the returned list with allTables list to make sure right results are returned
    for (int limit = 1; limit < 2; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllTables = 0;
      UserList forwardPage;
      UserList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listUsers(null, limit, null, after, adminAuthHeaders());
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        printUsers(forwardPage);
        assertEntityPagination(allUsers.getData(), forwardPage, limit, indexInAllTables);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listUsers(null, limit, before, null, adminAuthHeaders());
          assertEntityPagination(allUsers.getData(), backwardPage, limit, (indexInAllTables - limit));
        }

        indexInAllTables += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllTables = totalRecords - limit - forwardPage.getData().size();
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listUsers(null, limit, before, null, adminAuthHeaders());
        printUsers(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allUsers.getData(), forwardPage, limit, indexInAllTables);
        pageCount++;
        indexInAllTables -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printUsers(UserList list) {
    list.getData().forEach(user -> LOG.info("User {}", user.getName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  /**
   * @see TableResourceTest#put_addDeleteFollower_200 test for tests related to GET user with owns field parameter
   *
   * @see TableResourceTest#put_addDeleteFollower_200 for tests related getting user with follows list
   *
   * @see TableResourceTest also tests GET user returns owns list
   */

  @Test
  public void patch_userNameChange_as_another_user_401(TestInfo test)
          throws HttpResponseException, JsonProcessingException {
    // Ensure user name can't be changed using patch
    User user = createUser(create(test, 6).withName("test2").withDisplayName("displayName")
            .withEmail("test2@email.com"), authHeaders("test2@email.com"));
    String userJson = JsonUtils.pojoToJson(user);
    user.setDisplayName("newName");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> patchUser(userJson, user,
            authHeaders("test100@email.com")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test100'} does not have permissions");
  }

  @Test
  public void patch_userNameChange_as_same_user_200_ok(TestInfo test) throws HttpResponseException,
          JsonProcessingException {
    // Ensure user name can't be changed using patch
    User user = createUser(create(test, 6).withName("test").withDisplayName("displayName")
            .withEmail("test@email.com"), authHeaders("test@email.com"));
    String userJson = JsonUtils.pojoToJson(user);
    String newDisplayName = "newDisplayName";
    user.setDisplayName(newDisplayName); // Update the name
    user = patchUser(userJson, user, adminAuthHeaders()); // Patch the user
    assertEquals(newDisplayName, user.getDisplayName());
  }

  @Test
  public void patch_userDeletedDisallowed_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure user deleted attributed can't be changed using patch
    User user = createUser(create(test), adminAuthHeaders());
    String userJson = JsonUtils.pojoToJson(user);
    user.setDeactivated(true);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchUser(userJson, user, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute("User", "deactivated"));
  }

  @Test
  public void patch_userAttributes_as_admin_200_ok(TestInfo test) throws HttpResponseException,
          JsonProcessingException {
    // Create user without any attributes
    User user = createUser(create(test), adminAuthHeaders());
    assertNull(user.getDisplayName());
    assertNull(user.getIsBot());
    assertNull(user.getProfile());
    assertNull(user.getDeactivated());
    assertNull(user.getTimezone());

    Team team1 = createTeam(TeamResourceTest.create(test, 1), adminAuthHeaders());
    Team team2 = createTeam(TeamResourceTest.create(test, 2), adminAuthHeaders());
    Team team3 = createTeam(TeamResourceTest.create(test, 3), adminAuthHeaders());
    List<EntityReference> teams = Arrays.asList(new TeamEntityInterface(team1).getEntityReference(),
            new TeamEntityInterface(team2).getEntityReference());
    Profile profile = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));


    // Add previously absent attributes
    String timezone = "America/Los_Angeles";
    user = patchUserAttributesAndCheck(user, "displayName", teams, profile, timezone, false,
            false, adminAuthHeaders(), MINOR_UPDATE);

    // Replace the attributes
    timezone = "Canada/Eastern";
    teams = Arrays.asList(new TeamEntityInterface(team1).getEntityReference(),
            new TeamEntityInterface(team3).getEntityReference()); // team2 dropped and team3 is added
    profile = new Profile().withImages(new ImageList().withImage(URI.create("http://image2.com")));
    user = patchUserAttributesAndCheck(user, "displayName1", teams, profile, timezone, true,
            false, adminAuthHeaders(), MINOR_UPDATE);

    // Remove the attributes
    patchUserAttributesAndCheck(user, null, null, null, null, null,
            null, adminAuthHeaders(), MINOR_UPDATE);
  }

  @Test
  public void delete_validUser_as_non_admin_401(TestInfo test) throws HttpResponseException {
    CreateUser create = create(test).withName("test3").withEmail("test3@email.com");
    User user = createUser(create, authHeaders("test3"));

    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> deleteUser(user.getId(),
            authHeaders("test3@email.com")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test3'} is not admin");
  }

  @Test
  public void delete_validUser_as_admin_200(TestInfo test) throws HttpResponseException {
    Team team = createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    List<UUID> teamIds = Collections.singletonList(team.getId());

    CreateUser create = create(test).withProfile(PROFILE).withTeams(teamIds);
    User user = createUser(create, adminAuthHeaders());

    // Add user as follower to a table
    Table table = TableResourceTest.createTable(test, 1);
    TableResourceTest.addAndCheckFollower(table, user.getId(), CREATED, 1, adminAuthHeaders());

    deleteUser(user.getId(), adminAuthHeaders());

    // Make sure team entity no longer shows relationship to this user
    team = TeamResourceTest.getTeam(team.getId(), "users", adminAuthHeaders());
    assertTrue(team.getUsers().isEmpty());

    // Make sure the user is no longer following the table
    team = TeamResourceTest.getTeam(team.getId(), "users", adminAuthHeaders());
    assertTrue(team.getUsers().isEmpty());
    TableResourceTest.checkFollowerDeleted(table.getId(), user.getId(), adminAuthHeaders());

    // Get deactivated user and ensure the name and display name has deactivated
    User deactivatedUser = getUser(user.getId(), adminAuthHeaders());
    assertEquals("deactivated." + user.getName(), deactivatedUser.getName());
    assertEquals("Deactivated " + user.getDisplayName(), deactivatedUser.getDisplayName());

    // User can no longer follow other entities
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            TableResourceTest.addAndCheckFollower(table, user.getId(), CREATED, 1, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, deactivatedUser(user.getId().toString()));

    // TODO deactivated user can't be made owner
  }

  @Test
  public void delete_nonExistentUser_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteUser(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  public static User putUser(CreateUser user, Response.Status expectedStatus, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("users");
    return TestUtils.put(target, user, User.class, expectedStatus, authHeaders);
  }

  private User patchUser(UUID userId, String originalJson, User updated, Map<String, String> headers)
          throws JsonProcessingException, HttpResponseException {
    String updatedJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updatedJson);
    return TestUtils.patch(CatalogApplicationTest.getResource("users/" + userId), patch, User.class, headers);
  }

  private User patchUser(String originalJson, User updated, Map<String, String> headers)
          throws JsonProcessingException, HttpResponseException {
    return patchUser(updated.getId(), originalJson, updated, headers);
  }

  private User patchUserAttributesAndCheck(User before, String displayName, List<EntityReference> teams,
                                           Profile profile,
                                           String timezone, Boolean isBot, Boolean isAdmin,
                                           Map<String, String> authHeaders, UpdateType updateType)
          throws JsonProcessingException, HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    Optional.ofNullable(before.getTeams()).orElse(Collections.emptyList()).forEach(t -> t.setHref(null)); // Remove href
    String userJson = JsonUtils.pojoToJson(before);

    // Update the user attributes
    before.setDisplayName(displayName);
    before.setTeams(teams);
    before.setProfile(profile);
    before.setTimezone(timezone);
    before.setIsBot(isBot);
    before.setIsAdmin(isAdmin);

    // Validate information returned in patch response has the updates
    User updatedUser = patchUser(userJson, before, authHeaders);
    validateUser(updatedUser, before.getName(), displayName, teams, profile, timezone, isBot, isAdmin, updatedBy);
    TestUtils.validateUpdate(before.getVersion(), updatedUser.getVersion(), updateType);

    // GET the user and Validate information returned
    User getUser = getUser(before.getId(), "teams,profile", authHeaders);
    validateUser(getUser, before.getName(), displayName, teams, profile, timezone, isBot, isAdmin, updatedBy);
    return getUser;
  }


  public static User createAndCheckUser(CreateUser create, Map<String, String> authHeaders)
          throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    final User user = createUser(create, authHeaders);
    assertEquals(0.1, user.getVersion());
    List<EntityReference> expectedTeams = new ArrayList<>();
    for (UUID teamId : Optional.ofNullable(create.getTeams()).orElse(Collections.emptyList())) {
      expectedTeams.add(new EntityReference().withId(teamId).withType(Entity.TEAM));
    }
    validateUser(user, create.getName(), create.getDisplayName(), expectedTeams, create.getProfile(),
            create.getTimezone(), create.getIsBot(), create.getIsAdmin(), updatedBy);

    // GET the newly created user and validate
    User getUser = getUser(user.getId(), "profile,teams", authHeaders);
    validateUser(getUser, create.getName(), create.getDisplayName(), expectedTeams, create.getProfile(),
            create.getTimezone(), create.getIsBot(), create.getIsAdmin(), updatedBy);
    return user;
  }

  public static User createOrUpdateAndCheckUser(User before, CreateUser create, Response.Status expectedStatus,
                                                Map<String, String> authHeaders, UpdateType updateType)
          throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    final User updatedUser = putUser(create, expectedStatus, authHeaders);
    List<EntityReference> expectedTeams = new ArrayList<>();
    for (UUID teamId : Optional.ofNullable(create.getTeams()).orElse(Collections.emptyList())) {
      expectedTeams.add(new EntityReference().withId(teamId).withType(Entity.TEAM));
    }
    validateUser(updatedUser, create.getName(), create.getDisplayName(), expectedTeams, create.getProfile(),
            create.getTimezone(), create.getIsBot(), create.getIsAdmin(), updatedBy);

    if (before == null) {
      assertEquals(0.1, updatedUser.getVersion()); // First version created
    } else {
      TestUtils.validateUpdate(before.getVersion(), updatedUser.getVersion(), updateType);
    }

    // GET the newly created user and validate
    User getUser = getUser(updatedUser.getId(), "profile,teams", authHeaders);
    validateUser(getUser, create.getName(), create.getDisplayName(), expectedTeams, create.getProfile(),
            create.getTimezone(), create.getIsBot(), create.getIsAdmin(), updatedBy);
    return updatedUser;
  }

  public static CreateUser create(TestInfo test, int index) {
    return new CreateUser().withName(getUserName(test) + index).withEmail(getUserName(test) + "@open-metadata.org");
  }

  public static CreateUser create(TestInfo test) {
    return new CreateUser().withName(getUserName(test)).withEmail(getUserName(test)+"@open-metadata.org");
  }

  public static User createUser(CreateUser create, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("users"), create, User.class, authHeaders);
  }

  public static void validateUser(User user, String expectedName, String expectedDisplayName,
                                  List<EntityReference> expectedTeams,
                                  Profile expectedProfile, String expectedTimeZone, Boolean expectedIsBot,
                                  Boolean expectedIsAdmin, String expectedUpdatedBy) {
    assertEquals(expectedName, user.getName());
    assertEquals(expectedDisplayName, user.getDisplayName());
    assertEquals(expectedUpdatedBy, user.getUpdatedBy());
    assertEquals(expectedTimeZone, user.getTimezone());
    assertEquals(expectedIsBot, user.getIsBot());
    assertEquals(expectedIsAdmin, user.getIsAdmin());
    assertNotNull(user.getId());
    assertNotNull(user.getHref());
    if (expectedTeams != null && !expectedTeams.isEmpty()) {
      assertEquals(expectedTeams.size(), user.getTeams().size());
      for (EntityReference team : user.getTeams()) {
        TestUtils.validateEntityReference(team);
        boolean foundTeam = false;
        for (EntityReference expected : expectedTeams) {
          if (expected.getId().equals(team.getId())) {
            foundTeam = true;
            break;
          }
        }
        assertTrue(foundTeam);
      }
    }
    if (expectedProfile != null) {
      assertEquals(expectedProfile, user.getProfile());
    }
  }

  /** Validate returned fields GET .../users/{id}?fields="..." or GET .../users/name/{name}?fields="..." */
  private void validateGetWithDifferentField(User user, boolean byName) throws HttpResponseException {
    // .../teams?fields=profile
    String fields = "profile";
    user = byName ? getUserByName(user.getName(), fields, adminAuthHeaders()) :
            getUser(user.getId(), fields, adminAuthHeaders());
    assertNotNull(user.getProfile());
    assertNull(user.getTeams());

    // .../teams?fields=profile,teams
    fields = "profile, teams";
    user = byName ? getUserByName(user.getName(), fields, adminAuthHeaders()) :
            getUser(user.getId(), fields, adminAuthHeaders());
    assertNotNull(user.getProfile());
    assertNotNull(user.getTeams());
  }

  public static User getUser(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    return getUser(id, null, authHeaders);
  }

  public static User getUser(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("users/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, User.class, authHeaders);
  }

  public static User getUserByName(String name, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("users/name/" + name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, User.class, authHeaders);
  }

  private void deleteUser(UUID id, Map<String, String> headers) throws HttpResponseException {
    TestUtils.delete(CatalogApplicationTest.getResource("users/" + id), headers);
  }

  public static UserList listUsers(String fields, Integer limit, String before, String after,
                                   Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("users");
    target = fields != null ? target.queryParam("fields", fields) : target;
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, UserList.class, authHeaders);
  }

  // TODO write following tests
  // list users
  // list users with various fields parameters
  public static String getUserName(TestInfo testInfo) {
    String testName = testInfo.getDisplayName();
    // user name can't be longer than 64 characters
    return String.format("user_%s", testName.substring(0, Math.min(testName.length(), 50)));
  }
}
