package org.openmetadata.catalog.resources.teams;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.SecureCatalogApplicationTest;
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.TeamRepository;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
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
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class SecureTeamResourceTest extends SecureCatalogApplicationTest {
  private static final Logger LOG = LoggerFactory.getLogger(SecureTeamResourceTest.class);
  final Profile PROFILE = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

  @Test
  public void post_validTeams_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    Map<String, String> authHeaders = TestUtils.authHeaders("admin@getcollate.com");
    CreateTeam create = create(test, 1);
    createAndCheckTeam(create, authHeaders);

    create = create(test, 2).withDisplayName("displayName");
    createAndCheckTeam(create, authHeaders);

    create = create(test, 4).withProfile(PROFILE);
    createAndCheckTeam(create, authHeaders);

    create = create(test, 5).withDisplayName("displayName").withDescription("description").withProfile(PROFILE);
    createAndCheckTeam(create, authHeaders);
  }

  @Test
  public void post_validTeams_as_non_admin_401(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    Map<String, String> authHeaders = TestUtils.authHeaders("test@getcollate.com");
    CreateTeam create = create(test, 1);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createAndCheckTeam(create,
            authHeaders));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_teamWithUsers_200_OK(TestInfo test) throws HttpResponseException {
    // Add team to user relationships while creating a team
    User user1 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 1),
            TestUtils.authHeaders("test@getcollate.com"));
    User user2 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 2),
            TestUtils.authHeaders("test@getcollate.com"));
    List<UUID> users = Arrays.asList(user1.getId(), user2.getId());
    CreateTeam create = create(test).withDisplayName("displayName").withDescription("description")
            .withProfile(PROFILE).withUsers(users);
    Team team = createAndCheckTeam(create, TestUtils.authHeaders("admin@getcollate.com"));

    // Make sure the user entity has relationship to the team
    user1 = SecureUserResourceTest.getUser(user1.getId(), "teams", TestUtils.authHeaders("test@getcollate.com"));
    assertEquals(team.getId(), user1.getTeams().get(0).getId());
    user2 = SecureUserResourceTest.getUser(user2.getId(), "teams", TestUtils.authHeaders("test@getcollate.com"));
    assertEquals(team.getId(), user2.getTeams().get(0).getId());
  }

  @Test
  public void get_teamWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    User user1 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 1),
            TestUtils.authHeaders("test@getcollate.com"));
    List<UUID> users = Collections.singletonList(user1.getId());

    CreateTeam create = create(test).withDisplayName("displayName").withDescription("description")
            .withProfile(PROFILE).withUsers(users);
    Team team = createTeam(create, TestUtils.authHeaders("admin@getcollate.com"));
    validateGetWithDifferentFields(team, false, TestUtils.authHeaders("admin@getcollate.com"));
  }

  /**
   * @see TableResourceTest#put_addDeleteFollower_200
   * for tests related getting team with entities owned by the team
   */

  @Test
  public void delete_validTeam_as_non_admin_401(TestInfo test) throws HttpResponseException {
    User user1 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 1),
            TestUtils.authHeaders("test@getcollate.com"));
    List<UUID> users = Collections.singletonList(user1.getId());
    CreateTeam create = create(test).withUsers(users);
    Team team = createAndCheckTeam(create, TestUtils.authHeaders("admin@getcollate.com"));
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteTeam(team.getId(), TestUtils.authHeaders("test@getcollate.com")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void patch_teamAttributes_as_admin_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create table without any attributes
    Team team = createTeam(create(test), TestUtils.authHeaders("admin@getcollate.com"));
    assertNull(team.getDisplayName());
    assertNull(team.getDescription());
    assertNull(team.getProfile());
    assertNull(team.getDeleted());
    assertNull(team.getUsers());

    User user1 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 1), TestUtils.authHeaders("test@getcollate.com"));
    User user2 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 2), TestUtils.authHeaders("test@getcollate.com"));
    User user3 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 3), TestUtils.authHeaders("test@getcollate.com"));

    List<User> users = Arrays.asList(user1, user2);
    Profile profile = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

    // Add previously absent attributes
    team = patchTeamAttributesAndCheck(team, "displayName", "description", profile, users,
            TestUtils.authHeaders("admin@getcollate.com"));

    // Replace the attributes
    users = Arrays.asList(user1, user3); // user2 dropped and user3 is added
    profile = new Profile().withImages(new ImageList().withImage(URI.create("http://image1.com")));
    team = patchTeamAttributesAndCheck(team, "displayName1", "description1", profile, users,
            TestUtils.authHeaders("admin@getcollate.com"));

    // Remove the attributes
    patchTeamAttributesAndCheck(team, null, null, null, null,
            TestUtils.authHeaders("admin@getcollate.com"));
  }

  @Test
  public void patch_teamAttributes_as_non_admin_401(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create table without any attributes
    Team team = createTeam(create(test), TestUtils.authHeaders("admin@getcollate.com"));
    assertNull(team.getDisplayName());
    assertNull(team.getDescription());
    assertNull(team.getProfile());
    assertNull(team.getDeleted());
    assertNull(team.getUsers());

    User user1 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 1), TestUtils.authHeaders("test@getcollate.com"));
    User user2 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 2), TestUtils.authHeaders("test@getcollate.com"));
    User user3 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 3), TestUtils.authHeaders("test@getcollate.com"));

    List<User> users = Arrays.asList(user1, user2);
    Profile profile = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchTeamAttributesAndCheck(team, "displayName", "description", profile, users,
                    TestUtils.authHeaders("test@getcollate.com")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }
//  @Test
//  public void patch_updateInvalidUsers_404_notFound(TestInfo test) throws HttpResponseException {
//    CreateTeam create = create(test);
//    Team team = createAndCheckTeam(create);
//
//    // User patch to add team to user relationship to an invalid user
//    List<UUID> users = Collections.singletonList(UUID.randomUUID() /* invalid userId */);
//    UpdateTeam update = new UpdateTeam().withUsers(users);
//    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> updateTeam(team.getId(), update));
//    assertEquals(Response.Status.NOT_FOUND.getStatusCode(), exception.getStatusCode());
//  }

  public static Team createAndCheckTeam(CreateTeam create, Map<String, String> authHeaders) throws HttpResponseException {
    Team team = createTeam(create, authHeaders);
    List<User> expectedUsers = new ArrayList<>();
    for (UUID teamId : Optional.ofNullable(create.getUsers()).orElse(Collections.emptyList())) {
      expectedUsers.add(new User().withId(teamId));
    }
    assertEquals(team.getName(), create.getName());
    validateTeam(team, create.getDescription(), create.getDisplayName(), create.getProfile(), expectedUsers);

    // Get the newly created team and validate it
    Team getTeam = getTeam(team.getId(), "profile,users", authHeaders);
    assertEquals(team.getName(), create.getName());
    validateTeam(getTeam, create.getDescription(), create.getDisplayName(), create.getProfile(), expectedUsers);
    return team;
  }

  public static Team createTeam(CreateTeam create, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(SecureCatalogApplicationTest.getResource("teams"), create, Team.class, authHeaders);
  }

  public static Team getTeam(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    return getTeam(id, null, authHeaders);
  }

  public static Team getTeam(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("teams/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Team.class, authHeaders);
  }

  public static Team getTeamByName(String name, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("teams/name/" + name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Team.class, authHeaders);
  }

  private static void validateTeam(Team team, String expectedDescription, String expectedDisplayName,
                                   Profile expectedProfile, List<User> expectedUsers) {
    assertNotNull(team.getId());
    assertNotNull(team.getHref());
    assertEquals(expectedDescription, team.getDescription());
    assertEquals(expectedDisplayName, team.getDisplayName());
    assertEquals(expectedProfile, team.getProfile());
    if (expectedUsers != null && !expectedUsers.isEmpty()) {
      assertEquals(expectedUsers.size(), team.getUsers().size());
      for (EntityReference user : team.getUsers()) {
        TestUtils.validateEntityReference(user);
        boolean foundUser = false;
        for (User expected : expectedUsers) {
          if (expected.getId().equals(user.getId())) {
            foundUser = true;
            break;
          }
        }
        assertTrue(foundUser);
      }
    }
    TestUtils.validateEntityReference(team.getOwns());
  }

  /** Validate returned fields GET .../teams/{id}?fields="..." or GET .../teams/name/{name}?fields="..." */
  private void validateGetWithDifferentFields(Team team, boolean byName, Map<String, String> authHeaders)
          throws HttpResponseException {
    // .../teams?fields=profile
    String fields = "profile";
    team = byName ? getTeamByName(team.getName(), fields, authHeaders) : getTeam(team.getId(), fields, authHeaders);
    assertNotNull(team.getProfile());
    assertNull(team.getUsers());

    // .../teams?fields=profile,users
    fields = "profile,users";
    team = byName ? getTeamByName(team.getName(), fields, authHeaders) : getTeam(team.getId(), fields, authHeaders);
    assertNotNull(team.getProfile());
    assertNotNull(team.getUsers());
  }

  private Team patchTeam(UUID teamId, String originalJson, Team updated, Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updatedJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updatedJson);
    return TestUtils.patch(SecureCatalogApplicationTest.getResource("teams/" + teamId), patch, Team.class, authHeaders);
  }
  private Team patchTeam(String originalJson, Team updated, Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    return patchTeam(updated.getId(), originalJson, updated, authHeaders);
  }

  private Team patchTeamAttributesAndCheck(Team team, String displayName, String description, Profile profile,
                                           List<User> users, Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    Optional.ofNullable(team.getUsers()).orElse(Collections.emptyList()).forEach(t -> t.setHref(null)); // Remove href
    String tableJson = JsonUtils.pojoToJson(team);

    // Update the table attributes
    team.setDisplayName(displayName);
    team.setDescription(description);
    team.setProfile(profile);
    team.setUsers(TeamRepository.toEntityReference(users));

    // Validate information returned in patch response has the updates
    Team updatedTeam = patchTeam(tableJson, team, authHeaders);
    validateTeam(updatedTeam, description, displayName, profile, users);

    // GET the table and Validate information returned
    Team getTeam = getTeam(team.getId(), "users,profile", authHeaders);
    validateTeam(getTeam, description, displayName, profile, users);
    return  getTeam;
  }

  public void deleteTeam(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(SecureCatalogApplicationTest.getResource("teams/" + id), authHeaders);
  }

  public static CreateTeam create(TestInfo test, int index) {
    return new CreateTeam().withName(getTeamName(test) + index);
  }

  public static CreateTeam create(TestInfo test) {
    return new CreateTeam().withName(getTeamName(test));
  }

  public static String getTeamName(TestInfo test) {
    return String.format("team_%s", test.getDisplayName());
  }

  public static String getTeamName(TestInfo test, int index) {
    return String.format("team%d_%s", index, test.getDisplayName());
  }
}
