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

package org.openmetadata.catalog.resources;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.ENTITY_ALREADY_EXISTS;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.resources.teams.RoleResourceTest.createRole;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.ENTITY_NAME_LENGTH_ERROR;
import static org.openmetadata.catalog.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.UpdateType;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.checkUserFollowing;
import static org.openmetadata.catalog.util.TestUtils.userAuthHeaders;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Predicate;
import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.catalog.api.services.CreateMessagingService;
import org.openmetadata.catalog.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.catalog.api.services.CreatePipelineService;
import org.openmetadata.catalog.api.services.CreatePipelineService.PipelineServiceType;
import org.openmetadata.catalog.api.services.CreateStorageService;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.DatabaseServiceRepository.DatabaseServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.MessagingServiceRepository.MessagingServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.PipelineServiceRepository.PipelineServiceEntityInterface;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;
import org.openmetadata.catalog.resources.events.WebhookResourceTest;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.catalog.resources.services.MessagingServiceResourceTest;
import org.openmetadata.catalog.resources.services.PipelineServiceResourceTest;
import org.openmetadata.catalog.resources.services.StorageServiceResourceTest;
import org.openmetadata.catalog.resources.tags.TagResourceTest;
import org.openmetadata.catalog.resources.teams.RoleResource;
import org.openmetadata.catalog.resources.teams.RoleResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.StorageServiceType;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class EntityResourceTest<T> extends CatalogApplicationTest {
  private static final Map<String, EntityResourceTest<?>> ENTITY_RESOURCE_TEST_MAP = new HashMap<>();
  private final String entityType;
  private final Class<T> entityClass;
  private final Class<? extends ResultList<T>> entityListClass;
  protected final String collectionName;
  private final String allFields;
  private final boolean supportsFollowers;
  private final boolean supportsOwner;
  private final boolean supportsTags;
  protected boolean supportsPatch = true;
  protected boolean supportsSoftDelete = true;
  private final boolean supportsAuthorizedMetadataOperations;

  public static final String DATA_STEWARD_ROLE_NAME = "DataSteward";
  public static final String DATA_CONSUMER_ROLE_NAME = "DataConsumer";

  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static User USER_WITH_DATA_STEWARD_ROLE;
  public static Role DATA_STEWARD_ROLE;
  public static EntityReference DATA_STEWARD_ROLE_REFERENCE;
  public static User USER_WITH_DATA_CONSUMER_ROLE;
  public static Role DATA_CONSUMER_ROLE;
  public static EntityReference DATA_CONSUMER_ROLE_REFERENCE;
  public static Role ROLE1;
  public static EntityReference ROLE_REF1;

  public static EntityReference SNOWFLAKE_REFERENCE;
  public static EntityReference REDSHIFT_REFERENCE;
  public static EntityReference MYSQL_REFERENCE;
  public static EntityReference BIGQUERY_REFERENCE;

  public static EntityReference KAFKA_REFERENCE;
  public static EntityReference PULSAR_REFERENCE;
  public static EntityReference AIRFLOW_REFERENCE;
  public static EntityReference PREFECT_REFERENCE;

  public static EntityReference AWS_STORAGE_SERVICE_REFERENCE;
  public static EntityReference GCP_STORAGE_SERVICE_REFERENCE;

  public static TagLabel USER_ADDRESS_TAG_LABEL;
  public static TagLabel USER_BANK_ACCOUNT_TAG_LABEL;
  public static TagLabel PERSONAL_DATA_TAG_LABEL;
  public static TagLabel PII_SENSITIVE_TAG_LABEL;
  public static TagLabel TIER1_TAG_LABEL;
  public static TagLabel TIER2_TAG_LABEL;

  public EntityResourceTest(
      String entityTYpe,
      Class<T> entityClass,
      Class<? extends ResultList<T>> entityListClass,
      String collectionName,
      String fields,
      boolean supportsFollowers,
      boolean supportsOwner,
      boolean supportsTags,
      boolean supportsAuthorizedMetadataOperations) {
    this.entityType = entityTYpe;
    this.entityClass = entityClass;
    this.entityListClass = entityListClass;
    this.collectionName = collectionName;
    this.allFields = fields;
    this.supportsFollowers = supportsFollowers;
    this.supportsOwner = supportsOwner;
    this.supportsTags = supportsTags;
    this.supportsAuthorizedMetadataOperations = supportsAuthorizedMetadataOperations;
    ENTITY_RESOURCE_TEST_MAP.put(entityTYpe, this);
  }

  @BeforeAll
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    webhookCallbackResource.clearEvents();
    WebhookResourceTest webhookResourceTest = new WebhookResourceTest();
    webhookResourceTest.startWebhookSubscription();
    webhookResourceTest.startWebhookEntitySubscriptions(entityType);

    UserResourceTest userResourceTest = new UserResourceTest();
    USER1 = UserResourceTest.createUser(userResourceTest.create(test), adminAuthHeaders());
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType(Entity.USER);

    DATA_STEWARD_ROLE = RoleResourceTest.getRoleByName(DATA_STEWARD_ROLE_NAME, RoleResource.FIELDS, adminAuthHeaders());
    DATA_STEWARD_ROLE_REFERENCE = new EntityReference().withId(DATA_STEWARD_ROLE.getId()).withType(Entity.ROLE);
    USER_WITH_DATA_STEWARD_ROLE =
        UserResourceTest.createUser(
            UserResourceTest.create("user-data-steward").withRoles(List.of(DATA_STEWARD_ROLE.getId())),
            adminAuthHeaders());
    DATA_CONSUMER_ROLE =
        RoleResourceTest.getRoleByName(DATA_CONSUMER_ROLE_NAME, RoleResource.FIELDS, adminAuthHeaders());
    DATA_CONSUMER_ROLE_REFERENCE = new EntityReference().withId(DATA_CONSUMER_ROLE.getId()).withType(Entity.ROLE);
    USER_WITH_DATA_CONSUMER_ROLE =
        UserResourceTest.createUser(
            UserResourceTest.create("user-data-consumer").withRoles(List.of(DATA_CONSUMER_ROLE.getId())),
            adminAuthHeaders());

    TeamResourceTest teamResourceTest = new TeamResourceTest();
    TEAM1 = TeamResourceTest.createTeam(teamResourceTest.create(test), adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType(Entity.TEAM);

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    ROLE1 = createRole(roleResourceTest.create(test), adminAuthHeaders());
    ROLE_REF1 = new EntityReference().withId(ROLE1.getId()).withType("role");

    // Create snowflake database service
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    CreateDatabaseService createDatabaseService =
        new CreateDatabaseService()
            .withName(databaseServiceResourceTest.getEntityName(test, 1))
            .withServiceType(DatabaseServiceType.Snowflake)
            .withDatabaseConnection(TestUtils.DATABASE_CONNECTION);
    DatabaseService databaseService =
        new DatabaseServiceResourceTest().createEntity(createDatabaseService, adminAuthHeaders());
    SNOWFLAKE_REFERENCE =
        new EntityReference()
            .withName(databaseService.getName())
            .withId(databaseService.getId())
            .withType(Entity.DATABASE_SERVICE);

    createDatabaseService.withName("redshiftDB").withServiceType(DatabaseServiceType.Redshift);
    databaseService = databaseServiceResourceTest.createEntity(createDatabaseService, adminAuthHeaders());
    REDSHIFT_REFERENCE = new DatabaseServiceEntityInterface(databaseService).getEntityReference();

    createDatabaseService.withName("bigQueryDB").withServiceType(DatabaseServiceType.BigQuery);
    databaseService = databaseServiceResourceTest.createEntity(createDatabaseService, adminAuthHeaders());
    BIGQUERY_REFERENCE = new DatabaseServiceEntityInterface(databaseService).getEntityReference();

    createDatabaseService.withName("mysqlDB").withServiceType(DatabaseServiceType.MySQL);
    databaseService = databaseServiceResourceTest.createEntity(createDatabaseService, adminAuthHeaders());
    MYSQL_REFERENCE = new DatabaseServiceEntityInterface(databaseService).getEntityReference();

    // Create Kafka messaging service
    MessagingServiceResourceTest messagingServiceResourceTest = new MessagingServiceResourceTest();
    CreateMessagingService createMessaging =
        new CreateMessagingService()
            .withName("kafka")
            .withServiceType(MessagingServiceType.Kafka)
            .withBrokers(List.of("192.168.1.1:0"));
    MessagingService messagingService = messagingServiceResourceTest.createEntity(createMessaging, adminAuthHeaders());
    KAFKA_REFERENCE = new MessagingServiceEntityInterface(messagingService).getEntityReference();

    // Create Pulsar messaging service
    createMessaging
        .withName("pulsar")
        .withServiceType(MessagingServiceType.Pulsar)
        .withBrokers(List.of("192.168.1.1:0"));
    messagingService = messagingServiceResourceTest.createEntity(createMessaging, adminAuthHeaders());
    PULSAR_REFERENCE = new MessagingServiceEntityInterface(messagingService).getEntityReference();

    // Create Airflow pipeline service
    PipelineServiceResourceTest pipelineServiceResourceTest = new PipelineServiceResourceTest();
    CreatePipelineService createPipeline =
        new CreatePipelineService()
            .withName("airflow")
            .withServiceType(PipelineServiceType.Airflow)
            .withPipelineUrl(new URI("http://localhost:0"));
    PipelineService pipelineService = pipelineServiceResourceTest.createEntity(createPipeline, adminAuthHeaders());
    AIRFLOW_REFERENCE = new PipelineServiceEntityInterface(pipelineService).getEntityReference();

    // Create Prefect pipeline service
    createPipeline
        .withName("prefect")
        .withServiceType(PipelineServiceType.Prefect)
        .withPipelineUrl(new URI("http://localhost:0"));
    pipelineService = pipelineServiceResourceTest.createEntity(createPipeline, adminAuthHeaders());
    PREFECT_REFERENCE = new PipelineServiceEntityInterface(pipelineService).getEntityReference();

    // Create AWS storage service, S3
    CreateStorageService createService =
        new CreateStorageService().withName("s3").withServiceType(StorageServiceType.S3);
    StorageService service = new StorageServiceResourceTest().createEntity(createService, adminAuthHeaders());
    AWS_STORAGE_SERVICE_REFERENCE =
        new EntityReference().withName(service.getName()).withId(service.getId()).withType(Entity.STORAGE_SERVICE);

    // Create GCP storage service, GCS
    createService.withName("gs").withServiceType(StorageServiceType.GCS);
    service = new StorageServiceResourceTest().createEntity(createService, adminAuthHeaders());
    GCP_STORAGE_SERVICE_REFERENCE =
        new EntityReference().withName(service.getName()).withId(service.getId()).withType(Entity.STORAGE_SERVICE);

    USER_ADDRESS_TAG_LABEL = getTagLabel("User.Address");
    USER_BANK_ACCOUNT_TAG_LABEL = getTagLabel("User.BankAccount");
    PERSONAL_DATA_TAG_LABEL = getTagLabel("PersonalData.Personal");
    PII_SENSITIVE_TAG_LABEL = getTagLabel("PII.Sensitive");
    TIER1_TAG_LABEL = getTagLabel("Tier.Tier1");
    TIER2_TAG_LABEL = getTagLabel("Tier.Tier2");
  }

  private TagLabel getTagLabel(String tagName) throws HttpResponseException {
    Tag tag = TagResourceTest.getTag(tagName, adminAuthHeaders());
    return new TagLabel().withTagFQN(tag.getFullyQualifiedName()).withDescription(tag.getDescription());
  }

  @AfterAll
  public void afterAllTests() throws Exception {
    WebhookResourceTest webhookResourceTest = new WebhookResourceTest();
    webhookResourceTest.validateWebhookEvents();
    webhookResourceTest.validateWebhookEntityEvents(entityType);
    delete_recursiveTest();
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Methods to be overridden entity test class
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Create request such as CreateTable, CreateChart returned by concrete implementation
  public abstract Object createRequest(String name, String description, String displayName, EntityReference owner)
      throws URISyntaxException;

  // Add all possible relationships to check if the entity is missing any of them after deletion
  public T beforeDeletion(TestInfo test, T entity) throws HttpResponseException {
    return entity;
  }

  // Get container entity based on create request that has CONTAINS relationship to the entity created with this
  // request has . For table, it is database. For database, it is databaseService. See Relationship.CONTAINS for
  // details.
  public abstract EntityReference getContainer(Object createRequest) throws URISyntaxException;

  // Entity specific validate for entity create using POST
  public abstract void validateCreatedEntity(T createdEntity, Object request, Map<String, String> authHeaders)
      throws HttpResponseException;

  // Entity specific validate for entity create using PUT
  public abstract void validateUpdatedEntity(T updatedEntity, Object request, Map<String, String> authHeaders)
      throws HttpResponseException;

  protected void validateDeletedEntity(
      Object create, T entityBeforeDeletion, T entityAfterDeletion, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCreatedEntity(entityAfterDeletion, create, authHeaders);
  }

  // Entity specific validate for entity create using PATCH
  public abstract void compareEntities(T expected, T updated, Map<String, String> authHeaders)
      throws HttpResponseException;

  // Get interface to access all common entity attributes
  public abstract EntityInterface<T> getEntityInterface(T entity);

  // Do some preparation work right before calling validateGetWithDifferentFields.
  protected void prepareGetWithDifferentFields(T entity) throws HttpResponseException {}

  // Get an entity by ID and name with different fields. See TableResourceTest for example.
  public abstract void validateGetWithDifferentFields(T entity, boolean byName) throws HttpResponseException;

  // Assert field change in an entity recorded during PUT or POST operations
  public abstract void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException;

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for GET operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  void get_entityListWithPagination_200(TestInfo test) throws IOException, URISyntaxException {
    // Create a number of entities between 5 and 20 inclusive
    Random rand = new Random();
    int maxEntities = rand.nextInt(16) + 5;

    List<UUID> createdUUIDs = new ArrayList<>();
    for (int i = 0; i < maxEntities; i++) {
      createdUUIDs.add(
          getEntityInterface(createEntity(createRequest(getEntityName(test, i), null, null, null), adminAuthHeaders()))
              .getId());
    }

    T entity = createEntity(createRequest(getEntityName(test, -1), null, null, null), adminAuthHeaders());
    EntityInterface<T> deleted = getEntityInterface(entity);
    deleteAndCheckEntity(entity, adminAuthHeaders());

    Predicate<T> matchDeleted =
        e -> {
          EntityInterface<T> entityInterface = getEntityInterface(e);
          return entityInterface.getId().equals(deleted.getId());
        };

    for (String include : List.of("non-deleted", "all", "deleted")) {

      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("include", include);
            }
          };
      // List all entities and use it for checking pagination
      ResultList<T> allEntities = listEntities(queryParams, 1000000, null, null, adminAuthHeaders());
      int totalRecords = allEntities.getData().size();
      printEntities(allEntities);

      // List entity with limit set from 1 to maxTables size
      // Each time compare the returned list with allTables list to make sure right results are
      // returned
      for (int limit = 1; limit < maxEntities; limit++) {
        String after = null;
        String before;
        int pageCount = 0;
        int indexInAllTables = 0;
        ResultList<T> forwardPage;
        ResultList<T> backwardPage;
        boolean foundDeleted = false;
        do { // For each limit (or page size) - forward scroll till the end
          LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
          forwardPage = listEntities(queryParams, limit, null, after, adminAuthHeaders());
          foundDeleted = forwardPage.getData().stream().anyMatch(matchDeleted) || foundDeleted;
          after = forwardPage.getPaging().getAfter();
          before = forwardPage.getPaging().getBefore();
          assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);

          if (pageCount == 0) { // CASE 0 - First page is being returned. There is no before-cursor
            assertNull(before);
          } else {
            // Make sure scrolling back based on before cursor returns the correct result
            backwardPage = listEntities(queryParams, limit, before, null, adminAuthHeaders());
            assertEntityPagination(allEntities.getData(), backwardPage, limit, (indexInAllTables - limit));
          }

          printEntities(forwardPage);
          indexInAllTables += forwardPage.getData().size();
          pageCount++;
        } while (after != null);

        if ("all".equals(include) || "deleted".equals(include)) {
          assertTrue(!supportsSoftDelete || foundDeleted);
        } else { // non-delete
          assertFalse(foundDeleted);
        }

        // We have now reached the last page - test backward scroll till the beginning
        pageCount = 0;
        indexInAllTables = totalRecords - limit - forwardPage.getData().size();
        foundDeleted = false;
        do {
          LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
          forwardPage = listEntities(queryParams, limit, before, null, adminAuthHeaders());
          foundDeleted = forwardPage.getData().stream().anyMatch(matchDeleted) || foundDeleted;
          printEntities(forwardPage);
          before = forwardPage.getPaging().getBefore();
          assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);
          pageCount++;
          indexInAllTables -= forwardPage.getData().size();
        } while (before != null);

        if ("all".equals(include) || "deleted".equals(include)) {
          assertTrue(foundDeleted);
        } else { // non-delete
          assertFalse(foundDeleted);
        }
      }

      // before running "deleted" delete all created entries otherwise the test doesn't work with just one element.
      if ("all".equals(include)) {
        for (T e : allEntities.getData()) {
          EntityInterface<T> toBeDeleted = getEntityInterface(e);
          if (createdUUIDs.contains(toBeDeleted.getId()) && !toBeDeleted.isDeleted()) {
            deleteAndCheckEntity(e, adminAuthHeaders());
          }
        }
      }
    }
  }

  /** At the end of test for an entity, delete the parent container to test recursive delete functionality */
  private void delete_recursiveTest() throws URISyntaxException, IOException {
    // Finally, delete the container that contains the entities created for this test
    EntityReference container = getContainer(createRequest("deleteRecursive", "", "", null));
    if (container != null) {
      ResultList<T> listBeforeDeletion = listEntities(null, 1000, null, null, adminAuthHeaders());
      // Delete non-empty container entity and ensure deletion is not allowed
      EntityResourceTest<?> containerTest = ENTITY_RESOURCE_TEST_MAP.get(container.getType());
      HttpResponseException exception =
          assertThrows(
              HttpResponseException.class, () -> containerTest.deleteEntity(container.getId(), adminAuthHeaders()));
      assertResponse(exception, BAD_REQUEST, container.getType() + " is not empty");

      // Now delete the container with recursive flag on
      containerTest.deleteEntity(container.getId(), true, adminAuthHeaders());

      // Make sure entities contained are deleted and the new list operation returns 0 entities
      ResultList<T> listAfterDeletion = listEntities(null, 1000, null, null, adminAuthHeaders());
      listAfterDeletion
          .getData()
          .forEach(e -> assertNotEquals(getEntityInterface(e).getContainer().getId(), container.getId()));
      assertTrue(listAfterDeletion.getData().size() < listBeforeDeletion.getData().size());
    }
  }

  @Test
  void get_entityListWithInvalidLimit_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> listEntities(null, -1, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, () -> listEntities(null, 0, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception =
        assertThrows(HttpResponseException.class, () -> listEntities(null, 1000001, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  void get_entityListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> listEntities(null, 1, "", "", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  @Test
  void get_entityWithDifferentFields_200_OK(TestInfo test) throws IOException, URISyntaxException {
    Object create = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);
    T entity = createAndCheckEntity(create, adminAuthHeaders());
    prepareGetWithDifferentFields(entity);
    validateGetWithDifferentFields(entity, false);
    validateGetWithDifferentFields(entity, true);
  }

  @Test
  void get_deletedVersion(TestInfo test) throws IOException, URISyntaxException {
    Object create = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);
    T entity = createEntity(create, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    getEntity(entityInterface.getId(), null, allFields, adminAuthHeaders());
    deleteAndCheckEntity(entity, adminAuthHeaders());
    EntityHistory history = getVersionList(entityInterface.getId(), adminAuthHeaders());
    T latestVersion = JsonUtils.readValue((String) history.getVersions().get(0), entityClass);
    entityInterface = getEntityInterface(latestVersion);
    getVersion(entityInterface.getId(), entityInterface.getVersion(), adminAuthHeaders());
  }

  @Test
  void get_entityIncludeDeleted_200(TestInfo test) throws IOException, URISyntaxException {
    Object create = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);
    // Create first time using POST
    T entity = beforeDeletion(test, createEntity(create, adminAuthHeaders()));
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    T entityBeforeDeletion = getEntity(entityInterface.getId(), null, allFields, adminAuthHeaders());
    // delete it
    deleteAndCheckEntity(entity, adminAuthHeaders());
    assertResponse(
        () -> getEntity(entityInterface.getId(), Collections.emptyMap(), null, adminAuthHeaders()),
        NOT_FOUND,
        entityNotFound(entityType, entityInterface.getId()));
    assertResponse(
        () ->
            getEntityByName(entityInterface.getFullyQualifiedName(), Collections.emptyMap(), null, adminAuthHeaders()),
        NOT_FOUND,
        entityNotFound(entityType, entityInterface.getFullyQualifiedName()));

    Map<String, String> queryParams = new HashMap<>();
    for (String include : List.of("deleted", "all")) {
      queryParams.put("include", include);
      T entityAfterDeletion = getEntity(entityInterface.getId(), queryParams, allFields, adminAuthHeaders());
      validateDeletedEntity(create, entityBeforeDeletion, entityAfterDeletion, adminAuthHeaders());
      entityAfterDeletion =
          getEntityByName(entityInterface.getFullyQualifiedName(), queryParams, allFields, adminAuthHeaders());
      validateDeletedEntity(create, entityBeforeDeletion, entityAfterDeletion, adminAuthHeaders());
    }

    queryParams.put("include", "non-deleted");
    assertResponse(
        () -> getEntity(entityInterface.getId(), queryParams, null, adminAuthHeaders()),
        NOT_FOUND,
        entityNotFound(entityType, entityInterface.getId()));
    assertResponse(
        () -> getEntityByName(entityInterface.getFullyQualifiedName(), queryParams, null, adminAuthHeaders()),
        NOT_FOUND,
        entityNotFound(entityType, entityInterface.getFullyQualifiedName()));
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for POST operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  void post_entityCreateWithInvalidName_400() throws URISyntaxException {
    // Create an entity with mandatory name field null
    final Object request = createRequest(null, "description", "displayName", null);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(request, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name must not be null]");

    // Create an entity with mandatory name field empty
    final Object request1 = createRequest("", "description", "displayName", null);
    exception = assertThrows(HttpResponseException.class, () -> createEntity(request1, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, ENTITY_NAME_LENGTH_ERROR);

    // Create an entity with mandatory name field too long
    final Object request2 = createRequest(LONG_ENTITY_NAME, "description", "displayName", null);
    exception = assertThrows(HttpResponseException.class, () -> createEntity(request2, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, ENTITY_NAME_LENGTH_ERROR);
  }

  @Test
  void post_entityWithInvalidOwnerType_4xx(TestInfo test) throws URISyntaxException {
    if (!supportsOwner) {
      return;
    }
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */
    Object create = createRequest(getEntityName(test), "", "", owner);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  void post_entityWithNonExistentOwner_4xx(TestInfo test) throws URISyntaxException {
    if (!supportsOwner) {
      return;
    }
    EntityReference owner = new EntityReference().withId(NON_EXISTENT_ENTITY).withType("user");
    Object create = createRequest(getEntityName(test), "", "", owner);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));
  }

  @Test
  void post_entityAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException, URISyntaxException {
    Object create = createRequest(getEntityName(test), "", "", null);
    // Create first time using POST
    createEntity(create, adminAuthHeaders());
    // Second time creating the same entity using POST should fail
    assertResponse(() -> createEntity(create, adminAuthHeaders()), CONFLICT, ENTITY_ALREADY_EXISTS);
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for PUT operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  void put_entityCreate_200(TestInfo test) throws IOException, URISyntaxException {
    // Create a new entity with PUT
    Object request = createRequest(getEntityName(test), "description", "displayName", null);
    updateAndCheckEntity(request, CREATED, adminAuthHeaders(), UpdateType.CREATED, null);
  }

  @Test
  void put_entityUpdateWithNoChange_200(TestInfo test) throws IOException, URISyntaxException {
    // Create a chart with POST
    Object request = createRequest(getEntityName(test), "description", "display", USER_OWNER1);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Update chart two times successfully with PUT requests
    ChangeDescription change = getChangeDescription(entityInterface.getVersion());
    updateAndCheckEntity(request, OK, adminAuthHeaders(), NO_CHANGE, change);
    updateAndCheckEntity(request, OK, adminAuthHeaders(), NO_CHANGE, change);
  }

  @Test
  void put_entityCreate_as_owner_200(TestInfo test) throws IOException, URISyntaxException {
    if (!supportsOwner) {
      return; // Entity doesn't support ownership
    }
    // Create a new entity with PUT as admin user
    Object request = createRequest(getEntityName(test), null, null, USER_OWNER1);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Update the entity as USER_OWNER1
    request = createRequest(getEntityName(test), "newDescription", null, USER_OWNER1);
    FieldChange fieldChange = new FieldChange().withName("description").withNewValue("newDescription");
    ChangeDescription change =
        getChangeDescription(entityInterface.getVersion()).withFieldsAdded(Collections.singletonList(fieldChange));
    updateAndCheckEntity(request, OK, authHeaders(USER1.getEmail()), MINOR_UPDATE, change);
  }

  @Test
  void put_entityUpdateOwner_200(TestInfo test) throws IOException, URISyntaxException {
    if (!supportsOwner) {
      return; // Entity doesn't support ownership
    }
    // Create an entity without owner
    Object request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Set TEAM_OWNER1 as owner using PUT request
    FieldChange fieldChange = new FieldChange().withName("owner").withNewValue(TEAM_OWNER1);
    request = createRequest(getEntityName(test), "description", "displayName", TEAM_OWNER1);
    ChangeDescription change =
        getChangeDescription(entityInterface.getVersion()).withFieldsAdded(Collections.singletonList(fieldChange));
    entity = updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
    entityInterface = getEntityInterface(entity);
    checkOwnerOwns(TEAM_OWNER1, entityInterface.getId(), true);

    // Change owner from TEAM_OWNER1 to USER_OWNER1 using PUT request
    request = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);
    fieldChange = new FieldChange().withName("owner").withOldValue(TEAM_OWNER1).withNewValue(USER_OWNER1);
    change =
        getChangeDescription(entityInterface.getVersion()).withFieldsUpdated(Collections.singletonList(fieldChange));
    entity = updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
    entityInterface = getEntityInterface(entity);
    checkOwnerOwns(USER_OWNER1, entityInterface.getId(), true);
    checkOwnerOwns(TEAM_OWNER1, entityInterface.getId(), false);

    // Set the owner to the existing owner. No ownership change must be recorded.
    request = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);
    change = getChangeDescription(entityInterface.getVersion());
    entity = updateAndCheckEntity(request, OK, adminAuthHeaders(), NO_CHANGE, change);
    entityInterface = getEntityInterface(entity);
    checkOwnerOwns(USER_OWNER1, entityInterface.getId(), true);

    // Remove ownership (from USER_OWNER1) using PUT request. Owner is expected to remain the same
    // and not removed.
    request = createRequest(getEntityName(test), "description", "displayName", null);
    updateEntity(request, OK, adminAuthHeaders());
    checkOwnerOwns(USER_OWNER1, entityInterface.getId(), true);
  }

  @Test
  void put_entityNullDescriptionUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    // Create entity with null description
    Object request = createRequest(getEntityName(test), null, "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Update null description with a new description
    request = createRequest(getEntityName(test), "updatedDescription", "displayName", null);
    FieldChange fieldChange = new FieldChange().withName("description").withNewValue("updatedDescription");
    ChangeDescription change =
        getChangeDescription(entityInterface.getVersion()).withFieldsAdded(Collections.singletonList(fieldChange));
    updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  void put_entityEmptyDescriptionUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    // Create entity with empty description
    Object request = createRequest(getEntityName(test), "", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Update empty description with a new description
    request = createRequest(getEntityName(test), "updatedDescription", "displayName", null);
    ChangeDescription change = getChangeDescription(entityInterface.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("description").withOldValue("").withNewValue("updatedDescription"));
    updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  void put_entityNonEmptyDescriptionUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    // Create entity with non-empty description
    Object request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Update non-empty description with a new description
    Double oldVersion = entityInterface.getVersion();
    request = createRequest(getEntityName(test), "updatedDescription", "displayName", null);
    entity = updateEntity(request, OK, adminAuthHeaders());
    entityInterface = getEntityInterface(entity);
    // For service resources, we allow update of non-empty description via PUT
    List<Class<?>> services =
        Arrays.asList(DatabaseService.class, PipelineService.class, DashboardService.class, MessagingService.class);
    if (services.contains(entity.getClass())) {
      assertNotEquals(oldVersion, entityInterface.getVersion()); // Version did change
      assertEquals("updatedDescription", entityInterface.getDescription()); // Description did change
    } else {
      assertEquals(oldVersion, entityInterface.getVersion()); // Version did not change
      assertEquals("description", entityInterface.getDescription()); // Description did not change
    }
  }

  @Test
  void put_addDeleteFollower_200(TestInfo test) throws IOException, URISyntaxException {
    if (!supportsFollowers) {
      return; // Entity does not support following
    }
    Object request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    UUID entityId = getEntityInterface(entity).getId();

    // Add follower to the entity
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = UserResourceTest.createUser(userResourceTest.create(test, 1), userAuthHeaders());
    addAndCheckFollower(entityId, user1.getId(), CREATED, 1, userAuthHeaders());

    // Add the same user as follower and make sure no errors are thrown and return response is OK
    // (and not CREATED)
    addAndCheckFollower(entityId, user1.getId(), OK, 1, userAuthHeaders());

    // Add a new follower to the entity
    User user2 = UserResourceTest.createUser(userResourceTest.create(test, 2), userAuthHeaders());
    addAndCheckFollower(entityId, user2.getId(), CREATED, 2, userAuthHeaders());

    // Delete followers and make sure they are deleted
    deleteAndCheckFollower(entityId, user1.getId(), 1, userAuthHeaders());
    deleteAndCheckFollower(entityId, user2.getId(), 0, userAuthHeaders());
  }

  @Test
  void put_addFollowerDeleteEntity_200(TestInfo test) throws IOException, URISyntaxException {
    if (!supportsFollowers) {
      return; // Entity does not support following
    }
    Object request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    UUID entityId = getEntityInterface(entity).getId();

    // Add follower to the entity
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = UserResourceTest.createUser(userResourceTest.create(test, 1), userAuthHeaders());
    addAndCheckFollower(entityId, user1.getId(), CREATED, 1, userAuthHeaders());

    deleteEntity(entityId, adminAuthHeaders());

    Map<String, String> queryParams =
        new HashMap<>() {
          {
            put("include", "deleted");
          }
        };
    EntityInterface<T> entityInterface =
        getEntityInterface(getEntity(entityId, queryParams, "followers", adminAuthHeaders()));
    TestUtils.existsInEntityReferenceList(entityInterface.getFollowers(), user1.getId(), true);
  }

  @Test
  void put_addDeleteInvalidFollower_200(TestInfo test) throws IOException, URISyntaxException {
    if (!supportsFollowers) {
      return; // Entity does not support following
    }
    Object request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, adminAuthHeaders());
    UUID entityId = getEntityInterface(entity).getId();

    // Add non-existent user as follower to the entity
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> addAndCheckFollower(entityId, NON_EXISTENT_ENTITY, CREATED, 1, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));

    // Delete non-existent user as follower to the entity
    exception =
        assertThrows(
            HttpResponseException.class,
            () -> deleteAndCheckFollower(entityId, NON_EXISTENT_ENTITY, 1, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for PATCH operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  void patch_entityDescriptionAndTestAuthorizer(TestInfo test) throws IOException, URISyntaxException {
    if (!supportsPatch || !supportsAuthorizedMetadataOperations) {
      return;
    }

    T entity = createEntity(createRequest(getEntityName(test), "description", null, null), adminAuthHeaders());

    // Anyone can update description on unowned entity.
    entity = patchEntityAndCheckAuthorization(getEntityInterface(entity), TestUtils.ADMIN_USER_NAME, false);
    entity = patchEntityAndCheckAuthorization(getEntityInterface(entity), USER1.getName(), false);
    entity = patchEntityAndCheckAuthorization(getEntityInterface(entity), USER_WITH_DATA_STEWARD_ROLE.getName(), false);
    entity =
        patchEntityAndCheckAuthorization(getEntityInterface(entity), USER_WITH_DATA_CONSUMER_ROLE.getName(), false);

    EntityInterface<T> entityInterface = getEntityInterface(entity);

    if (!supportsOwner) {
      return;
    }

    // Set the owner for the table.
    String originalJson = JsonUtils.pojoToJson(entity);
    ChangeDescription change = getChangeDescription(entityInterface.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("owner").withNewValue(USER_OWNER1));
    entityInterface.setOwner(USER_OWNER1);
    entity =
        patchEntityAndCheck(
            entityInterface.getEntity(),
            originalJson,
            authHeaders(USER1.getName() + "@open-metadata.org"),
            MINOR_UPDATE,
            change);

    // Admin, owner (USER1) and user with DataSteward role can update description on entity owned by USER1.
    entity = patchEntityAndCheckAuthorization(getEntityInterface(entity), TestUtils.ADMIN_USER_NAME, false);
    entity = patchEntityAndCheckAuthorization(getEntityInterface(entity), USER1.getName(), false);
    entity = patchEntityAndCheckAuthorization(getEntityInterface(entity), USER_WITH_DATA_STEWARD_ROLE.getName(), false);
    patchEntityAndCheckAuthorization(getEntityInterface(entity), USER_WITH_DATA_CONSUMER_ROLE.getName(), true);
  }

  @Test
  void patch_entityAttributes_200_ok(TestInfo test) throws IOException, URISyntaxException {
    if (!supportsPatch) {
      return;
    }
    // Create entity without description, owner
    T entity = createEntity(createRequest(getEntityName(test), null, null, null), adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    assertListNull(entityInterface.getDescription(), entityInterface.getOwner());

    entity = getEntity(entityInterface.getId(), adminAuthHeaders());
    entityInterface = getEntityInterface(entity);

    //
    // Add displayName, description, owner, and tags when previously they were null
    //
    String origJson = JsonUtils.pojoToJson(entity);

    // Update entity
    entityInterface.setDescription("description");
    entityInterface.setDisplayName("displayName");

    // Field changes
    ChangeDescription change = getChangeDescription(entityInterface.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description"));
    change.getFieldsAdded().add(new FieldChange().withName("displayName").withNewValue("displayName"));
    if (supportsOwner) {
      entityInterface.setOwner(TEAM_OWNER1);
      change.getFieldsAdded().add(new FieldChange().withName("owner").withNewValue(TEAM_OWNER1));
    }
    if (supportsTags) {
      entityInterface.setTags(new ArrayList<>());
      entityInterface.getTags().add(USER_ADDRESS_TAG_LABEL);
      change.getFieldsAdded().add(new FieldChange().withName("tags").withNewValue(entityInterface.getTags()));
    }

    entity = patchEntityAndCheck(entity, origJson, adminAuthHeaders(), MINOR_UPDATE, change);
    entityInterface = getEntityInterface(entity);
    entityInterface.setOwner(TEAM_OWNER1); // Get rid of href and name in the response for owner

    //
    // Replace description, add tags tier, owner
    //
    origJson = JsonUtils.pojoToJson(entity);

    // Change entity
    entityInterface.setDescription("description1");
    entityInterface.setDisplayName("displayName1");

    // Field changes
    change = getChangeDescription(entityInterface.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("description").withOldValue("description").withNewValue("description1"));
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("displayName").withOldValue("displayName").withNewValue("displayName1"));
    if (supportsOwner) {
      entityInterface.setOwner(USER_OWNER1);
      change
          .getFieldsUpdated()
          .add(new FieldChange().withName("owner").withOldValue(TEAM_OWNER1).withNewValue(USER_OWNER1));
    }

    if (supportsTags) {
      entityInterface.getTags().add(TIER1_TAG_LABEL);
      change.getFieldsAdded().add(new FieldChange().withName("tags").withNewValue(List.of(TIER1_TAG_LABEL)));
    }

    entity = patchEntityAndCheck(entity, origJson, adminAuthHeaders(), MINOR_UPDATE, change);
    entityInterface = getEntityInterface(entity);

    entityInterface.setOwner(USER_OWNER1); // Get rid of href and name in the response for owner

    //
    // Remove description, tier, owner
    //
    origJson = JsonUtils.pojoToJson(entity);
    List<TagLabel> removedTags = entityInterface.getTags();

    entityInterface.setDescription(null);
    entityInterface.setDisplayName(null);
    entityInterface.setOwner(null);
    entityInterface.setTags(null);

    // Field changes
    change = getChangeDescription(entityInterface.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("description").withOldValue("description1"));
    change.getFieldsDeleted().add(new FieldChange().withName("displayName").withOldValue("displayName1"));
    if (supportsOwner) {
      change.getFieldsDeleted().add(new FieldChange().withName("owner").withOldValue(USER_OWNER1));
    }
    if (supportsTags) {
      change.getFieldsDeleted().add(new FieldChange().withName("tags").withOldValue(removedTags));
    }

    patchEntityAndCheck(entity, origJson, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  void patch_deleted_attribute_disallowed_400(TestInfo test)
      throws HttpResponseException, JsonProcessingException, URISyntaxException {
    if (!supportsPatch) {
      return;
    }
    // `deleted` attribute can't be set to true in PATCH operation & can only be done using DELETE operation
    T entity = createEntity(createRequest(getEntityName(test), "", "", null), adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    String json = JsonUtils.pojoToJson(entity);
    entityInterface.setDeleted(true);
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class, () -> patchEntity(entityInterface.getId(), json, entity, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute(entityType, "deleted"));
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for DELETE operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  void delete_nonExistentEntity_404() {
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> deleteEntity(NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound(entityType, NON_EXISTENT_ENTITY));
  }

  @Test
  void delete_entity_as_admin_200(TestInfo test) throws IOException, URISyntaxException {
    Object request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, adminAuthHeaders());
    deleteAndCheckEntity(entity, adminAuthHeaders());
  }

  @Test
  void delete_entity_as_non_admin_401(TestInfo test) throws HttpResponseException, URISyntaxException {
    Object request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, adminAuthHeaders());
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class, () -> deleteAndCheckEntity(entity, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  /** Soft delete an entity and then use PUT request to restore it back */
  @Test
  void delete_put_entity_200(TestInfo test) throws IOException, URISyntaxException {
    Object request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, adminAuthHeaders());
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    // Soft delete the entity
    deleteAndCheckEntity(entity, adminAuthHeaders());
    Double version = EntityUtil.nextVersion(entityInterface.getVersion()); // Version changes during soft-delete

    // Send PUT request (with no changes) to restore the entity from soft deleted state
    ChangeDescription change = getChangeDescription(version);
    change.getFieldsUpdated().add(new FieldChange().withName("deleted").withNewValue(false).withOldValue(true));
    updateAndCheckEntity(request, Response.Status.OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Other tests
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  void testInvalidEntityList() {
    // Invalid entityCreated list
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> getChangeEvents("invalidEntity", entityType, null, System.currentTimeMillis(), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Invalid entity invalidEntity in query param entityCreated");

    // Invalid entityUpdated list
    exception =
        assertThrows(
            HttpResponseException.class,
            () -> getChangeEvents(null, "invalidEntity", entityType, System.currentTimeMillis(), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Invalid entity invalidEntity in query param entityUpdated");

    // Invalid entityDeleted list
    exception =
        assertThrows(
            HttpResponseException.class,
            () -> getChangeEvents(entityType, null, "invalidEntity", System.currentTimeMillis(), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Invalid entity invalidEntity in query param entityDeleted");
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity functionality for tests
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  protected WebTarget getCollection() {
    return getResource(collectionName);
  }

  protected final WebTarget getResource(UUID id) {
    return getCollection().path("/" + id);
  }

  protected final WebTarget getResourceByName(String name) {
    return getCollection().path("/name/" + name);
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

  public final T getEntity(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(id);
    target = target.queryParam("fields", fields);
    return TestUtils.get(target, entityClass, authHeaders);
  }

  public final T getEntity(UUID id, Map<String, String> queryParams, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    for (Entry<String, String> entry : Optional.ofNullable(queryParams).orElse(Collections.emptyMap()).entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return TestUtils.get(target, entityClass, authHeaders);
  }

  protected final T getEntityByName(
      String name, Map<String, String> queryParams, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResourceByName(name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    for (Entry<String, String> entry : Optional.ofNullable(queryParams).orElse(Collections.emptyMap()).entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return TestUtils.get(target, entityClass, authHeaders);
  }

  public final T createEntity(Object createRequest, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getCollection(), createRequest, entityClass, authHeaders);
  }

  public final T updateEntity(Object updateRequest, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.put(getCollection(), updateRequest, entityClass, status, authHeaders);
  }

  public final T patchEntity(UUID id, String originalJson, T updated, Map<String, String> authHeaders)
      throws JsonProcessingException, HttpResponseException {
    String updatedEntityJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedEntityJson);
    return TestUtils.patch(getResource(id), patch, entityClass, authHeaders);
  }

  public final void deleteAndCheckEntity(T entity, Map<String, String> authHeaders) throws IOException {
    deleteAndCheckEntity(entity, false, authHeaders);
  }

  public final void deleteAndCheckEntity(T entity, boolean recursive, Map<String, String> authHeaders)
      throws IOException {
    EntityInterface<T> entityInterface = getEntityInterface(entity);
    UUID id = entityInterface.getId();
    long timestamp = System.currentTimeMillis();

    // Delete entity
    deleteEntity(id, recursive, authHeaders);

    // Validate delete change event
    Double expectedVersion = EntityUtil.nextVersion(entityInterface.getVersion());
    if (supportsSoftDelete) {
      validateDeletedEvent(id, timestamp, EventType.ENTITY_SOFT_DELETED, expectedVersion, authHeaders);

      // Validate that the entity version is updated after soft delete
      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("include", Include.DELETED.value());
            }
          };
      T getEntity = getEntity(id, queryParams, allFields, authHeaders);
      EntityInterface<T> getEntityInterface = getEntityInterface(getEntity);
      assertEquals(expectedVersion, getEntityInterface.getVersion());
      ChangeDescription change = getChangeDescription(entityInterface.getVersion());
      change.getFieldsUpdated().add(new FieldChange().withName("deleted").withOldValue(false).withNewValue(true));
      assertEquals(change, getEntityInterface.getChangeDescription());
    } else { // Hard delete
      validateDeletedEvent(id, timestamp, EventType.ENTITY_DELETED, entityInterface.getVersion(), authHeaders);
    }
  }

  public final void deleteEntity(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    deleteEntity(id, false, authHeaders);
  }

  public final void deleteEntity(UUID id, boolean recursive, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(id);
    if (recursive) {
      target = target.queryParam("recursive", true);
    }
    TestUtils.delete(target, entityClass, authHeaders);
    assertResponse(() -> getEntity(id, authHeaders), NOT_FOUND, entityNotFound(entityType, id));
  }

  public final T createAndCheckEntity(Object create, Map<String, String> authHeaders) throws IOException {
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

    // TODO GET the entity by name

    // Validate that change event was created
    validateChangeEvents(entityInterface, entityInterface.getUpdatedAt(), EventType.ENTITY_CREATED, null, authHeaders);
    return entity;
  }

  protected final T updateAndCheckEntity(
      Object request,
      Status status,
      Map<String, String> authHeaders,
      UpdateType updateType,
      ChangeDescription changeDescription)
      throws IOException {
    T updated = updateEntity(request, status, authHeaders);
    EntityInterface<T> entityInterface = getEntityInterface(updated);
    validateUpdatedEntity(updated, request, authHeaders);
    validateChangeDescription(updated, updateType, changeDescription);
    validateEntityHistory(entityInterface.getId(), updateType, changeDescription, authHeaders);
    validateLatestVersion(entityInterface, updateType, changeDescription, authHeaders);

    // GET the newly updated entity and validate
    T getEntity = getEntity(entityInterface.getId(), authHeaders);
    validateUpdatedEntity(getEntity, request, authHeaders);
    validateChangeDescription(getEntity, updateType, changeDescription);

    // Check if the entity change events are record
    if (updateType != NO_CHANGE) {
      EventType expectedEventType =
          updateType == UpdateType.CREATED ? EventType.ENTITY_CREATED : EventType.ENTITY_UPDATED;
      validateChangeEvents(
          entityInterface, entityInterface.getUpdatedAt(), expectedEventType, changeDescription, authHeaders);
    }
    return updated;
  }

  private void validateEntityHistory(
      UUID id, UpdateType updateType, ChangeDescription expectedChangeDescription, Map<String, String> authHeaders)
      throws IOException {
    // GET ../entity/{id}/versions to list the all the versions of an entity
    EntityHistory history = getVersionList(id, authHeaders);
    T latestVersion = JsonUtils.readValue((String) history.getVersions().get(0), entityClass);

    // Make sure the latest version has changeDescription as received during update
    validateChangeDescription(latestVersion, updateType, expectedChangeDescription);
    if (updateType == UpdateType.CREATED) {
      // PUT used for creating entity, there is only one version
      assertEquals(1, history.getVersions().size());
    } else if (updateType != NO_CHANGE) {
      // Entity changed by PUT. Check the previous version exists
      T previousVersion = JsonUtils.readValue((String) history.getVersions().get(1), entityClass);
      assertEquals(expectedChangeDescription.getPreviousVersion(), getEntityInterface(previousVersion).getVersion());
    }
  }

  private void validateLatestVersion(
      EntityInterface<T> entityInterface,
      UpdateType updateType,
      ChangeDescription expectedChangeDescription,
      Map<String, String> authHeaders)
      throws IOException {
    // GET ../entity/{id}/versions/{versionId} to get specific versions of the entity
    // Get the latest version of the entity from the versions API and ensure it is correct
    T latestVersion = getVersion(entityInterface.getId(), entityInterface.getVersion(), authHeaders);
    validateChangeDescription(latestVersion, updateType, expectedChangeDescription);
    if (updateType != NO_CHANGE && updateType != UpdateType.CREATED) {
      // Get the previous version of the entity from the versions API and ensure it is correct
      T prevVersion = getVersion(entityInterface.getId(), expectedChangeDescription.getPreviousVersion(), authHeaders);
      assertEquals(expectedChangeDescription.getPreviousVersion(), getEntityInterface(prevVersion).getVersion());
    }
  }

  protected final T patchEntityAndCheck(
      T updated,
      String originalJson,
      Map<String, String> authHeaders,
      UpdateType updateType,
      ChangeDescription expectedChange)
      throws IOException {
    EntityInterface<T> entityInterface = getEntityInterface(updated);

    // Validate information returned in patch response has the updates
    T returned = patchEntity(entityInterface.getId(), originalJson, updated, authHeaders);
    entityInterface = getEntityInterface(returned);

    compareEntities(updated, returned, authHeaders);
    validateChangeDescription(returned, updateType, expectedChange);
    validateEntityHistory(entityInterface.getId(), updateType, expectedChange, authHeaders);
    validateLatestVersion(entityInterface, updateType, expectedChange, authHeaders);

    // GET the entity and Validate information returned
    T getEntity = getEntity(entityInterface.getId(), authHeaders);
    compareEntities(updated, getEntity, authHeaders);
    validateChangeDescription(getEntity, updateType, expectedChange);

    // Check if the entity change events are record
    if (updateType != NO_CHANGE) {
      EventType expectedEventType =
          updateType == UpdateType.CREATED ? EventType.ENTITY_CREATED : EventType.ENTITY_UPDATED;
      validateChangeEvents(
          entityInterface, entityInterface.getUpdatedAt(), expectedEventType, expectedChange, authHeaders);
    }
    return returned;
  }

  T patchEntityAndCheckAuthorization(EntityInterface<T> entityInterface, String userName, boolean shouldThrowException)
      throws IOException {
    T entity = entityInterface.getEntity();
    String originalJson = JsonUtils.pojoToJson(entity);

    String originalDescription = entityInterface.getDescription();
    String newDescription = String.format("Description added by %s", userName);
    ChangeDescription change = getChangeDescription(entityInterface.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("description").withOldValue(originalDescription).withNewValue(newDescription));

    entityInterface.setDescription(newDescription);

    if (shouldThrowException) {
      HttpResponseException exception =
          assertThrows(
              HttpResponseException.class,
              () ->
                  patchEntity(
                      entityInterface.getId(), originalJson, entity, authHeaders(userName + "@open-metadata.org")));
      assertResponse(
          exception,
          FORBIDDEN,
          String.format(
              "Principal: CatalogPrincipal{name='%s'} does not have permission to UpdateDescription", userName));
      // Revert to original.
      entityInterface.setDescription(originalDescription);
      return entityInterface.getEntity();
    }
    return patchEntityAndCheck(
        entity, originalJson, authHeaders(userName + "@open-metadata.org"), MINOR_UPDATE, change);
  }

  protected final void validateCommonEntityFields(
      EntityInterface<T> entity,
      String expectedDescription,
      String expectedUpdatedByUser,
      EntityReference expectedOwner) {
    assertListNotNull(entity.getId(), entity.getHref(), entity.getFullyQualifiedName());
    assertEquals(expectedDescription, entity.getDescription());
    assertEquals(expectedUpdatedByUser, entity.getUpdatedBy());
    assertReference(expectedOwner, entity.getOwner());
  }

  protected final void validateChangeDescription(T updated, UpdateType updateType, ChangeDescription expectedChange)
      throws IOException {
    EntityInterface<T> updatedEntityInterface = getEntityInterface(updated);
    if (updateType == UpdateType.CREATED) {
      return; // PUT operation was used to create an entity. No change description expected.
    }
    TestUtils.validateUpdate(expectedChange.getPreviousVersion(), updatedEntityInterface.getVersion(), updateType);

    if (updateType != UpdateType.NO_CHANGE) {
      assertChangeDescription(expectedChange, updatedEntityInterface.getChangeDescription());
    }
  }

  private void assertChangeDescription(ChangeDescription expected, ChangeDescription actual) throws IOException {
    assertEquals(expected.getPreviousVersion(), actual.getPreviousVersion());
    assertFieldLists(expected.getFieldsAdded(), actual.getFieldsAdded());
    assertFieldLists(expected.getFieldsUpdated(), actual.getFieldsUpdated());
    assertFieldLists(expected.getFieldsDeleted(), actual.getFieldsDeleted());
  }

  /**
   * This method validates the change event created after POST, PUT, and PATCH operations and ensures entityCreate,
   * entityUpdated, and entityDeleted change events are created in the system with valid date.
   */
  protected final void validateChangeEvents(
      EntityInterface<T> entityInterface,
      long timestamp,
      EventType expectedEventType,
      ChangeDescription expectedChangeDescription,
      Map<String, String> authHeaders)
      throws IOException {
    validateChangeEvents(entityInterface, timestamp, expectedEventType, expectedChangeDescription, authHeaders, true);
    validateChangeEvents(entityInterface, timestamp, expectedEventType, expectedChangeDescription, authHeaders, false);
  }

  private void validateChangeEvents(
      EntityInterface<T> entityInterface,
      long timestamp,
      EventType expectedEventType,
      ChangeDescription expectedChangeDescription,
      Map<String, String> authHeaders,
      boolean withEventFilter)
      throws IOException {
    ResultList<ChangeEvent> changeEvents;
    ChangeEvent changeEvent = null;

    int iteration = 0;
    while (changeEvent == null && iteration < 25) {
      iteration++;
      // Sometimes change event is not returned on quickly querying with a millisecond
      // Try multiple times before giving up
      if (withEventFilter) {
        // Get change event with an event filter for specific entity type
        changeEvents = getChangeEvents(entityType, entityType, null, timestamp, authHeaders);
      } else {
        // Get change event with no event filter for entity types
        changeEvents = getChangeEvents("*", "*", null, timestamp, authHeaders);
      }

      if (changeEvents == null || changeEvents.getData().size() == 0) {
        try {
          Thread.sleep(iteration * 10L); // Sleep with backoff
        } catch (InterruptedException e) {
          e.printStackTrace();
        }
        continue;
      }

      for (ChangeEvent event : changeEvents.getData()) {
        if (event.getTimestamp() == timestamp) {
          changeEvent = event;
          break;
        }
      }
    }

    assertNotNull(
        changeEvent,
        "Expected change event "
            + expectedEventType
            + " at "
            + timestamp
            + " was not found for entity "
            + entityInterface.getId());

    assertEquals(expectedEventType, changeEvent.getEventType());
    assertEquals(entityType, changeEvent.getEntityType());
    assertEquals(entityInterface.getId(), changeEvent.getEntityId());
    assertEquals(entityInterface.getVersion(), changeEvent.getCurrentVersion());
    assertEquals(TestUtils.getPrincipal(authHeaders), changeEvent.getUserName());

    //
    // previous, entity, changeDescription
    //
    if (expectedEventType == EventType.ENTITY_CREATED) {
      assertEquals(changeEvent.getEventType(), EventType.ENTITY_CREATED);
      assertEquals(changeEvent.getPreviousVersion(), 0.1);
      assertNull(changeEvent.getChangeDescription());
      compareEntities(
          entityInterface.getEntity(), JsonUtils.readValue((String) changeEvent.getEntity(), entityClass), authHeaders);
    } else if (expectedEventType == EventType.ENTITY_UPDATED) {
      assertChangeDescription(expectedChangeDescription, changeEvent.getChangeDescription());
    } else if (expectedEventType == EventType.ENTITY_DELETED) {
      assertListNull(changeEvent.getEntity(), changeEvent.getChangeDescription());
    }
  }

  private void validateDeletedEvent(
      UUID id, long timestamp, EventType expectedEventType, Double expectedVersion, Map<String, String> authHeaders)
      throws IOException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    ResultList<ChangeEvent> changeEvents;
    ChangeEvent changeEvent = null;

    int iteration = 0;
    while (changeEvent == null && iteration < 25) {
      iteration++;
      changeEvents = getChangeEvents(null, null, entityType, timestamp, authHeaders);

      if (changeEvents == null || changeEvents.getData().size() == 0) {
        try {
          Thread.sleep(iteration * 10L); // Sleep with backoff
        } catch (InterruptedException e) {
          e.printStackTrace();
        }
        continue;
      }
      for (ChangeEvent event : changeEvents.getData()) {
        if (event.getEntityId().equals(id)) {
          changeEvent = event;
          break;
        }
      }
    }

    assertNotNull(changeEvent, "Deleted event after " + timestamp + " was not found for entity " + id);
    assertEquals(expectedEventType, changeEvent.getEventType());
    assertEquals(entityType, changeEvent.getEntityType());
    assertEquals(id, changeEvent.getEntityId());
    assertEquals(expectedVersion, changeEvent.getCurrentVersion());
    assertEquals(updatedBy, changeEvent.getUserName());
  }

  protected EntityHistory getVersionList(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(id).path("/versions");
    return TestUtils.get(target, EntityHistory.class, authHeaders);
  }

  protected ResultList<ChangeEvent> getChangeEvents(
      String entityCreated, String entityUpdated, String entityDeleted, long timestamp, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("events");
    target = entityCreated == null ? target : target.queryParam("entityCreated", entityCreated);
    target = entityUpdated == null ? target : target.queryParam("entityUpdated", entityUpdated);
    target = entityDeleted == null ? target : target.queryParam("entityDeleted", entityDeleted);
    target = target.queryParam("timestamp", timestamp);
    return TestUtils.get(target, ChangeEventList.class, authHeaders);
  }

  protected T getVersion(UUID id, Double version, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(id).path("/versions/" + version.toString());
    return TestUtils.get(target, entityClass, authHeaders);
  }

  protected final void assertFieldLists(List<FieldChange> expectedList, List<FieldChange> actualList)
      throws IOException {
    expectedList.sort(EntityUtil.compareFieldChange);
    actualList.sort(EntityUtil.compareFieldChange);
    assertEquals(expectedList.size(), actualList.size());

    for (int i = 0; i < expectedList.size(); i++) {
      assertEquals(expectedList.get(i).getName(), actualList.get(i).getName());
      assertFieldChange(
          expectedList.get(i).getName(), expectedList.get(i).getNewValue(), actualList.get(i).getNewValue());
      assertFieldChange(
          expectedList.get(i).getName(), expectedList.get(i).getOldValue(), actualList.get(i).getOldValue());
    }
  }

  protected final void assertCommonFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.endsWith("owner")) {
      EntityReference expectedRef = (EntityReference) expected;
      EntityReference actualRef = JsonUtils.readValue(actual.toString(), EntityReference.class);
      assertEquals(expectedRef.getId(), actualRef.getId());
    } else if (fieldName.endsWith("tags")) {
      @SuppressWarnings("unchecked")
      List<TagLabel> expectedTags = (List<TagLabel>) expected;
      List<TagLabel> actualTags = JsonUtils.readObjects(actual.toString(), TagLabel.class);
      assertTrue(actualTags.containsAll(expectedTags));
    } else {
      // All the other fields
      assertEquals(expected, actual, "Field name " + fieldName);
    }
  }

  protected ChangeDescription getChangeDescription(Double previousVersion) {
    return new ChangeDescription()
        .withPreviousVersion(previousVersion)
        .withFieldsAdded(new ArrayList<>())
        .withFieldsUpdated(new ArrayList<>())
        .withFieldsDeleted(new ArrayList<>());
  }

  protected static void assertReference(EntityReference expected, EntityReference actual) {
    if (expected != null) {
      assertNotNull(actual);
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
        User user = new UserResourceTest().getEntity(ownerId, "owns", adminAuthHeaders());
        ownsList = user.getOwns();
      } else if (owner.getType().equals(Entity.TEAM)) {
        Team team = TeamResourceTest.getTeam(ownerId, "owns", adminAuthHeaders());
        ownsList = team.getOwns();
      } else {
        throw new IllegalArgumentException("Invalid owner type " + owner.getType());
      }

      TestUtils.existsInEntityReferenceList(ownsList, entityId, expectedOwning);
    }
  }

  public void addAndCheckFollower(
      UUID entityId, UUID userId, Status status, int totalFollowerCount, Map<String, String> authHeaders)
      throws IOException {
    WebTarget target = getFollowersCollection(entityId);
    ChangeEvent event = TestUtils.put(target, userId.toString(), ChangeEvent.class, status, authHeaders);

    // GET .../entity/{entityId} returns newly added follower
    T getEntity = getEntity(entityId, authHeaders);
    EntityInterface<T> entityInterface = getEntityInterface(getEntity);
    List<EntityReference> followers = entityInterface.getFollowers();

    assertEquals(totalFollowerCount, followers.size());
    TestUtils.validateEntityReference(followers);
    TestUtils.existsInEntityReferenceList(followers, userId, true);

    // GET .../users/{userId} shows user as following the entity
    checkUserFollowing(userId, entityId, true, authHeaders);

    // Validate change events
    validateChangeEvents(
        entityInterface, event.getTimestamp(), EventType.ENTITY_UPDATED, event.getChangeDescription(), authHeaders);
  }

  protected void deleteAndCheckFollower(
      UUID entityId, UUID userId, int totalFollowerCount, Map<String, String> authHeaders) throws IOException {
    // Delete the follower
    WebTarget target = getFollowerResource(entityId, userId);
    ChangeEvent change = TestUtils.delete(target, ChangeEvent.class, authHeaders);

    // Get the entity and ensure the deleted follower is not in the followers list
    T getEntity = checkFollowerDeleted(entityId, userId, authHeaders);
    EntityInterface<T> entityInterface = getEntityInterface(getEntity);
    assertEquals(totalFollowerCount, getEntityInterface(getEntity).getFollowers().size());

    // Validate change events
    validateChangeEvents(
        entityInterface, change.getTimestamp(), EventType.ENTITY_UPDATED, change.getChangeDescription(), authHeaders);
  }

  public T checkFollowerDeleted(UUID entityId, UUID userId, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Get the entity and ensure the deleted follower is not in the followers list
    T getEntity = getEntity(entityId, authHeaders);
    List<EntityReference> followers = getEntityInterface(getEntity).getFollowers();
    TestUtils.validateEntityReference(followers);
    TestUtils.existsInEntityReferenceList(followers, userId, false);
    return getEntity;
  }

  public ResultList<T> listEntities(Map<String, String> queryParams, Map<String, String> authHeaders)
      throws HttpResponseException {
    return listEntities(queryParams, null, null, null, authHeaders);
  }

  public ResultList<T> listEntities(
      Map<String, String> queryParams, Integer limit, String before, String after, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection();
    for (Entry<String, String> entry : Optional.ofNullable(queryParams).orElse(Collections.emptyMap()).entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }

    target = limit != null ? target.queryParam("limit", limit) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, entityListClass, authHeaders);
  }

  private void printEntities(ResultList<T> list) {
    list.getData().forEach(e -> LOG.info("{} {}", entityClass, getEntityInterface(e).getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  /**
   * Given a list of properties of an Entity (e.g., List<Column> or List<MlFeature> and a function that validate the
   * elements of T, validate lists
   */
  public <P> void assertListProperty(List<P> expected, List<P> actual, BiConsumer<P, P> validate) {
    if (expected == null && actual == null) {
      return;
    }

    assertNotNull(expected);
    assertEquals(expected.size(), actual.size());
    for (int i = 0; i < expected.size(); i++) {
      validate.accept(expected.get(i), actual.get(i));
    }
  }

  public final String getEntityName(TestInfo test) {
    return String.format("%s_%s", entityType, test.getDisplayName());
  }

  public final String getEntityName(TestInfo test, int index) {
    return String.format("%s_%d_%s", entityType, index, test.getDisplayName());
  }
}
