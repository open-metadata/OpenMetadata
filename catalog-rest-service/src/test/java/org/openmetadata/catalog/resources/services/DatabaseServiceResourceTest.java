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

package org.openmetadata.catalog.resources.services;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.getPrincipal;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Date;
import java.util.Map;
import javax.ws.rs.core.Response;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.jdbi3.DatabaseServiceRepository.DatabaseServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.database.DatabaseServiceResource.DatabaseServiceList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

public class DatabaseServiceResourceTest extends EntityResourceTest<DatabaseService> {
  public DatabaseServiceResourceTest() {
    super(
        Entity.DATABASE_SERVICE,
        DatabaseService.class,
        DatabaseServiceList.class,
        "services/databaseServices",
        "",
        false,
        false,
        false);
    this.supportsPatch = false;
  }

  @Test
  void post_validDatabaseService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create database service with different optional fields
    Map<String, String> authHeaders = adminAuthHeaders();
    createAndCheckEntity(create(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(create(test, 2).withDescription("description"), authHeaders);
    createAndCheckEntity(create(test, 3).withIngestionSchedule(null), authHeaders);
  }

  @Test
  void post_validDatabaseService_as_non_admin_401(TestInfo test) {
    // Create database service with different optional fields
    Map<String, String> authHeaders = authHeaders("test@open-metadata.org");

    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> createAndCheckEntity(create(test, 1).withDescription(null), authHeaders));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void post_invalidDatabaseServiceNoJdbc_4xx(TestInfo test) {
    // No jdbc connection set
    CreateDatabaseService create = create(test).withJdbc(null);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "jdbc must not be null");
  }

  @Test
  void post_invalidIngestionSchedule_4xx(TestInfo test) {
    // No jdbc connection set
    CreateDatabaseService create = create(test);
    Schedule schedule = create.getIngestionSchedule();

    // Invalid format
    create.withIngestionSchedule(schedule.withRepeatFrequency("INVALID"));
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "Invalid ingestion repeatFrequency INVALID");

    // Duration that contains years, months and seconds are not allowed
    create.withIngestionSchedule(schedule.withRepeatFrequency("P1Y"));
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(
        exception,
        BAD_REQUEST,
        "Ingestion repeatFrequency can only contain Days, Hours, " + "and Minutes - example P{d}DT{h}H{m}M");

    create.withIngestionSchedule(schedule.withRepeatFrequency("P1M"));
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(
        exception,
        BAD_REQUEST,
        "Ingestion repeatFrequency can only contain Days, Hours, " + "and Minutes - example P{d}DT{h}H{m}M");

    create.withIngestionSchedule(schedule.withRepeatFrequency("PT1S"));
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(
        exception,
        BAD_REQUEST,
        "Ingestion repeatFrequency can only contain Days, Hours, " + "and Minutes - example P{d}DT{h}H{m}M");
  }

  @Test
  void post_validIngestionSchedules_as_admin_200(TestInfo test) throws IOException {
    Schedule schedule = new Schedule().withStartDate(new Date());
    schedule.withRepeatFrequency("PT60M"); // Repeat every 60M should be valid
    createAndCheckEntity(create(test, 1).withIngestionSchedule(schedule), adminAuthHeaders());

    schedule.withRepeatFrequency("PT1H49M");
    createAndCheckEntity(create(test, 2).withIngestionSchedule(schedule), adminAuthHeaders());

    schedule.withRepeatFrequency("P1DT1H49M");
    createAndCheckEntity(create(test, 3).withIngestionSchedule(schedule), adminAuthHeaders());
  }

  @Test
  void post_ingestionScheduleIsTooShort_4xx(TestInfo test) {
    // No jdbc connection set
    CreateDatabaseService create = create(test);
    Schedule schedule = create.getIngestionSchedule();
    create.withIngestionSchedule(schedule.withRepeatFrequency("PT1M")); // Repeat every 0 seconds
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(
        exception, BAD_REQUEST, "Ingestion repeatFrequency is too short and must be more than 60 minutes");

    create.withIngestionSchedule(schedule.withRepeatFrequency("PT59M")); // Repeat every 50 minutes 59 seconds
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(
        exception, BAD_REQUEST, "Ingestion repeatFrequency is too short and must " + "be more than 60 minutes");
  }

  @Test
  void put_updateDatabaseService_as_admin_2xx(TestInfo test) throws IOException {
    DatabaseService service =
        createAndCheckEntity(create(test).withDescription(null).withIngestionSchedule(null), adminAuthHeaders());

    // Update database description and ingestion service that are null
    CreateDatabaseService update = create(test).withDescription("description1");
    Schedule schedule = update.getIngestionSchedule();
    ChangeDescription change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description1"));
    change.getFieldsAdded().add(new FieldChange().withName("ingestionSchedule").withNewValue(schedule));
    service = updateAndCheckEntity(update, OK, adminAuthHeaders(), UpdateType.MINOR_UPDATE, change);

    // Update ingestion schedule
    Schedule schedule1 = new Schedule().withStartDate(new Date()).withRepeatFrequency("PT1H");
    update.withIngestionSchedule(schedule1);
    change = getChangeDescription(service.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("ingestionSchedule").withOldValue(schedule).withNewValue(schedule1));
    updateAndCheckEntity(update, OK, adminAuthHeaders(), UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void put_update_as_non_admin_401(TestInfo test) throws IOException {
    Map<String, String> authHeaders = adminAuthHeaders();
    createAndCheckEntity(create(test).withDescription(null).withIngestionSchedule(null), authHeaders);

    // Update as non admin should be forbidden
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () ->
                updateAndCheckEntity(
                    create(test), OK, authHeaders("test@open-metadata.org"), UpdateType.MINOR_UPDATE, null));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} " + "is not admin");
  }

  @Test
  void delete_ExistentDatabaseService_as_admin_200(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    DatabaseService databaseService = createEntity(create(test), authHeaders);
    deleteEntity(databaseService.getId(), authHeaders);
  }

  @Test
  void delete_put_DatabaseService_200(TestInfo test) throws IOException {
    CreateDatabaseService request = create(test).withDescription("");
    DatabaseService databaseService = createEntity(request, adminAuthHeaders());

    // Delete
    deleteEntity(databaseService.getId(), adminAuthHeaders());

    ChangeDescription change = getChangeDescription(databaseService.getVersion());
    change.setFieldsUpdated(
        Arrays.asList(
            new FieldChange().withName("deleted").withNewValue(false).withOldValue(true),
            new FieldChange().withName("description").withNewValue("updatedDescription").withOldValue("")));

    // PUT with updated description
    updateAndCheckEntity(
        request.withDescription("updatedDescription"), Response.Status.OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  void delete_as_user_401(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    DatabaseService databaseService = createEntity(create(test), authHeaders);
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> deleteEntity(databaseService.getId(), authHeaders("test@open-metadata.org")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  public CreateDatabaseService create(TestInfo test) {
    return create(getEntityName(test))
        .withIngestionSchedule(new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D"));
  }

  private CreateDatabaseService create(TestInfo test, int index) {
    return create(getEntityName(test, index));
  }

  private CreateDatabaseService create(String entityName) {
    return new CreateDatabaseService()
        .withName(entityName)
        .withServiceType(DatabaseServiceType.Snowflake)
        .withJdbc(TestUtils.JDBC_INFO);
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description);
  }

  @Override
  public EntityReference getContainer(Object createRequest) throws URISyntaxException {
    return null; // No container entity
  }

  @Override
  public void validateCreatedEntity(DatabaseService service, Object request, Map<String, String> authHeaders) {
    CreateDatabaseService createRequest = (CreateDatabaseService) request;
    validateCommonEntityFields(
        getEntityInterface(service), createRequest.getDescription(), getPrincipal(authHeaders), null);
    assertEquals(createRequest.getName(), service.getName());

    // Validate jdbc
    assertEquals(createRequest.getJdbc(), service.getJdbc());

    Schedule expectedIngestion = createRequest.getIngestionSchedule();
    if (expectedIngestion != null) {
      assertEquals(expectedIngestion.getStartDate(), service.getIngestionSchedule().getStartDate());
      assertEquals(expectedIngestion.getRepeatFrequency(), service.getIngestionSchedule().getRepeatFrequency());
    }
  }

  @Override
  public void validateUpdatedEntity(DatabaseService service, Object request, Map<String, String> authHeaders) {
    validateCreatedEntity(service, request, authHeaders);
  }

  @Override
  public void compareEntities(DatabaseService expected, DatabaseService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public EntityInterface<DatabaseService> getEntityInterface(DatabaseService entity) {
    return new DatabaseServiceEntityInterface(entity);
  }

  @Override
  public void validateGetWithDifferentFields(DatabaseService service, boolean byName) throws HttpResponseException {
    // No fields support
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getName(), fields, adminAuthHeaders())
            : getEntity(service.getId(), fields, adminAuthHeaders());
    TestUtils.assertListNotNull(
        service.getHref(),
        service.getVersion(),
        service.getUpdatedBy(),
        service.getServiceType(),
        service.getJdbc(),
        service.getUpdatedAt());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (fieldName.equals("ingestionSchedule")) {
      Schedule expectedSchedule = (Schedule) expected;
      Schedule actualSchedule = JsonUtils.readValue((String) actual, Schedule.class);
      assertEquals(expectedSchedule, actualSchedule);
    } else {
      super.assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
