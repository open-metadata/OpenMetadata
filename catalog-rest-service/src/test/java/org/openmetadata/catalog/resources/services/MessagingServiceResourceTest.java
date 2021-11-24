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
import org.openmetadata.catalog.api.services.CreateMessagingService;
import org.openmetadata.catalog.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.MessagingServiceRepository.MessagingServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.messaging.MessagingServiceResource.MessagingServiceList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

import javax.ws.rs.client.WebTarget;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class MessagingServiceResourceTest extends EntityResourceTest<MessagingService> {

  public static List<String> KAFKA_BROKERS;
  public static URI SCHEMA_REGISTRY_URL;

  public MessagingServiceResourceTest() {
    super(Entity.MESSAGING_SERVICE, MessagingService.class, MessagingServiceList.class,
            "services/messagingServices", "", false, false, false);
    supportsPatch = false;
  }

  @BeforeAll
  public static void setup() throws URISyntaxException {
    KAFKA_BROKERS = List.of("192.168.1.1:0");
    SCHEMA_REGISTRY_URL = new URI("http://localhost:0");
  }

  @Test
  public void post_serviceWithLongName_400_badRequest(TestInfo test) {
    // Create messaging with mandatory name field empty
    CreateMessagingService create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createService(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create messaging with mandatory name field null
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createService(create(test).withName(null), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name must not be null]");

    // Create messaging with mandatory name field empty
    exception = assertThrows(HttpResponseException.class, () ->
            createService(create(test).withName(""), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");

    // Create messaging with mandatory serviceType field empty
    exception = assertThrows(HttpResponseException.class, () ->
            createService(create(test).withServiceType(null), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[serviceType must not be null]");

    // Create messaging with mandatory brokers field empty
    exception = assertThrows(HttpResponseException.class, () ->
            createService(create(test).withBrokers(null), adminAuthHeaders()));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[brokers must not be null]");
  }

  @Test
  public void post_serviceAlreadyExists_409(TestInfo test) throws HttpResponseException {
    CreateMessagingService create = create(test);
    createService(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createService(create, adminAuthHeaders()));
    TestUtils.assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create messaging service with different optional fields
    Map<String, String> authHeaders = adminAuthHeaders();
    createAndCheckEntity(create(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(create(test, 2).withDescription("description"), authHeaders);
    createAndCheckEntity(create(test, 3).withIngestionSchedule(null), authHeaders);
  }

  @Test
  public void post_validService_as_non_admin_401(TestInfo test)  {
    // Create messaging service with different optional fields
    Map<String, String> authHeaders = authHeaders("test@open-metadata.org");

    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createAndCheckEntity(create(test, 1).withDescription(null), authHeaders));
    TestUtils.assertResponse(exception, FORBIDDEN,
            "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_invalidIngestionSchedule_4xx(TestInfo test) {
    // No jdbc connection set
    CreateMessagingService create = create(test);
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
  public void post_validIngestionSchedules_as_admin_200(TestInfo test) throws IOException {
    Schedule schedule = new Schedule().withStartDate(new Date());
    schedule.withRepeatFrequency("PT60M");  // Repeat every 60M should be valid
    createAndCheckEntity(create(test, 1).withIngestionSchedule(schedule), adminAuthHeaders());

    schedule.withRepeatFrequency("PT1H49M");
    createAndCheckEntity(create(test, 2).withIngestionSchedule(schedule), adminAuthHeaders());

    schedule.withRepeatFrequency("P1DT1H49M");
    createAndCheckEntity(create(test, 3).withIngestionSchedule(schedule), adminAuthHeaders());
  }

  @Test
  public void post_ingestionScheduleIsTooShort_4xx(TestInfo test) {
    // No jdbc connection set
    CreateMessagingService create = create(test);
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
  public void put_updateService_as_admin_2xx(TestInfo test) throws IOException, URISyntaxException {
    MessagingService service = createAndCheckEntity(create(test).withDescription(null).withIngestionSchedule(null)
            .withBrokers(KAFKA_BROKERS).withSchemaRegistry(SCHEMA_REGISTRY_URL), adminAuthHeaders());

    // Update messaging description and ingestion service that are null
    CreateMessagingService update = create(test).withDescription("description1").withIngestionSchedule(null);
    ChangeDescription change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description1"));
    service = updateAndCheckEntity(update, OK, adminAuthHeaders(), UpdateType.MINOR_UPDATE, change);

    // Update ingestion schedule
    Schedule schedule = new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D");
    change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("ingestionSchedule").withNewValue(schedule));
    update.withIngestionSchedule(schedule);
    service = updateAndCheckEntity(update, OK, adminAuthHeaders(), UpdateType.MINOR_UPDATE, change);

    // Update description and ingestion schedule again
    Schedule schedule1 = new Schedule().withStartDate(new Date()).withRepeatFrequency("PT1H");
    update.withIngestionSchedule(schedule1);
    change = getChangeDescription(service.getVersion());
    change.getFieldsUpdated().add(new FieldChange().withName("ingestionSchedule")
            .withOldValue(schedule).withNewValue(schedule1));
    service = updateAndCheckEntity(update, OK, adminAuthHeaders(), UpdateType.MINOR_UPDATE, change);

    // update broker list and schema registry
    List<String> updatedBrokers = List.of("localhost:0");
    URI updatedSchemaRegistry = new URI("http://localhost:9000");
    update.withBrokers(updatedBrokers).withSchemaRegistry(updatedSchemaRegistry);

    change = getChangeDescription(service.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("brokers").withOldValue(KAFKA_BROKERS));
    change.getFieldsAdded().add(new FieldChange().withName("brokers").withNewValue(updatedBrokers));
    change.getFieldsUpdated().add(new FieldChange().withName("schemaRegistry")
            .withOldValue(SCHEMA_REGISTRY_URL).withNewValue(updatedSchemaRegistry));

    updateAndCheckEntity(update, OK, adminAuthHeaders(), UpdateType.MINOR_UPDATE, change);
  }

  @Test
  public void put_update_as_non_admin_401(TestInfo test) throws IOException {
    Map<String, String> authHeaders = adminAuthHeaders();
    createAndCheckEntity(create(test).withDescription(null).withIngestionSchedule(null), authHeaders);

    // Update messaging description as non admin and expect exception
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            updateAndCheckEntity(create(test), OK, authHeaders("test@open-metadata.org"),
                    UpdateType.NO_CHANGE, null));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} " +
            "is not admin");
  }

  @Test
  public void get_nonExistentService_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getService(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.MESSAGING_SERVICE,
            TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_nonExistentServiceByName_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> getServiceByName("invalidName", null, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.MESSAGING_SERVICE,
            "invalidName"));
  }

  public static MessagingService createService(CreateMessagingService create,
                                              Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("services/messagingServices"),
                          create, MessagingService.class, authHeaders);
  }

  public static MessagingService getService(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    return getService(id, null, authHeaders);
  }

  public static MessagingService getService(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("services/messagingServices/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, MessagingService.class, authHeaders);
  }

  public static MessagingService getServiceByName(String name, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("services/messagingServices/name/" + name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, MessagingService.class, authHeaders);
  }

  public static String getName(TestInfo test) {
    return String.format("dbservice_%s", test.getDisplayName());
  }

  public static String getName(TestInfo test, int index) {
    return String.format("dbservice_%d_%s", index, test.getDisplayName());
  }

  @Test
  public void delete_ExistentMessagingService_as_admin_200(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    MessagingService messagingService = createService(create(test), authHeaders);
    deleteService(messagingService.getId(), messagingService.getName(), authHeaders);
  }

  @Test
  public void delete_as_user_401(TestInfo test) throws HttpResponseException {
    Map<String, String> authHeaders = adminAuthHeaders();
    MessagingService messagingService = createService(create(test), authHeaders);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteService(messagingService.getId(), messagingService.getName(),
                    authHeaders("test@open-metadata.org")));
    TestUtils.assertResponse(exception, FORBIDDEN,
            "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void delete_notExistentMessagingService() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getService(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    TestUtils.assertResponse(exception, NOT_FOUND,
            CatalogExceptionMessage.entityNotFound(Entity.MESSAGING_SERVICE, TestUtils.NON_EXISTENT_ENTITY));
  }

  private void deleteService(UUID id, String name, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(CatalogApplicationTest.getResource("services/messagingServices/" + id), authHeaders);

    // Ensure deleted service does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getService(id, authHeaders));
    TestUtils.assertResponse(exception, NOT_FOUND,
            CatalogExceptionMessage.entityNotFound(Entity.MESSAGING_SERVICE, id));

    // Ensure deleted service does not exist when getting by name
    exception = assertThrows(HttpResponseException.class, () -> getServiceByName(name, null, authHeaders));
    TestUtils.assertResponse(exception, NOT_FOUND,
            CatalogExceptionMessage.entityNotFound(Entity.MESSAGING_SERVICE, name));
  }

  public static CreateMessagingService create(TestInfo test) {
    return new CreateMessagingService().withName(getName(test)).withServiceType(MessagingServiceType.Kafka)
            .withBrokers(KAFKA_BROKERS)
            .withSchemaRegistry(SCHEMA_REGISTRY_URL)
            .withIngestionSchedule(new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D"));
  }

  private static CreateMessagingService create(TestInfo test, int index) {
    return new CreateMessagingService().withName(getName(test, index)).withServiceType(MessagingServiceType.Pulsar)
            .withBrokers(List.of("192.1.1.1:0"))
            .withIngestionSchedule(new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D"));
  }

  @Override
  public Object createRequest(TestInfo test, int index, String description, String displayName, EntityReference owner)
          throws URISyntaxException {
    return create(test).withName(getName(test, index)).withDescription(description).withIngestionSchedule(null);
  }

  @Override
  public void validateCreatedEntity(MessagingService service, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {
    CreateMessagingService createRequest = (CreateMessagingService) request;
    validateCommonEntityFields(getEntityInterface(service), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), null);
    Schedule expectedIngestion = createRequest.getIngestionSchedule();
    if (expectedIngestion != null) {
      assertEquals(expectedIngestion.getStartDate(), service.getIngestionSchedule().getStartDate());
      assertEquals(expectedIngestion.getRepeatFrequency(), service.getIngestionSchedule().getRepeatFrequency());
    }
    assertTrue(createRequest.getBrokers().containsAll(service.getBrokers()));
    assertEquals(createRequest.getSchemaRegistry(), service.getSchemaRegistry());
  }

  @Override
  public void validateUpdatedEntity(MessagingService service, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {
    validateCreatedEntity(service, request, authHeaders);
  }

  @Override
  public void compareEntities(MessagingService expected, MessagingService updated, Map<String, String> authHeaders)
          throws HttpResponseException {
  }

  @Override
  public EntityInterface<MessagingService> getEntityInterface(MessagingService entity) {
    return new MessagingServiceEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    return; // TODO
  }
}
