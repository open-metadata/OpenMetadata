package org.openmetadata.catalog.resources.databases;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateDatabase;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.databases.DatabaseResource.DatabaseList;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.common.utils.JsonSchemaUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

public class DatabaseResourceTest extends CatalogApplicationTest {
  private static final Logger LOG = LoggerFactory.getLogger(DatabaseResourceTest.class);
  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static EntityReference SNOWFLAKE_REFERENCE;
  public static EntityReference REDSHIFT_REFERENCE;
  public static EntityReference MYSQL_REFERENCE;
  public static EntityReference BIGQUERY_REFERENCE;

  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException {
    USER1 = UserResourceTest.createUser(UserResourceTest.create(test));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = TeamResourceTest.createTeam(TeamResourceTest.create(test));
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");

    CreateDatabaseService createService = new CreateDatabaseService().withName("snowflakeDB")
            .withServiceType(DatabaseServiceType.Snowflake).withJdbc(TestUtils.JDBC_INFO);
    DatabaseService service = DatabaseServiceResourceTest.createService(createService);
    SNOWFLAKE_REFERENCE = EntityUtil.getEntityReference(service);

    createService.withName("redshiftDB").withServiceType(DatabaseServiceType.Redshift);
    service = DatabaseServiceResourceTest.createService(createService);
    REDSHIFT_REFERENCE = EntityUtil.getEntityReference(service);

    createService.withName("bigQueryDB").withServiceType(DatabaseServiceType.BigQuery);
    service = DatabaseServiceResourceTest.createService(createService);
    BIGQUERY_REFERENCE = EntityUtil.getEntityReference(service);

    createService.withName("mysqlDB").withServiceType(DatabaseServiceType.MySQL);
    service = DatabaseServiceResourceTest.createService(createService);
    MYSQL_REFERENCE = EntityUtil.getEntityReference(service);
  }

  @Test
  public void post_databaseWithLongName_400_badRequest(TestInfo test) {
    // Create database with mandatory name field empty
    CreateDatabase create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createDatabase(create));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_databaseWithoutName_400_badRequest(TestInfo test) {
    // Create database with mandatory name field empty
    CreateDatabase create = create(test).withName("");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createDatabase(create));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_databaseAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateDatabase create = create(test);
    createDatabase(create);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createDatabase(create));
    TestUtils.assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validDatabases_200_OK(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    CreateDatabase create = create(test);
    createAndCheckDatabase(create);

    create.withName(getDatabaseName(test, 1)).withDescription("description");
    createAndCheckDatabase(create);
  }

  @Test
  public void post_databaseWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckDatabase(create(test).withOwner(USER_OWNER1));
  }

  @Test
  public void post_databaseWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckDatabase(create(test).withOwner(TEAM_OWNER1));
  }

  @Test
  public void post_databaseWithoutRequiredService_4xx(TestInfo test) {
    CreateDatabase create = create(test).withService(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createDatabase(create));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "service must not be null");
  }

  @Test
  public void post_databaseWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

    CreateDatabase create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createDatabase(create));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_databaseWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TestUtils.NON_EXISTENT_ENTITY).withType("user");
    CreateDatabase create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createDatabase(create));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_databaseWithDifferentService_200_ok(TestInfo test) throws HttpResponseException {
    EntityReference[] differentServices = { MYSQL_REFERENCE, REDSHIFT_REFERENCE, BIGQUERY_REFERENCE,
            SNOWFLAKE_REFERENCE};

    // Create database for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckDatabase(create(test).withService(service));

      // List databases by filtering on service name and ensure right databases are returned in the response
      DatabaseList list = listDatabases("service", service.getName());
      for (Database db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
      }
    }
  }

  @Test
  public void get_databaseListWithInvalidLimitOffet_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listDatabases(null, null, -1, null, null));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listDatabases(null, null, 0, null, null));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listDatabases(null, null, 1000001, null, null));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_databaseListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listDatabases(null, null, 1, "", ""));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  @Test
  public void get_databaseListWithValidLimitOffet_4xx(TestInfo test) throws HttpResponseException {
    // Create a large number of databases
    int maxDatabases = 40;
    for (int i = 0; i < maxDatabases; i++) {
      createDatabase(create(test, i));
    }

    // List all databases
    DatabaseList allDatabases = listDatabases(null, null, 1000000, null, null);
    int totalRecords = allDatabases.getData().size();
    printDatabases(allDatabases);

    // List limit number databases at a time at varous offsets and ensure right results are returned
    for (int limit = 1; limit < maxDatabases; limit++) {
      String after = null;
      String before = null;
      int pageCount = 0;
      int indexInAllDatabases = 0;
      DatabaseList forwardPage;
      DatabaseList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listDatabases(null, null, limit, null, after);
        printDatabases(forwardPage);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allDatabases.getData(), forwardPage, limit, indexInAllDatabases);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursort
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listDatabases(null, null, limit, before, null);
          assertEntityPagination(allDatabases.getData(), backwardPage, limit, (indexInAllDatabases - limit));
        }

        indexInAllDatabases += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllDatabases = totalRecords - limit - forwardPage.getData().size() ;
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listDatabases(null, null, limit, before, null);
        printDatabases(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allDatabases.getData(), forwardPage, limit, indexInAllDatabases);
        pageCount++;
        indexInAllDatabases -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printDatabases(DatabaseList list) {
    list.getData().forEach(database -> LOG.info("DB {}", database.getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  @Test
  public void put_databaseUpdateWithNoChange_200(TestInfo test) throws HttpResponseException {
    // Create a database with POST
    CreateDatabase request = create(test).withService(SNOWFLAKE_REFERENCE).withOwner(USER_OWNER1);
    createAndCheckDatabase(request);

    // Update database two times successfully with PUT requests
    updateAndCheckDatabase(request, OK);
    updateAndCheckDatabase(request, OK);
  }

  @Test
  public void put_databaseCreate_200(TestInfo test) throws HttpResponseException {
    // Create a new database with put
    CreateDatabase request = create(test).withService(SNOWFLAKE_REFERENCE).withOwner(USER_OWNER1);
    updateAndCheckDatabase(request.withName(test.getDisplayName()).withDescription(null), CREATED);
  }

  @Test
  public void put_databaseNullDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateDatabase request = create(test).withService(SNOWFLAKE_REFERENCE).withDescription(null);
    createAndCheckDatabase(request);

    // Update null description with a new description
    Database db = updateAndCheckDatabase(request.withDescription("newDescription"), OK);
    assertEquals("newDescription", db.getDescription());
  }

  @Test
  public void put_databaseEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    // Create table with empty description
    CreateDatabase request = create(test).withService(SNOWFLAKE_REFERENCE).withDescription("");
    createAndCheckDatabase(request);

    // Update empty description with a new description
    Database db = updateAndCheckDatabase(request.withDescription("newDescription"), OK);
    assertEquals("newDescription", db.getDescription());
  }

  @Test
  public void put_databaseNonEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateDatabase request = create(test).withService(SNOWFLAKE_REFERENCE).withDescription("description");
    createAndCheckDatabase(request);

    // Updating description is ignored when backend already has description
    Database db = updateDatabase(request.withDescription("newDescription"), OK);
    assertEquals("description", db.getDescription());
  }

  @Test
  public void put_databaseUpdateOwner_200(TestInfo test) throws HttpResponseException {
    CreateDatabase request = create(test).withService(SNOWFLAKE_REFERENCE).withDescription("");
    createAndCheckDatabase(request);

    // Change ownership from USER_OWNER1 to TEAM_OWNER1
    updateAndCheckDatabase(request.withOwner(TEAM_OWNER1), OK);

    // Remove ownership
    Database db = updateAndCheckDatabase(request.withOwner(null), OK);
    assertNull(db.getOwner());
  }

  @Test
  public void get_nonExistentDatabase_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getDatabase(TestUtils.NON_EXISTENT_ENTITY));
    TestUtils.assertResponse(exception, NOT_FOUND,
            CatalogExceptionMessage.entityNotFound(Entity.DATABASE, TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_databaseWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateDatabase create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(SNOWFLAKE_REFERENCE);
    Database database = createAndCheckDatabase(create);
    validateGetWithDifferentFields(database, false);
  }

  @Test
  public void get_databaseByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateDatabase create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(SNOWFLAKE_REFERENCE);
    Database database = createAndCheckDatabase(create);
    validateGetWithDifferentFields(database, true);
  }

  @Test
  public void patch_databaseAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create database without description, owner
    Database database = createDatabase(create(test));
    assertNull(database.getDescription());
    assertNull(database.getOwner());
    assertNotNull(database.getService());

    database = getDatabase(database.getId(), "service,owner,usageSummary");
    database.getService().setHref(null); // href is readonly and not patchable

    // Add description, owner when previously they were null
    database = patchDatabaseAttributesAndCheck(database, "description", TEAM_OWNER1);
    database.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner
    database.setService(MYSQL_REFERENCE); // Get rid of href and name returned in the response for service

    // Replace description, tier, owner
    database = patchDatabaseAttributesAndCheck(database, "description1", USER_OWNER1);
    database.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner
    database.setService(REDSHIFT_REFERENCE); // Get rid of href and name returned in the response for service

    // Remove description, tier, owner
    patchDatabaseAttributesAndCheck(database, null, null);
  }

  @Test
  public void patch_databaseIDChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure database ID can't be changed using patch
    Database database = createDatabase(create(test));
    UUID databaseId = database.getId();
    String databaseJson = JsonUtils.pojoToJson(database);
    database.setId(UUID.randomUUID());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> patchDatabase(databaseId, databaseJson, database));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE, "id"));

    // ID can't be deleted
    database.setId(null);
    exception = assertThrows(HttpResponseException.class, () -> patchDatabase(databaseId, databaseJson, database));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE, "id"));
  }

  @Test
  public void patch_databaseNameChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure database name can't be changed using patch
    Database database = createDatabase(create(test));
    String databaseJson = JsonUtils.pojoToJson(database);
    database.setName("newName");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> patchDatabase(databaseJson, database));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE, "name"));

    // Name can't be removed
    database.setName(null);
    exception = assertThrows(HttpResponseException.class, () -> patchDatabase(databaseJson, database));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE, "name"));
  }

  @Test
  public void patch_databaseRemoveService_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure service corresponding to database can't be changed by patch operation
    Database database = createDatabase(create(test));
    database.getService().setHref(null); // Remove href from returned response as it is read-only field

    String databaseJson = JsonUtils.pojoToJson(database);
    database.setService(MYSQL_REFERENCE);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> patchDatabase(databaseJson, database));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE, "service"));

    // Service relationship can't be removed
    database.setService(null);
    exception = assertThrows(HttpResponseException.class, () -> patchDatabase(databaseJson, database));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE, "service"));
  }

  // TODO listing tables test:1
  // TODO Change service?

  @Test
  public void delete_emptyDatabase_200_ok(TestInfo test) throws HttpResponseException {
    Database database = createDatabase(create(test));
    deleteDatabase(database.getId());
  }

  @Test
  public void delete_nonEmptyDatabase_4xx() {
    // TODO
  }

  @Test
  public void delete_nonExistentDatabase_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> deleteDatabase(TestUtils.NON_EXISTENT_ENTITY));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.DATABASE, TestUtils.NON_EXISTENT_ENTITY));
  }

  public static Database createAndCheckDatabase(CreateDatabase create) throws HttpResponseException {
    Database database = createDatabase(create);
    validateDatabase(database, create.getDescription(), create.getOwner(), create.getService());
    return getAndValidate(database.getId(), create);
  }

  public static Database updateAndCheckDatabase(CreateDatabase create, Status status) throws HttpResponseException {
    Database updatedDb = updateDatabase(create, status);
    validateDatabase(updatedDb, create.getDescription(), create.getOwner(), create.getService());

    // GET the newly updated database and validate
    return getAndValidate(updatedDb.getId(), create);
  }

  // Make sure in GET operations the returned database has all the required information passed during creation
  public static Database getAndValidate(UUID databaseId, CreateDatabase create) throws HttpResponseException {
    // GET the newly created database by ID and validate
    Database database = getDatabase(databaseId, "service,owner");
    validateDatabase(database, create.getDescription(), create.getOwner(), create.getService());

    // GET the newly created database by name and validate
    String fqn = database.getFullyQualifiedName();
    database = getDatabaseByName(fqn, "service,owner");
    return validateDatabase(database, create.getDescription(), create.getOwner(), create.getService());
  }

  public static Database updateDatabase(CreateDatabase create, Status status) throws HttpResponseException {
    return TestUtils.put(CatalogApplicationTest.getResource("databases"), create, Database.class, status);
  }

  public static Database createDatabase(CreateDatabase create) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("databases"), create, Database.class);
  }

  /** Validate returned fields GET .../databases/{id}?fields="..." or GET .../databases/name/{fqn}?fields="..." */
  private void validateGetWithDifferentFields(Database database, boolean byName) throws HttpResponseException {
    // .../databases?fields=owner
    String fields = "owner";
    database = byName ? getDatabaseByName(database.getFullyQualifiedName(), fields) :
            getDatabase(database.getId(), fields);
    assertNotNull(database.getOwner());
    assertNull(database.getService());
    assertNull(database.getTables());

    // .../databases?fields=owner,service
    fields = "owner,service";
    database = byName ? getDatabaseByName(database.getFullyQualifiedName(), fields) :
            getDatabase(database.getId(), fields);
    assertNotNull(database.getOwner());
    assertNotNull(database.getService());
    assertNull(database.getTables());

    // .../databases?fields=owner,service,tables
    fields = "owner,service,tables,usageSummary";
    database = byName ? getDatabaseByName(database.getFullyQualifiedName(), fields) :
            getDatabase(database.getId(), fields);
    assertNotNull(database.getOwner());
    assertNotNull(database.getService());
    assertNotNull(database.getTables());
    TestUtils.validateEntityReference(database.getTables());
    assertNotNull(database.getUsageSummary());

  }

  private static Database validateDatabase(Database database, String expectedDescription, EntityReference expectedOwner,
                                           EntityReference expectedService) {
    assertNotNull(database.getId());
    assertNotNull(database.getHref());
    assertEquals(expectedDescription, database.getDescription());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(database.getOwner());
      Assertions.assertEquals(expectedOwner.getId(), database.getOwner().getId());
      Assertions.assertEquals(expectedOwner.getType(), database.getOwner().getType());
      assertNotNull(database.getOwner().getHref());
    }

    // Validate service
    if (expectedService != null) {
      TestUtils.validateEntityReference(database.getService());
      Assertions.assertEquals(expectedService.getId(), database.getService().getId());
      Assertions.assertEquals(expectedService.getType(), database.getService().getType());
    }
    return database;
  }

  private Database patchDatabaseAttributesAndCheck(Database database, String newDescription,
                                                EntityReference newOwner)
          throws JsonProcessingException, HttpResponseException {
    String databaseJson = JsonUtils.pojoToJson(database);

    // Update the table attributes
    database.setDescription(newDescription);
    database.setOwner(newOwner);

    // Validate information returned in patch response has the updates
    Database updatedDatabase = patchDatabase(databaseJson, database);
    validateDatabase(updatedDatabase, database.getDescription(), newOwner, null);

    // GET the table and Validate information returned
    Database getDatabase = getDatabase(database.getId(), "service,owner");
    validateDatabase(getDatabase, database.getDescription(), newOwner, null);
    return updatedDatabase;
  }

  private Database patchDatabase(UUID databaseId, String originalJson, Database updatedDatabase) throws JsonProcessingException, HttpResponseException {
    String updateTableJson = JsonUtils.pojoToJson(updatedDatabase);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updateTableJson);
    return TestUtils.patch(CatalogApplicationTest.getResource("databases/" + databaseId), patch, Database.class);
  }

  private Database patchDatabase(String originalJson, Database updatedDatabase) throws JsonProcessingException, HttpResponseException {
    return patchDatabase(updatedDatabase.getId(), originalJson, updatedDatabase);
  }

  public static void getDatabase(UUID id) throws HttpResponseException {
    getDatabase(id, null);
  }

  public static Database getDatabase(UUID id, String fields) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("databases/" + id);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Database.class);
  }

  public static Database getDatabaseByName(String fqn, String fields) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("databases/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Database.class);
  }

  public static DatabaseList listDatabases(String fields, String serviceParam) throws HttpResponseException {
    return listDatabases(fields, serviceParam, null, null, null);
  }

  public static DatabaseList listDatabases(String fields, String serviceParam, Integer limitParam,
                                           String before, String after)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("databases");
    target = fields != null ? target.queryParam("fields", fields): target;
    target = serviceParam != null ? target.queryParam("service", serviceParam): target;
    target = limitParam != null ? target.queryParam("limit", limitParam): target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, DatabaseList.class);
  }

  private void deleteDatabase(UUID id) throws HttpResponseException {
    TestUtils.delete(CatalogApplicationTest.getResource("databases/" + id));

    // Ensure deleted database does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getDatabase(id));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.DATABASE, id));
  }

  public static String getDatabaseName(TestInfo test) {
    return String.format("database_%s", test.getDisplayName());
  }

  public static String getDatabaseName(TestInfo test, int index) {
    return String.format("database%d_%s", index, test.getDisplayName());
  }

  public static CreateDatabase create(TestInfo test) {
    return new CreateDatabase().withName(getDatabaseName(test)).withService(SNOWFLAKE_REFERENCE);
  }

  public static CreateDatabase create(TestInfo test, int index) {
    return new CreateDatabase().withName(getDatabaseName(test, index)).withService(SNOWFLAKE_REFERENCE);
  }
}
