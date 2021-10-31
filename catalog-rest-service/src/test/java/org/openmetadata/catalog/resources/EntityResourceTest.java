package org.openmetadata.catalog.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.catalog.api.services.CreateMessagingService;
import org.openmetadata.catalog.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.catalog.api.services.CreatePipelineService;
import org.openmetadata.catalog.api.services.CreatePipelineService.PipelineServiceType;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.DatabaseServiceRepository.DatabaseServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.MessagingServiceRepository.MessagingServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.PipelineServiceRepository.PipelineServiceEntityInterface;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
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
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.resources.services.PipelineServiceResourceTest.createService;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.checkUserFollowing;
import static org.openmetadata.catalog.util.TestUtils.userAuthHeaders;

public abstract class EntityResourceTest<T> extends CatalogApplicationTest {
  private final Class<T> entityClass;
  private final String collectionName;
  private final String allFields;
  private final boolean supportsFollowers;

  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;

  public static EntityReference SNOWFLAKE_REFERENCE;
  public static EntityReference REDSHIFT_REFERENCE;
  public static EntityReference MYSQL_REFERENCE;
  public static EntityReference BIGQUERY_REFERENCE;

  public static EntityReference KAFKA_REFERENCE;
  public static EntityReference PULSAR_REFERENCE;
  public static EntityReference AIRFLOW_REFERENCE;
  public static EntityReference PREFECT_REFERENCE;

  public static final TagLabel USER_ADDRESS_TAG_LABEL = new TagLabel().withTagFQN("User.Address");
  public static final TagLabel USER_BANK_ACCOUNT_TAG_LABEL = new TagLabel().withTagFQN("User.BankAccount");
  public static final TagLabel TIER1_TAG_LABEL = new TagLabel().withTagFQN("Tier.Tier1");
  public static final TagLabel TIER2_TAG_LABEL = new TagLabel().withTagFQN("Tier.Tier2");

  public EntityResourceTest(Class<T> entityClass, String collectionName, String fields, boolean supportsFollowers) {
    this.entityClass = entityClass;
    this.collectionName = collectionName;
    this.allFields = fields;
    this.supportsFollowers = supportsFollowers;
  }

  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException, URISyntaxException {
    USER1 = UserResourceTest.createUser(UserResourceTest.create(test), authHeaders("test@open-metadata.org"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = TeamResourceTest.createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");

    // Create snowflake database service
    CreateDatabaseService createDatabaseService = new CreateDatabaseService()
            .withName(DatabaseServiceResourceTest.getName(test, 1))
            .withServiceType(DatabaseServiceType.Snowflake).withJdbc(TestUtils.JDBC_INFO);
    DatabaseService databaseService = DatabaseServiceResourceTest.createService(createDatabaseService,
            adminAuthHeaders());
    SNOWFLAKE_REFERENCE = new EntityReference().withName(databaseService.getName()).withId(databaseService.getId())
            .withType(Entity.DATABASE_SERVICE);

    createDatabaseService.withName("redshiftDB").withServiceType(DatabaseServiceType.Redshift);
    databaseService = DatabaseServiceResourceTest.createService(createDatabaseService, adminAuthHeaders());
    REDSHIFT_REFERENCE = new DatabaseServiceEntityInterface(databaseService).getEntityReference();

    createDatabaseService.withName("bigQueryDB").withServiceType(DatabaseServiceType.BigQuery);
    databaseService = DatabaseServiceResourceTest.createService(createDatabaseService, adminAuthHeaders());
    BIGQUERY_REFERENCE = new DatabaseServiceEntityInterface(databaseService).getEntityReference();

    createDatabaseService.withName("mysqlDB").withServiceType(DatabaseServiceType.MySQL);
    databaseService = DatabaseServiceResourceTest.createService(createDatabaseService, adminAuthHeaders());
    MYSQL_REFERENCE = new DatabaseServiceEntityInterface(databaseService).getEntityReference();

    // Create Kafka messaging service
    CreateMessagingService createMessaging = new CreateMessagingService().withName("kafka")
            .withServiceType(MessagingServiceType.Kafka).withBrokers(List.of("192.168.1.1:0"));
    MessagingService messagingService = MessagingServiceResourceTest.createService(createMessaging, adminAuthHeaders());
    KAFKA_REFERENCE = new MessagingServiceEntityInterface(messagingService).getEntityReference();

    // Create Pulsar messaging service
    createMessaging.withName("pulsar").withServiceType(MessagingServiceType.Pulsar)
            .withBrokers(List.of("192.168.1.1:0"));
    messagingService = MessagingServiceResourceTest.createService(createMessaging, adminAuthHeaders());
    PULSAR_REFERENCE = new MessagingServiceEntityInterface(messagingService).getEntityReference();

    // Create Airflow pipeline service
    CreatePipelineService createPipeline = new CreatePipelineService().withName("airflow")
            .withServiceType(PipelineServiceType.Airflow).withPipelineUrl(new URI("http://localhost:0"));
    PipelineService pipelineService = createService(createPipeline, adminAuthHeaders());
    AIRFLOW_REFERENCE = new PipelineServiceEntityInterface(pipelineService).getEntityReference();

    // Create Prefect pipeline service
    createPipeline.withName("prefect").withServiceType(PipelineServiceType.Prefect)
            .withPipelineUrl(new URI("http://localhost:0"));
    pipelineService = createService(createPipeline, adminAuthHeaders());
    PREFECT_REFERENCE = new PipelineServiceEntityInterface(pipelineService).getEntityReference();
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
    if (entityClass == User.class || entityClass == Team.class) {
      return; // User and team entity POST and PUSH are admin only operations
    }
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
    if (entityClass == User.class || entityClass == Team.class) {
      // Ignore the test - User and team entities can't be owned like other data assets
      return;
    }
    // Create an entity without owner
    Object request = createRequest(test, "description", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Set TEAM_OWNER1 as owner using PUT request
    request = createRequest(test, "description", "displayName", TEAM_OWNER1);
    ChangeDescription change = getChangeDescription(entityInterface.getVersion())
            .withFieldsAdded(Collections.singletonList("owner"));
    entity = updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
    entityInterface = getEntityInterface(entity);
    checkOwnerOwns(TEAM_OWNER1, entityInterface.getId(), true);

    // Change owner from TEAM_OWNER1 to USER_OWNER1 using PUT request
    request = createRequest(test, "description", "displayName", USER_OWNER1);
    change = getChangeDescription(entityInterface.getVersion()).withFieldsUpdated(Collections.singletonList("owner"));
    entity = updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
    entityInterface = getEntityInterface(entity);
    checkOwnerOwns(USER_OWNER1, entityInterface.getId(), true);
    checkOwnerOwns(TEAM_OWNER1, entityInterface.getId(), false);

    // Remove ownership (from USER_OWNER1) using PUT request
    request = createRequest(test, "description", "displayName", null);
    change = getChangeDescription(entityInterface.getVersion()).withFieldsDeleted(Collections.singletonList("owner"));
    updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
    checkOwnerOwns(USER_OWNER1, entityInterface.getId(), false);
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

  @Test
  public void put_addDeleteFollower_200(TestInfo test) throws HttpResponseException, URISyntaxException {
    if (!supportsFollowers) {
      return; // Entity does not support following
    }
    Object request = createRequest(test, "description", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    UUID entityId = getEntityInterface(entity).getId();

    // Add follower to the entity
    User user1 = UserResourceTest.createUser(UserResourceTest.create(test, 1), userAuthHeaders());
    addAndCheckFollower(entityId, user1.getId(), CREATED, 1, userAuthHeaders());

    // Add the same user as follower and make sure no errors are thrown and return response is OK (and not CREATED)
    addAndCheckFollower(entityId, user1.getId(), OK, 1, userAuthHeaders());

    // Add a new follower to the entity
    User user2 = UserResourceTest.createUser(UserResourceTest.create(test, 2), userAuthHeaders());
    addAndCheckFollower(entityId, user2.getId(), CREATED, 2, userAuthHeaders());

    // Delete followers and make sure they are deleted
    deleteAndCheckFollower(entityId, user1.getId(), 1, userAuthHeaders());
    deleteAndCheckFollower(entityId, user2.getId(), 0, userAuthHeaders());
  }

  @Test
  public void put_addDeleteInvalidFollower_200(TestInfo test) throws HttpResponseException, URISyntaxException {
    if (!supportsFollowers) {
      return; // Entity does not support following
    }
    Object request = createRequest(test, "description", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    UUID entityId = getEntityInterface(entity).getId();

    // Add non existent user as follower to the entity
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            addAndCheckFollower(entityId, NON_EXISTENT_ENTITY, CREATED, 1, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));

    // Delete non existent user as follower to the entity
    exception = assertThrows(HttpResponseException.class, () ->
            deleteAndCheckFollower(entityId, NON_EXISTENT_ENTITY, 1, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity functionality for tests
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  protected final WebTarget getCollection() {
    return getResource(collectionName);
  }

  protected final WebTarget getResource(UUID id) {
    return getResource(collectionName + "/" + id);
  }

  protected final WebTarget getFollowersCollection(UUID id) {
    return getResource(collectionName + "/" + id + "/followers");
  }

  protected final WebTarget getFollowerResource(UUID id, UUID userId) {
    return getResource(collectionName + "/" + id + "/followers/" + userId);
  }

  protected final T getEntity(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(id);
    target = target.queryParam("fields", allFields);
    return TestUtils.get(target, entityClass, authHeaders);
  }

  protected final T createEntity(Object createRequest, Map<String, String> authHeaders)
          throws HttpResponseException {
    return TestUtils.post(getCollection(), createRequest, entityClass, authHeaders);
  }

  protected final T updateEntity(Object updateRequest, Status status, Map<String, String> authHeaders)
          throws HttpResponseException {
    return TestUtils.put(getCollection(), updateRequest, entityClass, status, authHeaders);
  }

  protected final T patchEntity(UUID id, String originalJson, T updated, Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updatedEntityJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updatedEntityJson);
    return TestUtils.patch(getResource(id), patch, entityClass, authHeaders);
  }

  protected final T createAndCheckEntity(Object create, Map<String, String> authHeaders) throws HttpResponseException {
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

  protected final T updateAndCheckEntity(Object request, Status status, Map<String, String> authHeaders,
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

  protected final T patchEntityAndCheck(T updated, String originalJson, Map<String, String> authHeaders,
                                     UpdateType updateType, ChangeDescription expectedChange)
          throws JsonProcessingException, HttpResponseException {
    EntityInterface<T> entityInterface = getEntityInterface(updated);

    // Validate information returned in patch response has the updates
    T returned = patchEntity(entityInterface.getId(), originalJson, updated, authHeaders);
    validatePatchedEntity(updated, returned, authHeaders);
    validateChangeDescription(returned, updateType, expectedChange);

    // GET the entity and Validate information returned
    T getEntity = getEntity(entityInterface.getId(), authHeaders);
    validatePatchedEntity(updated, getEntity, authHeaders);
    validateChangeDescription(getEntity, updateType, expectedChange);
    return returned;
  }

  protected final void validateCommonEntityFields(EntityInterface<T> entity, String expectedDescription,
                                               String expectedUpdatedByUser, EntityReference expectedOwner) {
    assertNotNull(entity.getId());
    assertNotNull(entity.getHref());
    assertNotNull(entity.getFullyQualifiedName());
    assertEquals(expectedDescription, entity.getDescription());
    assertEquals(expectedUpdatedByUser, entity.getUpdatedBy());
    assertOwner(expectedOwner, entity.getOwner());
  }

  protected final void validateChangeDescription(T updated, UpdateType updateType,
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

  protected EntityHistory getVersionList(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/" + id + "/versions");
    return TestUtils.get(target, EntityHistory.class, authHeaders);
  }

  protected T getVersion(UUID id, Double version, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(collectionName + "/" + id + "/versions/" + version.toString());
    return TestUtils.get(target, entityClass, authHeaders);
  }

  protected static void assertFieldLists(List<String> expectedList, List<String> actualList) {
    expectedList.sort(Comparator.comparing(String::toString));
    actualList.sort(Comparator.comparing(String::toString));
    assertIterableEquals(expectedList, actualList);
  }

  protected ChangeDescription getChangeDescription(Double previousVersion) {
    return new ChangeDescription().withPreviousVersion(previousVersion)
            .withFieldsAdded(new ArrayList<>()).withFieldsUpdated(new ArrayList<>())
            .withFieldsDeleted(new ArrayList<>());
  }

  protected static void assertOwner(EntityReference expected, EntityReference actual) {
    if (expected != null) {
      TestUtils.validateEntityReference(actual);
      assertEquals(expected.getId(), actual.getId());
      assertEquals(expected.getType(), actual.getType());
    } else {
      assertNull(actual);
    }
  }
  protected static void assertService(EntityReference expected, EntityReference actual) {
    TestUtils.validateEntityReference(actual);
    assertEquals(expected.getId(), actual.getId());
    assertEquals(expected.getType(), actual.getType());
  }

  protected static void checkOwnerOwns(EntityReference owner, UUID entityId, boolean expectedOwning)
          throws HttpResponseException {
    if (owner != null) {
      UUID ownerId = owner.getId();
      List<EntityReference> ownsList;
      if (owner.getType().equals(Entity.USER)) {
        User user = UserResourceTest.getUser(ownerId, "owns", adminAuthHeaders());
        ownsList = user.getOwns();
      } else if (owner.getType().equals(Entity.TEAM)) {
        Team team = TeamResourceTest.getTeam(ownerId, "owns", adminAuthHeaders());
        ownsList = team.getOwns();
      } else {
        throw new IllegalArgumentException("Invalid owner type " + owner.getType());
      }

      boolean owning = false;
      for (EntityReference owns : ownsList) {
        TestUtils.validateEntityReference(owns);
        if (owns.getId().equals(entityId)) {
          owning = true;
          break;
        }
      }
      assertEquals(expectedOwning, owning, "Ownership not correct in the owns list for " + owner.getType());
    }
  }

  public void addAndCheckFollower(UUID entityId, UUID userId, Status status, int totalFollowerCount,
                                  Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getFollowersCollection(entityId);
    TestUtils.put(target, userId.toString(), status, authHeaders);

    // GET .../entity/{entityId} returns newly added follower
    T getEntity = getEntity(entityId, authHeaders);
    EntityInterface<T> entityInterface = getEntityInterface(getEntity);
    List<EntityReference> followers = entityInterface.getFollowers();

    assertEquals(totalFollowerCount, followers.size());
    TestUtils.validateEntityReference(followers);
    boolean followerFound = false;
    for (EntityReference follower : followers) {
      if (follower.getId().equals(userId)) {
        followerFound = true;
        break;
      }
    }
    assertTrue(followerFound, "Follower added was not found in " + entityClass + " get response");

    // GET .../users/{userId} shows user as following the entity
    checkUserFollowing(userId, entityId, true, authHeaders);
  }

  protected void deleteAndCheckFollower(UUID entityId, UUID userId, int totalFollowerCount,
                                      Map<String, String> authHeaders) throws HttpResponseException {
    // Delete the follower
    WebTarget target = getFollowerResource(entityId, userId);
    TestUtils.delete(target, authHeaders);

    // Get the entity and ensure the deleted follower is not in the followers list
    T getEntity = checkFollowerDeleted(entityId, userId, authHeaders);
    assertEquals(totalFollowerCount, getEntityInterface(getEntity).getFollowers().size());
  }

  public T checkFollowerDeleted(UUID entityId, UUID userId, Map<String, String> authHeaders)
          throws HttpResponseException {
    // Get the entity and ensure the deleted follower is not in the followers list
    T getEntity = getEntity(entityId, authHeaders);
    List<EntityReference> followers = getEntityInterface(getEntity).getFollowers();
    TestUtils.validateEntityReference(followers);
    boolean followerFound = false;
    for (EntityReference follower : followers) {
      if (follower.getId().equals(userId)) {
        followerFound = true;
        break;
      }
    }
    assertFalse(followerFound, "Follower deleted is still found in " + entityClass + " get response");

    // GET .../users/{userId} shows user as following the entity
    checkUserFollowing(userId, entityId, false, authHeaders);
    return getEntity;
  }
}
