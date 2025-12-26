package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.services.connections.messaging.RedpandaConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for MessagingService entity operations.
 *
 * <p>Extends BaseServiceIT to inherit common service tests.
 */
@Execution(ExecutionMode.CONCURRENT)
public class MessagingServiceResourceIT
    extends BaseServiceIT<MessagingService, CreateMessagingService> {

  @Override
  protected CreateMessagingService createMinimalRequest(TestNamespace ns) {
    KafkaConnection conn = new KafkaConnection().withBootstrapServers("localhost:9092");

    return new CreateMessagingService()
        .withName(ns.prefix("msgservice"))
        .withServiceType(MessagingServiceType.Kafka)
        .withConnection(new MessagingConnection().withConfig(conn))
        .withDescription("Test messaging service");
  }

  @Override
  protected CreateMessagingService createRequest(String name, TestNamespace ns) {
    KafkaConnection conn = new KafkaConnection().withBootstrapServers("localhost:9092");

    return new CreateMessagingService()
        .withName(name)
        .withServiceType(MessagingServiceType.Kafka)
        .withConnection(new MessagingConnection().withConfig(conn));
  }

  @Override
  protected MessagingService createEntity(CreateMessagingService createRequest) {
    return SdkClients.adminClient().messagingServices().create(createRequest);
  }

  @Override
  protected MessagingService getEntity(String id) {
    return SdkClients.adminClient().messagingServices().get(id);
  }

  @Override
  protected MessagingService getEntityByName(String fqn) {
    return SdkClients.adminClient().messagingServices().getByName(fqn);
  }

  @Override
  protected MessagingService patchEntity(String id, MessagingService entity) {
    return SdkClients.adminClient().messagingServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().messagingServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().messagingServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().messagingServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "messagingService";
  }

  @Override
  protected void validateCreatedEntity(
      MessagingService entity, CreateMessagingService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<MessagingService> listEntities(ListParams params) {
    return SdkClients.adminClient().messagingServices().list(params);
  }

  @Override
  protected MessagingService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().messagingServices().get(id, fields);
  }

  @Override
  protected MessagingService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().messagingServices().getByName(fqn, fields);
  }

  @Override
  protected MessagingService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().messagingServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().messagingServices().getVersionList(id);
  }

  @Override
  protected MessagingService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().messagingServices().getVersion(id.toString(), version);
  }

  // ===================================================================
  // MESSAGING SERVICE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_messagingServiceWithKafkaConnection_200_OK(TestNamespace ns) {
    KafkaConnection conn =
        new KafkaConnection()
            .withBootstrapServers("localhost:9092")
            .withSchemaRegistryURL(URI.create("http://localhost:8081"));

    CreateMessagingService request =
        new CreateMessagingService()
            .withName(ns.prefix("kafka_service"))
            .withServiceType(MessagingServiceType.Kafka)
            .withConnection(new MessagingConnection().withConfig(conn))
            .withDescription("Test Kafka service");

    MessagingService service = createEntity(request);
    assertNotNull(service);
    assertEquals(MessagingServiceType.Kafka, service.getServiceType());
  }

  @Test
  void post_messagingServiceWithRedpandaConnection_200_OK(TestNamespace ns) {
    RedpandaConnection conn = new RedpandaConnection().withBootstrapServers("localhost:9092");

    CreateMessagingService request =
        new CreateMessagingService()
            .withName(ns.prefix("redpanda_service"))
            .withServiceType(MessagingServiceType.Redpanda)
            .withConnection(new MessagingConnection().withConfig(conn))
            .withDescription("Test Redpanda service");

    MessagingService service = createEntity(request);
    assertNotNull(service);
    assertEquals(MessagingServiceType.Redpanda, service.getServiceType());
  }

  @Test
  void put_messagingServiceDescription_200_OK(TestNamespace ns) {
    CreateMessagingService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    MessagingService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    service.setDescription("Updated description");
    MessagingService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_messagingServiceVersionHistory(TestNamespace ns) {
    CreateMessagingService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    MessagingService service = createEntity(request);
    Double initialVersion = service.getVersion();

    service.setDescription("Updated description");
    MessagingService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_messagingServiceSoftDeleteRestore(TestNamespace ns) {
    CreateMessagingService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    MessagingService service = createEntity(request);
    assertNotNull(service.getId());

    deleteEntity(service.getId().toString());

    MessagingService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(service.getId().toString());

    MessagingService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_messagingServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreateMessagingService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    MessagingService service1 = createEntity(request1);
    assertNotNull(service1);

    CreateMessagingService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate messaging service should fail");
  }

  @Test
  void test_listMessagingServices(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreateMessagingService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<MessagingService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }
}
