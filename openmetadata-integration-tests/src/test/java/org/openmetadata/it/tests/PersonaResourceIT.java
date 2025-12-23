package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

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
}
