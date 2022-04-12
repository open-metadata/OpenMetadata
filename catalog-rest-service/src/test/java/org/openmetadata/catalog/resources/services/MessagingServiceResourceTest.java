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
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateMessagingService;
import org.openmetadata.catalog.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.jdbi3.MessagingServiceRepository.MessagingServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.messaging.MessagingServiceResource;
import org.openmetadata.catalog.resources.services.messaging.MessagingServiceResource.MessagingServiceList;
import org.openmetadata.catalog.services.connections.messaging.KafkaConnection;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.MessagingConnection;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

@Slf4j
public class MessagingServiceResourceTest extends EntityResourceTest<MessagingService, CreateMessagingService> {

  public static String KAFKA_BROKERS = "192.168.1.1:0";
  public static URI SCHEMA_REGISTRY_URL;

  static {
    try {
      SCHEMA_REGISTRY_URL = new URI("http://localhost:0");
    } catch (URISyntaxException e) {
      e.printStackTrace();
    }
  }

  public MessagingServiceResourceTest() {
    super(
        Entity.MESSAGING_SERVICE,
        MessagingService.class,
        MessagingServiceList.class,
        "services/messagingServices",
        MessagingServiceResource.FIELDS);
    supportsPatch = false;
    supportsAuthorizedMetadataOperations = false;
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create messaging with mandatory serviceType field empty
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[serviceType must not be null]");

    // Create messaging with mandatory brokers field empty
    assertResponse(
        () -> createEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[connection must not be null]");
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
        createRequest(test).withDescription("description1").withConnection(messagingConnection);
    ChangeDescription change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description1"));
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Update connection
    MessagingConnection messagingConnection1 =
        new MessagingConnection()
            .withConfig(
                new KafkaConnection().withBootstrapServers("host:9092").withSchemaRegistryURL(new URI("host:8081")));
    change = getChangeDescription(service.getVersion());
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName("connection")
                .withNewValue(messagingConnection1)
                .withOldValue(messagingConnection));
    update.withConnection(messagingConnection1);
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Update description and connection
    MessagingConnection messagingConnection2 =
        new MessagingConnection()
            .withConfig(
                new KafkaConnection().withBootstrapServers("host1:9092").withSchemaRegistryURL(new URI("host1:8081")));
    update.withConnection(messagingConnection1);
    change = getChangeDescription(service.getVersion());
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName("connection")
                .withOldValue(messagingConnection1)
                .withNewValue(messagingConnection2));
    update.setConnection(messagingConnection2);
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Override
  public CreateMessagingService createRequest(
      String name, String description, String displayName, EntityReference owner) {
    return new CreateMessagingService()
        .withName(name)
        .withServiceType(MessagingServiceType.Kafka)
        .withConnection(
            new MessagingConnection()
                .withConfig(
                    new KafkaConnection()
                        .withBootstrapServers(KAFKA_BROKERS)
                        .withSchemaRegistryURL(SCHEMA_REGISTRY_URL)))
        .withDescription(description)
        .withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(
      MessagingService service, CreateMessagingService createRequest, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(service),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    MessagingConnection expectedMessagingConnection = createRequest.getConnection();
    MessagingConnection actualMessagingConnection = service.getConnection();
    validateConnection(expectedMessagingConnection, actualMessagingConnection, service.getServiceType());
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
  public EntityInterface<MessagingService> validateGetWithDifferentFields(MessagingService service, boolean byName)
      throws HttpResponseException {
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(service.getOwner());

    fields = "owner";
    service =
        byName
            ? getEntityByName(service.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return getEntityInterface(service);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if ("connection".equals(fieldName)) {
      MessagingConnection expectedConnection = (MessagingConnection) expected;
      MessagingConnection actualConnection = JsonUtils.readValue((String) actual, MessagingConnection.class);
      actualConnection.setConfig(JsonUtils.convertValue(actualConnection.getConfig(), KafkaConnection.class));
      assertEquals(expectedConnection, actualConnection);
    } else {
      super.assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateConnection(
      MessagingConnection expectedConnection,
      MessagingConnection actualConnection,
      MessagingServiceType messagingServiceType) {
    if (expectedConnection.getConfig() != null) {
      if (messagingServiceType == MessagingServiceType.Kafka) {
        KafkaConnection expectedKafkaConnection = (KafkaConnection) expectedConnection.getConfig();
        KafkaConnection actualKafkaConnection;
        if (actualConnection.getConfig() instanceof KafkaConnection) {
          actualKafkaConnection = (KafkaConnection) actualConnection.getConfig();
        } else {
          actualKafkaConnection = JsonUtils.convertValue(actualConnection.getConfig(), KafkaConnection.class);
        }
        assertEquals(expectedKafkaConnection.getBootstrapServers(), actualKafkaConnection.getBootstrapServers());
        assertEquals(expectedKafkaConnection.getSchemaRegistryURL(), actualKafkaConnection.getSchemaRegistryURL());
      }
    }
  }
}
