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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateMessagingService;
import org.openmetadata.catalog.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.jdbi3.MessagingServiceRepository.MessagingServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.messaging.MessagingServiceResource.MessagingServiceList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

@Slf4j
public class MessagingServiceResourceTest extends EntityResourceTest<MessagingService, CreateMessagingService> {

  public static List<String> KAFKA_BROKERS;
  public static URI SCHEMA_REGISTRY_URL;

  public MessagingServiceResourceTest() {
    super(
        Entity.MESSAGING_SERVICE,
        MessagingService.class,
        MessagingServiceList.class,
        "services/messagingServices",
        "owner",
        false,
        true,
        false,
        false);
    supportsPatch = false;
  }

  @BeforeAll
  public static void setup() throws URISyntaxException {
    KAFKA_BROKERS = List.of("192.168.1.1:0");
    SCHEMA_REGISTRY_URL = new URI("http://localhost:0");
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create messaging with mandatory serviceType field empty
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[serviceType must not be null]");

    // Create messaging with mandatory brokers field empty
    exception =
        assertThrows(
            HttpResponseException.class, () -> createEntity(createRequest(test).withBrokers(null), ADMIN_AUTH_HEADERS));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[brokers must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create messaging service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
    createAndCheckEntity(createRequest(test, 3).withIngestionSchedule(null), authHeaders);
  }

  @Test
  void post_invalidIngestionSchedule_4xx(TestInfo test) {
    // No jdbc connection set
    Schedule schedule = new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D");
    CreateMessagingService create = createRequest(test).withIngestionSchedule(schedule);

    // Invalid format
    create.withIngestionSchedule(schedule.withRepeatFrequency("INVALID"));
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    TestUtils.assertResponse(exception, BAD_REQUEST, "Invalid ingestion repeatFrequency INVALID");

    // Duration that contains years, months and seconds are not allowed
    create.withIngestionSchedule(schedule.withRepeatFrequency("P1Y"));
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    TestUtils.assertResponse(
        exception,
        BAD_REQUEST,
        "Ingestion repeatFrequency can only contain Days, Hours, " + "and Minutes - example P{d}DT{h}H{m}M");

    create.withIngestionSchedule(schedule.withRepeatFrequency("P1M"));
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    TestUtils.assertResponse(
        exception,
        BAD_REQUEST,
        "Ingestion repeatFrequency can only contain Days, Hours, " + "and Minutes - example P{d}DT{h}H{m}M");

    create.withIngestionSchedule(schedule.withRepeatFrequency("PT1S"));
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    TestUtils.assertResponse(
        exception,
        BAD_REQUEST,
        "Ingestion repeatFrequency can only contain Days, Hours, " + "and Minutes - example P{d}DT{h}H{m}M");
  }

  @Test
  void post_validIngestionSchedules_as_admin_200(TestInfo test) throws IOException {
    Schedule schedule = new Schedule().withStartDate(new Date());
    schedule.withRepeatFrequency("PT60M"); // Repeat every 60M should be valid
    createAndCheckEntity(createRequest(test, 1).withIngestionSchedule(schedule), ADMIN_AUTH_HEADERS);

    schedule.withRepeatFrequency("PT1H49M");
    createAndCheckEntity(createRequest(test, 2).withIngestionSchedule(schedule), ADMIN_AUTH_HEADERS);

    schedule.withRepeatFrequency("P1DT1H49M");
    createAndCheckEntity(createRequest(test, 3).withIngestionSchedule(schedule), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_ingestionScheduleIsTooShort_4xx(TestInfo test) {
    // No jdbc connection set
    Schedule schedule = new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D");
    CreateMessagingService create = createRequest(test).withIngestionSchedule(schedule);
    create.withIngestionSchedule(schedule.withRepeatFrequency("PT1M")); // Repeat every 0 seconds
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    TestUtils.assertResponseContains(
        exception, BAD_REQUEST, "Ingestion repeatFrequency is too short and must be more than 60 minutes");

    create.withIngestionSchedule(schedule.withRepeatFrequency("PT59M")); // Repeat every 50 minutes 59 seconds
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    TestUtils.assertResponse(
        exception, BAD_REQUEST, "Ingestion repeatFrequency is too short and must " + "be more than 60 minutes");
  }

  @Test
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException, URISyntaxException {
    MessagingService service =
        createAndCheckEntity(
            createRequest(test)
                .withDescription(null)
                .withIngestionSchedule(null)
                .withBrokers(KAFKA_BROKERS)
                .withSchemaRegistry(SCHEMA_REGISTRY_URL),
            ADMIN_AUTH_HEADERS);

    // Update messaging description and ingestion service that are null
    CreateMessagingService update = createRequest(test).withDescription("description1").withIngestionSchedule(null);
    ChangeDescription change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description1"));
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Update ingestion schedule
    Schedule schedule = new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D");
    change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("ingestionSchedule").withNewValue(schedule));
    update.withIngestionSchedule(schedule);
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Update description and ingestion schedule again
    Schedule schedule1 = new Schedule().withStartDate(new Date()).withRepeatFrequency("PT1H");
    update.withIngestionSchedule(schedule1);
    change = getChangeDescription(service.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("ingestionSchedule").withOldValue(schedule).withNewValue(schedule1));
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // update broker list and schema registry
    List<String> updatedBrokers = List.of("localhost:0");
    URI updatedSchemaRegistry = new URI("http://localhost:9000");
    update.withBrokers(updatedBrokers).withSchemaRegistry(updatedSchemaRegistry);

    change = getChangeDescription(service.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("brokers").withOldValue(KAFKA_BROKERS));
    change.getFieldsAdded().add(new FieldChange().withName("brokers").withNewValue(updatedBrokers));
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName("schemaRegistry")
                .withOldValue(SCHEMA_REGISTRY_URL)
                .withNewValue(updatedSchemaRegistry));

    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void put_update_as_non_owner_401(TestInfo test) throws IOException {
    createAndCheckEntity(
        createRequest(test).withDescription(null).withIngestionSchedule(null).withOwner(USER_OWNER1),
        ADMIN_AUTH_HEADERS);

    // Update messaging description as non owner and expect exception
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> updateAndCheckEntity(createRequest(test), OK, TEST_AUTH_HEADERS, UpdateType.NO_CHANGE, null));
    TestUtils.assertResponse(
        exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} " + "does not have permissions");
  }

  @Override
  public CreateMessagingService createRequest(
      String name, String description, String displayName, EntityReference owner) {
    return new CreateMessagingService()
        .withName(name)
        .withServiceType(MessagingServiceType.Kafka)
        .withBrokers(KAFKA_BROKERS)
        .withSchemaRegistry(SCHEMA_REGISTRY_URL)
        //            .withIngestionSchedule(new Schedule().withStartDate(new Date()).withRepeatFrequency("P1D"));
        .withDescription(description)
        .withOwner(owner)
        .withIngestionSchedule(null);
  }

  @Override
  public void validateCreatedEntity(
      MessagingService service, CreateMessagingService createRequest, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(service),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    Schedule expectedIngestion = createRequest.getIngestionSchedule();
    if (expectedIngestion != null) {
      assertEquals(expectedIngestion.getStartDate(), service.getIngestionSchedule().getStartDate());
      assertEquals(expectedIngestion.getRepeatFrequency(), service.getIngestionSchedule().getRepeatFrequency());
    }
    assertTrue(createRequest.getBrokers().containsAll(service.getBrokers()));
    assertEquals(createRequest.getSchemaRegistry(), service.getSchemaRegistry());
  }

  @Override
  public void validateUpdatedEntity(
      MessagingService service, CreateMessagingService request, Map<String, String> authHeaders) {
    validateCreatedEntity(service, request, authHeaders);
  }

  @Override
  public void compareEntities(MessagingService expected, MessagingService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public EntityInterface<MessagingService> getEntityInterface(MessagingService entity) {
    return new MessagingServiceEntityInterface(entity);
  }

  @Override
  public void validateGetWithDifferentFields(MessagingService service, boolean byName) throws HttpResponseException {
    String fields = "owner";
    service =
        byName
            ? getEntityByName(service.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNotNull(
        service.getHref(),
        service.getOwner(),
        service.getVersion(),
        service.getUpdatedBy(),
        service.getServiceType(),
        service.getUpdatedAt());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    switch (fieldName) {
      case "ingestionSchedule":
        Schedule expectedSchedule = (Schedule) expected;
        Schedule actualSchedule = JsonUtils.readValue((String) actual, Schedule.class);
        assertEquals(expectedSchedule, actualSchedule);
        break;
      case "brokers":
        @SuppressWarnings("unchecked")
        List<String> expectedBrokers = (List<String>) expected;
        List<String> actualBrokers = JsonUtils.readObjects((String) actual, String.class);
        assertEquals(expectedBrokers, actualBrokers);
        break;
      case "schemaRegistry":
        URI expectedUri = (URI) expected;
        URI actualUri = URI.create((String) actual);
        assertEquals(expectedUri, actualUri);
        break;
      default:
        super.assertCommonFieldChange(fieldName, expected, actual);
        break;
    }
  }
}
