/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.services;

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreatePipelineService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.PipelineServiceRepository.PipelineServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.pipeline.PipelineServiceResource.PipelineServiceList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.TestUtils;

import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class PipelineServiceResourceTest extends EntityResourceTest<PipelineService> {

  public static URI PIPELINE_SERVICE_URL;

  public PipelineServiceResourceTest() {
    super(Entity.PIPELINE_SERVICE, PipelineService.class, PipelineServiceList.class,
            "services/pipelineServices", "", false, false, false);
    this.supportsPatch = false;
  }

  @BeforeAll
  public static void setup() throws URISyntaxException {
    PIPELINE_SERVICE_URL = new URI("http://localhost:8080");
  }

  @Override
  public Object createRequest(TestInfo test, int index, String description, String displayName, EntityReference owner)
          throws URISyntaxException {
    return create(test, index).withDescription(description).withIngestionSchedule(null);
  }

  @Override
  public void validateCreatedEntity(PipelineService createdEntity, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {

  }

  @Override
  public void validateUpdatedEntity(PipelineService updatedEntity, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {

  }

  @Override
  public void compareEntities(PipelineService expected, PipelineService updated, Map<String, String> authHeaders)
          throws HttpResponseException {

  }

  @Override
  public EntityInterface<PipelineService> getEntityInterface(PipelineService entity) {
    return new PipelineServiceEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {

  }

  @Test
  public void post_serviceWithLongName_400_badRequest(TestInfo test) {
    // Create pipeline with mandatory name field empty
    CreatePipelineService create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createService(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create pipeline with mandatory name field null
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createService(create(test).withName(null), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name must not be null]");

    // Create pipeline with mandatory name field empty
    exception = assertThrows(HttpResponseException.class, () ->
            createService(create(test).withName(""), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");

    // Create pipeline with mandatory serviceType field empty
    exception = assertThrows(HttpResponseException.class, () ->
            createService(create(test).withServiceType(null), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[serviceType must not be null]");

    // Create pipeline with mandatory brokers field empty
    exception = assertThrows(HttpResponseException.class, () ->
            createService(create(test).withPipelineUrl(null), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[pipelineUrl must not be null]");
  }

  @Test
  public void post_serviceAlreadyExists_409(TestInfo test) throws HttpResponseException {
    CreatePipelineService create = create(test);
    createService(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createService(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validService_as_admin_200_ok(TestInfo test) throws HttpResponseException {
    // Create pipeline service with different optional fields
    Map<String, String> authHeaders = adminAuthHeaders();
    createAndCheckService(create(test, 1).withDescription(null), authHeaders);
    createAndCheckService(create(test, 2).withDescription("description"), authHeaders);
    createAndCheckService(create(test, 3).withIngestionSchedule(null), authHeaders);
  }

  @Test
  public void post_validService_as_non_admin_401(TestInfo test)  {
    // Create pipeline service with different optional fields
    Map<String, String> authHeaders = authHeaders("test@open-metadata.org");

    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createAndCheckService(create(test, 1).withDescription(null), authHeaders));
    TestUtils.assertResponse(exception, FORBIDDEN,
            "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_invalidIngestionSchedule_4xx(TestInfo test) {
    // No jdbc connection set
    CreatePipelineService create = create(test);
    Schedule schedule = create.getIngestionSchedule();

    // Invalid format
    create.withIngestionSchedule(schedule.withRepeatFrequency("INVALID"));
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createService(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "Invalid ingestion repeatFrequency INVALID");

    // Duration that contains years, months and seconds are not allowed
    create.withIngestionSchedule(schedule.withRepeatFrequency("P1Y"));
    exception = assertThrows(HttpResponseException.class, () -> createService(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST,
            "Ingestion repeatFrequency can only contain Days, Hours, " +
                    "and Minutes - example P{d}DT{h}H{m}M");

    create.withIngestionSchedule(schedule.withRepeatFrequency("P1M"));
    exception = assertThrows(HttpResponseException.class, () -> createService(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST,
            "Ingestion repeatFrequency can only contain Days, Hours, " +
                    "and Minutes - example P{d}DT{h}H{m}M");

    create.withIngestionSchedule(schedule.withRepeatFrequency("PT1S"));
    exception = assertThrows(HttpResponseException.class, () -> createService(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST,
            "Ingestion repeatFrequency can only contain Days, Hours, " +
                    "and Minutes - example P{d}DT{h}H{m}M");
  }

  @Test
  public void post_validIngestionSchedules_as_admin_200(TestInfo test) throws HttpResponseException {
    Schedule schedule = new Schedule().withStartDate(new Date());
    schedule.withRepeatFrequency("PT60M");  // Repeat every 60M should be valid
    createAndCheckService(create(test, 1).withIngestionSchedule(schedule), adminAuthHeaders());

    schedule.withRepeatFrequency("PT1H49M");
    createAndCheckService(create(test, 2).withIngestionSchedule(schedule), adminAuthHeaders());

    schedule.withRepeatFrequency("P1DT1H49M");
    createAndCheckService(create(test, 3).withIngestionSchedule(schedule), adminAuthHeaders());
  }

  @Test
  public void post_ingestionScheduleIsTooShort_4xx(TestInfo test) {
    // No jdbc connection set
    CreatePipelineService create = create(test);
    Schedule schedule = create.getIngestionSchedule();
    create.withIngestionSchedule(schedule.withRepeatFrequency("PT1M"));  // Repeat every 0 seconds
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createService(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST,
            "Ingestion repeatFrequency is too short and must be more than 60 minutes");

    create.withIngestionSchedule(schedule.withRepeatFrequency("PT59M"));  // Repeat every 50 minutes 59 seconds
    exception = assertThrows(HttpResponseException.class, () -> createService(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "Ingestion repeatFrequency is too short and must " +
            "be more than 60 minutes");
  }

  @Test
  public void put_updateService_as_admin_2xx(TestInfo test) throws HttpResponseException, URISyntaxException {
    PipelineService dbService = createAndCheckService(create(test).withDescription(null).withIngestionSchedule(null)
            .withPipelineUrl(PIPELINE_SERVICE_URL), adminAuthHeaders());

    // Update pipeline description and ingestion service that are null
    CreatePipelineService update = create(test).withDescription("description1");
    updateAndCheckService(update, OK, adminAuthHeaders());

    // Update ingestion schedule
    Schedule schedule = new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D");
    update.withIngestionSchedule(schedule);
    updateAndCheckService(update, OK, adminAuthHeaders());

    // Update  ingestion schedule again
    update.withIngestionSchedule(schedule.withRepeatFrequency("PT1H"));
    updateAndCheckService(update, OK, adminAuthHeaders());

    // update broker list and schema registry
    update.withPipelineUrl(new URI("http://localhost:9000"));
    updateAndCheckService(update, OK, adminAuthHeaders());
    PipelineService updatedService = getService(dbService.getId(), adminAuthHeaders());
    validatePipelineServiceConfig(updatedService, List.of("localhost:0"), new URI("http://localhost:9000"));
  }

  @Test
  public void put_update_as_non_admin_401(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    PipelineService pipelineService = createAndCheckService(create(test).withDescription(null)
                    .withIngestionSchedule(null),
            authHeaders);

    // Update pipeline description and ingestion service that are null
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            updateAndCheckService(create(test), OK, authHeaders("test@open-metadata.org")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} " +
            "is not admin");
  }

  @Test
  public void get_nonExistentService_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getService(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.PIPELINE_SERVICE,
            TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_nonExistentServiceByName_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> getServiceByName("invalidName", null, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.PIPELINE_SERVICE,
            "invalidName"));
  }

  public static PipelineService createAndCheckService(CreatePipelineService create,
                                                      Map<String, String> authHeaders) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    PipelineService service = createService(create, authHeaders);
    assertEquals(0.1, service.getVersion());
    validateService(service, create.getName(), create.getDescription(), create.getIngestionSchedule(), updatedBy);

    // GET the newly created service and validate
    PipelineService getService = getService(service.getId(), authHeaders);
    validateService(getService, create.getName(), create.getDescription(), create.getIngestionSchedule(), updatedBy);

    // GET the newly created service by name and validate
    getService = getServiceByName(service.getName(), null, authHeaders);
    validateService(getService, create.getName(), create.getDescription(), create.getIngestionSchedule(), updatedBy);
    return service;
  }

  public static PipelineService createService(CreatePipelineService create,
                                              Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("services/pipelineServices"),
                          create, PipelineService.class, authHeaders);
  }

  private static void validateService(PipelineService service, String expectedName, String expectedDescription,
                                      Schedule expectedIngestion, String expectedUpdatedBy) {
    assertNotNull(service.getId());
    assertNotNull(service.getHref());
    assertEquals(expectedName, service.getName());
    assertEquals(expectedDescription, service.getDescription());
    assertEquals(expectedUpdatedBy, service.getUpdatedBy());

    if (expectedIngestion != null) {
      assertEquals(expectedIngestion.getStartDate(), service.getIngestionSchedule().getStartDate());
      assertEquals(expectedIngestion.getRepeatFrequency(), service.getIngestionSchedule().getRepeatFrequency());
    }
  }

  public static PipelineService getService(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    return getService(id, null, authHeaders);
  }

  public static PipelineService getService(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("services/pipelineServices/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, PipelineService.class, authHeaders);
  }

  public static PipelineService getServiceByName(String name, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("services/pipelineServices/name/" + name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, PipelineService.class, authHeaders);
  }

  public static String getName(TestInfo test) {
    return String.format("pservice_%s", test.getDisplayName());
  }

  public static String getName(TestInfo test, int index) {
    return String.format("pservice_%d_%s", index, test.getDisplayName());
  }

  @Test
  public void delete_ExistentPipelineService_as_admin_200(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    PipelineService pipelineService = createService(create(test), authHeaders);
    deleteService(pipelineService.getId(), pipelineService.getName(), authHeaders);
  }

  @Test
  public void delete_as_user_401(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    PipelineService pipelineService = createService(create(test), authHeaders);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteService(pipelineService.getId(), pipelineService.getName(),
                    authHeaders("test@open-metadata.org")));
    TestUtils.assertResponse(exception, FORBIDDEN,
            "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void delete_notExistentPipelineService() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getService(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND,
            CatalogExceptionMessage.entityNotFound(Entity.PIPELINE_SERVICE, TestUtils.NON_EXISTENT_ENTITY));
  }

  private void deleteService(UUID id, String name, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(CatalogApplicationTest.getResource("services/pipelineServices/" + id), authHeaders);

    // Ensure deleted service does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getService(id, authHeaders));
    TestUtils.assertResponse(exception, NOT_FOUND,
            CatalogExceptionMessage.entityNotFound(Entity.PIPELINE_SERVICE, id));

    // Ensure deleted service does not exist when getting by name
    exception = assertThrows(HttpResponseException.class, () -> getServiceByName(name, null, authHeaders));
    TestUtils.assertResponse(exception, NOT_FOUND,
            CatalogExceptionMessage.entityNotFound(Entity.PIPELINE_SERVICE, name));
  }

  public static CreatePipelineService create(TestInfo test) {
    return new CreatePipelineService().withName(getName(test))
            .withServiceType(CreatePipelineService.PipelineServiceType.Airflow)
            .withPipelineUrl(PIPELINE_SERVICE_URL)
            .withIngestionSchedule(new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D"));
  }

  private static CreatePipelineService create(TestInfo test, int index) {
    return new CreatePipelineService().withName(getName(test, index))
            .withServiceType(CreatePipelineService.PipelineServiceType.Airflow)
            .withPipelineUrl(PIPELINE_SERVICE_URL)
            .withIngestionSchedule(new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D"));
  }

  public static void updateAndCheckService(CreatePipelineService update, Status status,
                                           Map<String, String> authHeaders) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    PipelineService service = updatePipelineService(update, status, authHeaders);
    validateService(service, service.getName(), update.getDescription(), update.getIngestionSchedule(), updatedBy);

    // GET the newly updated pipeline and validate
    PipelineService getService = getService(service.getId(), authHeaders);
    validateService(getService, service.getName(), update.getDescription(), update.getIngestionSchedule(), updatedBy);

    // GET the newly updated pipeline by name and validate
    getService = getServiceByName(service.getName(), null, authHeaders);
    validateService(getService, service.getName(), update.getDescription(), update.getIngestionSchedule(), updatedBy);
  }

  public static PipelineService updatePipelineService(CreatePipelineService updated,
                                                      Status status, Map<String, String> authHeaders)
          throws HttpResponseException {
    return TestUtils.put(CatalogApplicationTest.getResource("services/pipelineServices"), updated,
            PipelineService.class, status, authHeaders);
  }

  private static void validatePipelineServiceConfig(PipelineService actualService, List<String> expectedBrokers,
                                                     URI expectedUrl) {
    assertEquals(actualService.getPipelineUrl(), expectedUrl);
  }
}
