package org.openmetadata.catalog.resources.services;

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.SecureCatalogApplicationTest;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.catalog.api.services.UpdateDatabaseService;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.type.JdbcInfo;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.TestUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.*;

public class SecureDatabaseServiceResourceTest extends SecureCatalogApplicationTest {
  private static final Logger LOG = LoggerFactory.getLogger(SecureDatabaseServiceResourceTest.class);

  @Test
  public void post_validDatabaseService_as_admin_200_ok(TestInfo test) throws HttpResponseException {
    // Create database service with different optional fields
    Map<String, String> authHeaders = TestUtils.adminAuthHeaders();
    createAndCheckService(create(test, 1).withDescription(null), authHeaders);
    createAndCheckService(create(test, 2).withDescription("description"), authHeaders);
    createAndCheckService(create(test, 3).withIngestionSchedule(null), authHeaders);
  }

  @Test
  public void post_validDatabaseService_as_non_admin_401(TestInfo test)  {
    // Create database service with different optional fields
    Map<String, String> authHeaders = TestUtils.authHeaders("test@getcollate.io");

    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createAndCheckService(create(test, 1).withDescription(null), authHeaders));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_as_admin_200_ok(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = TestUtils.adminAuthHeaders();

    Schedule schedule = new Schedule().withStartDate(RestUtil.DATE_TIME_FORMAT.format(new Date()));
    schedule.withRepeatFrequency("PT60M");  // Repeat every 60M should be valid
    createAndCheckService(create(test, 1).withIngestionSchedule(schedule), authHeaders);

    schedule.withRepeatFrequency("PT1H49M");
    createAndCheckService(create(test, 2).withIngestionSchedule(schedule), authHeaders);

    schedule.withRepeatFrequency("P1DT1H49M");
    createAndCheckService(create(test, 3).withIngestionSchedule(schedule), authHeaders);
  }


  @Test
  public void put_update_as_admin_2xx(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = TestUtils.adminAuthHeaders();
    DatabaseService dbService = createAndCheckService(create(test).withDescription(null).withIngestionSchedule(null),
                                                      authHeaders);
    String id = dbService.getId().toString();
    String startDate = RestUtil.DATE_TIME_FORMAT.format(new Date());

    // Update database description and ingestion service that are null
    UpdateDatabaseService update = new UpdateDatabaseService().withDescription("description1");
    updateAndCheckService(id, update, OK, authHeaders);
    // Update ingestion schedule
    Schedule schedule = new Schedule().withStartDate(startDate).withRepeatFrequency("P1D");
    update.withIngestionSchedule(schedule);
    updateAndCheckService(id, update, OK, authHeaders);
  }

  @Test
  public void put_update_as_non_admin_401(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = TestUtils.adminAuthHeaders();
    DatabaseService dbService = createAndCheckService(create(test).withDescription(null).withIngestionSchedule(null),
            authHeaders);
    String id = dbService.getId().toString();
    String startDate = RestUtil.DATE_TIME_FORMAT.format(new Date());

    // Update database description and ingestion service that are null
    UpdateDatabaseService update = new UpdateDatabaseService().withDescription("description1");

    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            updateAndCheckService(id, update, OK, TestUtils.authHeaders("test@getcollate.com")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  public static DatabaseService createAndCheckService(CreateDatabaseService create,
                                                      Map<String, String> authHeaders) throws HttpResponseException {
    DatabaseService service = createService(create, authHeaders);
    validateService(service, create.getName(), create.getDescription(), create.getJdbc(), create.getIngestionSchedule());

    // GET the newly created resource and validate
    DatabaseService getService = getService(service.getId(), authHeaders);
    validateService(getService, create.getName(), create.getDescription(), create.getJdbc(), create.getIngestionSchedule());
    return service;
  }

  public static DatabaseService createService(CreateDatabaseService create,
                                              Map<String, String> authHeaders) throws HttpResponseException {
    LOG.info("Create {}".format(create.toString()));
    return TestUtils.post(SecureCatalogApplicationTest.getResource("services/databaseServices"),
                          create, DatabaseService.class, authHeaders);
  }

  private static void validateService(DatabaseService service, String expectedName, String expectedDescription,
                                      JdbcInfo expectedJdbc, Schedule expectedIngestion) {
    assertNotNull(service.getId());
    assertNotNull(service.getHref());
    assertEquals(expectedName, service.getName());
    assertEquals(expectedDescription, service.getDescription());

    // Validate jdbc
    assertEquals(expectedJdbc, service.getJdbc());

    if (expectedIngestion != null) {
      assertEquals(expectedIngestion.getStartDate(), service.getIngestionSchedule().getStartDate());
      assertEquals(expectedIngestion.getRepeatFrequency(), service.getIngestionSchedule().getRepeatFrequency());
    }
  }

  public static DatabaseService getService(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    return getService(id, null, authHeaders);
  }

  public static DatabaseService getService(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("services/databaseServices/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, DatabaseService.class, authHeaders);
  }

  public static String getName(TestInfo test) {
    return String.format("dbservice_%s", test.getDisplayName());
  }

  public static String getName(TestInfo test, int index) {
    return String.format("dbservice_%d_%s", index, test.getDisplayName());
  }

  @Test
  public void delete_as_admin_200_ok(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = TestUtils.adminAuthHeaders();
    DatabaseService databaseService = createService(create(test), authHeaders);
    deleteService(databaseService.getId(), authHeaders);
  }

  @Test
  public void delete_as_user_401(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = TestUtils.adminAuthHeaders();
    DatabaseService databaseService = createService(create(test), authHeaders);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteService(databaseService.getId(), TestUtils.authHeaders("test@getcollate.com")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }


  private void deleteService(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(SecureCatalogApplicationTest.getResource("services/databaseServices/" + id), authHeaders);

    // Ensure deleted service does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getService(id, authHeaders));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.DATABASE_SERVICE, id));
  }

  public static CreateDatabaseService create(TestInfo test) {
    String startDate = RestUtil.DATE_TIME_FORMAT.format(new Date());
    return new CreateDatabaseService().withName(getName(test)).withServiceType(DatabaseServiceType.Snowflake)
            .withJdbc(TestUtils.JDBC_INFO).withIngestionSchedule(new Schedule().withStartDate(startDate).withRepeatFrequency("P1D"));
  }

  private static CreateDatabaseService create(TestInfo test, int index) {
    return new CreateDatabaseService().withName(getName(test, index)).withServiceType(DatabaseServiceType.Snowflake)
            .withJdbc(TestUtils.JDBC_INFO);
  }

  public static void updateAndCheckService(String id, UpdateDatabaseService update, Status status,
                                           Map<String, String> authHeaders) throws HttpResponseException {
    DatabaseService service = updateDatabaseService(id, update, status, authHeaders);
    validateService(service, service.getName(), update.getDescription(), service.getJdbc(),
            update.getIngestionSchedule());

    // GET the newly updated database and validate
    DatabaseService getService = getService(service.getId(), authHeaders);
    validateService(getService, service.getName(), update.getDescription(), service.getJdbc(),
            update.getIngestionSchedule());
  }

  public static DatabaseService updateDatabaseService(String id, UpdateDatabaseService updated,
                                                      Status status, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(SecureCatalogApplicationTest.getResource("services/databaseServices/" + id), updated,
            DatabaseService.class, status, authHeaders);
  }
}
