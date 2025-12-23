package org.openmetadata.it.factories;

import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.type.MessagingConnection;

/**
 * Factory for creating MessagingService entities in integration tests.
 *
 * <p>Provides namespace-isolated entity creation with consistent patterns.
 */
public class MessagingServiceTestFactory {

  /**
   * Create a Kafka messaging service with default settings. Each call creates a unique service to
   * avoid conflicts in parallel test execution.
   */
  public static MessagingService createKafka(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("kafkaService_" + uniqueId);

    KafkaConnection kafkaConn = new KafkaConnection().withBootstrapServers("localhost:9092");

    MessagingConnection conn = new MessagingConnection().withConfig(kafkaConn);

    CreateMessagingService request =
        new CreateMessagingService()
            .withName(name)
            .withServiceType(MessagingServiceType.Kafka)
            .withConnection(conn)
            .withDescription("Test Kafka service");

    return SdkClients.adminClient().messagingServices().create(request);
  }

  /**
   * Create a Redpanda messaging service with default settings. Each call creates a unique service
   * to avoid conflicts in parallel test execution.
   */
  public static MessagingService createRedpanda(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("redpandaService_" + uniqueId);

    KafkaConnection kafkaConn = new KafkaConnection().withBootstrapServers("localhost:9092");

    MessagingConnection conn = new MessagingConnection().withConfig(kafkaConn);

    CreateMessagingService request =
        new CreateMessagingService()
            .withName(name)
            .withServiceType(MessagingServiceType.Redpanda)
            .withConnection(conn)
            .withDescription("Test Redpanda service");

    return SdkClients.adminClient().messagingServices().create(request);
  }

  /** Get messaging service by ID. */
  public static MessagingService getById(String id) {
    return SdkClients.adminClient().messagingServices().get(id);
  }
}
