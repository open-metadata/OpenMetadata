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

import static java.lang.String.format;
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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.Entity.FIELD_DELETED;
import static org.openmetadata.catalog.Entity.FIELD_EXTENSION;
import static org.openmetadata.catalog.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.Entity.FIELD_TAGS;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.ENTITY_ALREADY_EXISTS;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityIsNotEmpty;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.noPermission;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.notAdmin;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.readOnlyAttribute;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.ENTITY_NAME_LENGTH_ERROR;
import static org.openmetadata.catalog.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.catalog.util.TestUtils.UpdateType;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertListNotEmpty;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;
import static org.openmetadata.catalog.util.TestUtils.checkUserFollowing;
import static org.openmetadata.catalog.util.TestUtils.validateEntityReference;
import static org.openmetadata.catalog.util.TestUtils.validateEntityReferences;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
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
import org.openmetadata.catalog.CreateEntity;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.api.data.TermReference;
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.entity.Type;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.DatabaseSchema;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.entity.type.Category;
import org.openmetadata.catalog.entity.type.CustomProperty;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;
import org.openmetadata.catalog.resources.events.WebhookResourceTest;
import org.openmetadata.catalog.resources.glossary.GlossaryResourceTest;
import org.openmetadata.catalog.resources.metadata.TypeResourceTest;
import org.openmetadata.catalog.resources.services.DashboardServiceResourceTest;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.catalog.resources.services.MessagingServiceResourceTest;
import org.openmetadata.catalog.resources.services.PipelineServiceResourceTest;
import org.openmetadata.catalog.resources.services.StorageServiceResourceTest;
import org.openmetadata.catalog.resources.tags.TagResourceTest;
import org.openmetadata.catalog.resources.teams.RoleResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class EntityResourceTest<T extends EntityInterface, K extends CreateEntity>
    extends CatalogApplicationTest {
  private static final Map<String, EntityResourceTest<? extends EntityInterface, ? extends CreateEntity>>
      ENTITY_RESOURCE_TEST_MAP = new HashMap<>();
  private final String entityType;
  protected final Class<T> entityClass;
  private final Class<? extends ResultList<T>> entityListClass;
  protected final String collectionName;
  private final String allFields;
  protected final boolean supportsFollowers;
  protected boolean supportsOwner;
  protected final boolean supportsTags;
  protected boolean supportsPatch = true;
  protected boolean supportsSoftDelete;
  protected boolean supportsAuthorizedMetadataOperations = true;
  protected boolean supportsFieldsQueryParam = true;
  protected boolean supportsEmptyDescription = true;
  protected boolean supportsNameWithDot = true;
  protected final boolean supportsCustomExtension;

  public static final String DATA_STEWARD_ROLE_NAME = "DataSteward";
  public static final String DATA_CONSUMER_ROLE_NAME = "DataConsumer";

  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static User USER2;
  public static EntityReference USER_OWNER2;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static User USER_WITH_DATA_STEWARD_ROLE;
  public static Role DATA_STEWARD_ROLE;
  public static EntityReference DATA_STEWARD_ROLE_REFERENCE;
  public static User USER_WITH_DATA_CONSUMER_ROLE;
  public static Role DATA_CONSUMER_ROLE;
  public static EntityReference DATA_CONSUMER_ROLE_REFERENCE;
  public static Role ROLE1;
  public static EntityReference ROLE1_REFERENCE;

  public static EntityReference SNOWFLAKE_REFERENCE;
  public static EntityReference REDSHIFT_REFERENCE;
  public static EntityReference MYSQL_REFERENCE;
  public static EntityReference BIGQUERY_REFERENCE;

  public static EntityReference KAFKA_REFERENCE;
  public static EntityReference PULSAR_REFERENCE;
  public static EntityReference AIRFLOW_REFERENCE;
  public static EntityReference GLUE_REFERENCE;

  public static EntityReference AWS_STORAGE_SERVICE_REFERENCE;
  public static EntityReference GCP_STORAGE_SERVICE_REFERENCE;

  public static TagLabel USER_ADDRESS_TAG_LABEL;
  public static TagLabel PERSONAL_DATA_TAG_LABEL;
  public static TagLabel PII_SENSITIVE_TAG_LABEL;
  public static TagLabel TIER1_TAG_LABEL;
  public static TagLabel TIER2_TAG_LABEL;

  public static Glossary GLOSSARY1;
  public static EntityReference GLOSSARY1_REF;
  public static Glossary GLOSSARY2;
  public static EntityReference GLOSSARY2_REF;

  public static GlossaryTerm GLOSSARY1_TERM1;
  public static EntityReference GLOSSARY1_TERM1_REF;
  public static TagLabel GLOSSARY1_TERM1_LABEL;

  public static GlossaryTerm GLOSSARY2_TERM1;
  public static EntityReference GLOSSARY2_TERM1_REF;
  public static TagLabel GLOSSARY2_TERM1_LABEL;

  public static EntityReference SUPERSET_REFERENCE;
  public static EntityReference LOOKER_REFERENCE;
  public static List<EntityReference> CHART_REFERENCES;

  public static Database DATABASE;
  public static EntityReference DATABASE_REFERENCE;

  public static DatabaseSchema DATABASE_SCHEMA;
  public static EntityReference DATABASE_SCHEMA_REFERENCE;

  public static List<Column> COLUMNS;

  public static Type INT_TYPE;
  public static Type STRING_TYPE;

  // Run webhook related tests randomly. This will ensure these tests are not run for every entity evey time junit
  // tests are run to save time. But over the course of development of a release, when tests are run enough times,
  // the webhook tests are run for all the entities.
  public static boolean runWebhookTests;

  public EntityResourceTest(
      String entityType,
      Class<T> entityClass,
      Class<? extends ResultList<T>> entityListClass,
      String collectionName,
      String fields) {
    this.entityType = entityType;
    this.entityClass = entityClass;
    this.entityListClass = entityListClass;
    this.collectionName = collectionName;
    this.allFields = fields;
    ENTITY_RESOURCE_TEST_MAP.put(entityType, this);
    List<String> allowedFields = Entity.getEntityFields(entityClass);
    this.supportsFollowers = allowedFields.contains(FIELD_FOLLOWERS);
    this.supportsOwner = allowedFields.contains(FIELD_OWNER);
    this.supportsTags = allowedFields.contains(FIELD_TAGS);
    this.supportsSoftDelete = allowedFields.contains(FIELD_DELETED);
    this.supportsCustomExtension = allowedFields.contains(FIELD_EXTENSION);
  }

  @BeforeAll
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    runWebhookTests = new Random().nextBoolean();
    if (runWebhookTests) {
      webhookCallbackResource.clearEvents();
      WebhookResourceTest webhookResourceTest = new WebhookResourceTest();
      webhookResourceTest.startWebhookSubscription();
      webhookResourceTest.startWebhookEntitySubscriptions(entityType);
    }

    new RoleResourceTest().setupRoles(test);
    new UserResourceTest().setupUsers(test);

    new TagResourceTest().setupTags();
    new GlossaryResourceTest().setupGlossaries();

    new DatabaseServiceResourceTest().setupDatabaseServices(test);
    new MessagingServiceResourceTest().setupMessagingServices();
    new PipelineServiceResourceTest().setupPipelineServices(test);
    new StorageServiceResourceTest().setupStorageServices();
    new DashboardServiceResourceTest().setupDashboardServices(test);

    new TableResourceTest().setupDatabaseSchemas(test);
  }

  @AfterAll
  public void afterAllTests() throws Exception {
    if (runWebhookTests) {
      WebhookResourceTest webhookResourceTest = new WebhookResourceTest();
      webhookResourceTest.validateWebhookEvents();
      webhookResourceTest.validateWebhookEntityEvents(entityType);
    }
    delete_recursiveTest();
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Methods to be overridden entity test class
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Create request such as CreateTable, CreateChart returned by concrete implementation
  public final K createRequest(TestInfo test) {
    return createRequest(getEntityName(test)).withDescription("").withDisplayName(null).withOwner(null);
  }

  public final K createRequest(TestInfo test, int index) {
    return createRequest(getEntityName(test, index)).withDescription("").withDisplayName(null).withOwner(null);
  }

  public final K createRequest(String name, String description, String displayName, EntityReference owner) {
    return createRequest(name).withDescription(description).withDisplayName(displayName).withOwner(owner);
  }

  public abstract K createRequest(String name);

  // Add all possible relationships to check if the entity is missing any of them after deletion
  public T beforeDeletion(TestInfo test, T entity) throws HttpResponseException {
    return entity;
  }

  // Get container entity based on create request that has CONTAINS relationship to the entity created with this
  // request has . For table, it is database. For database, it is databaseService. See Relationship.CONTAINS for
  // details.
  public EntityReference getContainer() {
    return null;
  }

  // Get container entity based on create request that has CONTAINS relationship to the entity created with this
  // request has . For table, it is database. For database, it is databaseService. See Relationship.CONTAINS for
  // details.
  public EntityReference getContainer(T e) {
    return null;
  }

  // Entity specific validate for entity create using POST
  public abstract void validateCreatedEntity(T createdEntity, K request, Map<String, String> authHeaders)
      throws HttpResponseException;

  // Entity specific validate for entity create using PUT
  public void validateUpdatedEntity(T updatedEntity, K request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(updatedEntity, request, authHeaders);
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  protected void validateDeletedEntity(
      K create, T entityBeforeDeletion, T entityAfterDeletion, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(entityAfterDeletion, create, authHeaders);
    validateCreatedEntity(entityAfterDeletion, create, authHeaders);
  }

  // Entity specific validate for entity create using PATCH
  public abstract void compareEntities(T expected, T updated, Map<String, String> authHeaders)
      throws HttpResponseException;

  /**
   * GET by id and GET by name with different `fields` parameter and ensure the requested fields are returned. Common
   * fields for all entities - `owner`, `followers`, and `tags` need not be tested by implementations as it is done
   * already in the base class.
   */
  public abstract T validateGetWithDifferentFields(T entity, boolean byName) throws HttpResponseException;

  // Assert field change in an entity recorded during PUT or POST operations
  public abstract void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException;

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for GET operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  void get_entityWithDifferentFieldsQueryParam(TestInfo test) throws HttpResponseException {
    if (!supportsFieldsQueryParam) {
      return;
    }

    T entity = createEntity(createRequest(test, 0), ADMIN_AUTH_HEADERS);

    String allFields = String.join(",", Entity.getAllowedFields(entityClass));

    // GET an entity by ID with all the field names of an entity should be successful
    getEntity(entity.getId(), allFields, ADMIN_AUTH_HEADERS);

    // GET an entity by name with all the field names of an entity should be successful
    getEntityByName(entity.getFullyQualifiedName(), allFields, ADMIN_AUTH_HEADERS);

    // GET list of entities with all the field names of an entity should be successful
    Map<String, String> params = new HashMap<>();
    params.put("fields", allFields);
    listEntities(params, ADMIN_AUTH_HEADERS);

    // Adding any parameter that is allowed should result in an error
    String invalidField = "invalidField";
    assertResponse(
        () -> getEntity(entity.getId(), invalidField, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid field name invalidField");
    assertResponse(
        () -> getEntityByName(entity.getFullyQualifiedName(), invalidField, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid field name invalidField");

    params.put("fields", invalidField);
    assertResponse(() -> listEntities(params, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Invalid field name invalidField");
  }

  @Test
  void get_entityListWithPagination_200(TestInfo test) throws IOException {
    // Create a number of entities between 5 and 20 inclusive
    Random rand = new Random();
    int maxEntities = rand.nextInt(16) + 5;

    List<UUID> createdUUIDs = new ArrayList<>();
    for (int i = 0; i < maxEntities; i++) {
      createdUUIDs.add(
          createEntity(createRequest(getEntityName(test, i + 1), "", null, null), ADMIN_AUTH_HEADERS).getId());
    }

    T entity = createEntity(createRequest(getEntityName(test, 0), "", null, null), ADMIN_AUTH_HEADERS);
    deleteAndCheckEntity(entity, ADMIN_AUTH_HEADERS);

    Predicate<T> matchDeleted = e -> e.getId().equals(entity.getId());

    // Test listing entities that include deleted, non-deleted, and all the entities
    Random random = new Random();
    for (String include : List.of("non-deleted", "all", "deleted")) {
      if (!supportsSoftDelete && include.equals("deleted")) {
        continue;
      }
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", include);

      // List all entities and use it for checking pagination
      ResultList<T> allEntities = listEntities(queryParams, 1000000, null, null, ADMIN_AUTH_HEADERS);
      int totalRecords = allEntities.getData().size();
      printEntities(allEntities);

      // List entity with "limit" set from 1 to maxTables size with random jumps (to reduce the test time)
      // Each time compare the returned list with allTables list to make sure right results are returned
      for (int limit = 1; limit < maxEntities; limit += random.nextInt(5) + 1) {
        String after = null;
        String before;
        int pageCount = 0;
        int indexInAllTables = 0;
        ResultList<T> forwardPage;
        ResultList<T> backwardPage;
        boolean foundDeleted = false;
        do { // For each limit (or page size) - forward scroll till the end
          LOG.debug("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
          forwardPage = listEntities(queryParams, limit, null, after, ADMIN_AUTH_HEADERS);
          foundDeleted = forwardPage.getData().stream().anyMatch(matchDeleted) || foundDeleted;
          after = forwardPage.getPaging().getAfter();
          before = forwardPage.getPaging().getBefore();
          assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);

          if (pageCount == 0) { // CASE 0 - First page is being returned. There is no before-cursor
            assertNull(before);
          } else {
            // Make sure scrolling back based on before cursor returns the correct result
            backwardPage = listEntities(queryParams, limit, before, null, ADMIN_AUTH_HEADERS);
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
          LOG.debug("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
          forwardPage = listEntities(queryParams, limit, before, null, ADMIN_AUTH_HEADERS);
          foundDeleted = forwardPage.getData().stream().anyMatch(matchDeleted) || foundDeleted;
          printEntities(forwardPage);
          before = forwardPage.getPaging().getBefore();
          assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);
          pageCount++;
          indexInAllTables -= forwardPage.getData().size();
        } while (before != null);

        if ("all".equals(include) || "deleted".equals(include)) {
          assertTrue(!supportsSoftDelete || foundDeleted);
        } else { // non-delete
          assertFalse(foundDeleted);
        }
      }

      // before running "deleted" delete all created entries otherwise the test doesn't work with just one element.
      if ("all".equals(include)) {
        for (T toBeDeleted : allEntities.getData()) {
          if (createdUUIDs.contains(toBeDeleted.getId()) && Boolean.FALSE.equals(toBeDeleted.getDeleted())) {
            deleteAndCheckEntity(toBeDeleted, ADMIN_AUTH_HEADERS);
          }
        }
      }
    }
  }

  /** At the end of test for an entity, delete the parent container to test recursive delete functionality */
  private void delete_recursiveTest() throws IOException {
    // Finally, delete the container that contains the entities created for this test
    EntityReference container = getContainer();
    if (container != null) {
      // List both deleted and non deleted entities
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", "all");
      ResultList<T> listBeforeDeletion = listEntities(queryParams, 1000, null, null, ADMIN_AUTH_HEADERS);

      // Delete non-empty container entity and ensure deletion is not allowed
      EntityResourceTest<? extends EntityInterface, ? extends CreateEntity> containerTest =
          ENTITY_RESOURCE_TEST_MAP.get(container.getType());
      assertResponse(
          () -> containerTest.deleteEntity(container.getId(), ADMIN_AUTH_HEADERS),
          BAD_REQUEST,
          entityIsNotEmpty(container.getType()));

      // Now soft-delete the container with recursive flag on
      containerTest.deleteEntity(container.getId(), true, false, ADMIN_AUTH_HEADERS);

      // Make sure entities that belonged to the container are deleted and the new list operation returns fewer entities
      ResultList<T> listAfterDeletion = listEntities(null, 1000, null, null, ADMIN_AUTH_HEADERS);
      listAfterDeletion.getData().forEach(e -> assertNotEquals(getContainer(e).getId(), container.getId()));
      assertTrue(listAfterDeletion.getData().size() < listBeforeDeletion.getData().size());

      // Restore the soft-deleted container by PUT operation and make sure it is restored
      String containerName = container.getName();
      if (containerTest.getContainer() != null) {
        // Find container name by removing parentContainer fqn from container fqn
        // Example: remove "service" from "service.database" to get "database" container name for table
        String parentOfContainer = containerTest.getContainer().getName();
        containerName = container.getName().replace(parentOfContainer + Entity.SEPARATOR, "");
      }
      CreateEntity request = containerTest.createRequest(containerName, "", "", null);
      containerTest.updateEntity(request, Status.OK, ADMIN_AUTH_HEADERS);

      ResultList<T> listAfterRestore = listEntities(null, 1000, null, null, ADMIN_AUTH_HEADERS);
      assertEquals(listBeforeDeletion.getData().size(), listAfterRestore.getData().size());

      // Now hard-delete the container with recursive flag on and make sure GET operation can't get the entity
      containerTest.deleteEntity(container.getId(), true, true, ADMIN_AUTH_HEADERS);
      containerTest.assertEntityDeleted(container.getId(), true);
    }
  }

  @Test
  void get_entityListWithInvalidLimit_4xx() {
    // Limit must be >= 1 and <= 1000,000
    assertResponse(
        () -> listEntities(null, -1, null, null, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param limit must be greater than or equal to 0]");

    assertResponse(
        () -> listEntities(null, -1, null, null, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param limit must be greater than or equal to 0]");

    assertResponse(
        () -> listEntities(null, 1000001, null, null, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  void get_entityListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    assertResponse(
        () -> listEntities(null, 1, "", "", ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Only one of before or after query parameter allowed");
  }

  @Test
  void get_entityWithDifferentFields_200_OK(TestInfo test) throws IOException {
    K create = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);

    T entity = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    if (supportsTags) {
      String origJson = JsonUtils.pojoToJson(entity);
      entity.setTags(new ArrayList<>());
      entity.getTags().add(USER_ADDRESS_TAG_LABEL);
      entity.getTags().add(GLOSSARY2_TERM1_LABEL);
      entity = patchEntity(entity.getId(), origJson, entity, ADMIN_AUTH_HEADERS);
    }
    if (supportsFollowers) {
      UserResourceTest userResourceTest = new UserResourceTest();
      User user1 = userResourceTest.createEntity(userResourceTest.createRequest(test, 1), TEST_AUTH_HEADERS);
      addFollower(entity.getId(), user1.getId(), OK, TEST_AUTH_HEADERS);
    }
    entity = validateGetWithDifferentFields(entity, false);
    validateGetCommonFields(entity);

    entity = validateGetWithDifferentFields(entity, true);
    validateGetCommonFields(entity);
  }

  private void validateGetCommonFields(EntityInterface entityInterface) {
    if (supportsOwner) {
      validateEntityReference(entityInterface.getOwner());
    }
    if (supportsFollowers) {
      validateEntityReferences(entityInterface.getFollowers(), true);
    }
    if (supportsTags) {
      assertListNotEmpty(entityInterface.getTags());
    }
  }

  @Test
  void get_deletedVersion(TestInfo test) throws IOException {
    if (!supportsSoftDelete) {
      return;
    }
    T entity = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    getEntity(entity.getId(), allFields, ADMIN_AUTH_HEADERS);
    deleteAndCheckEntity(entity, ADMIN_AUTH_HEADERS);
    EntityHistory history = getVersionList(entity.getId(), ADMIN_AUTH_HEADERS);
    T latestVersion = JsonUtils.readValue((String) history.getVersions().get(0), entityClass);
    getVersion(entity.getId(), entity.getVersion(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void get_entityIncludeDeleted_200(TestInfo test) throws IOException {
    if (!supportsSoftDelete) {
      return;
    }
    // Create an entity using POST
    K create = createRequest(test);
    T entity = beforeDeletion(test, createEntity(create, ADMIN_AUTH_HEADERS));
    T entityBeforeDeletion = getEntity(entity.getId(), allFields, ADMIN_AUTH_HEADERS);

    // Soft delete the entity
    deleteAndCheckEntity(entity, ADMIN_AUTH_HEADERS);
    assertEntityDeleted(entity, false);

    // Ensure entity is returned in GET with include param set to deleted || all
    Map<String, String> queryParams = new HashMap<>();
    for (String include : List.of("deleted", "all")) {
      queryParams.put("include", include);
      T entityAfterDeletion = getEntity(entity.getId(), queryParams, allFields, ADMIN_AUTH_HEADERS);
      validateDeletedEntity(create, entityBeforeDeletion, entityAfterDeletion, ADMIN_AUTH_HEADERS);
      entityAfterDeletion = getEntityByName(entity.getFullyQualifiedName(), queryParams, allFields, ADMIN_AUTH_HEADERS);
      validateDeletedEntity(create, entityBeforeDeletion, entityAfterDeletion, ADMIN_AUTH_HEADERS);
    }
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for POST operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  protected void post_entityCreateWithInvalidName_400() {
    // Create an entity with mandatory name field null
    final K request = createRequest(null, "description", "displayName", null);
    assertResponse(() -> createEntity(request, ADMIN_AUTH_HEADERS), BAD_REQUEST, "[name must not be null]");

    // Create an entity with mandatory name field empty
    final K request1 = createRequest("", "description", "displayName", null);
    assertResponseContains(() -> createEntity(request1, ADMIN_AUTH_HEADERS), BAD_REQUEST, ENTITY_NAME_LENGTH_ERROR);

    // Create an entity with mandatory name field too long
    final K request2 = createRequest(LONG_ENTITY_NAME, "description", "displayName", null);
    assertResponse(() -> createEntity(request2, ADMIN_AUTH_HEADERS), BAD_REQUEST, ENTITY_NAME_LENGTH_ERROR);
  }

  @Test
  void post_entityWithInvalidOwnerType_4xx(TestInfo test) {
    if (!supportsOwner) {
      return;
    }
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */
    K create = createRequest(getEntityName(test), "", "", owner);
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "type must not be null");
  }

  @Test
  void post_entityWithNonExistentOwner_4xx(TestInfo test) {
    if (!supportsOwner) {
      return;
    }
    EntityReference owner = new EntityReference().withId(NON_EXISTENT_ENTITY).withType("user");
    K create = createRequest(getEntityName(test), "", "", owner);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), NOT_FOUND, entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));
  }

  @Test
  void post_entityWithOwner_200(TestInfo test) throws IOException {
    if (!supportsOwner) {
      return;
    }

    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam = teamResourceTest.createRequest(test);
    Team team = teamResourceTest.createAndCheckEntity(createTeam, ADMIN_AUTH_HEADERS);

    // Entity with user as owner is created successfully
    createAndCheckEntity(createRequest(getEntityName(test, 1), "", "", USER_OWNER1), ADMIN_AUTH_HEADERS);

    // Entity with team as owner is created successfully
    T entity =
        createAndCheckEntity(
            createRequest(getEntityName(test, 2), "", "", team.getEntityReference()), ADMIN_AUTH_HEADERS);

    // Delete team and ensure the entity still exists but with owner as deleted
    teamResourceTest.deleteEntity(team.getId(), ADMIN_AUTH_HEADERS);
    entity = getEntity(entity.getId(), FIELD_OWNER, ADMIN_AUTH_HEADERS);
    assertTrue(entity.getOwner().getDeleted());
  }

  @Test
  protected void post_entity_as_non_admin_401(TestInfo test) {
    assertResponse(() -> createEntity(createRequest(test), TEST_AUTH_HEADERS), FORBIDDEN, notAdmin(TEST_USER_NAME));
  }

  @Test
  void post_entityAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    K create = createRequest(getEntityName(test), "", "", null);
    // Create first time using POST
    createEntity(create, ADMIN_AUTH_HEADERS);
    // Second time creating the same entity using POST should fail
    assertResponse(() -> createEntity(create, ADMIN_AUTH_HEADERS), CONFLICT, ENTITY_ALREADY_EXISTS);
  }

  @Test
  void post_entityWithDots_200() throws HttpResponseException {
    if (!supportsNameWithDot) {
      return;
    }
    // Entity without "." should not have quoted fullyQualifiedName
    String name = format("%s_foo_bar", entityType);
    K request = createRequest(name, "", null, null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);
    assertFalse(entity.getFullyQualifiedName().contains("\""));

    // Now post entity name with dots. FullyQualifiedName must have " to escape dotted name
    name = format("%s_foo.bar", entityType);
    request = createRequest(name, "", null, null);
    entity = createEntity(request, ADMIN_AUTH_HEADERS);

    // The FQN has quote delimited parts if the FQN is hierarchical.
    // For entities where FQN is same as the entity name, (that is no hierarchical name for entities like user,
    // team, webhook and the entity names that are at the root for FQN like services, TagCategory, and Glossary etc.)
    // No delimiter is expected.
    boolean noHierarchicalName = entity.getFullyQualifiedName().equals(entity.getName());
    assertTrue(noHierarchicalName || entity.getFullyQualifiedName().contains("\""));
    assertEquals(name, entity.getName());
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for PUT operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  void put_entityCreate_200(TestInfo test) throws IOException {
    // Create a new entity with PUT
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    updateAndCheckEntity(request, CREATED, ADMIN_AUTH_HEADERS, UpdateType.CREATED, null);
  }

  @Test
  void put_entityUpdateWithNoChange_200(TestInfo test) throws IOException {
    // Create a chart with POST
    K request = createRequest(getEntityName(test), "description", "display", USER_OWNER1);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Update chart two times successfully with PUT requests
    ChangeDescription change = getChangeDescription(entity.getVersion());
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
  }

  @Test
  void put_entityCreate_as_owner_200(TestInfo test) throws IOException {
    if (!supportsOwner) {
      return; // Entity doesn't support ownership
    }
    // Create a new entity with PUT as admin user
    K request = createRequest(getEntityName(test), "", null, USER_OWNER1);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Update the entity as USER_OWNER1
    request = createRequest(getEntityName(test), "newDescription", null, USER_OWNER1);
    FieldChange fieldChange = new FieldChange().withName("description").withOldValue("").withNewValue("newDescription");
    ChangeDescription change =
        getChangeDescription(entity.getVersion()).withFieldsUpdated(Collections.singletonList(fieldChange));
    updateAndCheckEntity(request, OK, authHeaders(USER1.getEmail()), MINOR_UPDATE, change);
  }

  @Test
  void put_entityUpdateOwner_200(TestInfo test) throws IOException {
    if (!supportsOwner) {
      return; // Entity doesn't support ownership
    }
    // Create an entity without owner
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Set TEAM_OWNER1 as owner using PUT request
    FieldChange fieldChange = new FieldChange().withName(FIELD_OWNER).withNewValue(TEAM_OWNER1);
    request = createRequest(getEntityName(test), "description", "displayName", TEAM_OWNER1);
    ChangeDescription change =
        getChangeDescription(entity.getVersion()).withFieldsAdded(Collections.singletonList(fieldChange));
    entity = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    checkOwnerOwns(TEAM_OWNER1, entity.getId(), true);

    // Change owner from TEAM_OWNER1 to USER_OWNER1 using PUT request
    request = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);
    fieldChange = new FieldChange().withName(FIELD_OWNER).withOldValue(TEAM_OWNER1).withNewValue(USER_OWNER1);
    change = getChangeDescription(entity.getVersion()).withFieldsUpdated(Collections.singletonList(fieldChange));
    entity = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    checkOwnerOwns(USER_OWNER1, entity.getId(), true);
    checkOwnerOwns(TEAM_OWNER1, entity.getId(), false);

    // Set the owner to the existing owner. No ownership change must be recorded.
    request = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);
    change = getChangeDescription(entity.getVersion());
    entity = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
    checkOwnerOwns(USER_OWNER1, entity.getId(), true);

    // Remove ownership (from USER_OWNER1) using PUT request. Owner is expected to remain the same
    // and not removed.
    request = createRequest(getEntityName(test), "description", "displayName", null);
    updateEntity(request, OK, ADMIN_AUTH_HEADERS);
    checkOwnerOwns(USER_OWNER1, entity.getId(), true);
  }

  @Test
  void put_entityUpdate_as_non_owner_4xx(TestInfo test) throws IOException {
    if (!supportsOwner) {
      return; // Entity doesn't support ownership
    }

    // Create an entity with owner
    K request = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);
    createEntity(request, ADMIN_AUTH_HEADERS);

    // Update description and remove owner as non-owner
    // Expect to throw an exception since only owner or admin can update resource
    K updateRequest = createRequest(getEntityName(test), "newDescription", "displayName", null);
    assertResponse(() -> updateEntity(updateRequest, OK, TEST_AUTH_HEADERS), FORBIDDEN, noPermission(TEST_USER_NAME));
  }

  @Test
  void put_entityNullDescriptionUpdate_200(TestInfo test) throws IOException {
    if (!supportsEmptyDescription) {
      return;
    }
    // Create entity with null description
    K request = createRequest(getEntityName(test), null, "displayName", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    // Update null description with a new description
    request = createRequest(getEntityName(test), "updatedDescription", "displayName", null);
    FieldChange fieldChange = new FieldChange().withName("description").withNewValue("updatedDescription");
    ChangeDescription change =
        getChangeDescription(entity.getVersion()).withFieldsAdded(Collections.singletonList(fieldChange));
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_entityEmptyDescriptionUpdate_200(TestInfo test) throws IOException {
    // Create entity with empty description
    K request = createRequest(getEntityName(test), "", "displayName", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    // Update empty description with a new description
    request = createRequest(getEntityName(test), "updatedDescription", "displayName", null);
    ChangeDescription change = getChangeDescription(entity.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("description").withOldValue("").withNewValue("updatedDescription"));
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_entityNonEmptyDescriptionUpdate_200(TestInfo test) throws IOException {
    // Create entity with non-empty description
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Update non-empty description with a new description
    Double oldVersion = entity.getVersion();
    request = createRequest(getEntityName(test), "updatedDescription", "displayName", null);
    entity = updateEntity(request, OK, ADMIN_AUTH_HEADERS);
    // For service resources, we allow update of non-empty description via PUT
    List<Class<?>> services =
        Arrays.asList(
            DatabaseService.class,
            PipelineService.class,
            StorageService.class,
            DashboardService.class,
            MessagingService.class,
            IngestionPipeline.class,
            Type.class);
    if (services.contains(entity.getClass())) {
      assertNotEquals(oldVersion, entity.getVersion()); // Version did change
      assertEquals("updatedDescription", entity.getDescription()); // Description did change
    } else {
      assertEquals(oldVersion, entity.getVersion()); // Version did not change
      assertEquals("description", entity.getDescription()); // Description did not change
    }
  }

  @Test
  void put_addDeleteFollower_200(TestInfo test) throws IOException {
    if (!supportsFollowers) {
      return; // Entity does not support following
    }
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    UUID entityId = entity.getId();

    // Add follower to the entity
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = userResourceTest.createEntity(userResourceTest.createRequest(test, 1), TEST_AUTH_HEADERS);
    addAndCheckFollower(entityId, user1.getId(), OK, 1, TEST_AUTH_HEADERS);

    // Add the same user as follower and make sure no errors are thrown
    // (and not CREATED)
    addAndCheckFollower(entityId, user1.getId(), OK, 1, TEST_AUTH_HEADERS);

    // Add a new follower to the entity
    User user2 = userResourceTest.createEntity(userResourceTest.createRequest(test, 2), TEST_AUTH_HEADERS);
    addAndCheckFollower(entityId, user2.getId(), OK, 2, TEST_AUTH_HEADERS);

    // Delete followers and make sure they are deleted
    deleteAndCheckFollower(entityId, user1.getId(), 1, TEST_AUTH_HEADERS);
    deleteAndCheckFollower(entityId, user2.getId(), 0, TEST_AUTH_HEADERS);
  }

  @Test
  void put_addFollowerDeleteEntity_200(TestInfo test) throws IOException {
    if (!supportsFollowers) {
      return; // Entity does not support following
    }
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    UUID entityId = entity.getId();

    // Add follower to the entity
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = userResourceTest.createEntity(userResourceTest.createRequest(test, 1), TEST_AUTH_HEADERS);
    addAndCheckFollower(entityId, user1.getId(), OK, 1, TEST_AUTH_HEADERS);

    deleteEntity(entityId, ADMIN_AUTH_HEADERS);

    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", "deleted");
    entity = getEntity(entityId, queryParams, FIELD_FOLLOWERS, ADMIN_AUTH_HEADERS);
    TestUtils.existsInEntityReferenceList(entity.getFollowers(), user1.getId(), true);
  }

  @Test
  void put_addDeleteInvalidFollower_200(TestInfo test) throws IOException {
    if (!supportsFollowers) {
      return; // Entity does not support following
    }
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    UUID entityId = entity.getId();

    // Add non-existent user as follower to the entity
    assertResponse(
        () -> addAndCheckFollower(entityId, NON_EXISTENT_ENTITY, OK, 1, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));

    // Delete non-existent user as follower to the entity
    assertResponse(
        () -> deleteAndCheckFollower(entityId, NON_EXISTENT_ENTITY, 1, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for PATCH operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  void patch_entityDescriptionAndTestAuthorizer(TestInfo test) throws IOException {
    if (!supportsPatch || !supportsAuthorizedMetadataOperations) {
      return;
    }

    T entity = createEntity(createRequest(getEntityName(test), "description", null, null), ADMIN_AUTH_HEADERS);

    // Admins, Owner or a User with policy can update the entity
    entity = patchEntityAndCheckAuthorization(entity, TestUtils.ADMIN_USER_NAME, false);
    entity = patchEntityAndCheckAuthorization(entity, USER_WITH_DATA_STEWARD_ROLE.getName(), false);
    entity = patchEntityAndCheckAuthorization(entity, USER_WITH_DATA_CONSUMER_ROLE.getName(), false);
    entity = patchEntityAndCheckAuthorization(entity, USER1.getName(), false);

    if (!supportsOwner) {
      return;
    }

    // Set the owner for the table.
    String originalJson = JsonUtils.pojoToJson(entity);
    ChangeDescription change = getChangeDescription(entity.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName(FIELD_OWNER).withNewValue(USER_OWNER1));
    entity.setOwner(USER_OWNER1);
    entity =
        patchEntityAndCheck(
            entity, originalJson, authHeaders(USER1.getName() + "@open-metadata.org"), MINOR_UPDATE, change);

    // Admin, owner (USER1) and user with DataSteward role can update description on entity owned by USER1.
    entity = patchEntityAndCheckAuthorization(entity, TestUtils.ADMIN_USER_NAME, false);
    entity = patchEntityAndCheckAuthorization(entity, USER1.getName(), false);
    entity = patchEntityAndCheckAuthorization(entity, USER_WITH_DATA_STEWARD_ROLE.getName(), false);
    patchEntityAndCheckAuthorization(entity, USER_WITH_DATA_CONSUMER_ROLE.getName(), false);
  }

  @Test
  void patch_entityAttributes_200_ok(TestInfo test) throws IOException {
    if (!supportsPatch) {
      return;
    }
    // Create entity without description, owner
    T entity = createEntity(createRequest(getEntityName(test), "", null, null), ADMIN_AUTH_HEADERS);
    // user will always have the same user assigned as the owner
    if (!Entity.getEntityTypeFromObject(entity).equals(Entity.USER)) {
      assertListNull(entity.getOwner());
    }

    entity = getEntity(entity.getId(), ADMIN_AUTH_HEADERS);
    String oldDisplayName = entity.getDisplayName();

    //
    // Add displayName, description, owner, and tags when previously they were null
    //
    String origJson = JsonUtils.pojoToJson(entity);

    // Update entity
    entity.setDescription("description");
    entity.setDisplayName("displayName");

    // Field changes
    ChangeDescription change = getChangeDescription(entity.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("description").withOldValue("").withNewValue("description"));
    if (supportsOwner) {
      entity.setOwner(TEAM_OWNER1);
      change.getFieldsAdded().add(new FieldChange().withName(FIELD_OWNER).withNewValue(TEAM_OWNER1));
    }
    if (supportsTags) {
      entity.setTags(new ArrayList<>());
      entity.getTags().add(USER_ADDRESS_TAG_LABEL);
      entity.getTags().add(USER_ADDRESS_TAG_LABEL); // Add duplicated tags and make sure only one tag is added
      entity.getTags().add(GLOSSARY2_TERM1_LABEL);
      entity.getTags().add(GLOSSARY2_TERM1_LABEL); // Add duplicated tags and make sure only one tag is added
      change
          .getFieldsAdded()
          .add(
              new FieldChange()
                  .withName(FIELD_TAGS)
                  .withNewValue(List.of(USER_ADDRESS_TAG_LABEL, GLOSSARY2_TERM1_LABEL)));
    }
    change
        .getFieldsAdded()
        .add(new FieldChange().withName("displayName").withOldValue(oldDisplayName).withNewValue("displayName"));

    entity = patchEntityAndCheck(entity, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Replace description, add tags tier, owner
    //
    origJson = JsonUtils.pojoToJson(entity);

    // Change entity
    entity.setDescription("description1");
    entity.setDisplayName("displayName1");

    // Field changes
    change = getChangeDescription(entity.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("description").withOldValue("description").withNewValue("description1"));
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("displayName").withOldValue("displayName").withNewValue("displayName1"));
    if (supportsOwner) {
      entity.setOwner(USER_OWNER1);
      change
          .getFieldsUpdated()
          .add(new FieldChange().withName(FIELD_OWNER).withOldValue(TEAM_OWNER1).withNewValue(USER_OWNER1));
    }

    if (supportsTags) {
      entity.getTags().add(TIER1_TAG_LABEL);
      change.getFieldsAdded().add(new FieldChange().withName(FIELD_TAGS).withNewValue(List.of(TIER1_TAG_LABEL)));
    }

    entity = patchEntityAndCheck(entity, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Remove description, tier, owner
    //
    origJson = JsonUtils.pojoToJson(entity);
    List<TagLabel> removedTags = entity.getTags();

    entity.setDescription(null);
    entity.setOwner(null);
    entity.setTags(null);

    // Field changes
    change = getChangeDescription(entity.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("description").withOldValue("description1"));
    if (supportsOwner) {
      change.getFieldsDeleted().add(new FieldChange().withName(FIELD_OWNER).withOldValue(USER_OWNER1));
    }
    if (supportsTags) {
      change.getFieldsDeleted().add(new FieldChange().withName(FIELD_TAGS).withOldValue(removedTags));
    }

    patchEntityAndCheck(entity, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void patch_deleted_attribute_disallowed_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    if (!supportsPatch || !supportsSoftDelete) {
      return;
    }
    // `deleted` attribute can't be set to true in PATCH operation & can only be done using DELETE operation
    T entity = createEntity(createRequest(getEntityName(test), "", "", null), ADMIN_AUTH_HEADERS);
    String json = JsonUtils.pojoToJson(entity);
    entity.setDeleted(true);
    assertResponse(
        () -> patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        readOnlyAttribute(entityType, FIELD_DELETED));
  }

  @Test
  void put_addEntityCustomAttributes(TestInfo test) throws IOException {
    if (!supportsCustomExtension) {
      return;
    }

    // PUT valid custom field intA to the entity type
    TypeResourceTest typeResourceTest = new TypeResourceTest();
    INT_TYPE = typeResourceTest.getEntityByName("integer", "", ADMIN_AUTH_HEADERS);
    Type entityType = typeResourceTest.getEntityByName(this.entityType, "customProperties", ADMIN_AUTH_HEADERS);
    CustomProperty fieldA =
        new CustomProperty().withName("intA").withDescription("intA").withPropertyType(INT_TYPE.getEntityReference());
    entityType = typeResourceTest.addAndCheckCustomProperty(entityType.getId(), fieldA, OK, ADMIN_AUTH_HEADERS);
    final UUID id = entityType.getId();

    // PATCH valid custom field stringB
    STRING_TYPE = typeResourceTest.getEntityByName("string", "", ADMIN_AUTH_HEADERS);
    CustomProperty fieldB =
        new CustomProperty()
            .withName("stringB")
            .withDescription("stringB")
            .withPropertyType(STRING_TYPE.getEntityReference());

    String json = JsonUtils.pojoToJson(entityType);
    ChangeDescription change = getChangeDescription(entityType.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("customProperties").withNewValue(Arrays.asList(fieldB)));
    entityType.getCustomProperties().add(fieldB);
    entityType = typeResourceTest.patchEntityAndCheck(entityType, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // PUT invalid custom fields to the entity - custom field has invalid type
    Type invalidType =
        new Type().withId(UUID.randomUUID()).withName("invalid").withCategory(Category.Field).withSchema("{}");
    CustomProperty fieldInvalid =
        new CustomProperty()
            .withName("invalid")
            .withDescription("invalid")
            .withPropertyType(invalidType.getEntityReference());
    assertResponse(
        () -> typeResourceTest.addCustomProperty(id, fieldInvalid, OK, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(Entity.TYPE, invalidType.getId()));

    // PATCH invalid custom fields to the entity - custom field has invalid type
    String json1 = JsonUtils.pojoToJson(entityType);
    entityType.getCustomProperties().add(fieldInvalid);
    Type finalEntity = entityType;
    assertResponse(
        () -> typeResourceTest.patchEntity(id, json1, finalEntity, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(Entity.TYPE, invalidType.getId()));

    // Now POST an entity with extension that includes custom field intA
    ObjectMapper mapper = new ObjectMapper();
    ObjectNode jsonNode = mapper.createObjectNode();
    jsonNode.set("intA", mapper.convertValue(1, JsonNode.class));
    K create = createRequest(test).withExtension(jsonNode);
    T entity = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // PUT and update the entity with extension field intA to a new value
    // TODO to do change description for stored customProperties
    jsonNode.set("intA", mapper.convertValue(2, JsonNode.class));
    create = createRequest(test).withExtension(jsonNode);
    entity = updateEntity(create, Status.OK, ADMIN_AUTH_HEADERS);
    assertEquals(JsonUtils.valueToTree(create.getExtension()), JsonUtils.valueToTree(entity.getExtension()));

    // PATCH and update the entity with extension field stringB
    // TODO to do change description for stored customProperties
    json = JsonUtils.pojoToJson(entity);
    jsonNode.set("stringB", mapper.convertValue("stringB", JsonNode.class));
    entity.setExtension(jsonNode);
    entity = patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS);
    assertEquals(JsonUtils.valueToTree(jsonNode), JsonUtils.valueToTree(entity.getExtension()));

    // PUT and remove field intA from the the entity extension
    // TODO to do change description for stored customProperties
    jsonNode.remove("intA");
    create = createRequest(test).withExtension(jsonNode);
    entity = updateEntity(create, Status.OK, ADMIN_AUTH_HEADERS);
    assertEquals(JsonUtils.valueToTree(create.getExtension()), JsonUtils.valueToTree(entity.getExtension()));

    // PATCH and remove field stringB from the the entity extension
    // TODO to do change description for stored customProperties
    json = JsonUtils.pojoToJson(entity);
    jsonNode.remove("stringB");
    entity.setExtension(jsonNode);
    entity = patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS);
    assertEquals(JsonUtils.valueToTree(jsonNode), JsonUtils.valueToTree(entity.getExtension()));

    // Now set the entity custom property to an invalid value
    jsonNode.set("intA", mapper.convertValue("stringInsteadOfNumber", JsonNode.class)); // String in integer field
    assertResponseContains(
        () -> createEntity(createRequest(test, 1).withExtension(jsonNode), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.jsonValidationError("intA", ""));

    // Now set the entity custom property with an unknown field name
    jsonNode.remove("intA");
    jsonNode.set("stringC", mapper.convertValue("string", JsonNode.class)); // Unknown field
    assertResponse(
        () -> createEntity(createRequest(test, 1).withExtension(jsonNode), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.unknownCustomField("stringC"));
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for DELETE operations
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  void delete_nonExistentEntity_404() {
    assertResponse(
        () -> deleteEntity(NON_EXISTENT_ENTITY, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(entityType, NON_EXISTENT_ENTITY));
  }

  @Test
  void delete_entity_as_admin_200(TestInfo test) throws IOException {
    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);
    deleteAndCheckEntity(entity, ADMIN_AUTH_HEADERS);
  }

  @Test
  void delete_entity_as_non_admin_401(TestInfo test) throws HttpResponseException {
    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);
    assertResponse(() -> deleteAndCheckEntity(entity, TEST_AUTH_HEADERS), FORBIDDEN, notAdmin(TEST_USER_NAME));
  }

  /** Soft delete an entity and then use PUT request to restore it back */
  @Test
  void delete_put_entity_200(TestInfo test) throws IOException {
    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    deleteAndCheckEntity(entity, ADMIN_AUTH_HEADERS);

    // Entity is soft deleted
    if (supportsSoftDelete) {
      Double version = EntityUtil.nextVersion(entity.getVersion()); // Version changes during soft-delete

      // Send PUT request (with no changes) to restore the entity from soft deleted state
      ChangeDescription change = getChangeDescription(version);
      change.getFieldsUpdated().add(new FieldChange().withName(FIELD_DELETED).withNewValue(false).withOldValue(true));
      updateAndCheckEntity(request, Response.Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    } else {
      assertEntityDeleted(entity, true);
    }
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Other tests
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  void testInvalidEntityList() {
    // Invalid entityCreated list
    assertResponse(
        () -> getChangeEvents("invalidEntity", entityType, null, System.currentTimeMillis(), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid entity invalidEntity in query param entityCreated");

    // Invalid entityUpdated list
    assertResponse(
        () -> getChangeEvents(null, "invalidEntity", entityType, System.currentTimeMillis(), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid entity invalidEntity in query param entityUpdated");

    // Invalid entityDeleted list
    assertResponse(
        () -> getChangeEvents(entityType, null, "invalidEntity", System.currentTimeMillis(), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid entity invalidEntity in query param entityDeleted");
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

  public final T getEntityByName(String name, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    return getEntityByName(name, null, fields, authHeaders);
  }

  public final T getEntityByName(
      String name, Map<String, String> queryParams, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResourceByName(name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    for (Entry<String, String> entry : Optional.ofNullable(queryParams).orElse(Collections.emptyMap()).entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return TestUtils.get(target, entityClass, authHeaders);
  }

  public final T createEntity(CreateEntity createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.post(getCollection(), createRequest, entityClass, authHeaders);
  }

  public final T updateEntity(CreateEntity updateRequest, Status status, Map<String, String> authHeaders)
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
    deleteAndCheckEntity(entity, false, false, authHeaders);
  }

  public final void deleteAndCheckEntity(
      T entity, boolean recursive, boolean hardDelete, Map<String, String> authHeaders) throws IOException {
    UUID id = entity.getId();

    // Delete entity
    T deletedEntity = deleteEntity(id, recursive, hardDelete, authHeaders); // TODO fix this to include
    long timestamp = deletedEntity.getUpdatedAt();

    // Validate delete change event
    Double expectedVersion = EntityUtil.nextVersion(entity.getVersion());
    if (supportsSoftDelete && !hardDelete) {
      validateDeletedEvent(id, timestamp, EventType.ENTITY_SOFT_DELETED, expectedVersion, authHeaders);

      // Validate that the entity version is updated after soft delete
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", Include.DELETED.value());

      T getEntity = getEntity(id, queryParams, allFields, authHeaders);
      assertEquals(expectedVersion, getEntity.getVersion());
      ChangeDescription change = getChangeDescription(entity.getVersion());
      change.getFieldsUpdated().add(new FieldChange().withName(FIELD_DELETED).withOldValue(false).withNewValue(true));
      assertEquals(change, getEntity.getChangeDescription());
    } else { // Hard delete
      validateDeletedEvent(id, timestamp, EventType.ENTITY_DELETED, entity.getVersion(), authHeaders);
    }
  }

  public final T deleteEntity(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    return deleteEntity(id, false, false, authHeaders);
  }

  public final T deleteEntity(UUID id, boolean recursive, boolean hardDelete, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(id);
    target = recursive ? target.queryParam("recursive", true) : target;
    target = hardDelete ? target.queryParam("hardDelete", true) : target;
    T entity = TestUtils.delete(target, entityClass, authHeaders);
    assertEntityDeleted(id, hardDelete);
    return entity;
  }

  public final T createAndCheckEntity(K create, Map<String, String> authHeaders) throws IOException {
    return createAndCheckEntity(create, authHeaders, create);
  }

  /** Helper function to create an entity, submit POST API request and validate response. */
  public final T createAndCheckEntity(K create, Map<String, String> authHeaders, K created) throws IOException {
    // Validate an entity that is created has all the information set in create request
    String updatedBy = SecurityUtil.getPrincipalName(authHeaders);
    T entity = createEntity(create, authHeaders);

    assertEquals(updatedBy, entity.getUpdatedBy());
    assertEquals(0.1, entity.getVersion()); // First version of the entity
    validateCommonEntityFields(entity, created, authHeaders);
    validateCreatedEntity(entity, created, authHeaders);

    // GET the entity created and ensure it has all the information set in create request
    T getEntity = getEntity(entity.getId(), authHeaders);
    assertEquals(0.1, entity.getVersion()); // First version of the entity
    validateCommonEntityFields(entity, created, authHeaders);
    validateCreatedEntity(getEntity, created, authHeaders);

    getEntity = getEntityByName(entity.getFullyQualifiedName(), allFields, authHeaders);
    assertEquals(0.1, entity.getVersion()); // First version of the entity
    validateCommonEntityFields(entity, created, authHeaders);
    validateCreatedEntity(getEntity, created, authHeaders);

    // Validate that change event was created
    validateChangeEvents(entity, entity.getUpdatedAt(), EventType.ENTITY_CREATED, null, authHeaders);
    return entity;
  }

  protected final T updateAndCheckEntity(
      K request,
      Status status,
      Map<String, String> authHeaders,
      UpdateType updateType,
      ChangeDescription changeDescription)
      throws IOException {
    T updated = updateEntity(request, status, authHeaders);
    validateUpdatedEntity(updated, request, authHeaders);
    validateChangeDescription(updated, updateType, changeDescription);
    validateEntityHistory(updated.getId(), updateType, changeDescription, authHeaders);
    validateLatestVersion(updated, updateType, changeDescription, authHeaders);

    // GET the newly updated entity and validate
    T getEntity = getEntity(updated.getId(), authHeaders);
    validateUpdatedEntity(getEntity, request, authHeaders);
    validateChangeDescription(getEntity, updateType, changeDescription);

    // Check if the entity change events are record
    if (updateType != NO_CHANGE) {
      EventType expectedEventType =
          updateType == UpdateType.CREATED ? EventType.ENTITY_CREATED : EventType.ENTITY_UPDATED;
      validateChangeEvents(updated, updated.getUpdatedAt(), expectedEventType, changeDescription, authHeaders);
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
      assertEquals(expectedChangeDescription.getPreviousVersion(), previousVersion.getVersion());
    }
  }

  private void validateLatestVersion(
      EntityInterface entityInterface,
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
      assertEquals(expectedChangeDescription.getPreviousVersion(), prevVersion.getVersion());
    }
  }

  /** Helper function to generate JSON PATCH, submit PATCH API request and validate response. */
  protected final T patchEntityAndCheck(
      T updated,
      String originalJson,
      Map<String, String> authHeaders,
      UpdateType updateType,
      ChangeDescription expectedChange)
      throws IOException {

    // Validate information returned in patch response has the updates
    T returned = patchEntity(updated.getId(), originalJson, updated, authHeaders);

    validateCommonEntityFields(updated, returned, authHeaders);
    compareEntities(updated, returned, authHeaders);
    validateChangeDescription(returned, updateType, expectedChange);
    validateEntityHistory(returned.getId(), updateType, expectedChange, authHeaders);
    validateLatestVersion(returned, updateType, expectedChange, authHeaders);

    // GET the entity and Validate information returned
    T getEntity = getEntity(returned.getId(), authHeaders);
    validateCommonEntityFields(updated, returned, authHeaders);
    compareEntities(updated, getEntity, authHeaders);
    validateChangeDescription(getEntity, updateType, expectedChange);

    // Check if the entity change events are record
    if (updateType != NO_CHANGE) {
      EventType expectedEventType =
          updateType == UpdateType.CREATED ? EventType.ENTITY_CREATED : EventType.ENTITY_UPDATED;
      validateChangeEvents(returned, returned.getUpdatedAt(), expectedEventType, expectedChange, authHeaders);
    }
    return returned;
  }

  T patchEntityAndCheckAuthorization(T entity, String userName, boolean shouldThrowException) throws IOException {
    String originalJson = JsonUtils.pojoToJson(entity);

    String originalDescription = entity.getDescription();
    String newDescription = format("Description added by %s", userName);
    ChangeDescription change = getChangeDescription(entity.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("description").withOldValue(originalDescription).withNewValue(newDescription));

    entity.setDescription(newDescription);

    if (shouldThrowException) {
      assertResponse(
          () -> patchEntity(entity.getId(), originalJson, entity, authHeaders(userName + "@open-metadata.org")),
          FORBIDDEN,
          noPermission(userName, "UpdateDescription"));
      // Revert to original.
      entity.setDescription(originalDescription);
      return entity;
    }
    return patchEntityAndCheck(
        entity, originalJson, authHeaders(userName + "@open-metadata.org"), MINOR_UPDATE, change);
  }

  protected final void validateCommonEntityFields(T entity, CreateEntity create, Map<String, String> authHeaders) {
    assertListNotNull(entity.getId(), entity.getHref(), entity.getFullyQualifiedName());
    assertEquals(create.getName(), entity.getName());
    assertEquals(create.getDisplayName(), entity.getDisplayName());
    assertEquals(create.getDescription(), entity.getDescription());
    assertEquals(JsonUtils.valueToTree(create.getExtension()), JsonUtils.valueToTree(entity.getExtension()));
    assertEquals(create.getOwner(), entity.getOwner());
    assertEquals(getPrincipalName(authHeaders), entity.getUpdatedBy());
  }

  protected final void validateCommonEntityFields(T expected, T actual, Map<String, String> authHeaders) {
    assertListNotNull(actual.getId(), actual.getHref(), actual.getFullyQualifiedName());
    assertEquals(expected.getName(), actual.getName());
    assertEquals(expected.getDisplayName(), actual.getDisplayName());
    assertEquals(expected.getDescription(), actual.getDescription());
    assertEquals(JsonUtils.valueToTree(expected.getExtension()), JsonUtils.valueToTree(actual.getExtension()));
    assertEquals(expected.getOwner(), actual.getOwner());
    assertEquals(getPrincipalName(authHeaders), actual.getUpdatedBy());
  }

  protected final void validateChangeDescription(T updated, UpdateType updateType, ChangeDescription expectedChange)
      throws IOException {
    if (updateType == UpdateType.CREATED) {
      return; // PUT operation was used to create an entity. No change description expected.
    }
    TestUtils.validateUpdate(expectedChange.getPreviousVersion(), updated.getVersion(), updateType);

    if (updateType != UpdateType.NO_CHANGE) {
      assertChangeDescription(expectedChange, updated.getChangeDescription());
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
      T entityInterface,
      long timestamp,
      EventType expectedEventType,
      ChangeDescription expectedChangeDescription,
      Map<String, String> authHeaders)
      throws IOException {
    validateChangeEvents(entityInterface, timestamp, expectedEventType, expectedChangeDescription, authHeaders, true);
    validateChangeEvents(entityInterface, timestamp, expectedEventType, expectedChangeDescription, authHeaders, false);
  }

  private void validateChangeEvents(
      T entity,
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
            + entity.getId());

    assertEquals(expectedEventType, changeEvent.getEventType());
    assertEquals(entityType, changeEvent.getEntityType());
    assertEquals(entity.getId(), changeEvent.getEntityId());
    assertEquals(entity.getVersion(), changeEvent.getCurrentVersion());
    assertEquals(SecurityUtil.getPrincipalName(authHeaders), changeEvent.getUserName());

    //
    // previous, entity, changeDescription
    //
    if (expectedEventType == EventType.ENTITY_CREATED) {
      assertEquals(EventType.ENTITY_CREATED, changeEvent.getEventType());
      assertEquals(0.1, changeEvent.getPreviousVersion());
      assertNull(changeEvent.getChangeDescription());
      T changeEventEntity = JsonUtils.readValue((String) changeEvent.getEntity(), entityClass);
      validateCommonEntityFields(entity, changeEventEntity, authHeaders);
      compareEntities(entity, changeEventEntity, authHeaders);
    } else if (expectedEventType == EventType.ENTITY_UPDATED) {
      assertChangeDescription(expectedChangeDescription, changeEvent.getChangeDescription());
    } else if (expectedEventType == EventType.ENTITY_DELETED) {
      assertListNull(changeEvent.getEntity(), changeEvent.getChangeDescription());
    }
  }

  private void validateDeletedEvent(
      UUID id, long timestamp, EventType expectedEventType, Double expectedVersion, Map<String, String> authHeaders)
      throws IOException {
    String updatedBy = SecurityUtil.getPrincipalName(authHeaders);
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
    if (fieldName.endsWith(FIELD_OWNER)) {
      EntityReference expectedRef = (EntityReference) expected;
      EntityReference actualRef = JsonUtils.readValue(actual.toString(), EntityReference.class);
      assertEquals(expectedRef.getId(), actualRef.getId());
    } else if (fieldName.endsWith(FIELD_TAGS)) {
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

  protected static void checkOwnerOwns(EntityReference owner, UUID entityId, boolean expectedOwning)
      throws HttpResponseException {
    if (owner != null) {
      UUID ownerId = owner.getId();
      List<EntityReference> ownsList;
      if (owner.getType().equals(Entity.USER)) {
        User user = new UserResourceTest().getEntity(ownerId, "owns", ADMIN_AUTH_HEADERS);
        ownsList = user.getOwns();
      } else if (owner.getType().equals(Entity.TEAM)) {
        Team team = new TeamResourceTest().getEntity(ownerId, "owns", ADMIN_AUTH_HEADERS);
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
    ChangeEvent event = addFollower(entityId, userId, status, authHeaders);

    // GET .../entity/{entityId} returns newly added follower
    T getEntity = getEntity(entityId, authHeaders);
    List<EntityReference> followers = getEntity.getFollowers();

    assertEquals(totalFollowerCount, followers.size());
    validateEntityReferences(followers);
    TestUtils.existsInEntityReferenceList(followers, userId, true);

    // GET .../users/{userId} shows user as following the entity
    checkUserFollowing(userId, entityId, true, authHeaders);

    // Validate change events
    validateChangeEvents(
        getEntity, event.getTimestamp(), EventType.ENTITY_UPDATED, event.getChangeDescription(), authHeaders);
  }

  public ChangeEvent addFollower(UUID entityId, UUID userId, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getFollowersCollection(entityId);
    return TestUtils.put(target, userId.toString(), ChangeEvent.class, status, authHeaders);
  }

  protected void deleteAndCheckFollower(
      UUID entityId, UUID userId, int totalFollowerCount, Map<String, String> authHeaders) throws IOException {
    // Delete the follower
    WebTarget target = getFollowerResource(entityId, userId);
    ChangeEvent change = TestUtils.delete(target, ChangeEvent.class, authHeaders);

    // Get the entity and ensure the deleted follower is not in the followers list
    T getEntity = checkFollowerDeleted(entityId, userId, authHeaders);
    assertEquals(totalFollowerCount, getEntity.getFollowers().size());

    // Validate change events
    validateChangeEvents(
        getEntity, change.getTimestamp(), EventType.ENTITY_UPDATED, change.getChangeDescription(), authHeaders);
  }

  public T checkFollowerDeleted(UUID entityId, UUID userId, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Get the entity and ensure the deleted follower is not in the followers list
    T getEntity = getEntity(entityId, authHeaders);
    List<EntityReference> followers = getEntity.getFollowers();
    validateEntityReferences(followers);
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
    list.getData().forEach(e -> LOG.debug("{} {}", entityClass, e.getFullyQualifiedName()));
    LOG.debug("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  public void assertEntityDeleted(T entity, boolean hardDelete) {
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", hardDelete ? "all" : "non-deleted");

    // Make sure getting entity by ID get 404 not found response
    assertEntityDeleted(entity.getId(), hardDelete);

    // Make sure getting entity by name gets 404 not found response
    assertResponse(
        () -> getEntityByName(entity.getFullyQualifiedName(), queryParams, "", ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(entityType, entity.getFullyQualifiedName()));
  }

  public void assertEntityDeleted(UUID id, boolean hardDelete) {
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", hardDelete ? "all" : "non-deleted");
    assertResponse(() -> getEntity(id, queryParams, "", ADMIN_AUTH_HEADERS), NOT_FOUND, entityNotFound(entityType, id));
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

  protected void assertEntityReferencesFieldChange(
      List<EntityReference> expectedList, List<EntityReference> actualList) {
    for (EntityReference expected : expectedList) {
      EntityReference actual =
          actualList.stream().filter(a -> EntityUtil.entityReferenceMatch.test(a, expected)).findAny().orElse(null);
      assertNotNull(actual, "Expected entity reference " + expected.getId() + " not found");
    }
  }

  protected void assertStrings(List<String> expectedList, List<String> actualList) {
    for (String expected : expectedList) {
      String actual = actualList.stream().filter(a -> EntityUtil.stringMatch.test(a, expected)).findAny().orElse(null);
      assertNotNull(actual, "Expected string " + expected + " not found");
    }
  }

  protected void assertTermReferences(List<TermReference> expectedList, List<TermReference> actualList) {
    for (TermReference expected : expectedList) {
      TermReference actual =
          actualList.stream().filter(a -> EntityUtil.termReferenceMatch.test(a, expected)).findAny().orElse(null);
      assertNotNull(actual, "Expected termReference " + expected + " not found");
    }
  }

  public final String getEntityName(TestInfo test) {
    return format("%s_%s", entityType, test.getDisplayName().replaceAll("\\(.*\\)", ""));
  }

  /**
   * Generates and entity name by adding a char from a-z to ensure alphanumeric ordering In alphanumeric ordering using
   * numbers can be counterintuitive (e.g :entity_0_test < entity_10_test < entity_1_test is the correct ordering of
   * these 3 strings)
   */
  public final String getEntityName(TestInfo test, int index) {
    return format(
        "%s_%s_%s", entityType, getNthAlphanumericString(index), test.getDisplayName().replaceAll("\\(.*\\)", ""));
  }

  /**
   * Transforms a positive integer to base 26 using digits a...z Alphanumeric ordering of results is equivalent to
   * ordering of inputs
   */
  private String getNthAlphanumericString(int index) {
    final int N_LETTERS = 26;
    if (index < 0) {
      throw new IllegalArgumentException(format("Index must be positive, cannot be %d", index));
    }
    if (index < 26) {
      return String.valueOf((char) ('a' + index));
    }
    return getNthAlphanumericString(index / N_LETTERS) + (char) ('a' + (index % N_LETTERS));
  }
}
