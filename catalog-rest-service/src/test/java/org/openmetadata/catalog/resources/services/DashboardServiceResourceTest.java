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

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.dashboard.DashboardServiceResource.DashboardServiceList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.Map;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.getPrincipal;

public class DashboardServiceResourceTest extends EntityResourceTest<DashboardService> {
  public DashboardServiceResourceTest() {
    super(Entity.DASHBOARD_SERVICE, DashboardService.class, DashboardServiceList.class, "services/dashboardServices",
            "", false, false, false);
    this.supportsPatch = false;
  }

  @Test
  public void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create dashboard with mandatory serviceType field empty
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create(test).withServiceType(null), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[serviceType must not be null]");

    // Create dashboard with mandatory brokers field empty
    exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create(test).withDashboardUrl(null), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[dashboardUrl must not be null]");
  }

  @Test
  public void post_validService_as_admin_200_ok(TestInfo test) throws IOException, URISyntaxException {
    // Create dashboard service with different optional fields
    Map<String, String> authHeaders = adminAuthHeaders();
    createAndCheckEntity(create(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(create(test, 2).withDescription("description"), authHeaders);
    createAndCheckEntity(create(test, 3).withIngestionSchedule(null), authHeaders);
  }

  @Test
  public void post_validService_as_non_admin_401(TestInfo test)  {
    // Create dashboard service with different optional fields
    Map<String, String> authHeaders = authHeaders("test@open-metadata.org");

    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createAndCheckEntity(create(test, 1).withDescription(null), authHeaders));
    TestUtils.assertResponse(exception, FORBIDDEN,
            "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_invalidIngestionSchedule_4xx(TestInfo test) throws URISyntaxException {
    // No jdbc connection set
    CreateDashboardService create = create(test);
    Schedule schedule = create.getIngestionSchedule();

    // Invalid format
    create.withIngestionSchedule(schedule.withRepeatFrequency("INVALID"));
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "Invalid ingestion repeatFrequency INVALID");

    // Duration that contains years, months and seconds are not allowed
    create.withIngestionSchedule(schedule.withRepeatFrequency("P1Y"));
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST,
            "Ingestion repeatFrequency can only contain Days, Hours, " +
                    "and Minutes - example P{d}DT{h}H{m}M");

    create.withIngestionSchedule(schedule.withRepeatFrequency("P1M"));
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST,
            "Ingestion repeatFrequency can only contain Days, Hours, " +
                    "and Minutes - example P{d}DT{h}H{m}M");

    create.withIngestionSchedule(schedule.withRepeatFrequency("PT1S"));
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST,
            "Ingestion repeatFrequency can only contain Days, Hours, " +
                    "and Minutes - example P{d}DT{h}H{m}M");
  }

  @Test
  public void post_validIngestionSchedules_as_admin_200(TestInfo test)
          throws IOException, URISyntaxException {
    Schedule schedule = new Schedule().withStartDate(new Date());
    schedule.withRepeatFrequency("PT60M");  // Repeat every 60M should be valid
    createAndCheckEntity(create(test, 1).withIngestionSchedule(schedule), adminAuthHeaders());

    schedule.withRepeatFrequency("PT1H49M");
    createAndCheckEntity(create(test, 2).withIngestionSchedule(schedule), adminAuthHeaders());

    schedule.withRepeatFrequency("P1DT1H49M");
    createAndCheckEntity(create(test, 3).withIngestionSchedule(schedule), adminAuthHeaders());
  }

  @Test
  public void post_ingestionScheduleIsTooShort_4xx(TestInfo test) throws URISyntaxException {
    // No jdbc connection set
    CreateDashboardService create = create(test);
    Schedule schedule = create.getIngestionSchedule();
    create.withIngestionSchedule(schedule.withRepeatFrequency("PT1M"));  // Repeat every 0 seconds
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST,
            "Ingestion repeatFrequency is too short and must be more than 60 minutes");

    create.withIngestionSchedule(schedule.withRepeatFrequency("PT59M"));  // Repeat every 50 minutes 59 seconds
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "Ingestion repeatFrequency is too short and must " +
            "be more than 60 minutes");
  }

  @Test
  public void put_updateService_as_admin_2xx(TestInfo test) throws IOException, URISyntaxException {
    DashboardService service = createAndCheckEntity(create(test).withDescription(null).withIngestionSchedule(null),
            adminAuthHeaders());

    // Update dashboard description and ingestion service that are null
    Schedule schedule = new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D");
    CreateDashboardService update = create(test).withDescription("description1")
            .withDashboardUrl(new URI("http://localhost:8080")).withUsername("user").withPassword("password")
            .withIngestionSchedule(schedule);

    ChangeDescription change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description1"));
    change.getFieldsAdded().add(new FieldChange().withName("userName").withNewValue("user"));
    change.getFieldsAdded().add(new FieldChange().withName("ingestionSchedule").withNewValue(schedule));
    change.getFieldsUpdated().add(new FieldChange().withName("dashboardUrl").withOldValue("http://192.1.1.1:0")
            .withNewValue("http://localhost:8080"));
    service = updateAndCheckEntity(update, OK, adminAuthHeaders(), UpdateType.MINOR_UPDATE, change);

    // Update ingestion schedule
    Schedule schedule1 = new Schedule().withStartDate(new Date()).withRepeatFrequency("PT1H");
    change = getChangeDescription(service.getVersion());
    change.getFieldsUpdated().add(new FieldChange().withName("ingestionSchedule").withOldValue(schedule)
            .withNewValue(schedule1));
    update.withIngestionSchedule(schedule1);
    updateAndCheckEntity(update, OK, adminAuthHeaders(), UpdateType.MINOR_UPDATE, change);
  }

  @Test
  public void put_update_as_non_admin_401(TestInfo test) throws IOException, URISyntaxException {
    Map<String, String> authHeaders = adminAuthHeaders();
    createAndCheckEntity(create(test).withDescription(null).withIngestionSchedule(null), authHeaders);

    // Update dashboard description and ingestion service that are null
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            updateAndCheckEntity(create(test), OK, authHeaders("test@open-metadata.org"),
            UpdateType.NO_CHANGE, null));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} " +
            "is not admin");
  }

  @Test
  public void delete_ExistentDashboardService_as_admin_200(TestInfo test)
          throws HttpResponseException, URISyntaxException {
    Map<String, String> authHeaders = adminAuthHeaders();
    DashboardService dashboardService = createEntity(create(test), authHeaders);
    deleteEntity(dashboardService.getId(), authHeaders);
  }

  @Test
  public void delete_as_user_401(TestInfo test) throws HttpResponseException, URISyntaxException {
    Map<String, String> authHeaders = adminAuthHeaders();
    DashboardService dashboardService = createEntity(create(test), authHeaders);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteEntity(dashboardService.getId(), authHeaders("test@open-metadata.org")));
    TestUtils.assertResponse(exception, FORBIDDEN,
            "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void delete_notExistentDashboardService() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getEntity(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND,
            CatalogExceptionMessage.entityNotFound(Entity.DASHBOARD_SERVICE, TestUtils.NON_EXISTENT_ENTITY));
  }

  private CreateDashboardService create(TestInfo test) throws URISyntaxException {
    return create(getEntityName(test));
  }

  private CreateDashboardService create(TestInfo test, int index) throws URISyntaxException {
    return create(getEntityName(test, index));
  }

  private CreateDashboardService create(String entityName) throws URISyntaxException {
    return new CreateDashboardService().withName(entityName)
            .withServiceType(CreateDashboardService.DashboardServiceType.Superset)
            .withDashboardUrl(new URI("http://192.1.1.1:0"))
            .withIngestionSchedule(new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D"));
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner)
          throws URISyntaxException {
    return create(name).withDescription(description).withIngestionSchedule(null);
  }

  @Override
  public void validateCreatedEntity(DashboardService service, Object request, Map<String, String> authHeaders) {
    CreateDashboardService createRequest = (CreateDashboardService) request;
    validateCommonEntityFields(getEntityInterface(service), createRequest.getDescription(),
            getPrincipal(authHeaders), null);
    assertEquals(createRequest.getName(), service.getName());

    Schedule expectedIngestion = createRequest.getIngestionSchedule();
    if (expectedIngestion != null) {
      assertEquals(expectedIngestion.getStartDate(), service.getIngestionSchedule().getStartDate());
      assertEquals(expectedIngestion.getRepeatFrequency(), service.getIngestionSchedule().getRepeatFrequency());
    }
  }

  @Override
  public void validateUpdatedEntity(DashboardService service, Object request, Map<String, String> authHeaders) {
    validateCreatedEntity(service, request, authHeaders);
  }

  @Override
  public void compareEntities(DashboardService expected, DashboardService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public EntityInterface<DashboardService> getEntityInterface(DashboardService entity) {
    return new DashboardServiceEntityInterface(entity);
  }

  @Override
  public void validateGetWithDifferentFields(DashboardService service, boolean byName) throws HttpResponseException {
    // No fields support
    String fields = "";
    service = byName ? getEntityByName(service.getName(), fields, adminAuthHeaders()) :
            getEntity(service.getId(), fields, adminAuthHeaders());
    TestUtils.assertListNotNull(service.getHref(), service.getVersion(), service.getUpdatedBy(),
            service.getServiceType(), service.getUpdatedAt());
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