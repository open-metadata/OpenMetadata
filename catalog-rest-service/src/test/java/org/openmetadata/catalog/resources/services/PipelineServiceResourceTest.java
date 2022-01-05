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
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.getPrincipal;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreatePipelineService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.PipelineServiceRepository.PipelineServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.pipeline.PipelineServiceResource.PipelineServiceList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

public class PipelineServiceResourceTest extends EntityResourceTest<PipelineService> {

  public static URI PIPELINE_SERVICE_URL;

  public PipelineServiceResourceTest() {
    super(
        Entity.PIPELINE_SERVICE,
        PipelineService.class,
        PipelineServiceList.class,
        "services/pipelineServices",
        "",
        false,
        false,
        false);
    this.supportsPatch = false;
  }

  @BeforeAll
  @Override
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    super.setup(test);
    PIPELINE_SERVICE_URL = new URI("http://localhost:8080");
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create pipeline with mandatory serviceType field empty
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class, () -> createEntity(create(test).withServiceType(null), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[serviceType must not be null]");

    // Create pipeline with mandatory brokers field empty
    exception =
        assertThrows(
            HttpResponseException.class, () -> createEntity(create(test).withPipelineUrl(null), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[pipelineUrl must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create pipeline service with different optional fields
    Map<String, String> authHeaders = adminAuthHeaders();
    createAndCheckEntity(create(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(create(test, 2).withDescription("description"), authHeaders);
    createAndCheckEntity(create(test, 3).withIngestionSchedule(null), authHeaders);
  }

  @Test
  void post_validService_as_non_admin_401(TestInfo test) {
    // Create pipeline service with different optional fields
    Map<String, String> authHeaders = authHeaders("test@open-metadata.org");

    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> createAndCheckEntity(create(test, 1).withDescription(null), authHeaders));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void post_invalidIngestionSchedule_4xx(TestInfo test) {
    // No jdbc connection set
    CreatePipelineService create = create(test);
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
    CreatePipelineService create = create(test);
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
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException, URISyntaxException {
    PipelineService service =
        createAndCheckEntity(
            create(test).withDescription(null).withIngestionSchedule(null).withPipelineUrl(PIPELINE_SERVICE_URL),
            adminAuthHeaders());

    // Update pipeline description and ingestion service that are null
    CreatePipelineService update = create(test).withDescription("description1");
    Schedule schedule = update.getIngestionSchedule();
    ChangeDescription change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description1"));
    change.getFieldsAdded().add(new FieldChange().withName("ingestionSchedule").withNewValue(schedule));
    service = updateAndCheckEntity(update, OK, adminAuthHeaders(), UpdateType.MINOR_UPDATE, change);

    // Update ingestion schedule again
    Schedule schedule1 = new Schedule().withStartDate(new Date()).withRepeatFrequency("PT1H");
    update.withIngestionSchedule(schedule1);
    change = getChangeDescription(service.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("ingestionSchedule").withOldValue(schedule).withNewValue(schedule1));
    service = updateAndCheckEntity(update, OK, adminAuthHeaders(), UpdateType.MINOR_UPDATE, change);

    // update pipeline Url
    URI pipelineUrl = new URI("http://localhost:9000");
    update.withPipelineUrl(pipelineUrl);
    change = getChangeDescription(service.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("pipelineUrl").withOldValue(PIPELINE_SERVICE_URL).withNewValue(pipelineUrl));
    updateAndCheckEntity(update, OK, adminAuthHeaders(), UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void put_update_as_non_admin_401(TestInfo test) throws IOException {
    Map<String, String> authHeaders = adminAuthHeaders();
    createAndCheckEntity(create(test).withDescription(null).withIngestionSchedule(null), authHeaders);

    // Update pipeline description and ingestion service that are null
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () ->
                updateAndCheckEntity(
                    create(test), OK, authHeaders("test@open-metadata.org"), UpdateType.NO_CHANGE, null));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} " + "is not admin");
  }

  @Test
  void delete_ExistentPipelineService_as_admin_200(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    PipelineService pipelineService = createEntity(create(test), authHeaders);
    deleteEntity(pipelineService.getId(), authHeaders);
  }

  @Test
  void delete_as_user_401(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    PipelineService pipelineService = createEntity(create(test), authHeaders);
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> deleteEntity(pipelineService.getId(), authHeaders("test@open-metadata.org")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void delete_notExistentPipelineService() {
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> getEntity(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    TestUtils.assertResponse(
        exception,
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(Entity.PIPELINE_SERVICE, TestUtils.NON_EXISTENT_ENTITY));
  }

  private CreatePipelineService create(TestInfo test) {
    return create(getEntityName(test));
  }

  private CreatePipelineService create(TestInfo test, int index) {
    return create(getEntityName(test, index));
  }

  private CreatePipelineService create(String entityName) {
    return new CreatePipelineService()
        .withName(entityName)
        .withServiceType(CreatePipelineService.PipelineServiceType.Airflow)
        .withPipelineUrl(PIPELINE_SERVICE_URL)
        .withIngestionSchedule(new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D"));
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description).withIngestionSchedule(null);
  }

  @Override
  public EntityReference getContainer(Object createRequest) throws URISyntaxException {
    return null; // No container entity
  }

  @Override
  public void validateCreatedEntity(PipelineService service, Object request, Map<String, String> authHeaders) {
    CreatePipelineService createRequest = (CreatePipelineService) request;
    validateCommonEntityFields(
        getEntityInterface(service), createRequest.getDescription(), getPrincipal(authHeaders), null);
    assertEquals(createRequest.getName(), service.getName());

    Schedule expectedIngestion = createRequest.getIngestionSchedule();
    if (expectedIngestion != null) {
      assertEquals(expectedIngestion.getStartDate(), service.getIngestionSchedule().getStartDate());
      assertEquals(expectedIngestion.getRepeatFrequency(), service.getIngestionSchedule().getRepeatFrequency());
    }
    assertEquals(createRequest.getPipelineUrl(), service.getPipelineUrl());
  }

  @Override
  public void validateUpdatedEntity(PipelineService updatedEntity, Object request, Map<String, String> authHeaders) {
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  @Override
  public void compareEntities(PipelineService expected, PipelineService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public EntityInterface<PipelineService> getEntityInterface(PipelineService entity) {
    return new PipelineServiceEntityInterface(entity);
  }

  @Override
  public void validateGetWithDifferentFields(PipelineService service, boolean byName) throws HttpResponseException {
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
        service.getUpdatedAt());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (fieldName.equals("ingestionSchedule")) {
      Schedule expectedSchedule = (Schedule) expected;
      Schedule actualSchedule = JsonUtils.readValue((String) actual, Schedule.class);
      assertEquals(expectedSchedule, actualSchedule);
    } else if (fieldName.equals("pipelineUrl")) {
      URI expectedUri = (URI) expected;
      URI actualUri = URI.create((String) actual);
      assertEquals(expectedUri, actualUri);
    } else {
      super.assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
