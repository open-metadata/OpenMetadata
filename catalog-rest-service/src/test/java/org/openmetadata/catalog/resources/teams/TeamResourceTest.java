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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.resources.teams.UserResourceTest.createUser;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.validateEntityReference;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.locations.LocationResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResource.TeamList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.ImageList;
import org.openmetadata.catalog.type.Profile;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
public class TeamResourceTest extends EntityResourceTest<Team> {
  final Profile PROFILE = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

  public TeamResourceTest() {
    super(Entity.TEAM, Team.class, TeamList.class, "teams", TeamResource.FIELDS, false, false, false, false);
  }

  @Test
  void post_validTeams_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateTeam create = create(test, 1);
    createAndCheckEntity(create, adminAuthHeaders());

    create = create(test, 2).withDisplayName("displayName");
    createAndCheckEntity(create, adminAuthHeaders());

    create = create(test, 3).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());

    create = create(test, 4).withProfile(PROFILE);
    createAndCheckEntity(create, adminAuthHeaders());

    create = create(test, 5).withDisplayName("displayName").withDescription("description").withProfile(PROFILE);
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  void post_validTeams_as_non_admin_401(TestInfo test) {
    // Create team with different optional fields
    Map<String, String> authHeaders = authHeaders("test@open-metadata.org");
    CreateTeam create = create(test, 1);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createAndCheckEntity(create, authHeaders));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void post_teamWithUsers_200_OK(TestInfo test) throws IOException {
    // Add team to user relationships while creating a team
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = createUser(userResourceTest.create(test, 1), authHeaders("test@open-metadata.org"));
    User user2 = createUser(userResourceTest.create(test, 2), authHeaders("test@open-metadata.org"));
    List<UUID> users = Arrays.asList(user1.getId(), user2.getId());
    CreateTeam create =
        create(test)
            .withDisplayName("displayName")
            .withDescription("description")
            .withProfile(PROFILE)
            .withUsers(users);
    Team team = createAndCheckEntity(create, adminAuthHeaders());

    // Make sure the user entity has relationship to the team
    user1 = userResourceTest.getEntity(user1.getId(), "teams", authHeaders("test@open-metadata.org"));
    assertEquals(team.getId(), user1.getTeams().get(0).getId());
    user2 = userResourceTest.getEntity(user2.getId(), "teams", authHeaders("test@open-metadata.org"));
    assertEquals(team.getId(), user2.getTeams().get(0).getId());
  }

  @Test
  void get_teamWithInvalidFields_400_BadRequest(TestInfo test) throws HttpResponseException {
    CreateTeam create = create(test);
    Team team = createTeam(create, adminAuthHeaders());

    // Empty query field .../teams?fields=
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> getTeam(team.getId(), "test", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidField("test"));

    // .../teams?fields=invalidField
    exception =
        assertThrows(HttpResponseException.class, () -> getTeam(team.getId(), "invalidField", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidField("invalidField"));
  }

  /**
   * @see EntityResourceTest#put_addDeleteFollower_200 for tests related getting team with entities owned by the team
   */
  @Test
  void delete_validTeam_200_OK(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = createUser(userResourceTest.create(test, 1), adminAuthHeaders());
    List<UUID> users = Collections.singletonList(user1.getId());
    CreateTeam create = create(test).withUsers(users);
    Team team = createAndCheckEntity(create, adminAuthHeaders());

    // Team with users can be deleted - Team -- has --> User relationships are deleted
    deleteAndCheckEntity(team, adminAuthHeaders());

    // Make sure user does not have relationship to this team
    User user = userResourceTest.getEntity(user1.getId(), "teams", adminAuthHeaders());
    assertTrue(user.getTeams().isEmpty());
  }

  //  @Test
  //  public void patch_teamAttributes_as_admin_200_ok(TestInfo test)
  //          throws HttpResponseException, JsonProcessingException {
  //    //
  //    // Create table without any attributes
  //    //
  //    Team team = createTeam(create(test), adminAuthHeaders());
  //    assertNull(team.getDisplayName());
  //    assertNull(team.getDescription());
  //    assertNull(team.getProfile());
  //    assertNull(team.getDeleted());
  //    assertNull(team.getUsers());
  //
  //    User user1 = createUser(UserResourceTest.create(test, 1), authHeaders("test@open-metadata.org"));
  //    User user2 = createUser(UserResourceTest.create(test, 2), authHeaders("test@open-metadata.org"));
  //    User user3 = createUser(UserResourceTest.create(test, 3), authHeaders("test@open-metadata.org"));
  //
  //    List<EntityReference> users = Arrays.asList(new UserEntityInterface(user1).getEntityReference(),
  //            new UserEntityInterface(user2).getEntityReference());
  //    Profile profile = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));
  //
  //    //
  //    // Add previously absent attributes
  //    //
  //    String originalJson = JsonUtils.pojoToJson(team);
  //    team.withDisplayName("displayName").withDescription("description").withProfile(profile).withUsers(users);
  //    ChangeDescription change = getChangeDescription(team.getVersion())
  //            .withFieldsAdded(Arrays.asList("displayName", "description", "profile", "users"));
  //    team = patchEntityAndCheck(team, originalJson, adminAuthHeaders(), MINOR_UPDATE, change);
  //
  //    //
  //    // Replace the attributes
  //    //
  //    users = Arrays.asList(new UserEntityInterface(user1).getEntityReference(),
  //            new UserEntityInterface(user3).getEntityReference()); // user2 dropped and user3 is added
  //    profile = new Profile().withImages(new ImageList().withImage(URI.create("http://image1.com")));
  //
  //    originalJson = JsonUtils.pojoToJson(team);
  //    team.withDisplayName("displayName1").withDescription("description1").withProfile(profile).withUsers(users);
  //    change = getChangeDescription(team.getVersion())
  //            .withFieldsUpdated(Arrays.asList("displayName", "description", "profile", "users"));
  //    team = patchEntityAndCheck(team, originalJson, adminAuthHeaders(), MINOR_UPDATE, change);
  //
  //    // Remove the attributes
  //    originalJson = JsonUtils.pojoToJson(team);
  //    team.withDisplayName(null).withDescription(null).withProfile(null).withUsers(null);
  //    change = getChangeDescription(team.getVersion())
  //            .withFieldsDeleted(Arrays.asList("displayName", "description", "profile", "users"));
  //    patchEntityAndCheck(team, originalJson, adminAuthHeaders(), MINOR_UPDATE, change);
  //  }

  @Test
  void patch_teamAttributes_as_non_admin_403(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create table without any attributes
    Team team = createTeam(create(test), adminAuthHeaders());
    // Patching as a non-admin should is disallowed
    String originalJson = JsonUtils.pojoToJson(team);
    team.setDisplayName("newDisplayName");
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> patchTeam(team.getId(), originalJson, team, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  public static Team createTeam(CreateTeam create, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("teams"), create, Team.class, authHeaders);
  }

  public static Team getTeam(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("teams/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Team.class, authHeaders);
  }

  public static Team getTeamByName(String name, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("teams/name/" + name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Team.class, authHeaders);
  }

  private static void validateTeam(
      Team team,
      String expectedDescription,
      String expectedDisplayName,
      Profile expectedProfile,
      List<EntityReference> expectedUsers,
      String expectedUpdatedBy) {
    assertListNotNull(team.getId(), team.getHref());
    assertEquals(expectedDescription, team.getDescription());
    assertEquals(expectedUpdatedBy, team.getUpdatedBy());
    assertEquals(expectedDisplayName, team.getDisplayName());
    assertEquals(expectedProfile, team.getProfile());
    if (expectedUsers != null && !expectedUsers.isEmpty()) {
      assertEquals(expectedUsers.size(), team.getUsers().size());
      for (EntityReference user : team.getUsers()) {
        TestUtils.validateEntityReference(user);
        TestUtils.existsInEntityReferenceList(expectedUsers, user.getId(), true);
      }
    }
    TestUtils.validateEntityReference(team.getOwns());
  }

  /** Validate returned fields GET .../teams/{id}?fields="..." or GET .../teams/name/{name}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Team expectedTeam, boolean byName) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(adminAuthHeaders());
    // .../teams?fields=profile
    String fields = "profile";
    Team getTeam =
        byName
            ? getTeamByName(expectedTeam.getName(), fields, adminAuthHeaders())
            : getTeam(expectedTeam.getId(), fields, adminAuthHeaders());
    validateTeam(
        getTeam,
        expectedTeam.getDescription(),
        expectedTeam.getDisplayName(),
        expectedTeam.getProfile(),
        null,
        updatedBy);
    assertNull(getTeam.getOwns());

    // .../teams?fields=users,owns
    fields = "users,owns,profile";
    getTeam =
        byName
            ? getTeamByName(expectedTeam.getName(), fields, adminAuthHeaders())
            : getTeam(expectedTeam.getId(), fields, adminAuthHeaders());
    assertNotNull(getTeam.getProfile());
    validateEntityReference(getTeam.getUsers());
    validateEntityReference(getTeam.getOwns());
  }

  private Team patchTeam(UUID teamId, String originalJson, Team updated, Map<String, String> authHeaders)
      throws JsonProcessingException, HttpResponseException {
    String updatedJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
    return TestUtils.patch(CatalogApplicationTest.getResource("teams/" + teamId), patch, Team.class, authHeaders);
  }

  private Team patchTeam(String originalJson, Team updated, Map<String, String> authHeaders)
      throws JsonProcessingException, HttpResponseException {
    return patchTeam(updated.getId(), originalJson, updated, authHeaders);
  }

  CreateTeam create(TestInfo test, int index) {
    return new CreateTeam().withName(getEntityName(test) + index);
  }

  public CreateTeam create(TestInfo test) {
    return create(getEntityName(test));
  }

  public CreateTeam create(String entityName) {
    return new CreateTeam().withName(entityName);
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name)
        .withDescription(description)
        .withDisplayName(displayName)
        .withProfile(PROFILE)
        .withUsers(List.of(USER1.getId()));
  }

  @Override
  public Team beforeDeletion(TestInfo test, Team team) throws HttpResponseException {
    LocationResourceTest locationResourceTest = new LocationResourceTest();
    EntityReference teamRef = new EntityReference().withId(team.getId()).withType("team");
    locationResourceTest.createEntity(
        locationResourceTest.createRequest(getEntityName(test), null, null, teamRef), adminAuthHeaders());
    return team;
  }

  @Override
  public EntityReference getContainer(Object createRequest) throws URISyntaxException {
    return null; // No container entity
  }

  @Override
  public void validateCreatedEntity(Team team, Object request, Map<String, String> authHeaders) {
    CreateTeam createRequest = (CreateTeam) request;
    validateCommonEntityFields(
        getEntityInterface(team), createRequest.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    assertEquals(createRequest.getDisplayName(), team.getDisplayName());
    assertEquals(createRequest.getProfile(), team.getProfile());

    List<EntityReference> expectedUsers = new ArrayList<>();
    for (UUID teamId : Optional.ofNullable(createRequest.getUsers()).orElse(Collections.emptyList())) {
      expectedUsers.add(new EntityReference().withId(teamId).withType(Entity.USER));
    }
    List<EntityReference> actualUsers = Optional.ofNullable(team.getUsers()).orElse(Collections.emptyList());
    if (!expectedUsers.isEmpty()) {
      assertEquals(expectedUsers.size(), actualUsers.size());
      for (EntityReference user : expectedUsers) {
        TestUtils.existsInEntityReferenceList(actualUsers, user.getId(), true);
      }
    }
    TestUtils.validateEntityReference(team.getOwns());
  }

  @Override
  public void validateUpdatedEntity(Team updatedEntity, Object request, Map<String, String> authHeaders) {
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  @Override
  protected void validateDeletedEntity(
      Object create, Team teamBeforeDeletion, Team teamAfterDeletion, Map<String, String> authHeaders)
      throws HttpResponseException {
    super.validateDeletedEntity(create, teamBeforeDeletion, teamAfterDeletion, authHeaders);

    List<EntityReference> expectedOwnedEntities = new ArrayList<>();
    for (EntityReference ref : Optional.ofNullable(teamBeforeDeletion.getOwns()).orElse(Collections.emptyList())) {
      expectedOwnedEntities.add(new EntityReference().withId(ref.getId()).withType(Entity.TABLE));
    }
    if (!expectedOwnedEntities.isEmpty()) {
      assertEquals(expectedOwnedEntities.size(), teamAfterDeletion.getOwns().size());
      for (EntityReference ref : expectedOwnedEntities) {
        TestUtils.existsInEntityReferenceList(teamAfterDeletion.getOwns(), ref.getId(), true);
      }
    }
  }

  @Override
  public void compareEntities(Team expected, Team updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(updated), expected.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertEquals(expected.getProfile(), updated.getProfile());

    List<EntityReference> expectedUsers = Optional.ofNullable(expected.getUsers()).orElse(Collections.emptyList());
    List<EntityReference> actualUsers = Optional.ofNullable(updated.getUsers()).orElse(Collections.emptyList());
    actualUsers.forEach(TestUtils::validateEntityReference);
    actualUsers.forEach(user -> user.setHref(null));
    expectedUsers.forEach(user -> user.setHref(null));

    actualUsers.sort(EntityUtil.compareEntityReference);
    expectedUsers.sort(EntityUtil.compareEntityReference);
    assertEquals(expectedUsers, actualUsers);
    TestUtils.validateEntityReference(updated.getOwns());
  }

  @Override
  public EntityInterface<Team> getEntityInterface(Team entity) {
    return new TeamEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
