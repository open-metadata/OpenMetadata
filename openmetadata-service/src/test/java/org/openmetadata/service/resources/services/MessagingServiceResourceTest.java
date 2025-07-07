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

package org.openmetadata.service.resources.services;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.messaging.MessagingServiceResource;
import org.openmetadata.service.resources.services.messaging.MessagingServiceResource.MessagingServiceList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class MessagingServiceResourceTest
    extends ServiceResourceTest<MessagingService, CreateMessagingService> {
  public static final String KAFKA_BROKERS = "192.168.1.1:0";
  public static final URI SCHEMA_REGISTRY_URL = CommonUtil.getUri("http://localhost:0");

  public MessagingServiceResourceTest() {
    super(
        Entity.MESSAGING_SERVICE,
        MessagingService.class,
        MessagingServiceList.class,
        "services/messagingServices",
        MessagingServiceResource.FIELDS);
    supportsPatch = false;
  }

  public void setupMessagingServices() throws HttpResponseException {
    // Create Kafka messaging service
    MessagingServiceResourceTest messagingServiceResourceTest = new MessagingServiceResourceTest();
    CreateMessagingService createMessaging =
        new CreateMessagingService()
            .withName("kafka")
            .withServiceType(MessagingServiceType.Kafka)
            .withConnection(TestUtils.KAFKA_CONNECTION);
    MessagingService messagingService =
        messagingServiceResourceTest.createEntity(createMessaging, ADMIN_AUTH_HEADERS);
    KAFKA_REFERENCE = messagingService.getEntityReference();

    // Create Pulsar messaging service
    createMessaging
        .withName("redpanda")
        .withServiceType(MessagingServiceType.Redpanda)
        .withConnection(TestUtils.REDPANDA_CONNECTION);

    messagingService =
        messagingServiceResourceTest.createEntity(createMessaging, ADMIN_AUTH_HEADERS);
    REDPANDA_REFERENCE = messagingService.getEntityReference();
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create messaging with mandatory serviceType field empty
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param serviceType must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException, URISyntaxException {
    // Create messaging service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
    createAndCheckEntity(
        createRequest(test, 3)
            .withConnection(
                new MessagingConnection()
                    .withConfig(
                        new KafkaConnection()
                            .withBootstrapServers("localhost:9092")
                            .withSchemaRegistryURL(new URI("localhost:8081")))),
        authHeaders);

    // We can create the service without connection
    createAndCheckEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException, URISyntaxException {
    MessagingService service =
        createAndCheckEntity(
            createRequest(test)
                .withDescription(null)
                .withConnection(
                    new MessagingConnection()
                        .withConfig(
                            new KafkaConnection()
                                .withBootstrapServers("localhost:9092")
                                .withSchemaRegistryURL(new URI("localhost:8081")))),
            ADMIN_AUTH_HEADERS);

    MessagingConnection messagingConnection =
        new MessagingConnection()
            .withConfig(
                new KafkaConnection()
                    .withBootstrapServers("localhost:9092")
                    .withSchemaRegistryURL(new URI("localhost:8081")));
    // Update messaging description and ingestion service that are null
    CreateMessagingService update =
        createRequest(test)
            .withName(service.getName())
            .withDescription("description1")
            .withConnection(messagingConnection);
    ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
    fieldAdded(change, "description", "description1");
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update connection
    MessagingConnection messagingConnection1 =
        new MessagingConnection()
            .withConfig(
                new KafkaConnection()
                    .withBootstrapServers("host:9092")
                    .withSchemaRegistryURL(new URI("host:8081")));
    change = getChangeDescription(service, MINOR_UPDATE);
    fieldUpdated(change, "connection", messagingConnection, messagingConnection1);
    update.withConnection(messagingConnection1);
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update description and connection
    MessagingConnection messagingConnection2 =
        new MessagingConnection()
            .withConfig(
                new KafkaConnection()
                    .withBootstrapServers("host1:9092")
                    .withSchemaRegistryURL(new URI("host1:8081")));
    update.withConnection(messagingConnection1);
    change = getChangeDescription(service, MINOR_UPDATE);
    fieldUpdated(change, "connection", messagingConnection1, messagingConnection2);
    update.setConnection(messagingConnection2);
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_testConnectionResult_200(TestInfo test) throws IOException {
    MessagingService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // By default, we have no result logged in
    assertNull(service.getTestConnectionResult());
    MessagingService updatedService =
        putTestConnectionResult(service.getId(), TEST_CONNECTION_RESULT, ADMIN_AUTH_HEADERS);
    // Validate that the data got properly stored
    assertNotNull(updatedService.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL,
        updatedService.getTestConnectionResult().getStatus());
    assertEquals(updatedService.getConnection(), service.getConnection());
    // Check that the stored data is also correct
    MessagingService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, stored.getTestConnectionResult().getStatus());
    assertEquals(stored.getConnection(), service.getConnection());
  }

  public MessagingService putTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(serviceId).path("/testConnectionResult");
    return TestUtils.put(target, testConnectionResult, MessagingService.class, OK, authHeaders);
  }

  @Override
  public CreateMessagingService createRequest(String name) {
    return new CreateMessagingService()
        .withName(name)
        .withServiceType(MessagingServiceType.Kafka)
        .withConnection(
            new MessagingConnection()
                .withConfig(
                    new KafkaConnection()
                        .withBootstrapServers(KAFKA_BROKERS)
                        .withSchemaRegistryURL(SCHEMA_REGISTRY_URL)));
  }

  @Override
  public void validateCreatedEntity(
      MessagingService service,
      CreateMessagingService createRequest,
      Map<String, String> authHeaders) {
    MessagingConnection expectedMessagingConnection = createRequest.getConnection();
    MessagingConnection actualMessagingConnection = service.getConnection();
    validateConnection(
        expectedMessagingConnection, actualMessagingConnection, service.getServiceType());
  }

  @Override
  public void compareEntities(
      MessagingService expected, MessagingService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public MessagingService validateGetWithDifferentFields(MessagingService service, boolean byName)
      throws HttpResponseException {
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), null, fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(service.getOwners());

    fields = "owners,tags,followers";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), null, fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return service;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if ("connection".equals(fieldName)) {
      assertTrue(((String) actual).contains("-encrypted-value"));
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateConnection(
      MessagingConnection expectedConnection,
      MessagingConnection actualConnection,
      MessagingServiceType messagingServiceType) {
    if (expectedConnection != null
        && actualConnection != null
        && expectedConnection.getConfig() != null
        && actualConnection.getConfig() != null) {
      if (messagingServiceType == MessagingServiceType.Kafka) {
        KafkaConnection expectedKafkaConnection = (KafkaConnection) expectedConnection.getConfig();
        KafkaConnection actualKafkaConnection;
        if (actualConnection.getConfig() instanceof KafkaConnection) {
          actualKafkaConnection = (KafkaConnection) actualConnection.getConfig();
        } else {
          actualKafkaConnection =
              JsonUtils.convertValue(actualConnection.getConfig(), KafkaConnection.class);
        }
        assertEquals(
            expectedKafkaConnection.getBootstrapServers(),
            actualKafkaConnection.getBootstrapServers());
        assertEquals(
            expectedKafkaConnection.getSchemaRegistryURL(),
            actualKafkaConnection.getSchemaRegistryURL());
      }
    }
  }
}
