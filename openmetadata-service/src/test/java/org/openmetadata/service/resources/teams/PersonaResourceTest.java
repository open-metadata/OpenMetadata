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

import static jakarta.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.*;
import static org.openmetadata.service.exception.CatalogExceptionMessage.*;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.util.EntityUtil.*;
import static org.openmetadata.service.util.TestUtils.*;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;

import java.io.IOException;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.*;
import org.openmetadata.schema.type.*;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class PersonaResourceTest extends EntityResourceTest<Persona, CreatePersona> {
  public PersonaResourceTest() {
    super(
        PERSONA,
        Persona.class,
        PersonaResource.PersonaList.class,
        "personas",
        PersonaResource.FIELDS);
    supportsSearchIndex = false;
  }

  public void setupPersonas(TestInfo test) throws HttpResponseException {
    CreatePersona createPersona = createRequest(test, 1).withName("Data Scientist");
    DATA_SCIENTIST = createEntity(createPersona, ADMIN_AUTH_HEADERS);

    createPersona = createRequest(test, 11).withName("Data Engineer");
    DATA_ENGINEER = createEntity(createPersona, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_validPersonas_as_admin_200_OK(TestInfo test) throws IOException {
    // Create Persona with different optional fields
    CreatePersona create = createRequest(test, 1);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 2).withDisplayName("displayName");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 3).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 4);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 5).withDisplayName("displayName").withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_teamWithUsersAndDefaultRoles_200_OK(TestInfo test) throws IOException {
    // Add team to user relationships while creating a team
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 =
        userResourceTest.createEntity(
            userResourceTest.createRequest(test, 1), USER_WITH_CREATE_HEADERS);
    User user2 =
        userResourceTest.createEntity(
            userResourceTest.createRequest(test, 2), USER_WITH_CREATE_HEADERS);
    List<UUID> users = Arrays.asList(user1.getId(), user2.getId());

    CreatePersona create =
        createRequest(test)
            .withDisplayName("displayName")
            .withDescription("description")
            .withUsers(users);

    Persona persona = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Ensure that the user entity has relationship to the team
    user1 = userResourceTest.getEntity(user1.getId(), "personas", TEST_AUTH_HEADERS);
    assertEntityReferences(List.of(persona.getEntityReference()), user1.getPersonas());
    user2 = userResourceTest.getEntity(user2.getId(), "personas", TEST_AUTH_HEADERS);
    assertEntityReferences(List.of(persona.getEntityReference()), user2.getPersonas());
  }

  @Test
  void delete_validPersona_200_OK(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 =
        userResourceTest.createEntity(userResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    List<UUID> users = Collections.singletonList(user1.getId());

    CreatePersona create = createRequest(test).withUsers(users);
    Persona persona = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Team with users and defaultRoles can be deleted
    // Team -- has --> User relationships are deleted
    deleteAndCheckEntity(persona, ADMIN_AUTH_HEADERS);

    // Ensure that the user does not have relationship to this persona
    User user = userResourceTest.getEntity(user1.getId(), "personas", ADMIN_AUTH_HEADERS);
    assertEquals(0, user.getPersonas().size());
  }

  @Test
  void patch_teamAttributes_as_non_admin_403(TestInfo test) throws HttpResponseException {
    // Create team without any attributes
    Persona persona = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // Patching as a non-admin should be disallowed
    String originalJson = JsonUtils.pojoToJson(persona);
    persona.setDisplayName("newDisplayName");
    assertResponse(
        () -> patchEntity(persona.getId(), originalJson, persona, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.EDIT_DISPLAY_NAME)));
  }

  @Test
  void patch_personaUsers_as_user_with_UpdatePersona_permission(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    List<EntityReference> userRefs = new ArrayList<>();
    for (int i = 0; i < 7; i++) {
      User user =
          userResourceTest.createEntity(
              userResourceTest.createRequest(test, i), ADMIN_AUTH_HEADERS);
      userRefs.add(user.getEntityReference());
    }

    Persona persona = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(persona);
    persona.setUsers(userRefs);

    // Ensure user without UpdatePersona permission cannot add users to a Persona.
    String randomUserName = userRefs.get(0).getName();
    assertResponse(
        () ->
            patchEntity(
                persona.getId(),
                originalJson,
                persona,
                SecurityUtil.authHeaders(randomUserName + "@open-metadata.org")),
        FORBIDDEN,
        permissionNotAllowed(randomUserName, List.of(MetadataOperation.EDIT_USERS)));

    // Ensure user with UpdateTeam permission can add users to a team.
    ChangeDescription change = getChangeDescription(persona, MINOR_UPDATE);
    fieldAdded(change, "users", userRefs);
    patchEntityAndCheck(persona, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void patch_deleteUserFromPersona_200(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    final int totalUsers = 20;
    ArrayList<UUID> users = new ArrayList<>();
    for (int i = 0; i < totalUsers; i++) {
      User user =
          userResourceTest.createEntity(
              userResourceTest.createRequest(test, i), ADMIN_AUTH_HEADERS);
      users.add(user.getId());
    }

    CreatePersona create =
        createRequest(getEntityName(test), "description", "displayName", null).withUsers(users);

    Persona persona = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Remove a user from the Persona using patch request
    String json = JsonUtils.pojoToJson(persona);
    int removeUserIndex = new Random().nextInt(totalUsers);
    EntityReference deletedUser = persona.getUsers().get(removeUserIndex);
    persona.getUsers().remove(removeUserIndex);
    ChangeDescription change = getChangeDescription(persona, MINOR_UPDATE);
    fieldDeleted(change, "users", CommonUtil.listOf(deletedUser));
    patchEntityAndCheck(persona, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  private static void validatePersona(
      Persona persona,
      String expectedDescription,
      String expectedDisplayName,
      List<EntityReference> expectedUsers,
      String expectedUpdatedBy) {
    assertListNotNull(persona.getId(), persona.getHref());
    assertEquals(expectedDescription, persona.getDescription());
    assertEquals(expectedUpdatedBy, persona.getUpdatedBy());
    assertEquals(expectedDisplayName, persona.getDisplayName());
    TestUtils.assertEntityReferences(expectedUsers, persona.getUsers());
  }

  @Override
  public Persona validateGetWithDifferentFields(Persona expectedPersona, boolean byName)
      throws HttpResponseException {
    if (nullOrEmpty(expectedPersona.getUsers())) {
      UserResourceTest userResourceTest = new UserResourceTest();
      CreateUser create =
          userResourceTest
              .createRequest("user", "", "", null)
              .withPersonas(List.of(expectedPersona.getEntityReference()));
      userResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    }

    String updatedBy = getPrincipalName(ADMIN_AUTH_HEADERS);
    String fields = "";
    Persona getPersona =
        byName
            ? getEntityByName(expectedPersona.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(expectedPersona.getId(), null, fields, ADMIN_AUTH_HEADERS);
    validatePersona(
        getPersona,
        expectedPersona.getDescription(),
        expectedPersona.getDisplayName(),
        Collections.emptyList(),
        updatedBy);
    fields = "users";
    getPersona =
        byName
            ? getEntityByName(expectedPersona.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(expectedPersona.getId(), fields, ADMIN_AUTH_HEADERS);
    validateEntityReferences(getPersona.getUsers(), true);
    return getPersona;
  }

  @Override
  public CreatePersona createRequest(String name) {
    return new CreatePersona().withName(name);
  }

  @Override
  public void validateCreatedEntity(
      Persona persona, CreatePersona createRequest, Map<String, String> authHeaders) {
    List<EntityReference> expectedUsers = new ArrayList<>();
    for (UUID userId : listOrEmpty(createRequest.getUsers())) {
      expectedUsers.add(new EntityReference().withId(userId).withType(Entity.USER));
    }
    expectedUsers = expectedUsers.isEmpty() ? null : expectedUsers;
    TestUtils.assertEntityReferences(expectedUsers, persona.getUsers());
  }

  @Override
  public void compareEntities(Persona expected, Persona updated, Map<String, String> authHeaders) {
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    List<EntityReference> expectedUsers = listOrEmpty(expected.getUsers());
    List<EntityReference> actualUsers = listOrEmpty(updated.getUsers());
    TestUtils.assertEntityReferences(expectedUsers, actualUsers);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if ("users".equals(fieldName)) {
      assertEntityReferencesFieldChange(expected, actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
