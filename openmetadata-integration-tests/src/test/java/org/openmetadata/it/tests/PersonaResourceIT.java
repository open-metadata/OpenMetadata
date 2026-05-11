package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Persona entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds persona-specific tests for user
 * assignments and default persona behavior.
 *
 * <p>Migrated from: org.openmetadata.service.resources.teams.PersonaResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class PersonaResourceIT extends BaseEntityIT<Persona, CreatePersona> {

  // Persona has special characteristics
  {
    supportsOwners = false;
    supportsFollowers = false;
    supportsTags = false;
    supportsSoftDelete = false; // Persona uses hard delete
    supportsDomains = false;
    supportsDataProducts = false;
    supportsSearchIndex = false; // Persona doesn't have a search index
    supportsListHistoryByTimestamp = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreatePersona createMinimalRequest(TestNamespace ns) {
    return new CreatePersona()
        .withName(ns.prefix("persona"))
        .withDescription("Test persona created by integration test");
  }

  @Override
  protected CreatePersona createRequest(String name, TestNamespace ns) {
    return new CreatePersona().withName(name).withDescription("Test persona");
  }

  @Override
  protected Persona createEntity(CreatePersona createRequest) {
    return SdkClients.adminClient().personas().create(createRequest);
  }

  @Override
  protected Persona getEntity(String id) {
    return SdkClients.adminClient().personas().get(id);
  }

  @Override
  protected Persona getEntityByName(String fqn) {
    return SdkClients.adminClient().personas().getByName(fqn);
  }

  @Override
  protected Persona patchEntity(String id, Persona entity) {
    return SdkClients.adminClient().personas().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().personas().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().personas().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().personas().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "persona";
  }

  @Override
  protected void validateCreatedEntity(Persona entity, CreatePersona createRequest) {
    assertEquals(createRequest.getName(), entity.getName());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<Persona> listEntities(ListParams params) {
    return SdkClients.adminClient().personas().list(params);
  }

  @Override
  protected Persona getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().personas().get(id, fields);
  }

  @Override
  protected Persona getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().personas().getByName(fqn, fields);
  }

  @Override
  protected Persona getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().personas().get(id, "users", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().personas().getVersionList(id);
  }

  @Override
  protected Persona getVersion(UUID id, Double version) {
    return SdkClients.adminClient().personas().getVersion(id.toString(), version);
  }

  // ===================================================================
  // PERSONA-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_validPersona_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreatePersona request =
        new CreatePersona()
            .withName(ns.prefix("valid_persona"))
            .withDescription("Valid persona")
            .withDisplayName("Test Persona Display");

    Persona persona = createEntity(request);
    assertNotNull(persona);
    assertEquals("Test Persona Display", persona.getDisplayName());
  }

  @Test
  void post_personaWithUsers_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create test users
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    // Email must be well-formed - use simple alphanumeric format
    CreateUser userRequest1 =
        new CreateUser()
            .withName(ns.prefix("puser1_" + uniqueId))
            .withEmail("puser1" + uniqueId + "@test.com")
            .withDescription("Test user 1");
    User user1 = client.users().create(userRequest1);

    CreateUser userRequest2 =
        new CreateUser()
            .withName(ns.prefix("puser2_" + uniqueId))
            .withEmail("puser2" + uniqueId + "@test.com")
            .withDescription("Test user 2");
    User user2 = client.users().create(userRequest2);

    CreatePersona request =
        new CreatePersona()
            .withName(ns.prefix("persona_users"))
            .withDescription("Persona with users")
            .withUsers(Arrays.asList(user1.getId(), user2.getId()));

    Persona persona = createEntity(request);
    assertNotNull(persona);

    // Get persona with users field
    Persona fetched = getEntityWithFields(persona.getId().toString(), "users");
    assertNotNull(fetched.getUsers());
    assertEquals(2, fetched.getUsers().size());
  }

  @Test
  void put_personaDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreatePersona request =
        new CreatePersona()
            .withName(ns.prefix("persona_update_desc"))
            .withDescription("Initial description");

    Persona persona = createEntity(request);
    assertEquals("Initial description", persona.getDescription());

    // Update description
    persona.setDescription("Updated description");
    Persona updated = patchEntity(persona.getId().toString(), persona);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_defaultPersona_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a persona with default=true
    CreatePersona request1 =
        new CreatePersona()
            .withName(ns.prefix("default_persona_1"))
            .withDescription("First default persona")
            .withDefault(true);

    Persona persona1 = createEntity(request1);
    assertNotNull(persona1);
    assertTrue(persona1.getDefault());

    // Create another persona with default=true - should unset previous
    CreatePersona request2 =
        new CreatePersona()
            .withName(ns.prefix("default_persona_2"))
            .withDescription("Second default persona")
            .withDefault(true);

    Persona persona2 = createEntity(request2);
    assertNotNull(persona2);
    assertTrue(persona2.getDefault());

    // Verify first persona is no longer default
    Persona refreshed1 = getEntity(persona1.getId().toString());
    assertFalse(refreshed1.getDefault());
  }

  @Test
  void test_personaNameUniqueness(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String personaName = ns.prefix("unique_persona");
    CreatePersona request1 =
        new CreatePersona().withName(personaName).withDescription("First persona");

    Persona persona1 = createEntity(request1);
    assertNotNull(persona1);

    // Attempt to create duplicate
    CreatePersona request2 =
        new CreatePersona().withName(personaName).withDescription("Duplicate persona");

    assertThrows(
        Exception.class, () -> createEntity(request2), "Creating duplicate persona should fail");
  }

  @Test
  void post_validPersonas_as_admin_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Test 1: Basic persona
    CreatePersona create1 = new CreatePersona().withName(ns.prefix("persona1"));
    Persona persona1 = createEntity(create1);
    assertNotNull(persona1);
    assertEquals(ns.prefix("persona1"), persona1.getName());

    // Test 2: Persona with display name
    CreatePersona create2 =
        new CreatePersona()
            .withName(ns.prefix("persona2"))
            .withDisplayName("Display Name for Persona 2");
    Persona persona2 = createEntity(create2);
    assertNotNull(persona2);
    assertEquals("Display Name for Persona 2", persona2.getDisplayName());

    // Test 3: Persona with description
    CreatePersona create3 =
        new CreatePersona()
            .withName(ns.prefix("persona3"))
            .withDescription("This is a test persona");
    Persona persona3 = createEntity(create3);
    assertNotNull(persona3);
    assertEquals("This is a test persona", persona3.getDescription());

    // Test 4: Persona with both display name and description
    CreatePersona create4 =
        new CreatePersona()
            .withName(ns.prefix("persona4"))
            .withDisplayName("Persona 4 Display")
            .withDescription("Persona 4 description");
    Persona persona4 = createEntity(create4);
    assertNotNull(persona4);
    assertEquals("Persona 4 Display", persona4.getDisplayName());
    assertEquals("Persona 4 description", persona4.getDescription());
  }

  @Test
  void post_personaWithUsersAndVerifyRelationships_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create test users
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    CreateUser userRequest1 =
        new CreateUser()
            .withName(ns.prefix("reluser1_" + uniqueId))
            .withEmail("reluser1" + uniqueId + "@test.com");
    User user1 = client.users().create(userRequest1);

    CreateUser userRequest2 =
        new CreateUser()
            .withName(ns.prefix("reluser2_" + uniqueId))
            .withEmail("reluser2" + uniqueId + "@test.com");
    User user2 = client.users().create(userRequest2);

    // Create persona with users
    CreatePersona personaRequest =
        new CreatePersona()
            .withName(ns.prefix("persona_with_users"))
            .withDisplayName("Persona Display Name")
            .withDescription("Persona with user relationships")
            .withUsers(Arrays.asList(user1.getId(), user2.getId()));

    Persona persona = createEntity(personaRequest);
    assertNotNull(persona);

    // Verify bidirectional relationship - users should have persona reference
    User fetchedUser1 = client.users().get(user1.getId().toString(), "personas");
    assertNotNull(fetchedUser1.getPersonas());
    assertTrue(
        fetchedUser1.getPersonas().stream().anyMatch(ref -> ref.getId().equals(persona.getId())));

    User fetchedUser2 = client.users().get(user2.getId().toString(), "personas");
    assertNotNull(fetchedUser2.getPersonas());
    assertTrue(
        fetchedUser2.getPersonas().stream().anyMatch(ref -> ref.getId().equals(persona.getId())));
  }

  @Test
  void test_defaultPersona_POST_PUT_PATCH(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Test 1: Create a persona with default=true
    CreatePersona create1 =
        new CreatePersona()
            .withName(ns.prefix("data_scientist"))
            .withDescription("Data Scientist Persona")
            .withDefault(true);
    Persona persona1 = createEntity(create1);
    assertTrue(persona1.getDefault());

    // Test 2: Create another persona with default=true, should unset the previous default
    CreatePersona create2 =
        new CreatePersona()
            .withName(ns.prefix("data_engineer"))
            .withDescription("Data Engineer Persona")
            .withDefault(true);
    Persona persona2 = createEntity(create2);
    assertTrue(persona2.getDefault());

    // Verify persona1 is no longer default
    persona1 = getEntity(persona1.getId().toString());
    assertFalse(persona1.getDefault());

    // Test 3: Create a third persona without default flag
    CreatePersona create3 =
        new CreatePersona()
            .withName(ns.prefix("data_analyst"))
            .withDescription("Data Analyst Persona");
    Persona persona3 = createEntity(create3);
    assertFalse(persona3.getDefault());

    // Test 4: Update persona3 to be default using PATCH
    persona3.setDefault(true);
    persona3 = patchEntity(persona3.getId().toString(), persona3);
    assertTrue(persona3.getDefault());

    // Verify persona2 is no longer default
    persona2 = getEntity(persona2.getId().toString());
    assertFalse(persona2.getDefault());

    // Test 5: PATCH persona1 to be default
    persona1.setDefault(true);
    persona1 = patchEntity(persona1.getId().toString(), persona1);
    assertTrue(persona1.getDefault());

    // Verify persona3 is no longer default
    persona3 = getEntity(persona3.getId().toString());
    assertFalse(persona3.getDefault());

    // Test 6: PATCH to unset default from persona1
    persona1.setDefault(false);
    persona1 = patchEntity(persona1.getId().toString(), persona1);
    assertFalse(persona1.getDefault());

    // Verify no personas with our test prefix have default=true
    ListResponse<Persona> allPersonas = listEntities(new ListParams().withLimit(1000));
    for (Persona persona : allPersonas.getData()) {
      if (persona.getName().startsWith(ns.prefix(""))) {
        assertFalse(persona.getDefault());
      }
    }
  }

  @Test
  void test_systemDefaultPersonaForUsers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Test 1: Create a default persona
    CreatePersona createDefaultPersona =
        new CreatePersona()
            .withName(ns.prefix("default_persona"))
            .withDescription("System Default Persona")
            .withDefault(true);
    Persona defaultPersona = createEntity(createDefaultPersona);
    assertTrue(defaultPersona.getDefault());

    // Test 2: Create a user without any persona
    String uniqueId1 = UUID.randomUUID().toString().substring(0, 8);
    CreateUser userRequest1 =
        new CreateUser()
            .withName(ns.prefix("user1_" + uniqueId1))
            .withEmail("user1" + uniqueId1 + "@test.com");
    User user1 = client.users().create(userRequest1);

    // Test 3: Query user with defaultPersona field - should return system default
    user1 = client.users().get(user1.getId().toString(), "defaultPersona");
    assertNotNull(user1.getDefaultPersona());
    assertEquals(defaultPersona.getId(), user1.getDefaultPersona().getId());
    assertEquals(defaultPersona.getName(), user1.getDefaultPersona().getName());

    // Test 4: Create another persona (non-default)
    CreatePersona createPersona2 =
        new CreatePersona()
            .withName(ns.prefix("data_scientist_persona"))
            .withDescription("Data Scientist Persona");
    Persona persona2 = createEntity(createPersona2);
    assertFalse(persona2.getDefault());

    // Test 5: Assign persona2 to user1 and set it as user's default
    User userToUpdate = client.users().get(user1.getId().toString(), "personas");
    userToUpdate.setPersonas(Arrays.asList(persona2.getEntityReference()));
    userToUpdate.setDefaultPersona(persona2.getEntityReference());
    user1 = client.users().update(user1.getId().toString(), userToUpdate);

    // Test 6: Query user with defaultPersona - should now return user's own default, not system
    // default
    user1 = client.users().get(user1.getId().toString(), "defaultPersona");
    assertNotNull(user1.getDefaultPersona());
    assertEquals(persona2.getId(), user1.getDefaultPersona().getId());
    assertEquals(persona2.getName(), user1.getDefaultPersona().getName());

    // Test 7: Create a new system default persona
    CreatePersona createNewDefault =
        new CreatePersona()
            .withName(ns.prefix("new_default_persona"))
            .withDescription("New System Default Persona")
            .withDefault(true);
    Persona newDefaultPersona = createEntity(createNewDefault);
    assertTrue(newDefaultPersona.getDefault());

    // Test 8: Create a new user and verify they get the new system default
    String uniqueId2 = UUID.randomUUID().toString().substring(0, 8);
    CreateUser userRequest2 =
        new CreateUser()
            .withName(ns.prefix("user2_" + uniqueId2))
            .withEmail("user2" + uniqueId2 + "@test.com");
    User user2 = client.users().create(userRequest2);
    user2 = client.users().get(user2.getId().toString(), "defaultPersona");
    assertNotNull(user2.getDefaultPersona());
    assertEquals(newDefaultPersona.getId(), user2.getDefaultPersona().getId());

    // Test 9: User1 should still have their own default persona (not affected by system default
    // change)
    user1 = client.users().get(user1.getId().toString(), "defaultPersona");
    assertNotNull(user1.getDefaultPersona());
    assertEquals(persona2.getId(), user1.getDefaultPersona().getId());
  }

  @Test
  void delete_validPersona_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a user
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    CreateUser userRequest =
        new CreateUser()
            .withName(ns.prefix("deluser_" + uniqueId))
            .withEmail("deluser" + uniqueId + "@test.com");
    User user = client.users().create(userRequest);

    // Create persona with user
    CreatePersona personaRequest =
        new CreatePersona()
            .withName(ns.prefix("persona_to_delete"))
            .withDescription("Persona to be deleted")
            .withUsers(Arrays.asList(user.getId()));

    Persona persona = createEntity(personaRequest);
    assertNotNull(persona);

    // Verify user has persona relationship
    User userWithPersona = client.users().get(user.getId().toString(), "personas");
    assertNotNull(userWithPersona.getPersonas());
    assertEquals(1, userWithPersona.getPersonas().size());

    // Delete persona
    deleteEntity(persona.getId().toString());

    // Verify user no longer has relationship to this persona
    User userAfterDelete = client.users().get(user.getId().toString(), "personas");
    assertTrue(userAfterDelete.getPersonas() == null || userAfterDelete.getPersonas().isEmpty());
  }

  @Test
  void patch_deleteUserFromPersona_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create multiple users
    final int totalUsers = 5;
    java.util.List<UUID> userIds = new java.util.ArrayList<>();
    for (int i = 0; i < totalUsers; i++) {
      String uniqueId = UUID.randomUUID().toString().substring(0, 8);
      CreateUser userRequest =
          new CreateUser()
              .withName(ns.prefix("patchuser" + i + "_" + uniqueId))
              .withEmail("patchuser" + i + uniqueId + "@test.com");
      User user = client.users().create(userRequest);
      userIds.add(user.getId());
    }

    // Create persona with all users
    CreatePersona personaRequest =
        new CreatePersona()
            .withName(ns.prefix("persona_patch_users"))
            .withDescription("Persona for user removal test")
            .withDisplayName("Patch Test Persona")
            .withUsers(userIds);

    Persona persona = createEntity(personaRequest);
    assertNotNull(persona);

    // Get persona with users field
    Persona personaWithUsers = getEntityWithFields(persona.getId().toString(), "users");
    assertNotNull(personaWithUsers.getUsers());
    assertEquals(totalUsers, personaWithUsers.getUsers().size());

    // Remove one user from the persona
    UUID userToRemove = userIds.get(2);
    personaWithUsers.getUsers().removeIf(userRef -> userRef.getId().equals(userToRemove));

    // Update persona
    Persona updatedPersona = patchEntity(persona.getId().toString(), personaWithUsers);

    // Verify user was removed
    Persona verifyPersona = getEntityWithFields(updatedPersona.getId().toString(), "users");
    assertNotNull(verifyPersona.getUsers());
    assertEquals(totalUsers - 1, verifyPersona.getUsers().size());
    assertTrue(
        verifyPersona.getUsers().stream().noneMatch(ref -> ref.getId().equals(userToRemove)));
  }
}
