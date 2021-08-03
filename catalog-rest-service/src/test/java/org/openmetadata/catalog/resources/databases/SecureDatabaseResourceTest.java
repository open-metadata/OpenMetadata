package org.openmetadata.catalog.resources.databases;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.SecureCatalogApplicationTest;
import org.openmetadata.catalog.api.data.CreateDatabase;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.databases.DatabaseResource.DatabaseList;
import org.openmetadata.catalog.resources.services.SecureDatabaseServiceResourceTest;
import org.openmetadata.catalog.resources.teams.SecureTeamResourceTest;
import org.openmetadata.catalog.resources.teams.SecureUserResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.common.utils.JsonSchemaUtil;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.*;

public class SecureDatabaseResourceTest extends SecureCatalogApplicationTest {
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
    USER1 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test),
            TestUtils.authHeaders("test@getcollate.com"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = SecureTeamResourceTest.createTeam(SecureTeamResourceTest.create(test), TestUtils.adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");

    CreateDatabaseService createService = new CreateDatabaseService().withName("snowflakeDB")
            .withServiceType(DatabaseServiceType.Snowflake).withJdbc(TestUtils.JDBC_INFO);
    DatabaseService service = SecureDatabaseServiceResourceTest.createService(createService, TestUtils.adminAuthHeaders());
    SNOWFLAKE_REFERENCE = EntityUtil.getEntityReference(service);

    createService.withName("redshiftDB").withServiceType(DatabaseServiceType.Redshift);
    service = SecureDatabaseServiceResourceTest.createService(createService, TestUtils.adminAuthHeaders());
    REDSHIFT_REFERENCE = EntityUtil.getEntityReference(service);

    createService.withName("bigQueryDB").withServiceType(DatabaseServiceType.BigQuery);
    service = SecureDatabaseServiceResourceTest.createService(createService, TestUtils.adminAuthHeaders());
    BIGQUERY_REFERENCE = EntityUtil.getEntityReference(service);

    createService.withName("mysqlDB").withServiceType(DatabaseServiceType.MySQL);
    service = SecureDatabaseServiceResourceTest.createService(createService, TestUtils.adminAuthHeaders());
    MYSQL_REFERENCE = EntityUtil.getEntityReference(service);
  }

  @Test
  public void post_validDatabases_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    CreateDatabase create = create(test);
    createAndCheckDatabase(create, TestUtils.adminAuthHeaders());

    create.withName(getDatabaseName(test, 1)).withDescription("description");
    createAndCheckDatabase(create, TestUtils.adminAuthHeaders());
  }

  @Test
  public void post_databaseWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckDatabase(create(test).withOwner(USER_OWNER1), TestUtils.adminAuthHeaders());
  }

  @Test
  public void post_databaseWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckDatabase(create(test).withOwner(TEAM_OWNER1), TestUtils.adminAuthHeaders());
  }

  @Test
  public void post_database_as_non_admin_401(TestInfo test) {
    CreateDatabase create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDatabase(create, TestUtils.authHeaders("test@getcollate.com")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_databaseWithDifferentService_200_ok(TestInfo test) throws HttpResponseException {
    EntityReference[] differentServices = { MYSQL_REFERENCE, REDSHIFT_REFERENCE, BIGQUERY_REFERENCE,
            SNOWFLAKE_REFERENCE};

    // Create database for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckDatabase(create(test).withService(service), TestUtils.adminAuthHeaders());

      // List databases by filtering on service name and ensure right databases are returned in the response
      DatabaseList list = listDatabases("service", service.getName(), TestUtils.adminAuthHeaders());
      for (Database db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
      }
    }
  }

  @Test
  public void put_databaseUpdateWithNoChange_200(TestInfo test) throws HttpResponseException {
    // Create a database with POST
    CreateDatabase request = create(test).withService(SNOWFLAKE_REFERENCE).withOwner(USER_OWNER1);
    createAndCheckDatabase(request, TestUtils.adminAuthHeaders());

    // Update database two times successfully with PUT requests
    updateAndCheckDatabase(request, OK, TestUtils.adminAuthHeaders());
    updateAndCheckDatabase(request, OK, TestUtils.adminAuthHeaders());
  }

  @Test
  public void put_databaseCreate_200(TestInfo test) throws HttpResponseException {
    // Create a new database with put
    CreateDatabase request = create(test).withService(SNOWFLAKE_REFERENCE).withOwner(USER_OWNER1);
    updateAndCheckDatabase(request.withName(test.getDisplayName()).withDescription(null), CREATED, TestUtils.adminAuthHeaders());
  }

  @Test
  public void put_databaseCreate_as_owner_200(TestInfo test) throws HttpResponseException {
    // Create a new database with put
    CreateDatabase request = create(test).withService(SNOWFLAKE_REFERENCE).withOwner(USER_OWNER1);
    // Add Owner as admin
    createAndCheckDatabase(request, TestUtils.adminAuthHeaders());
    //Update the table as Owner
    updateAndCheckDatabase(request.withName(test.getDisplayName()).withDescription(null),
            CREATED, TestUtils.authHeaders(USER1.getEmail()));

  }

  @Test
  public void put_databaseNullDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateDatabase request = create(test).withService(SNOWFLAKE_REFERENCE).withDescription(null);
    createAndCheckDatabase(request, TestUtils.adminAuthHeaders());

    // Update null description with a new description
    Database db = updateAndCheckDatabase(request.withDescription("newDescription"), OK, TestUtils.adminAuthHeaders());
    assertEquals("newDescription", db.getDescription());
  }

  @Test
  public void put_databaseNonEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateDatabase request = create(test).withService(SNOWFLAKE_REFERENCE).withDescription("description");
    createAndCheckDatabase(request, TestUtils.adminAuthHeaders());

    // Updating description is ignored when backend already has description
    Database db = updateDatabase(request.withDescription("newDescription"), OK, TestUtils.adminAuthHeaders());
    assertEquals("description", db.getDescription());
  }

  @Test
  public void patch_databaseAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create database without description, owner
    Database database = createDatabase(create(test), TestUtils.adminAuthHeaders());
    assertNull(database.getDescription());
    assertNull(database.getOwner());
    assertNotNull(database.getService());

    database = getDatabase(database.getId(), "service,owner,usageSummary", TestUtils.adminAuthHeaders());
    database.getService().setHref(null); // href is readonly and not patchable

    // Add description, owner when previously they were null
    database = patchDatabaseAttributesAndCheck(database, "description", TEAM_OWNER1, TestUtils.adminAuthHeaders());
    database.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner
    database.setService(MYSQL_REFERENCE); // Get rid of href and name returned in the response for service

    // Replace description, tier, owner
    database = patchDatabaseAttributesAndCheck(database, "description1", USER_OWNER1, TestUtils.adminAuthHeaders());
    database.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner
    database.setService(REDSHIFT_REFERENCE); // Get rid of href and name returned in the response for service

    // Remove description, tier, owner
    patchDatabaseAttributesAndCheck(database, null, null, TestUtils.adminAuthHeaders());
  }

  @Test
  public void patch_databaseIDChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure database ID can't be changed using patch
    Database database = createDatabase(create(test), TestUtils.adminAuthHeaders());
    UUID databaseId = database.getId();
    String databaseJson = JsonUtils.pojoToJson(database);
    database.setId(UUID.randomUUID());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> patchDatabase(databaseId, databaseJson, database, TestUtils.adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE, "id"));

    // ID can't be deleted
    database.setId(null);
    exception = assertThrows(HttpResponseException.class, () -> patchDatabase(databaseId, databaseJson, database, TestUtils.adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE, "id"));
  }


  // TODO listing tables test:1
  // TODO Change service?

  @Test
  public void delete_emptyDatabase_200_ok(TestInfo test) throws HttpResponseException {
    Database database = createDatabase(create(test), TestUtils.adminAuthHeaders());
    deleteDatabase(database.getId(), TestUtils.adminAuthHeaders());
  }


  public static Database createAndCheckDatabase(CreateDatabase create,
                                                Map<String, String> authHeaders) throws HttpResponseException {
    Database database = createDatabase(create, authHeaders);
    validateDatabase(database, create.getDescription(), create.getOwner(), create.getService());
    return getAndValidate(database.getId(), create, authHeaders);
  }

  public static Database updateAndCheckDatabase(CreateDatabase create,
                                                Status status,
                                                Map<String, String> authHeaders) throws HttpResponseException {
    Database updatedDb = updateDatabase(create, status, authHeaders);
    validateDatabase(updatedDb, create.getDescription(), create.getOwner(), create.getService());

    // GET the newly updated database and validate
    return getAndValidate(updatedDb.getId(), create, authHeaders);
  }

  // Make sure in GET operations the returned database has all the required information passed during creation
  public static Database getAndValidate(UUID databaseId,
                                        CreateDatabase create,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    // GET the newly created database by ID and validate
    Database database = getDatabase(databaseId, "service,owner", authHeaders);
    validateDatabase(database, create.getDescription(), create.getOwner(), create.getService());

    // GET the newly created database by name and validate
    String fqn = database.getFullyQualifiedName();
    database = getDatabaseByName(fqn, "service,owner", authHeaders);
    return validateDatabase(database, create.getDescription(), create.getOwner(), create.getService());
  }

  public static Database updateDatabase(CreateDatabase create,
                                        Status status,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(SecureCatalogApplicationTest.getResource("databases"),
                          create, Database.class, status, authHeaders);
  }

  public static Database createDatabase(CreateDatabase create,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(SecureCatalogApplicationTest.getResource("databases"), create, Database.class, authHeaders);
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
                                                EntityReference newOwner, Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String databaseJson = JsonUtils.pojoToJson(database);

    // Update the table attributes
    database.setDescription(newDescription);
    database.setOwner(newOwner);

    // Validate information returned in patch response has the updates
    Database updatedDatabase = patchDatabase(databaseJson, database, authHeaders);
    validateDatabase(updatedDatabase, database.getDescription(), newOwner, null);

    // GET the table and Validate information returned
    Database getDatabase = getDatabase(database.getId(), "service,owner", authHeaders);
    validateDatabase(getDatabase, database.getDescription(), newOwner, null);
    return updatedDatabase;
  }

  private Database patchDatabase(UUID databaseId, String originalJson,
                                 Database updatedDatabase,
                                 Map<String, String> authHeaders) throws JsonProcessingException, HttpResponseException {
    String updateTableJson = JsonUtils.pojoToJson(updatedDatabase);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updateTableJson);
    return TestUtils.patch(SecureCatalogApplicationTest.getResource("databases/" + databaseId), patch, Database.class, authHeaders);
  }

  private Database patchDatabase(String originalJson,
                                 Database updatedDatabase,
                                 Map<String, String> authHeaders) throws JsonProcessingException, HttpResponseException {
    return patchDatabase(updatedDatabase.getId(), originalJson, updatedDatabase, authHeaders);
  }

  public static void getDatabase(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getDatabase(id, null, authHeaders);
  }

  public static Database getDatabase(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("databases/" + id);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Database.class, authHeaders);
  }

  public static Database getDatabaseByName(String fqn, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("databases/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Database.class, authHeaders);
  }

  public static DatabaseList listDatabases(String fields, String serviceParam, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("databases");
    target = fields != null ? target.queryParam("fields", fields): target;
    target = serviceParam != null ? target.queryParam("service", serviceParam): target;
    return TestUtils.get(target, DatabaseList.class, authHeaders);
  }

  private void deleteDatabase(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(SecureCatalogApplicationTest.getResource("databases/" + id), authHeaders);

    // Ensure deleted database does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getDatabase(id, authHeaders));
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
}
