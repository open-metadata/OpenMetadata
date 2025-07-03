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
    supportsOwners = false;
    supportsAdminOnly = true;
  }

  public void setupPersonas(TestInfo test) throws HttpResponseException {
    CreatePersona createPersona = createRequest(test, 1).withName("Data Scientist");
    DATA_SCIENTIST = createEntity(createPersona, ADMIN_AUTH_HEADERS);

    createPersona = createRequest(test, 11).withName("Data Engineer");
    DATA_ENGINEER = createEntity(createPersona, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_validPersonas_as_admin_200_OK(TestInfo test) throws IOException {
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
  void test_defaultPersona_POST_PUT_PATCH(TestInfo test) throws IOException {
    // Test 1: Create a persona with default=true
    CreatePersona create1 = createRequest(test, 1).withName("DataScientist").withDefault(true);
    Persona persona1 = createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);
    assertTrue(persona1.getDefault());

    // Test 2: Create another persona with default=true, should unset the previous default
    CreatePersona create2 = createRequest(test, 2).withName("DataEngineer").withDefault(true);
    Persona persona2 = createAndCheckEntity(create2, ADMIN_AUTH_HEADERS);
    assertTrue(persona2.getDefault());

    // Verify persona1 is no longer default
    persona1 = getEntity(persona1.getId(), ADMIN_AUTH_HEADERS);
    assertFalse(persona1.getDefault());

    // Test 3: Create a third persona without default flag
    CreatePersona create3 = createRequest(test, 3).withName("DataAnalyst");
    Persona persona3 = createAndCheckEntity(create3, ADMIN_AUTH_HEADERS);
    assertFalse(persona3.getDefault());

    // Test 4: Update persona3 to be default using PUT
    persona3.setDefault(true);
    ChangeDescription change = getChangeDescription(persona3, MINOR_UPDATE);
    fieldUpdated(change, "default", false, true);
    persona3 =
        updateAndCheckEntity(
            create3.withDefault(true), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertTrue(persona3.getDefault());

    // Verify persona2 is no longer default
    persona2 = getEntity(persona2.getId(), ADMIN_AUTH_HEADERS);
    assertFalse(persona2.getDefault());

    // Test 5: PATCH persona1 to be default
    String originalJson = JsonUtils.pojoToJson(persona1);
    persona1.setDefault(true);
    change = getChangeDescription(persona1, MINOR_UPDATE);
    fieldUpdated(change, "default", false, true);
    persona1 =
        patchEntityAndCheck(persona1, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertTrue(persona1.getDefault());

    // Verify persona3 is no longer default
    persona3 = getEntity(persona3.getId(), ADMIN_AUTH_HEADERS);
    assertFalse(persona3.getDefault());

    // Test 6: PATCH to unset default from persona1
    originalJson = JsonUtils.pojoToJson(persona1);
    persona1.setDefault(false);
    change = getChangeDescription(persona1, MINOR_UPDATE);
    fieldUpdated(change, "default", true, false);
    persona1 =
        patchEntityAndCheck(persona1, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertFalse(persona1.getDefault());

    // Verify no personas have default=true now
    List<Persona> allPersonas = listEntities(null, ADMIN_AUTH_HEADERS).getData();
    for (Persona persona : allPersonas) {
      if (persona.getName().startsWith(getEntityName(test))) {
        assertFalse(persona.getDefault());
      }
    }
  }

  @Test
  void test_systemDefaultPersonaForUsers(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();

    // Test 1: Create a default persona
    CreatePersona createDefaultPersona =
        createRequest(test, 1).withName("DefaultPersona").withDefault(true);
    Persona defaultPersona = createAndCheckEntity(createDefaultPersona, ADMIN_AUTH_HEADERS);
    assertTrue(defaultPersona.getDefault());

    // Test 2: Create a user without any persona
    User user1 =
        userResourceTest.createEntity(userResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);

    // Test 3: Query user with defaultPersona field - should return system default
    user1 = userResourceTest.getEntity(user1.getId(), "defaultPersona", ADMIN_AUTH_HEADERS);
    assertNotNull(user1.getDefaultPersona());
    assertEquals(defaultPersona.getId(), user1.getDefaultPersona().getId());
    assertEquals(defaultPersona.getName(), user1.getDefaultPersona().getName());

    // Test 4: Create another persona (non-default)
    CreatePersona createPersona2 = createRequest(test, 2).withName("DataScientist_test");
    Persona persona2 = createAndCheckEntity(createPersona2, ADMIN_AUTH_HEADERS);
    assertFalse(persona2.getDefault());

    // Test 5: Assign persona2 to user1 and set it as user's default
    // First, get a fresh copy of user1 without the defaultPersona field
    User userToUpdate = userResourceTest.getEntity(user1.getId(), "personas", ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(userToUpdate);
    userToUpdate.setPersonas(List.of(persona2.getEntityReference()));
    userToUpdate.setDefaultPersona(persona2.getEntityReference());
    ChangeDescription change = getChangeDescription(userToUpdate, MINOR_UPDATE);
    fieldAdded(change, "personas", List.of(persona2.getEntityReference()));
    fieldAdded(change, "defaultPersona", persona2.getEntityReference());
    user1 =
        userResourceTest.patchEntityAndCheck(
            userToUpdate, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Test 6: Query user with defaultPersona - should now return user's own default, not system
    // default
    user1 = userResourceTest.getEntity(user1.getId(), "defaultPersona", ADMIN_AUTH_HEADERS);
    assertNotNull(user1.getDefaultPersona());
    assertEquals(persona2.getId(), user1.getDefaultPersona().getId());
    assertEquals(persona2.getName(), user1.getDefaultPersona().getName());

    // Test 7: Create a new system default persona
    CreatePersona createNewDefault =
        createRequest(test, 3).withName("NewDefaultPersona").withDefault(true);
    Persona newDefaultPersona = createAndCheckEntity(createNewDefault, ADMIN_AUTH_HEADERS);
    assertTrue(newDefaultPersona.getDefault());

    // Test 8: Create a new user and verify they get the new system default
    User user2 =
        userResourceTest.createEntity(userResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS);
    user2 = userResourceTest.getEntity(user2.getId(), "defaultPersona", ADMIN_AUTH_HEADERS);
    assertNotNull(user2.getDefaultPersona());
    assertEquals(newDefaultPersona.getId(), user2.getDefaultPersona().getId());

    // Test 9: User1 should still have their own default persona (not affected by system default
    // change)
    user1 = userResourceTest.getEntity(user1.getId(), "defaultPersona", ADMIN_AUTH_HEADERS);
    assertNotNull(user1.getDefaultPersona());
    assertEquals(persona2.getId(), user1.getDefaultPersona().getId());
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
        "Principal: CatalogPrincipal{name='test'} is not admin");
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

    // Validate default field - it should always exist
    assertEquals(
        Boolean.TRUE.equals(createRequest.getDefault()), Boolean.TRUE.equals(persona.getDefault()));
  }

  @Override
  public void compareEntities(Persona expected, Persona updated, Map<String, String> authHeaders) {
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertEquals(expected.getDefault(), updated.getDefault());
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
    } else if ("default".equals(fieldName)) {
      Boolean expectedDefault = (Boolean) expected;
      Boolean actualDefault = (Boolean) actual;
      assertEquals(expectedDefault, actualDefault);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
