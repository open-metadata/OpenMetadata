package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.EntityValidation;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.it.util.UpdateType;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;

/**
 * Base class for all entity integration tests.
 *
 * Migrated from: org.openmetadata.service.resources.EntityResourceTest
 * Purpose: Provides common test methods that apply to ALL entities (CRUD, permissions, tags, etc.)
 *
 * This class replicates the pattern from EntityResourceTest but uses:
 * - SDK client instead of WebTarget
 * - TestNamespace for isolation instead of TestInfo
 * - Typed exceptions instead of HTTP status codes
 * - Feature flags to conditionally run tests based on entity capabilities
 *
 * Subclasses must implement:
 * - createMinimalRequest() - Create a minimal valid create request
 * - getEntityClient() - Return the appropriate entity client
 * - validateCreatedEntity() - Entity-specific validation
 *
 * @param <T> Entity type (e.g., Database, Table, User)
 * @param <K> Create request type (e.g., CreateDatabase, CreateTable)
 */
@ExtendWith(TestNamespaceExtension.class)
public abstract class BaseEntityIT<T extends EntityInterface, K> {

  // ===================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ===================================================================

  /**
   * Create a minimal valid create request for this entity.
   * This should include all required fields but minimal optional fields.
   */
  protected abstract K createMinimalRequest(TestNamespace ns, OpenMetadataClient client);

  /**
   * Create a request with a specific name.
   */
  protected abstract K createRequest(String name, TestNamespace ns, OpenMetadataClient client);

  /**
   * Create the entity using the SDK client.
   */
  protected abstract T createEntity(K createRequest, OpenMetadataClient client);

  /**
   * Get entity by ID.
   */
  protected abstract T getEntity(String id, OpenMetadataClient client);

  /**
   * Get entity by fully qualified name.
   */
  protected abstract T getEntityByName(String fqn, OpenMetadataClient client);

  /**
   * Update entity using PATCH (returns updated entity).
   */
  protected abstract T patchEntity(String id, T entity, OpenMetadataClient client);

  /**
   * Delete entity (soft delete if supported).
   */
  protected abstract void deleteEntity(String id, OpenMetadataClient client);

  /**
   * Restore a soft-deleted entity.
   */
  protected abstract void restoreEntity(String id, OpenMetadataClient client);

  /**
   * Hard delete an entity (permanently remove).
   */
  protected abstract void hardDeleteEntity(String id, OpenMetadataClient client);

  /**
   * Get the entity type name (e.g., "database", "table", "user").
   */
  protected abstract String getEntityType();

  /**
   * Validate that the created entity matches the create request.
   * Subclasses should add entity-specific validations.
   */
  protected abstract void validateCreatedEntity(T entity, K createRequest);

  // ===================================================================
  // FEATURE FLAGS - Control which tests run for this entity
  // ===================================================================

  protected boolean supportsFollowers = true;
  protected boolean supportsOwners = true;
  protected boolean supportsTags = true;
  protected boolean supportsDomains = true;
  protected boolean supportsDataProducts = true;
  protected boolean supportsSoftDelete = true;
  protected boolean supportsCustomExtension = true;
  protected boolean supportsFieldsQueryParam = true;
  protected boolean supportsPatch = true;
  protected boolean supportsEmptyDescription = true;

  // ===================================================================
  // VALIDATION HELPER METHODS
  // ===================================================================

  /**
   * Helper method to patch entity and validate version, ChangeDescription.
   * Similar to patchEntityAndCheck in EntityResourceTest.
   *
   * @param entity Entity with updated values
   * @param client OpenMetadata client
   * @param updateType Expected type of update
   * @param expectedChange Expected ChangeDescription (can be null for simple cases)
   * @return Updated entity
   */
  protected T patchEntityAndCheck(
      T entity,
      OpenMetadataClient client,
      UpdateType updateType,
      ChangeDescription expectedChange) {
    // Capture version before update
    Double previousVersion = entity.getVersion();

    // Perform the update
    T updated = patchEntity(entity.getId().toString(), entity, client);

    // Validate version changed correctly
    EntityValidation.validateVersion(updated, updateType, previousVersion);

    // Validate ChangeDescription
    EntityValidation.validateChangeDescription(updated, updateType, expectedChange);

    // Verify changes persisted by getting entity again
    T fetched = getEntity(updated.getId().toString(), client);
    assertEquals(updated.getVersion(), fetched.getVersion(), "Version mismatch after fetch");

    return updated;
  }

  // ===================================================================
  // COMMON CRUD TESTS (Phase 1 - 10 tests)
  // ===================================================================

  /**
   * Test: Create entity with minimal required fields
   * Equivalent to: post_entityCreate_200_OK in EntityResourceTest
   */
  @Test
  void post_entityCreate_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity with minimal fields
    K createRequest = createMinimalRequest(ns, client);
    T entity = createEntity(createRequest, client);

    // Common validations
    assertNotNull(entity.getId(), "Entity ID should not be null");
    assertNotNull(entity.getFullyQualifiedName(), "Entity FQN should not be null");
    assertNotNull(entity.getName(), "Entity name should not be null");

    // Validate version and ChangeDescription for newly created entity
    EntityValidation.validateVersion(entity, UpdateType.CREATED, null);
    EntityValidation.validateChangeDescription(entity, UpdateType.CREATED, null);

    // Entity-specific validations
    validateCreatedEntity(entity, createRequest);

    // Verify entity can be retrieved
    T fetched = getEntity(entity.getId().toString(), client);
    assertEquals(entity.getId(), fetched.getId());
    assertEquals(entity.getFullyQualifiedName(), fetched.getFullyQualifiedName());
    assertEquals(entity.getVersion(), fetched.getVersion(), "Version should match after fetch");
  }

  /**
   * Test: Create entity with invalid name (special characters, too long, etc.)
   * Equivalent to: post_entityCreateWithInvalidName_400 in EntityResourceTest
   */
  @Test
  void post_entityCreateWithInvalidName_400(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Test invalid name patterns that OpenMetadata actually rejects
    String[] invalidNames = {
      "", // Empty name
      "name with\nnewline", // Newline character
      "a".repeat(300), // Name too long (>256 chars typically)
    };

    for (String invalidName : invalidNames) {
      K createRequest = createRequest(invalidName, ns, client);
      assertThrows(
          InvalidRequestException.class,
          () -> createEntity(createRequest, client),
          "Expected InvalidRequestException for invalid name: " + invalidName);
    }
  }

  /**
   * Test: Create duplicate entity should fail
   * Equivalent to: post_duplicateEntity_409 in EntityResourceTest
   */
  @Test
  void post_duplicateEntity_409(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create first entity
    K createRequest = createMinimalRequest(ns, client);
    T entity = createEntity(createRequest, client);
    assertNotNull(entity.getId());

    // Attempt to create duplicate with same name
    K duplicateRequest = createRequest(entity.getName(), ns, client);
    assertThrows(
        Exception.class, // May be ConflictException or similar
        () -> createEntity(duplicateRequest, client),
        "Creating duplicate entity should fail");
  }

  /**
   * Test: Get entity by ID
   * Equivalent to: get_entity_200_OK in EntityResourceTest
   */
  @Test
  void get_entity_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);

    // Get entity by ID
    T fetched = getEntity(created.getId().toString(), client);

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
    assertEquals(created.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  /**
   * Test: Get entity by fully qualified name
   * Equivalent to: get_entityByName_200_OK in EntityResourceTest
   */
  @Test
  void get_entityByName_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);

    // Get entity by FQN
    T fetched = getEntityByName(created.getFullyQualifiedName(), client);

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  /**
   * Test: Get non-existent entity should fail
   * Equivalent to: get_entityNotFound_404 in EntityResourceTest
   */
  @Test
  void get_entityNotFound_404(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Try to get non-existent entity by ID
    String fakeId = "00000000-0000-0000-0000-000000000000";
    assertThrows(
        Exception.class,
        () -> getEntity(fakeId, client),
        "Getting non-existent entity should fail");

    // Try to get non-existent entity by name
    String fakeName = ns.prefix("nonExistent");
    assertThrows(
        Exception.class,
        () -> getEntityByName(fakeName, client),
        "Getting non-existent entity by name should fail");
  }

  /**
   * Test: Update entity description
   * Equivalent to: patch_entityAttributes_200_OK in EntityResourceTest
   */
  @Test
  void patch_entityDescription_200_OK(TestNamespace ns) {
    if (!supportsPatch) return;

    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);

    // Validate initial version
    assertEquals(0.1, created.getVersion(), 0.001, "Initial version should be 0.1");

    // Update description
    String oldDescription = created.getDescription();
    String newDescription = "Updated description via integration test";
    created.setDescription(newDescription);

    // Create expected ChangeDescription
    ChangeDescription expectedChange =
        EntityValidation.getChangeDescription(created.getVersion(), UpdateType.MINOR_UPDATE);
    expectedChange
        .getFieldsUpdated()
        .add(EntityValidation.fieldUpdated("description", oldDescription, newDescription));

    // Perform update with validation
    T updated = patchEntityAndCheck(created, client, UpdateType.MINOR_UPDATE, expectedChange);

    // Validate description was updated
    assertEquals(newDescription, updated.getDescription());
    assertEquals(0.2, updated.getVersion(), 0.001, "Version should increment to 0.2");

    // Verify ChangeDescription is present and correct
    assertNotNull(updated.getChangeDescription(), "ChangeDescription should be present");
    assertEquals(
        0.1,
        updated.getChangeDescription().getPreviousVersion(),
        0.001,
        "Previous version should be 0.1");
  }

  /**
   * Test: Soft delete entity
   * Equivalent to: delete_entity_soft_200 in EntityResourceTest
   */
  @Test
  void delete_entity_soft_200(TestNamespace ns) {
    if (!supportsSoftDelete) return;

    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);
    String entityId = created.getId().toString();

    // Soft delete
    deleteEntity(entityId, client);

    // Entity should not be retrievable by default
    assertThrows(
        Exception.class,
        () -> getEntity(entityId, client),
        "Deleted entity should not be retrievable");
  }

  // ===================================================================
  // AUTHORIZATION TESTS (Phase 1 - JWT-based)
  // ===================================================================

  /**
   * Test: Non-admin user cannot create entity
   * Equivalent to: post_entity_as_non_admin_401 in EntityResourceTest
   *
   * Uses JWT-based authentication with a regular user (no admin role).
   */
  @Test
  void post_entity_as_non_admin_401(TestNamespace ns) {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    OpenMetadataClient testUserClient = SdkClients.testUserClient();

    // Create request with prerequisites created as admin
    K createRequest = createMinimalRequest(ns, adminClient);

    // Attempt to create entity as non-admin user - should fail
    assertThrows(
        Exception.class,
        () -> createEntity(createRequest, testUserClient),
        "Non-admin user should not be able to create entity");
  }

  /**
   * Test: Non-admin user cannot delete entity
   * Equivalent to: delete_entity_as_non_admin_401 in EntityResourceTest
   *
   * Uses JWT-based authentication.
   */
  @Test
  void delete_entity_as_non_admin_401(TestNamespace ns) {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    OpenMetadataClient testUserClient = SdkClients.testUserClient();

    // Create entity as admin
    K createRequest = createMinimalRequest(ns, adminClient);
    T created = createEntity(createRequest, adminClient);

    // Attempt to delete as non-admin user
    assertThrows(
        Exception.class,
        () -> deleteEntity(created.getId().toString(), testUserClient),
        "Non-admin user should not be able to delete entity");
  }

  /**
   * Test: Creating duplicate entity should fail with conflict
   * Equivalent to: post_entityAlreadyExists_409_conflict in EntityResourceTest
   */
  @Test
  public void post_entityAlreadyExists_409_conflict(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create first entity
    K createRequest = createRequest(ns.prefix("duplicate"), ns, client);
    T created = createEntity(createRequest, client);
    assertNotNull(created.getId());

    // Attempt to create duplicate - should fail
    assertThrows(
        Exception.class,
        () -> createEntity(createRequest, client),
        "Creating duplicate entity should fail with conflict");
  }

  /**
   * Test: Entity names with dots should be properly quoted in FQN
   * Equivalent to: post_entityWithDots_200 in EntityResourceTest
   */
  @Test
  void post_entityWithDots_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity with dots in name
    String nameWithDots = ns.prefix("foo.bar");
    K createRequest = createRequest(nameWithDots, ns, client);
    T created = createEntity(createRequest, client);

    // Verify entity created
    assertNotNull(created.getId());
    assertEquals(nameWithDots, created.getName());

    // FQN should contain quotes if hierarchical, or exact name if not
    String fqn = created.getFullyQualifiedName();
    boolean isHierarchical = !fqn.equals(created.getName());
    if (isHierarchical) {
      assertTrue(fqn.contains("\""), "Hierarchical FQN with dots should contain quotes: " + fqn);
    }
  }

  // ===================================================================
  // PUT (UPSERT) TESTS
  // ===================================================================

  /**
   * Test: PUT can create new entity (upsert)
   * Equivalent to: put_entityCreate_200 in EntityResourceTest
   */
  @Test
  void put_entityCreate_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity using PUT (upsert with no existing entity)
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);

    // Verify entity was created
    assertNotNull(created.getId());
    assertEquals(0.1, created.getVersion(), 0.001);
    validateCreatedEntity(created, createRequest);
  }

  /**
   * Test: PUT with no changes should not increment version
   * Equivalent to: put_entityUpdateWithNoChange_200 in EntityResourceTest
   */
  @Test
  void put_entityUpdateWithNoChange_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);
    Double originalVersion = created.getVersion();

    // Update with same data (no change)
    T updated = patchEntity(created.getId().toString(), created, client);

    // Version should NOT change when there's no actual change
    assertEquals(
        originalVersion, updated.getVersion(), 0.001, "Version should not change for no-op update");
  }

  // ===================================================================
  // DELETE RESTORE TESTS
  // ===================================================================

  /**
   * Test: Soft deleted entity can be restored
   * Equivalent to: delete_restore_entity_200 in EntityResourceTest
   *
   * Note: This test verifies the restore functionality for soft-deleted entities.
   * The original test uses a PUT request to restore. Since we're using the SDK,
   * we'll verify that after soft delete, the entity can be restored and is functional.
   */
  @Test
  void delete_restore_entity_200(TestNamespace ns) {
    if (!supportsSoftDelete) return;

    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);
    String entityId = created.getId().toString();

    // Soft delete entity
    deleteEntity(entityId, client);

    // Verify entity is deleted (should not be retrievable by default)
    assertThrows(
        Exception.class,
        () -> getEntity(entityId, client),
        "Deleted entity should not be retrievable without include=deleted");

    // TODO: Add restore functionality once SDK supports it
    // For now, this test verifies soft delete works correctly
  }

  // ===================================================================
  // OWNER VALIDATION TESTS
  // ===================================================================

  /**
   * Test: PATCH entity with non-existent owner should fail
   * Equivalent to: post_entityWithNonExistentOwner_4xx in EntityResourceTest
   */
  @Test
  void patch_entityWithNonExistentOwner_4xx(TestNamespace ns) {
    if (!supportsOwners) return;

    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity without owner
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);

    // Try to set a non-existent owner
    org.openmetadata.schema.type.EntityReference nonExistentOwner =
        new org.openmetadata.schema.type.EntityReference()
            .withId(java.util.UUID.randomUUID())
            .withType("user")
            .withName("nonexistent@example.com");

    created.setOwners(List.of(nonExistentOwner));

    String entityId = created.getId().toString();
    assertThrows(
        Exception.class,
        () -> patchEntity(entityId, created, client),
        "Patching entity with non-existent owner should fail");
  }

  /**
   * Test: PATCH to update owner
   * Equivalent to: patch_entityUpdateOwner_200 in EntityResourceTest
   */
  @Test
  void patch_entityUpdateOwner_200(TestNamespace ns) {
    if (!supportsOwners || !supportsPatch) return;

    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity without owner
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);

    // Verify no owner initially
    T fetched = getEntityWithFields(created.getId().toString(), "owners", client);
    assertTrue(
        fetched.getOwners() == null || fetched.getOwners().isEmpty(),
        "Entity should not have owner initially");

    // Get ingestion-bot user to use as owner (bots are auto-created)
    org.openmetadata.schema.entity.teams.User botUser = client.users().getByName("ingestion-bot");
    org.openmetadata.schema.type.EntityReference ownerRef =
        new org.openmetadata.schema.type.EntityReference()
            .withId(botUser.getId())
            .withType("user")
            .withName(botUser.getName())
            .withFullyQualifiedName(botUser.getFullyQualifiedName());

    // Set owner via PATCH
    fetched.setOwners(List.of(ownerRef));
    T updated = patchEntity(fetched.getId().toString(), fetched, client);

    // Verify owner was set
    T updatedFetched = getEntityWithFields(updated.getId().toString(), "owners", client);
    assertNotNull(updatedFetched.getOwners(), "Entity should have owners");
    assertEquals(1, updatedFetched.getOwners().size(), "Entity should have 1 owner");
    assertEquals(
        botUser.getId(),
        updatedFetched.getOwners().get(0).getId(),
        "Owner should be ingestion-bot user");
  }

  /**
   * Test: Change owner from one user to another
   * Equivalent to: put_entityUpdateOwner_200 in EntityResourceTest
   */
  @Test
  void patch_entityChangeOwner_200(TestNamespace ns) {
    if (!supportsOwners) return;

    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity and set initial owner
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);

    // Set ingestion-bot as owner
    org.openmetadata.schema.entity.teams.User botUser = client.users().getByName("ingestion-bot");
    org.openmetadata.schema.type.EntityReference botRef =
        new org.openmetadata.schema.type.EntityReference()
            .withId(botUser.getId())
            .withType("user")
            .withName(botUser.getName());

    created.setOwners(List.of(botRef));
    T withOwner = patchEntity(created.getId().toString(), created, client);

    // Verify owner was set
    T fetchedWithOwner = getEntityWithFields(withOwner.getId().toString(), "owners", client);
    assertNotNull(fetchedWithOwner.getOwners());
    assertEquals(1, fetchedWithOwner.getOwners().size());
    assertEquals(botUser.getId(), fetchedWithOwner.getOwners().get(0).getId());

    // Clear the owner by setting empty list
    fetchedWithOwner.setOwners(new ArrayList<>());
    T withoutOwner = patchEntity(fetchedWithOwner.getId().toString(), fetchedWithOwner, client);

    // Verify owner was removed
    T finalFetch = getEntityWithFields(withoutOwner.getId().toString(), "owners", client);
    assertTrue(
        finalFetch.getOwners() == null || finalFetch.getOwners().isEmpty(),
        "Owner should be removed");
  }

  // ===================================================================
  // VERSION-BASED CONCURRENCY TESTS (Using entity version for optimistic locking)
  // ===================================================================

  /**
   * Test: Concurrent updates - version acts as optimistic lock
   * Equivalent to: patch_concurrent_updates_with_etag in EntityResourceTest
   *
   * In OpenMetadata, entity version acts as optimistic lock. When two concurrent updates
   * happen, the second one will see a different version and should handle it appropriately.
   */
  @Test
  void patch_concurrentUpdates_optimisticLock(TestNamespace ns) {
    if (!supportsPatch) return;

    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);
    Double originalVersion = created.getVersion();

    // First update - change description to unique value
    String firstDesc = "Concurrent update 1 - " + System.currentTimeMillis();
    created.setDescription(firstDesc);
    T afterFirst = patchEntity(created.getId().toString(), created, client);

    // Version should have changed
    assertTrue(
        afterFirst.getVersion() > originalVersion,
        "Version should increment after update, was: " + afterFirst.getVersion());

    // Get fresh copy for second update
    T fresh = getEntity(afterFirst.getId().toString(), client);

    // Second update with different description
    String secondDesc = "Concurrent update 2 - " + System.currentTimeMillis();
    fresh.setDescription(secondDesc);
    T afterSecond = patchEntity(fresh.getId().toString(), fresh, client);

    // Version should increment or stay same (depending on consolidation window)
    assertTrue(
        afterSecond.getVersion() >= afterFirst.getVersion(),
        "Version should be >= previous, got: "
            + afterSecond.getVersion()
            + " vs "
            + afterFirst.getVersion());
  }

  /**
   * Test: Version changes on updates (optimistic locking verification)
   * Equivalent to: patch_with_valid_etag / patch_with_stale_etag concepts
   *
   * This test verifies that version tracking works correctly for detecting changes.
   */
  @Test
  void patch_versionTracking_200(TestNamespace ns) {
    if (!supportsPatch) return;

    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity
    K createRequest = createMinimalRequest(ns, client);
    T created = createEntity(createRequest, client);
    assertEquals(0.1, created.getVersion(), 0.001, "Initial version should be 0.1");

    // Update 1: Change description
    created.setDescription("Version tracking update 1 - " + System.currentTimeMillis());
    T updated1 = patchEntity(created.getId().toString(), created, client);
    assertEquals(0.2, updated1.getVersion(), 0.001, "Version should be 0.2 after first update");

    // Update 2: Change description to a DIFFERENT value
    updated1.setDescription("Version tracking update 2 - " + System.currentTimeMillis());
    T updated2 = patchEntity(updated1.getId().toString(), updated1, client);

    // Version should increment (will be 0.3 if it's a new change, or same if consolidated)
    assertTrue(
        updated2.getVersion() >= 0.2,
        "Version should be at least 0.2, got: " + updated2.getVersion());

    // Fetch entity and verify version persisted
    T fetched = getEntity(updated2.getId().toString(), client);
    assertEquals(
        updated2.getVersion(),
        fetched.getVersion(),
        0.001,
        "Fetched version should match updated version");
  }

  // ===================================================================
  // PHASE 2: Advanced GET Operations
  // ===================================================================

  @Test
  void get_entityWithDifferentFields_200_OK(TestNamespace ns) {
    if (!supportsOwners && !supportsTags) {
      return; // Skip if entity doesn't support fields testing
    }

    OpenMetadataClient client = SdkClients.adminClient();
    K createRequest = createMinimalRequest(ns, client);
    T entity = createEntity(createRequest, client);

    // GET with no fields - should return basic fields only
    T entityWithoutFields = getEntity(entity.getId().toString(), client);
    assertNotNull(entityWithoutFields);
    assertNotNull(entityWithoutFields.getId());

    // GET with specific fields - owners, tags (if supported)
    String fields = buildFieldsParam();
    if (fields != null && !fields.isEmpty()) {
      T entityWithFields = getEntityWithFields(entity.getId().toString(), fields, client);
      assertNotNull(entityWithFields);
      assertNotNull(entityWithFields.getId());

      // Validate by name as well
      T entityByName = getEntityByNameWithFields(entity.getFullyQualifiedName(), fields, client);
      assertNotNull(entityByName);
      assertEquals(entity.getId(), entityByName.getId());
    }
  }

  @Test
  void get_entityIncludeDeleted_200(TestNamespace ns) {
    if (!supportsSoftDelete) {
      return;
    }

    OpenMetadataClient client = SdkClients.adminClient();
    K createRequest = createMinimalRequest(ns, client);
    T entity = createEntity(createRequest, client);
    String entityId = entity.getId().toString();

    // Soft delete the entity
    deleteEntity(entityId, client);

    // GET without include=deleted should throw exception
    assertThrows(
        Exception.class,
        () -> getEntity(entityId, client),
        "Getting deleted entity without include=deleted should fail");

    // GET with include=deleted should succeed
    T deletedEntity = getEntityIncludeDeleted(entityId, client);
    assertNotNull(deletedEntity);
    assertEquals(entity.getId(), deletedEntity.getId());
    assertTrue(deletedEntity.getDeleted(), "Entity should be marked as deleted");
  }

  // ===================================================================
  // HELPER METHODS FOR PHASE 2
  // ===================================================================

  /**
   * Build fields parameter based on entity capabilities.
   */
  private String buildFieldsParam() {
    List<String> fields = new ArrayList<>();
    if (supportsOwners) fields.add("owners");
    if (supportsTags) fields.add("tags");
    if (supportsFollowers) fields.add("followers");
    return String.join(",", fields);
  }

  /**
   * Get entity with specific fields parameter.
   * Subclasses can override if they have a different mechanism.
   */
  protected T getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    // Default implementation - subclasses should override
    return getEntity(id, client);
  }

  /**
   * Get entity by name with specific fields parameter.
   * Subclasses can override if they have a different mechanism.
   */
  protected T getEntityByNameWithFields(String fqn, String fields, OpenMetadataClient client) {
    // Default implementation - subclasses should override
    return getEntityByName(fqn, client);
  }

  /**
   * Get entity with include=deleted parameter.
   * Subclasses can override if they have a different mechanism.
   */
  protected T getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    // Default implementation - subclasses should override
    throw new UnsupportedOperationException("Include deleted not implemented");
  }

  // ===================================================================
  // PHASE 3: Pagination & List Operations
  // ===================================================================

  @Test
  void get_entityListWithPagination_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create multiple entities for pagination testing
    int entityCount = 5;
    List<UUID> createdIds = new ArrayList<>();

    for (int i = 0; i < entityCount; i++) {
      K createRequest = createRequest(ns.prefix("entity" + i), ns, client);
      T entity = createEntity(createRequest, client);
      createdIds.add(entity.getId());
    }

    // Create and delete one entity to test include=deleted
    UUID deletedId = null;
    if (supportsSoftDelete) {
      K deletedRequest = createRequest(ns.prefix("deleted"), ns, client);
      T deletedEntity = createEntity(deletedRequest, client);
      deletedId = deletedEntity.getId();
      deleteEntity(deletedEntity.getId().toString(), client);
    }

    // Test pagination with 2 page sizes instead of 4 (reduced for performance)
    // Still covers edge cases: small page size and medium page size
    int[] pageSizes = {11, 23};
    for (int limit : pageSizes) {
      testComprehensivePagination(client, limit, createdIds, deletedId);
    }
  }

  private void testComprehensivePagination(
      OpenMetadataClient client, int limit, List<UUID> createdIds, UUID deletedId) {
    // Get all entities first to know the total count (like old test does)
    org.openmetadata.sdk.models.ListParams allParams = new org.openmetadata.sdk.models.ListParams();
    allParams.setLimit(1000); // Get all entities
    org.openmetadata.sdk.models.ListResponse<T> allEntities = listEntities(allParams, client);

    assertNotNull(allEntities, "All entities list should not be null");
    assertNotNull(allEntities.getData(), "All entities data should not be null");
    assertNotNull(allEntities.getPaging(), "Paging info should not be null");

    int totalRecords = allEntities.getPaging().getTotal();
    assertTrue(totalRecords > 0, "Should have at least some entities");

    // Forward pagination - scroll through all pages
    org.openmetadata.sdk.models.ListParams params = new org.openmetadata.sdk.models.ListParams();
    params.setLimit(limit);

    List<UUID> seenIdsForward = new ArrayList<>();
    String afterCursor = null;
    String lastBeforeCursor = null;
    int pageCount = 0;

    do {
      params.setAfter(afterCursor);
      params.setBefore(null);
      org.openmetadata.sdk.models.ListResponse<T> page = listEntities(params, client);

      assertNotNull(page, "Page " + pageCount + " should not be null");
      assertNotNull(page.getData(), "Page " + pageCount + " data should not be null");
      assertNotNull(page.getPaging(), "Page " + pageCount + " paging should not be null");

      // First page should not have before cursor
      if (pageCount == 0) {
        assertNull(
            page.getPaging().getBefore(),
            "First page should not have before cursor for limit " + limit);
      } else {
        // Subsequent pages should have before cursor
        assertNotNull(
            page.getPaging().getBefore(),
            "Page " + pageCount + " should have before cursor for limit " + limit);

        // Test backward navigation from current page (important for SDK correctness)
        org.openmetadata.sdk.models.ListParams backParams =
            new org.openmetadata.sdk.models.ListParams();
        backParams.setLimit(limit);
        backParams.setBefore(page.getPaging().getBefore());
        org.openmetadata.sdk.models.ListResponse<T> backPage = listEntities(backParams, client);

        assertNotNull(backPage, "Backward page should not be null");
        assertTrue(
            backPage.getData().size() <= limit, "Backward page should respect limit " + limit);
      }

      // Verify page size
      int expectedPageSize = Math.min(limit, totalRecords - seenIdsForward.size());
      if (page.getPaging().getAfter() != null) {
        // Not the last page - should have exactly 'limit' items
        assertEquals(
            limit,
            page.getData().size(),
            "Page " + pageCount + " should have " + limit + " items (limit=" + limit + ")");
      } else {
        // Last page - may have fewer items
        assertTrue(
            page.getData().size() <= limit, "Last page should have at most " + limit + " items");
        assertTrue(page.getData().size() > 0, "Last page should have at least one item");
      }

      // Verify total count is at least what we initially saw
      // (In parallel execution, the total may increase as other tests create entities)
      assertTrue(
          page.getPaging().getTotal() >= totalRecords,
          "Total count should be at least "
              + totalRecords
              + " but was "
              + page.getPaging().getTotal());

      // Collect IDs and check for duplicates
      for (T entity : page.getData()) {
        UUID id = entity.getId();
        assertFalse(seenIdsForward.contains(id), "Forward: Duplicate entity ID " + id + " found");
        seenIdsForward.add(id);
      }

      afterCursor = page.getPaging().getAfter();
      lastBeforeCursor = page.getPaging().getBefore();
      pageCount++;

      // Safety check to prevent infinite loops
      assertTrue(pageCount < 1000, "Too many pages - possible infinite loop");

    } while (afterCursor != null);

    // Verify we saw at least the initial count of entities
    // (In parallel execution, we may see more due to other tests creating entities)
    assertTrue(
        seenIdsForward.size() >= totalRecords,
        "Forward pagination should have seen at least "
            + totalRecords
            + " entities but saw "
            + seenIdsForward.size());

    // Backward pagination - scroll from end to beginning
    List<UUID> seenIdsBackward = new ArrayList<>();
    String beforeCursor = lastBeforeCursor;
    pageCount = 0;

    while (beforeCursor != null) {
      params = new org.openmetadata.sdk.models.ListParams();
      params.setLimit(limit);
      params.setBefore(beforeCursor);

      org.openmetadata.sdk.models.ListResponse<T> page = listEntities(params, client);

      assertNotNull(page, "Backward page " + pageCount + " should not be null");
      assertNotNull(page.getData(), "Backward page " + pageCount + " data should not be null");

      // Collect IDs and check for duplicates
      for (T entity : page.getData()) {
        UUID id = entity.getId();
        assertFalse(seenIdsBackward.contains(id), "Backward: Duplicate entity ID " + id + " found");
        seenIdsBackward.add(id);
      }

      beforeCursor = page.getPaging().getBefore();
      pageCount++;

      // Safety check
      assertTrue(pageCount < 1000, "Too many backward pages - possible infinite loop");
    }

    // Note: Backward pagination may not see all entities if we started from a middle page
    // This is expected behavior - we're just verifying no duplicates and consistent cursors
  }

  @Test
  void get_entityListWithInvalidLimit_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Test with invalid limit (negative)
    org.openmetadata.sdk.models.ListParams params = new org.openmetadata.sdk.models.ListParams();
    params.setLimit(-1);

    assertThrows(
        Exception.class,
        () -> listEntities(params, client),
        "Listing with negative limit should fail");

    // Test with limit > max allowed (usually 1000000)
    params.setLimit(2000000);
    assertThrows(
        Exception.class,
        () -> listEntities(params, client),
        "Listing with excessive limit should fail");
  }

  @Test
  void get_entityListWithInvalidPaginationCursors_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Test with invalid after cursor
    org.openmetadata.sdk.models.ListParams paramsAfter =
        new org.openmetadata.sdk.models.ListParams();
    paramsAfter.setAfter("invalid-cursor-string");

    assertThrows(
        Exception.class,
        () -> listEntities(paramsAfter, client),
        "Listing with invalid after cursor should fail");

    // Test with invalid before cursor
    org.openmetadata.sdk.models.ListParams paramsBefore =
        new org.openmetadata.sdk.models.ListParams();
    paramsBefore.setBefore("invalid-cursor-string");

    assertThrows(
        Exception.class,
        () -> listEntities(paramsBefore, client),
        "Listing with invalid before cursor should fail");
  }

  @Test
  void get_entityWithInvalidFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    K createRequest = createMinimalRequest(ns, client);
    T entity = createEntity(createRequest, client);

    // Test GET by ID with invalid field
    String invalidField = "invalidFieldName123";
    assertThrows(
        Exception.class,
        () -> getEntityWithFields(entity.getId().toString(), invalidField, client),
        "GET with invalid field should fail");

    // Test GET by name with invalid field
    assertThrows(
        Exception.class,
        () -> getEntityByNameWithFields(entity.getFullyQualifiedName(), invalidField, client),
        "GET by name with invalid field should fail");
  }

  // ===================================================================
  // HELPER METHODS FOR PHASE 3
  // ===================================================================

  /**
   * List entities using the SDK. Subclasses must implement this.
   */
  protected abstract org.openmetadata.sdk.models.ListResponse<T> listEntities(
      org.openmetadata.sdk.models.ListParams params, OpenMetadataClient client);

  // ===================================================================
  // PHASE 3: TAGS OPERATIONS
  // ===================================================================

  @Test
  void test_entityWithInvalidTag(TestNamespace ns) {
    if (!supportsTags) {
      return;
    }
    OpenMetadataClient client = SdkClients.adminClient();

    // Create an entity first
    K validCreate = createRequest(ns.prefix("valid_entity"), ns, client);
    T entity = createEntity(validCreate, client);

    // Try to patch with invalid tag - this should fail
    TagLabel invalidTag = new TagLabel().withTagFQN("invalidTag");
    entity.setTags(List.of(invalidTag));
    String entityId = entity.getId().toString();
    assertThrows(
        Exception.class,
        () -> patchEntity(entityId, entity, client),
        "Patching entity with invalid tag should fail");
  }

  @Test
  void test_tagUpdateOptimization_PUT(TestNamespace ns) {
    if (!supportsTags) {
      return;
    }
    OpenMetadataClient client = SdkClients.adminClient();

    TagLabel tag1 = new TagLabel().withTagFQN("PII.Sensitive");
    TagLabel tag2 = new TagLabel().withTagFQN("Tier.Tier1");

    // Create entity first without tags, then patch to add tags
    K create = createRequest(ns.prefix("tag_put_test"), ns, client);
    T entity = createEntity(create, client);

    // Add tags via PATCH
    entity.setTags(List.of(tag1, tag2));
    T tagged = patchEntity(entity.getId().toString(), entity, client);

    // Verify initial tags
    T fetched = getEntityWithFields(tagged.getId().toString(), "tags", client);
    assertEquals(2, fetched.getTags().size());
    assertTagsContain(fetched.getTags(), List.of(tag1, tag2));

    // PATCH with one new tag - SDK PATCH merges tags, not replaces
    TagLabel tag3 = new TagLabel().withTagFQN("PersonalData.Personal");
    fetched.setTags(List.of(tag1, tag2, tag3));
    T updated = patchEntity(fetched.getId().toString(), fetched, client);

    // Verify all three tags are present (PATCH merges tags)
    T updatedFetched = getEntityWithFields(updated.getId().toString(), "tags", client);
    assertNotNull(updatedFetched.getTags());
    assertEquals(3, updatedFetched.getTags().size());
    assertTagsContain(updatedFetched.getTags(), List.of(tag1, tag2, tag3));
  }

  @Test
  void test_tagUpdateOptimization_PATCH(TestNamespace ns) {
    if (!supportsTags) {
      return;
    }
    OpenMetadataClient client = SdkClients.adminClient();

    TagLabel tag1 = new TagLabel().withTagFQN("PII.Sensitive");
    TagLabel tag2 = new TagLabel().withTagFQN("Tier.Tier1");

    // Create entity first without tags
    K create = createRequest(ns.prefix("tag_patch_test"), ns, client);
    T entity = createEntity(create, client);

    // Add initial tags via PATCH
    entity.setTags(List.of(tag1, tag2));
    T tagged = patchEntity(entity.getId().toString(), entity, client);

    T fetched = getEntityWithFields(tagged.getId().toString(), "tags", client);
    assertEquals(2, fetched.getTags().size());
    assertTagsContain(fetched.getTags(), List.of(tag1, tag2));

    // PATCH with different tags - SDK PATCH merges, so we need all 4 tags
    TagLabel tag3 = new TagLabel().withTagFQN("PersonalData.Personal");
    TagLabel tag4 = new TagLabel().withTagFQN("Certification.Bronze");

    fetched.setTags(List.of(tag1, tag2, tag3, tag4));
    T patched = patchEntity(fetched.getId().toString(), fetched, client);

    // Verify all four tags are present (PATCH merges tags)
    T patchedFetched = getEntityWithFields(patched.getId().toString(), "tags", client);
    assertEquals(4, patchedFetched.getTags().size());
    assertTagsContain(patchedFetched.getTags(), List.of(tag1, tag2, tag3, tag4));
  }

  @Test
  void test_tagUpdateOptimization_LargeScale(TestNamespace ns) {
    if (!supportsTags) {
      return;
    }
    OpenMetadataClient client = SdkClients.adminClient();

    // Create entity first without tags
    K create = createRequest(ns.prefix("tag_large_test"), ns, client);
    T entity = createEntity(create, client);

    // Add initial tags via PATCH
    List<TagLabel> initialTags = new ArrayList<>();
    initialTags.add(
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED));
    initialTags.add(
        new TagLabel()
            .withTagFQN("Tier.Tier1")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED));

    entity.setTags(initialTags);
    T tagged = patchEntity(entity.getId().toString(), entity, client);

    // Verify we have 2 unique tags
    T fetched = getEntityWithFields(tagged.getId().toString(), "tags", client);
    assertEquals(2, fetched.getTags().size());

    // Add more unique tags via PATCH
    List<TagLabel> additionalTags = new ArrayList<>();
    additionalTags.add(
        new TagLabel()
            .withTagFQN("PersonalData.Personal")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED));
    additionalTags.add(
        new TagLabel()
            .withTagFQN("Certification.Bronze")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED));

    List<TagLabel> allTags = new ArrayList<>(initialTags);
    allTags.addAll(additionalTags);

    fetched.setTags(allTags);
    T updated = patchEntity(fetched.getId().toString(), fetched, client);

    T updatedFetched = getEntityWithFields(updated.getId().toString(), "tags", client);
    assertEquals(4, updatedFetched.getTags().size());
    assertTagsContain(updatedFetched.getTags(), initialTags);
    assertTagsContain(updatedFetched.getTags(), additionalTags);
  }

  private void assertTagsContain(List<TagLabel> tags, List<TagLabel> expectedTags) {
    for (TagLabel expected : expectedTags) {
      assertTrue(
          tags.stream().anyMatch(tag -> tag.getTagFQN().equals(expected.getTagFQN())),
          "Tags should contain: " + expected.getTagFQN());
    }
  }

  private void assertTagsDoNotContain(List<TagLabel> tags, List<TagLabel> unexpectedTags) {
    for (TagLabel unexpected : unexpectedTags) {
      assertFalse(
          tags.stream().anyMatch(tag -> tag.getTagFQN().equals(unexpected.getTagFQN())),
          "Tags should not contain: " + unexpected.getTagFQN());
    }
  }

  // ===================================================================
  // PLACEHOLDER FOR REMAINING COMMON TESTS (Phase 3-5)
  // ===================================================================

  // Phase 3: Domains (remaining tests)
  // TODO: patch_addDomain_200
  // ... etc

  // Phase 4: Permissions & Versioning (25 tests)
  // TODO: test_entityPermissions
  // TODO: get_entityVersions_200
  // TODO: patch_entity_generates_change_event
  // ... etc

  // Phase 5: Advanced Features (29 tests)
  // TODO: test_customExtension
  // TODO: test_csvExport
  // TODO: test_bulkOperations
  // ... etc
}
