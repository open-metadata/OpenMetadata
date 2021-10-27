package org.openmetadata.catalog.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.api.services.CreateMessagingService;
import org.openmetadata.catalog.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.jdbi3.MessagingServiceRepository.MessagingServiceEntityInterface;
import org.openmetadata.catalog.resources.services.MessagingServiceResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;
import org.openmetadata.common.utils.JsonSchemaUtil;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public abstract class EntityResourceTest<T> extends CatalogApplicationTest {
  private final Class<T> entityClass;
  private final String collectionName;
  private final String allFields;

  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;

  public static EntityReference KAFKA_REFERENCE;
  public static EntityReference PULSAR_REFERENCE;
  public static final TagLabel TIER1_TAG_LABEL = new TagLabel().withTagFQN("Tier.Tier1");
  public static final TagLabel TIER2_TAG_LABEL = new TagLabel().withTagFQN("Tier.Tier2");

  public EntityResourceTest(Class<T> entityClass, String collectionName, String fields) {
    this.entityClass = entityClass;
    this.collectionName = collectionName;
    this.allFields = fields;
  }

  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException, URISyntaxException {
    USER1 = UserResourceTest.createUser(UserResourceTest.create(test), authHeaders("test@open-metadata.org"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = TeamResourceTest.createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");

    CreateMessagingService createService = new CreateMessagingService().withName("kafka")
            .withServiceType(MessagingServiceType.Kafka).withBrokers(List.of("192.168.1.1:0"));
    MessagingService service = MessagingServiceResourceTest.createService(createService, adminAuthHeaders());
    KAFKA_REFERENCE = new MessagingServiceEntityInterface(service).getEntityReference();

    createService.withName("pulsar").withServiceType(MessagingServiceType.Pulsar).withBrokers(List.of("192.168.1.1:0"));
    service = MessagingServiceResourceTest.createService(createService, adminAuthHeaders());
    PULSAR_REFERENCE = new MessagingServiceEntityInterface(service).getEntityReference();
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Methods to be overridden entity test class
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  public abstract Object createRequest(TestInfo test, String description, String displayName, EntityReference owner) throws URISyntaxException;

  public abstract void validateCreatedEntity(T createdEntity, Object request, Map<String, String> authHeaders)
          throws HttpResponseException;

  public abstract void validateUpdatedEntity(T updatedEntity, Object request, Map<String, String> authHeaders)
          throws HttpResponseException;

  public abstract void validatePatchedEntity(T expected, T updated, Map<String, String> authHeaders)
          throws HttpResponseException;

  public abstract EntityInterface<T> getEntityInterface(T entity);

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for POST operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for PUT operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  public void put_entityCreate_200(TestInfo test) throws IOException, URISyntaxException {
    // Create a new entity with PUT
    Object request = createRequest(test, "description", "displayName", null);
    updateAndCheckEntity(request, CREATED, adminAuthHeaders(), UpdateType.CREATED, null);
  }

  @Test
  public void put_entityUpdateWithNoChange_200(TestInfo test) throws IOException, URISyntaxException {
    // Create a chart with POST
    Object request = createRequest(test, "description", "display", USER_OWNER1);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Update chart two times successfully with PUT requests
    ChangeDescription change = getChangeDescription(entityInterface.getVersion());
    updateAndCheckEntity(request, OK, adminAuthHeaders(), NO_CHANGE, change);
    updateAndCheckEntity(request, OK, adminAuthHeaders(), NO_CHANGE, change);
  }

  @Test
  public void put_entityCreate_as_owner_200(TestInfo test) throws IOException, URISyntaxException {
    // Create a new entity with PUT as admin user
    Object request = createRequest(test, null, null, USER_OWNER1);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Update the entity as USER_OWNER1
    request = createRequest(test, "newDescription", null, USER_OWNER1);
    ChangeDescription change = getChangeDescription(entityInterface.getVersion())
            .withFieldsAdded(Collections.singletonList("description"));
    updateAndCheckEntity(request, OK, authHeaders(USER1.getEmail()), MINOR_UPDATE, change);
  }

  @Test
  public void put_entityUpdateOwner_200(TestInfo test) throws IOException, URISyntaxException {
    Object request = createRequest(test, "description", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Add TEAM_OWNER1 as owner
    request = createRequest(test, "description", "displayName", TEAM_OWNER1);
    ChangeDescription change = getChangeDescription(entityInterface.getVersion())
            .withFieldsAdded(Collections.singletonList("owner"));
    entity = updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
    entityInterface = getEntityInterface(entity);

    // Change owner from TEAM_OWNER1 to USER_OWNER1
    request = createRequest(test, "description", "displayName", USER_OWNER1);
    change = getChangeDescription(entityInterface.getVersion()).withFieldsUpdated(Collections.singletonList("owner"));
    entity = updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
    entityInterface = getEntityInterface(entity);

    // Remove ownership
    request = createRequest(test, "description", "displayName", null);
    change = getChangeDescription(entityInterface.getVersion()).withFieldsDeleted(Collections.singletonList("owner"));
    updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void put_entityNullDescriptionUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    // Create entity with null description
    Object request = createRequest(test, null, "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Update null description with a new description
    request = createRequest(test, "updatedDescription", "displayName", null);
    ChangeDescription change = getChangeDescription(entityInterface.getVersion())
            .withFieldsAdded(Collections.singletonList("description"));
    updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void put_entityEmptyDescriptionUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    // Create entity with empty description
    Object request = createRequest(test, "", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Update empty description with a new description
    request = createRequest(test, "updatedDescription", "displayName", null);
    ChangeDescription change = getChangeDescription(entityInterface.getVersion())
            .withFieldsUpdated(Collections.singletonList("description"));
    updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void put_entityNonEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException, URISyntaxException {
    // Create entity with non-empty description
    Object request = createRequest(test, "description", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Update non-empty description with a new description
    Double oldVersion = entityInterface.getVersion();
    request = createRequest(test, "updatedDescription", "displayName", null);
    entity = updateEntity(request, OK, adminAuthHeaders());
    entityInterface = getEntityInterface(entity);
    assertEquals(oldVersion, entityInterface.getVersion());                 // Version did not change
    assertEquals("description", entityInterface.getDescription()); // Description did not change
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity functionality for tests
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  public final WebTarget getCollection() {
    return getResource(collectionName);
  }

  public final WebTarget getResource(UUID id) {
    return getResource(collectionName + "/" + id);
  }

  public final T getEntity(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(id);
    target = target.queryParam("fields", allFields);
    return TestUtils.get(target, entityClass, authHeaders);
  }

  public final T createEntity(Object createRequest, Map<String, String> authHeaders)
          throws HttpResponseException {
    return TestUtils.post(getCollection(), createRequest, entityClass, authHeaders);
  }

  public final T updateEntity(Object updateRequest, Status status, Map<String, String> authHeaders)
          throws HttpResponseException {
    return TestUtils.put(getCollection(), updateRequest, entityClass, status, authHeaders);
  }

  public final T patchEntity(UUID id, String originalJson, T updated, Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updatedTableJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updatedTableJson);
    return TestUtils.patch(getResource(id), patch, entityClass, authHeaders);
  }

  public final T createAndCheckEntity(Object create, Map<String, String> authHeaders) throws HttpResponseException {
    // Validate an entity that is created has all the information set in create request
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    T entity = createEntity(create, authHeaders);
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    assertEquals(updatedBy, entityInterface.getUpdatedBy());
    assertEquals(0.1, entityInterface.getVersion()); // First version of the entity
    validateCreatedEntity(entity, create, authHeaders);

    // GET the entity created and ensure it has all the information set in create request
    T getEntity = getEntity(entityInterface.getId(), authHeaders);
    assertEquals(0.1, entityInterface.getVersion()); // First version of the entity
    validateCreatedEntity(getEntity, create, authHeaders);

    return entity;
  }

  public T updateAndCheckEntity(Object request, Status status, Map<String, String> authHeaders,
                                UpdateType updateType, ChangeDescription changeDescription)
          throws IOException {
    T updated = updateEntity(request, status, authHeaders);
    EntityInterface<T> entityInterface = getEntityInterface(updated);
    validateUpdatedEntity(updated, request, authHeaders);
    validateChangeDescription(updated, updateType, changeDescription);

    // GET ../entity/{id}/versions to list the operation
    // Get a list of entity versions API and ensure it is correct
    EntityHistory history = getVersionList(entityInterface.getId(), authHeaders);
    T latestVersion = JsonUtils.readValue((String) history.getVersions().get(0), entityClass);
    validateChangeDescription(latestVersion, updateType, changeDescription);
    if (updateType == UpdateType.CREATED) {
      assertEquals(1, history.getVersions().size()); // PUT used for creating entity, there is only one version
    } else if (updateType != NO_CHANGE){
      // Entity changed by PUT. Check the previous version exists
      T previousVersion = JsonUtils.readValue((String) history.getVersions().get(1), entityClass);
      assertEquals(changeDescription.getPreviousVersion(), getEntityInterface(previousVersion).getVersion());
    }

    // GET ../entity/{id}/versions/{versionId} to get specific versions of the entity
    // Get the latest version of the entity from the versions API and ensure it is correct
    // TODO fix this
//    latestVersion = getVersion(entityInterface.getId(), entityInterface.getVersion(), authHeaders);
//    validateChangeDescription(latestVersion, updateType, changeDescription);
    if (updateType != NO_CHANGE && updateType != UpdateType.CREATED){
      // Get the previous version of the entity from the versions API and ensure it is correct
      T previousVersion = getVersion(entityInterface.getId(), changeDescription.getPreviousVersion(), authHeaders);
      assertEquals(changeDescription.getPreviousVersion(), getEntityInterface(previousVersion).getVersion());
    }

    // GET the newly updated database and validate
    T getEntity = getEntity(entityInterface.getId(), authHeaders);
    validateUpdatedEntity(getEntity, request, authHeaders);
    validateChangeDescription(getEntity, updateType, changeDescription);
    return updated;
  }

  public final T patchEntityAndCheck(T updated, String originalJson, Map<String, String> authHeaders,
                                     UpdateType updateType, ChangeDescription expectedChange)
          throws JsonProcessingException, HttpResponseException {
    EntityInterface<T> entityInterface = getEntityInterface(updated);

    // Validate information returned in patch response has the updates
    T returned = patchEntity(entityInterface.getId(), originalJson, updated, authHeaders);
    validatePatchedEntity(updated, returned, authHeaders);
    validateChangeDescription(returned, updateType, expectedChange);

    // GET the entity and Validate information returned
    T getEntity = getEntity(entityInterface.getId(), authHeaders);
    validatePatchedEntity(updated, returned, authHeaders);
    validateChangeDescription(getEntity, updateType, expectedChange);
    return returned;
  }

  public final void validateCommonEntityFields(EntityInterface<T> entity, String expectedDescription,
                                               String expectedUpdatedByUser, EntityReference expectedOwner) {
    assertNotNull(entity.getId());
    assertNotNull(entity.getHref());
    assertNotNull(entity.getFullyQualifiedName());
    assertEquals(expectedDescription, entity.getDescription());
    assertEquals(expectedUpdatedByUser, entity.getUpdatedBy());
    assertOwner(expectedOwner, entity.getOwner());
  }

  public final void validateChangeDescription(T updated, UpdateType updateType,
                                              ChangeDescription expectedChange) {
    EntityInterface<T> updatedEntityInterface = getEntityInterface(updated);
    if (updateType == UpdateType.CREATED) {
      return; // PUT operation was used to create an entity. No change description expected.
    }
    TestUtils.validateUpdate(expectedChange.getPreviousVersion(), updatedEntityInterface.getVersion(), updateType);

    if (updateType != UpdateType.NO_CHANGE) {
      ChangeDescription change = updatedEntityInterface.getChangeDescription();
      assertEquals(expectedChange.getPreviousVersion(), change.getPreviousVersion());

      assertFieldLists(expectedChange.getFieldsAdded(), change.getFieldsAdded());
      assertFieldLists(expectedChange.getFieldsUpdated(), change.getFieldsUpdated());
      assertFieldLists(expectedChange.getFieldsDeleted(), change.getFieldsDeleted());
    }
  }

  public EntityHistory getVersionList(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/" + id + "/versions");
    return TestUtils.get(target, EntityHistory.class, authHeaders);
  }

  public T getVersion(UUID id, Double version, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/" + id + "/versions/" + version.toString());
    return TestUtils.get(target, entityClass, authHeaders);
  }

  public void assertFieldLists(List<String> expectedList, List<String> actualList) {
    expectedList.sort(Comparator.comparing(String::toString));
    actualList.sort(Comparator.comparing(String::toString));
    assertIterableEquals(expectedList, actualList);
  }

  public ChangeDescription getChangeDescription(Double previousVersion) {
    return new ChangeDescription().withPreviousVersion(previousVersion)
            .withFieldsAdded(new ArrayList<>()).withFieldsUpdated(new ArrayList<>())
            .withFieldsDeleted(new ArrayList<>());
  }

  public static void assertOwner(EntityReference expected, EntityReference actual) {
    if (expected != null) {
      TestUtils.validateEntityReference(actual);
      assertEquals(expected.getId(), actual.getId());
      assertEquals(expected.getType(), actual.getType());
    } else {
      assertNull(actual);
    }
  }
  public static void assertService(EntityReference expected, EntityReference actual) {
    TestUtils.validateEntityReference(actual);
    assertEquals(expected.getId(), actual.getId());
    assertEquals(expected.getType(), actual.getType());
  }
}
