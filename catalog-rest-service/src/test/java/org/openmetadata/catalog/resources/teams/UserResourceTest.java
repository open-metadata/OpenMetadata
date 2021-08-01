package org.openmetadata.catalog.resources.teams;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.api.teams.CreateUser;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.resources.teams.UserResource.UserList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.ImageList;
import org.openmetadata.catalog.type.Profile;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.common.utils.JsonSchemaUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.deactivatedUser;
import static org.openmetadata.catalog.resources.teams.TeamResourceTest.createTeam;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

public class UserResourceTest extends CatalogApplicationTest {
  public static final Logger LOG = LoggerFactory.getLogger(UserResourceTest.class);
  final Profile PROFILE = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

  @Test
  public void post_userWithLongName_400_badRequest(TestInfo test) {
    // Create team with mandatory name field empty
    HttpResponseException exception =
            assertThrows(HttpResponseException.class, () -> createUser(create(test).withName(TestUtils.LONG_ENTITY_NAME)));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_userWithoutName_400_badRequest(TestInfo test) {
    // Create user with mandatory name field null
    HttpResponseException exception = assertThrows(HttpResponseException.class,
            () -> createUser(create(test).withName(null)));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name must not be null]");

    // Create user with mandatory name field empty
    exception = assertThrows(HttpResponseException.class, () -> createUser(create(test).withName("")));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_userWithoutEmail_400_badRequest(TestInfo test) {
    // Create user with mandatory email field null
    HttpResponseException exception = assertThrows(HttpResponseException.class,
            () -> createUser(create(test).withEmail(null)));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[email must not be null]");

    // Create user with mandatory email field empty
    exception = assertThrows(HttpResponseException.class, () -> createUser(create(test).withEmail("")));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "email must match \"^\\S+@\\S+\\.\\S+$\"");
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "email size must be between 6 and 127");

    // Create user with mandatory email field with invalid email address
    exception = assertThrows(HttpResponseException.class, () -> createUser(create(test).withEmail("invalidEmail")));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "[email must match \"^\\S+@\\S+\\.\\S+$\"]");
  }

  @Test
  public void post_userAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateUser create = create(test);
    createUser(create);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createUser(create));
    TestUtils.assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validUser_200_ok(TestInfo test) throws HttpResponseException {
    // Create user with different optional fields
    CreateUser create = create(test, 1);
    createAndCheckUser(create);

    create = create(test, 2).withDisplayName("displayName");
    createAndCheckUser(create);

    create = create(test, 3).withProfile(PROFILE);
    createAndCheckUser(create);

    create = create(test, 5).withDisplayName("displayName").withProfile(PROFILE).withIsBot(true);
    createAndCheckUser(create);

    create = create(test, 6).withDisplayName("displayName").withProfile(PROFILE).withIsAdmin(true);
    createAndCheckUser(create);
  }

  @Test
  public void post_validUserWithTeams_200_ok(TestInfo test) throws HttpResponseException {
    // Create user with different optional fields
    Team team1 = createTeam(TeamResourceTest.create(test, 1));
    Team team2 = createTeam(TeamResourceTest.create(test, 2));
    List<UUID> teams = Arrays.asList(team1.getId(), team2.getId());
    CreateUser create = create(test).withTeams(teams);
    User user = createAndCheckUser(create);

    // Make sure Team has relationship to this user
    team1 = TeamResourceTest.getTeam(team1.getId(), "users");
    assertEquals(user.getId(), team1.getUsers().get(0).getId());
    team2 = TeamResourceTest.getTeam(team2.getId(), "users");
    assertEquals(user.getId(), team2.getUsers().get(0).getId());
  }

  @Test
  public void get_nonExistentUser_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getUser(TestUtils.NON_EXISTENT_ENTITY));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_userWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    // Create team and role for the user
    Team team = createTeam(TeamResourceTest.create(test));
    List<UUID> teamIds = Collections.singletonList(team.getId());

    CreateUser create = create(test).withDisplayName("displayName").withTeams(teamIds).withProfile(PROFILE);
    User user = createUser(create);
    validateGetWithDifferentField(user, false);
  }

  @Test
  public void get_userByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    // Create team and role for the user
    Team team = createTeam(TeamResourceTest.create(test));
    List<UUID> teamIds = Collections.singletonList(team.getId());

    CreateUser create = create(test).withDisplayName("displayName").withTeams(teamIds).withProfile(PROFILE);
    User user = createUser(create);
    validateGetWithDifferentField(user, true);
  }

  @Test
  public void get_userWithInvalidFields_400_BadRequest(TestInfo test) throws HttpResponseException {
    User user = createUser(create(test));

    // Empty query field .../users?fields=
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getUser(user.getId(), ""));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "Invalid field name");

    // .../users?fields=invalidField
    exception = assertThrows(HttpResponseException.class, () -> getUser(user.getId(), "invalidField"));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidField("invalidField"));
  }

  @Test
  public void get_userListWithInvalidLimit_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listUsers(null, -1, null, null));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listUsers(null, 0, null, null));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listUsers(null, 1000001, null, null));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_userListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listUsers(null, 1, "", ""));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  /**
   * For cursor based pagination and implementation details:
   * @see org.openmetadata.catalog.util.ResultList#ResultList(List, int, String, String)
   *
   * The tests and various CASES referenced are base on that.
   */
  @Test
  public void get_userListWithPagination_200(TestInfo test) throws HttpResponseException {
    // Create a large number of users
    int maxUsers = 40;
    for (int i = 0; i < maxUsers; i++) {
      createUser(create(test, i));
    }

    // List all users and use it for checking pagination
    UserList allUsers = listUsers(null, 1000000, null, null);
    int totalRecords = allUsers.getData().size();
    printUsers(allUsers);

    // List tables with limit set from 1 to maxTables size
    // Each time comapare the returned list with allTables list to make sure right results are returned
    for (int limit = 1; limit < maxUsers; limit++) {
      String after = null;
      String before = null;
      int pageCount = 0;
      int indexInAllTables = 0;
      UserList forwardPage;
      UserList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listUsers(null, limit, null, after);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allUsers.getData(), forwardPage, limit, indexInAllTables);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listUsers(null, limit, before, null);
          assertEntityPagination(allUsers.getData(), backwardPage, limit, (indexInAllTables - limit));
        }

        printUsers(forwardPage);
        indexInAllTables += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllTables = totalRecords - limit - forwardPage.getData().size() ;
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listUsers(null, limit, before, null);
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
  public void patch_userIDChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure user ID can't be changed using patch
    User user = createUser(create(test));
    UUID oldUserId = user.getId();
    String userJson = JsonUtils.pojoToJson(user);
    user.setId(UUID.randomUUID());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> patchUser(oldUserId, userJson, user));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute("User", "id"));
  }

  @Test
  public void patch_userNameChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure user name can't be changed using patch
    User user = createUser(create(test));
    String userJson = JsonUtils.pojoToJson(user);
    user.setName("newName");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> patchUser(userJson, user));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute("User", "name"));
  }

  @Test
  public void patch_userDeletedDisallowed_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure user deleted attributed can't be changed using patch
    User user = createUser(create(test));
    String userJson = JsonUtils.pojoToJson(user);
    user.setDeactivated(true);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> patchUser(userJson, user));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute("User", "deactivated"));
  }

  @Test
  public void patch_userAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create user without any attributes
    User user = createUser(create(test));
    assertNull(user.getDisplayName());
    assertNull(user.getIsBot());
    assertNull(user.getProfile());
    assertNull(user.getDeactivated());
    assertNull(user.getTimezone());

    Team team1 = createTeam(TeamResourceTest.create(test, 1));
    Team team2 = createTeam(TeamResourceTest.create(test, 2));
    Team team3 = createTeam(TeamResourceTest.create(test, 3));
    List<Team> teams = Arrays.asList(team1, team2);
    Profile profile = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));


    // Add previously absent attributes
    String timezone = "America/Los_Angeles";
    user = patchUserAttributesAndCheck(user, "displayName", teams, PROFILE, timezone, false, false);

    // Replace the attributes
    timezone = "Canada/Eastern";
    teams = Arrays.asList(team1, team3); // team2 dropped and team3 is added
    profile = new Profile().withImages(new ImageList().withImage(URI.create("http://image2.com")));
    user = patchUserAttributesAndCheck(user, "displayName1", teams, PROFILE, timezone, true, false);

    user = patchUserAttributesAndCheck(user, "displayName1", teams, PROFILE, timezone, false, true);

    // Remove the attributes
    patchUserAttributesAndCheck(user, null, null, null, null, null, null);
  }

  @Test
  public void delete_validUser_200_OK(TestInfo test) throws HttpResponseException {
    Team team = createTeam(TeamResourceTest.create(test));
    List<UUID> teamIds = Collections.singletonList(team.getId());

    CreateUser create = create(test).withProfile(PROFILE).withTeams(teamIds);
    User user = createUser(create);

    // Add user as follower to a table
    Table table = TableResourceTest.createTable(test, 1);
    TableResourceTest.addAndCheckFollower(table, user.getId(), CREATED, 1);

    deleteUser(user.getId());

    // Make sure team entity no longer shows relationship to this user
    team = TeamResourceTest.getTeam(team.getId(), "users");
    assertTrue(team.getUsers().isEmpty());

    // Make sure the user is no longer following the table
    team = TeamResourceTest.getTeam(team.getId(), "users");
    assertTrue(team.getUsers().isEmpty());
    TableResourceTest.checkFollowerDeleted(table.getId(), user.getId());

    // Get deactiveated user and ensure the name and display name has deactivated
    User deactiveatedUser = getUser(user.getId());
    assertEquals("deactivated." + user.getName(), deactiveatedUser.getName());
    assertEquals("Deactivated " + user.getDisplayName(), deactiveatedUser.getDisplayName());

    // User can no longer follow other entities
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            TableResourceTest.addAndCheckFollower(table, user.getId(), CREATED, 1));
    TestUtils.assertResponse(exception, BAD_REQUEST, deactivatedUser(user.getId().toString()));

    // TODO deactivated user can't be made owner
  }

  @Test
  public void delete_nonExistentUser_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> deleteUser(TestUtils.NON_EXISTENT_ENTITY));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  private User patchUser(UUID userId, String originalJson, User updated) throws JsonProcessingException, HttpResponseException {
    String updatedJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updatedJson);
    return TestUtils.patch(CatalogApplicationTest.getResource("users/" + userId), patch, User.class);
  }

  private User patchUser(String originalJson, User updated) throws JsonProcessingException, HttpResponseException {
    return patchUser(updated.getId(), originalJson, updated);
  }

  private User patchUserAttributesAndCheck(User user, String displayName, List<Team> teams, Profile profile,
                                           String timezone, Boolean isBot, Boolean isAdmin)
          throws JsonProcessingException, HttpResponseException {
    Optional.ofNullable(user.getTeams()).orElse(Collections.emptyList()).forEach(t -> t.setHref(null)); // Remove href
    String userJson = JsonUtils.pojoToJson(user);

    // Update the user attributes
    user.setDisplayName(displayName);
    user.setTeams(UserRepository.toEntityReference(teams));
    user.setProfile(profile);
    user.setTimezone(timezone);
    user.setIsBot(isBot);
    user.setIsAdmin(isAdmin);

    // Validate information returned in patch response has the updates
    User updatedUser = patchUser(userJson, user);
    validateUser(updatedUser, user.getName(), displayName, teams, profile, timezone, isBot, isAdmin);

    // GET the user and Validate information returned
    User getUser = getUser(user.getId(), "teams,profile");
    validateUser(getUser, user.getName(), displayName, teams, profile, timezone, isBot, isAdmin);
    return getUser;
  }


  public static User createAndCheckUser(CreateUser create) throws HttpResponseException {
    final User user = createUser(create);
    List<Team> expectedTeams = new ArrayList<>();
    for (UUID teamId : Optional.ofNullable(create.getTeams()).orElse(Collections.emptyList())) {
      expectedTeams.add(new Team().withId(teamId));
    }
    validateUser(user, create.getName(), create.getDisplayName(), expectedTeams, create.getProfile(),
            create.getTimezone(), create.getIsBot(), create.getIsAdmin());

    // GET the newly created user and validate
    User getUser = getUser(user.getId(), "profile,teams");
    validateUser(getUser, create.getName(), create.getDisplayName(), expectedTeams, create.getProfile(),
            create.getTimezone(), create.getIsBot(), create.getIsAdmin());
    return user;
  }

  public static CreateUser create(TestInfo test, int index) {
    String userName = getUserName(test) + index;
    String userEmail = userName + "@domain.com";
    return new CreateUser().withName(userName).withEmail(userEmail);
  }

  public static CreateUser create(TestInfo test) {
    String userName = getUserName(test);
    String userEmail = userName + "@domain.com";
    return new CreateUser().withName(userName).withEmail(userEmail);
  }

  public static User createUser(CreateUser create) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("users"), create, User.class);
  }

  public static void validateUser(User user, String expectedName, String expectedDisplayName, List<Team> expectedTeams,
                                  Profile expectedProfile, String expectedTimeZone, Boolean expectedIsBot,
                                  Boolean expectedIsAdmin) {
    assertEquals(expectedName, user.getName());
    assertEquals(expectedDisplayName, user.getDisplayName());
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
        for (Team expected : expectedTeams) {
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
    user = byName ? getUserByName(user.getName(), fields) : getUser(user.getId(), fields);
    assertNotNull(user.getProfile());
    assertNull(user.getTeams());

    // .../teams?fields=profile,teams
    fields = "profile, teams";
    user = byName ? getUserByName(user.getName(), fields) : getUser(user.getId(), fields);
    assertNotNull(user.getProfile());
    assertNotNull(user.getTeams());
  }

  public static User getUser(UUID id) throws HttpResponseException {
    return getUser(id, null);
  }

  public static User getUser(UUID id, String fields) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("users/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, User.class);
  }

  public static User getUserByName(String name, String fields) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("users/name/" + name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, User.class);
  }

  private void deleteUser(UUID id) throws HttpResponseException {
    TestUtils.delete(CatalogApplicationTest.getResource("users/" + id));
  }

  public static UserList listUsers(String fields, Integer limit, String before, String after) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("users");
    target = fields != null ? target.queryParam("fields", fields) : target;
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, UserList.class);
  }

  // TODO write following tests
  // list users
  // list users with various fields parameters
  public static String getUserName(TestInfo testInfo) {
    String testName = testInfo.getDisplayName();
    // user name can't be longer than 64 characters
    return String.format("user_%s", testName.substring(0, Math.min(testName.length(), 50)));
  }

  public static String getUserName(TestInfo testInfo, int index) {
    String testName = testInfo.getDisplayName();
    // user name can't be longer than 64 characters
    return String.format("user%d_%s", index, testName.substring(0, Math.min(testName.length(), 50)));
  }
}
