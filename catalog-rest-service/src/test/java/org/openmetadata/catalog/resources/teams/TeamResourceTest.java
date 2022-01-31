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
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.validateEntityReference;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
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
public class TeamResourceTest extends EntityResourceTest<Team, CreateTeam> {
  final Profile PROFILE = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

  public TeamResourceTest() {
    super(Entity.TEAM, Team.class, TeamList.class, "teams", TeamResource.FIELDS, false, false, false, false);
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
  void post_teamWithUsers_200_OK(TestInfo test) throws IOException {
    // Add team to user relationships while creating a team
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = userResourceTest.createEntity(userResourceTest.createRequest(test, 1), TEST_AUTH_HEADERS);
    User user2 = userResourceTest.createEntity(userResourceTest.createRequest(test, 2), TEST_AUTH_HEADERS);
    List<UUID> users = Arrays.asList(user1.getId(), user2.getId());
    CreateTeam create =
        createRequest(test)
            .withDisplayName("displayName")
            .withDescription("description")
            .withProfile(PROFILE)
            .withUsers(users);
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Make sure the user entity has relationship to the team
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
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> getEntity(team.getId(), "test", ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidField("test"));

    // .../teams?fields=invalidField
    exception =
        assertThrows(HttpResponseException.class, () -> getEntity(team.getId(), "invalidField", ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidField("invalidField"));
  }

  /**
   * @see EntityResourceTest put_addDeleteFollower_200 for tests related getting team with entities owned by the team
   */
  @Test
  void delete_validTeam_200_OK(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = userResourceTest.createEntity(userResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    List<UUID> users = Collections.singletonList(user1.getId());
    CreateTeam create = createRequest(test).withUsers(users);
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Team with users can be deleted - Team -- has --> User relationships are deleted
    deleteAndCheckEntity(team, ADMIN_AUTH_HEADERS);

    // Make sure user does not have relationship to this team
    User user = userResourceTest.getEntity(user1.getId(), "teams", ADMIN_AUTH_HEADERS);
    assertTrue(user.getTeams().isEmpty());
  }

  @Test
  void patch_teamAttributes_as_non_admin_403(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create table without any attributes
    Team team = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // Patching as a non-admin should is disallowed
    String originalJson = JsonUtils.pojoToJson(team);
    team.setDisplayName("newDisplayName");
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class, () -> patchEntity(team.getId(), originalJson, team, TEST_AUTH_HEADERS));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
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
    String updatedBy = TestUtils.getPrincipal(ADMIN_AUTH_HEADERS);
    // .../teams?fields=profile
    String fields = "profile";
    Team getTeam =
        byName
            ? getEntityByName(expectedTeam.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(expectedTeam.getId(), null, fields, ADMIN_AUTH_HEADERS);
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
            ? getEntityByName(expectedTeam.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(expectedTeam.getId(), fields, ADMIN_AUTH_HEADERS);
    assertNotNull(getTeam.getProfile());
    validateEntityReference(getTeam.getUsers());
    validateEntityReference(getTeam.getOwns());
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
  public void validateUpdatedEntity(Team updatedEntity, CreateTeam request, Map<String, String> authHeaders) {
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  @Override
  protected void validateDeletedEntity(
      CreateTeam create, Team teamBeforeDeletion, Team teamAfterDeletion, Map<String, String> authHeaders)
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
