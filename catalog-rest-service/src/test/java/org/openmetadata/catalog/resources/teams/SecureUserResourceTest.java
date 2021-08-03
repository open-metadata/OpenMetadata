package org.openmetadata.catalog.resources.teams;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;

import org.openmetadata.catalog.SecureCatalogApplicationTest;
import org.openmetadata.catalog.api.teams.CreateUser;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.security.CatalogOpenIdAuthorizationRequestFilter;
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
import java.util.*;

import static javax.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.*;

public class SecureUserResourceTest extends SecureCatalogApplicationTest {
  public static final Logger LOG = LoggerFactory.getLogger(SecureUserResourceTest.class);
  final Profile PROFILE = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));


  @Test
  public void post_validUser_200_ok_without_login(TestInfo test) {
    CreateUser create = create(test, 6).withDisplayName("displayName")
            .withEmail("test@email.com")
            .withIsAdmin(true);

    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createAndCheckUser(create,
            null));
    TestUtils.assertResponse(exception, UNAUTHORIZED, "Not authorized; User's Email is not present");
  }

  @Test
  public void post_validUser_200_ok(TestInfo test) throws HttpResponseException {
    CreateUser create = create(test, 6)
            .withName("test4")
            .withDisplayName("displayName")
            .withEmail("test4@email.com");
    createAndCheckUser(create, TestUtils.authHeaders("test4@getcollate.com"));
  }

  @Test
  public void post_validAdminUser_Non_Admin_401(TestInfo test) throws HttpResponseException {
    CreateUser create = create(test, 6)
            .withName("test")
            .withDisplayName("displayName")
            .withEmail("test@email.com").withIsAdmin(true);

    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createAndCheckUser(create,
            TestUtils.authHeaders("test@getcollate.com")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} " +
            "is not admin");
  }

  @Test
  public void post_validAdminUser_200_ok(TestInfo test) throws HttpResponseException {
    CreateUser create = create(test, 6)
            .withName("test1")
            .withDisplayName("displayName")
            .withEmail("test1@email.com").withIsAdmin(true);
    createAndCheckUser(create, TestUtils.authHeaders("admin@getcollate.com"));
  }


  @Test
  public void patch_userNameChange_as_another_user_401(TestInfo test) throws HttpResponseException,
          JsonProcessingException {
    // Ensure user name can't be changed using patch
    User user = createUser(create(test, 6).withName("test2").withDisplayName("displayName")
            .withEmail("test2@email.com"), TestUtils.authHeaders("test2@email.com"));
    String userJson = JsonUtils.pojoToJson(user);
    user.setDisplayName("newName");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> patchUser(userJson, user,
            TestUtils.authHeaders("test100@email.com")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test100'} " +
            "does not have permissions");
  }

  @Test
  public void patch_userNameChange_as_same_user_200_ok(TestInfo test) throws HttpResponseException,
          JsonProcessingException {
    // Ensure user name can't be changed using patch
    User user = createUser(create(test, 6).withName("test").withDisplayName("displayName")
            .withEmail("test@email.com"), TestUtils.authHeaders("test@email.com"));
    String userJson = JsonUtils.pojoToJson(user);
    String newDisplayName = "newDisplayName";
    user.setDisplayName("newDisplayName");
    User updatedUser = patchUser(userJson, user, TestUtils.authHeaders("test@email.com"));
    assertEquals(newDisplayName, user.getDisplayName());
  }

  @Test
  public void delete_validUser_as_non_admin_401(TestInfo test) throws HttpResponseException {
    CreateUser create = create(test).withName("test3").withEmail("test3@email.com");
    User user = createUser(create, TestUtils.authHeaders("test3"));

    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> deleteUser(user.getId(),
            TestUtils.authHeaders("test3@email.com")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test3'} " +
            "is not admin");
  }

  @Test
  public void delete_validUser_as_admin_200(TestInfo test) throws HttpResponseException {
    CreateUser create = create(test).withName("test").withEmail("test@email.com");
    User user = createUser(create, TestUtils.authHeaders("test"));

    deleteUser(user.getId(), TestUtils.authHeaders("admin@getcollate.com"));

    User deactivatedUser = getUser(user.getId(), TestUtils.authHeaders("admin@getcollate.com"));
    assertEquals("deactivated." + user.getName(), deactivatedUser.getName());
  }

  private User patchUser(UUID userId, String originalJson, User updated, Map<String, String> headers)
          throws JsonProcessingException, HttpResponseException {
    String updatedJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updatedJson);
    return TestUtils.patch(SecureCatalogApplicationTest.getResource("users/" + userId), patch,
            User.class, headers);
  }

  private User patchUser(String originalJson, User updated,Map<String, String> headers) throws
          JsonProcessingException, HttpResponseException {
    return patchUser(updated.getId(), originalJson, updated, headers);
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
    LOG.info("Before patch {}" + userJson);
    User updatedUser = patchUser(userJson, user, TestUtils.authHeaders("test"));
    LOG.info("After patch return {}" + JsonUtils.pojoToJson(updatedUser));
    validateUser(updatedUser, user.getName(), displayName, teams, profile, timezone, isBot, isAdmin);

    // GET the user and Validate information returned
    User getUser = getUser(user.getId(), "teams,profile", null);
    LOG.info("After patch get {}" + JsonUtils.pojoToJson(getUser));
    validateUser(getUser, user.getName(), displayName, teams, profile, timezone, isBot, isAdmin);
    return getUser;
  }


  public static User createAndCheckUser(CreateUser create, Map<String, String> httpHeaders)
          throws HttpResponseException {
    final User user = createUser(create, httpHeaders);
    List<Team> expectedTeams = new ArrayList<>();
    for (UUID teamId : Optional.ofNullable(create.getTeams()).orElse(Collections.emptyList())) {
      expectedTeams.add(new Team().withId(teamId));
    }
    validateUser(user, create.getName(), create.getDisplayName(), expectedTeams, create.getProfile(),
            create.getTimezone(), create.getIsBot(), create.getIsAdmin());

    // GET the newly created user and validate
    User getUser = getUser(user.getId(), "profile,teams", httpHeaders);
    validateUser(getUser, create.getName(), create.getDisplayName(), expectedTeams, create.getProfile(),
            create.getTimezone(), create.getIsBot(), create.getIsAdmin());
    return user;
  }

  public static CreateUser create(TestInfo test, int index) {
    return new CreateUser().withName(getUserName(test) + index).withEmail(getUserName(test) + "@getcollate.com");
  }

  public static CreateUser create(TestInfo test) {
    return new CreateUser().withName(getUserName(test)).withEmail(getUserName(test)+"@getcollate.com");
  }

  public static User createUser(CreateUser create, Map<String, String> httpHeaders) throws HttpResponseException {
    if (httpHeaders != null) {
      return TestUtils.post(SecureCatalogApplicationTest.getResource("users"), create,
              User.class, httpHeaders);
    } else {
      return TestUtils.post(SecureCatalogApplicationTest.getResource("users"), create, User.class);
    }

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
  }

  /** Validate returned fields GET .../users/{id}?fields="..." or GET .../users/name/{name}?fields="..." */
  private void validateGetWithDifferentField(User user, boolean byName) throws HttpResponseException {
    // .../teams?fields=profile
    String fields = "profile";
    user = byName ? getUserByName(user.getName(), fields) : getUser(user.getId(), fields, null);
    assertNotNull(user.getProfile());
    assertNull(user.getTeams());

    // .../teams?fields=profile,teams
    fields = "profile, teams";
    user = byName ? getUserByName(user.getName(), fields) : getUser(user.getId(), fields, null);
    assertNotNull(user.getProfile());
    assertNotNull(user.getTeams());
  }

  public static User getUser(UUID id, Map<String, String> httpHeaders) throws HttpResponseException {
    return getUser(id, null, httpHeaders);
  }

  public static User getUser(UUID id, String fields, Map<String, String> httpHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("users/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    if (httpHeaders != null) {
      return TestUtils.get(target, User.class, httpHeaders);
    } else {
      return TestUtils.get(target, User.class);
    }
  }

  public static User getUserByName(String name, String fields) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("users/name/" + name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, User.class);
  }

  private void deleteUser(UUID id, Map<String, String> headers) throws HttpResponseException {
    TestUtils.delete(SecureCatalogApplicationTest.getResource("users/" + id), headers);
  }


  // TODO write following tests
  // list users
  // list users with various fields parameters
  public static String getUserName(TestInfo testInfo) {
    return String.format("user_%s", testInfo.getDisplayName());
  }

  public static String getUserName(TestInfo testInfo, int index) {
    return String.format("user%d_%s", index, testInfo.getDisplayName());
  }

}
