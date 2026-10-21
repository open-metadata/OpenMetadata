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

package org.openmetadata.service.openlineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageInputDataset;
import org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.openlineage.OpenLineageTopicResolver.BrokerAddress;
import org.openmetadata.service.util.EntityUtil.Fields;

class OpenLineageTopicResolverTest {

  @Test
  void parseBroker_handlesListenerSchemesUnderscoresAndMissingPorts() {
    assertEquals(
        Optional.of(new BrokerAddress("kafka_broker", 9093)),
        OpenLineageTopicResolver.parseBroker(" SASL_SSL://Kafka_Broker:9093 "));
    assertEquals(
        Optional.of(new BrokerAddress("broker", -1)),
        OpenLineageTopicResolver.parseBroker("broker"));
    assertEquals(
        Optional.of(new BrokerAddress("broker", 9092)),
        OpenLineageTopicResolver.parseBroker("broker:9092/some/path"));
    assertEquals(
        Optional.of(new BrokerAddress("[::1]", 9092)),
        OpenLineageTopicResolver.parseBroker("[::1]:9092"));
    assertEquals(Optional.empty(), OpenLineageTopicResolver.parseBroker(""));
  }

  @Test
  void isKafkaNamespace_isCaseInsensitiveAndRejectsOtherSchemes() {
    assertTrue(OpenLineageTopicResolver.isKafkaNamespace("KAFKA://broker:9092"));
    assertFalse(OpenLineageTopicResolver.isKafkaNamespace("postgres://kafka:5432"));
    assertFalse(OpenLineageTopicResolver.isKafkaNamespace(null));
  }

  @Test
  void exactBrokerMatch_resolvesTheTopic() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubServices(entity, kafkaPojoService("kafka_prod", "other:9092, broker:9092"));
      stubTopics(entity, Set.of("kafka_prod.orders"));

      EntityReference topic = assertResolved(resolve("kafka://broker:9092", "orders"));

      assertEquals("kafka_prod.orders", topic.getFullyQualifiedName());
    }
  }

  @Test
  void otherListenerPortOfTheSameHost_resolvesTheTopic() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubServices(entity, service("kafka_prod", "broker:9092"));
      stubTopics(entity, Set.of("kafka_prod.orders"));

      assertEquals(
          "kafka_prod.orders",
          assertResolved(resolve("kafka://broker:9093", "orders")).getFullyQualifiedName());
    }
  }

  @Test
  void exactPortWins_overAnotherServiceOnTheSameHost() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubServices(entity, service("plain", "broker:9092"), service("tls", "broker:9093"));
      stubTopics(entity, Set.of("plain.orders", "tls.orders"));

      assertEquals(
          "tls.orders",
          assertResolved(resolve("kafka://broker:9093", "orders")).getFullyQualifiedName());
    }
  }

  /**
   * prod has not ingested the topic yet; staging, another cluster behind the same gateway host, has
   * a same-named one. Falling back to it would draw a permanent edge to the wrong cluster.
   */
  @Test
  void exactServiceWithoutTheTopic_doesNotFallBackToAnotherPort() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubServices(entity, service("prod", "gateway:9092"), service("staging", "gateway:9192"));
      stubTopics(entity, Set.of("staging.orders"));

      assertUnresolved(resolve("kafka://gateway:9092", "orders"), UnresolvedReason.NOT_FOUND);
    }
  }

  /** 9093 could be either cluster's listener, so the one holding the topic is not proof. */
  @Test
  void otherPortOfAHostServingSeveralServices_isNotGuessed() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubServices(entity, service("prod", "gateway:9092"), service("staging", "gateway:9192"));
      stubTopics(entity, Set.of("staging.orders"));

      OpenLineageResolution.Unresolved unresolved =
          assertUnresolved(
              resolve("kafka://gateway:9093", "orders"), UnresolvedReason.SERVICE_NOT_FOUND);

      assertTrue(unresolved.message().contains("staging"), unresolved.message());
    }
  }

  @Test
  void servicesSharingABroker_resolveToTheOnlyOneHoldingTheTopic() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubServices(entity, service("first", "localhost:9092"), service("second", "localhost:9092"));
      stubTopics(entity, Set.of("second.orders"));

      assertEquals(
          "second.orders",
          assertResolved(resolve("kafka://localhost:9092", "orders")).getFullyQualifiedName());
    }
  }

  @Test
  void topicInTwoServicesOnTheSameBroker_isAmbiguousAndDropped() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubServices(entity, service("first", "broker:9092"), service("second", "broker:9092"));
      stubTopics(entity, Set.of("first.orders", "second.orders"));

      OpenLineageResolution.Unresolved unresolved =
          assertUnresolved(resolve("kafka://broker:9092", "orders"), UnresolvedReason.NOT_FOUND);

      assertTrue(unresolved.message().contains("first.orders"), unresolved.message());
      assertTrue(unresolved.message().contains("second.orders"), unresolved.message());
    }
  }

  @Test
  void brokerNoServiceLists_reportsServiceNotFound() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubServices(entity, service("kafka_prod", "elsewhere:9092"), serviceWithoutConnection());
      stubTopics(entity, Set.of());

      assertUnresolved(
          resolve("kafka://broker:9092", "orders"), UnresolvedReason.SERVICE_NOT_FOUND);
    }
  }

  @Test
  void missingTopic_isReportedAndNeverCreated() {
    OpenLineageEntityCreator creator = mock(OpenLineageEntityCreator.class);
    OpenLineageEntityResolver resolver =
        new OpenLineageEntityResolver(
            true, "openlineage", Map.of("kafka://", "kafka_prod"), creator);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubServices(entity, service("kafka_prod", "broker:9092"));
      stubTopics(entity, Set.of());

      assertUnresolved(
          resolver.resolveDataset(dataset("kafka://broker:9092", "orders"), "user"),
          UnresolvedReason.NOT_FOUND);
      verifyNoInteractions(creator);
    }
  }

  @Test
  void dottedTopicName_neverMatchesATable() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubServices(entity, service("kafka_prod", "broker:9092"));
      stubTopics(entity, Set.of("kafka_prod.\"dbserver1.inventory.customers\""));

      EntityReference topic =
          assertResolved(resolve("kafka://broker:9092", "dbserver1.inventory.customers"));

      assertEquals("kafka_prod.\"dbserver1.inventory.customers\"", topic.getFullyQualifiedName());
      entity.verify(() -> Entity.getEntityRepository(Entity.TABLE), never());
    }
  }

  private static OpenLineageResolution resolve(String namespace, String name) {
    return new OpenLineageEntityResolver(false, "openlineage")
        .resolveDataset(dataset(namespace, name), "user");
  }

  private static OpenLineageInputDataset dataset(String namespace, String name) {
    return new OpenLineageInputDataset().withNamespace(namespace).withName(name);
  }

  /** Stored connection configs come back from the database as plain maps. */
  private static MessagingService service(String name, String bootstrapServers) {
    return new MessagingService()
        .withName(name)
        .withFullyQualifiedName(name)
        .withConnection(
            new MessagingConnection().withConfig(Map.of("bootstrapServers", bootstrapServers)));
  }

  private static MessagingService kafkaPojoService(String name, String bootstrapServers) {
    return new MessagingService()
        .withName(name)
        .withFullyQualifiedName(name)
        .withConnection(
            new MessagingConnection()
                .withConfig(new KafkaConnection().withBootstrapServers(bootstrapServers)));
  }

  private static MessagingService serviceWithoutConnection() {
    return new MessagingService().withName("no_connection").withFullyQualifiedName("no_connection");
  }

  private static void stubServices(MockedStatic<Entity> entity, MessagingService... services) {
    @SuppressWarnings("unchecked")
    EntityRepository<MessagingService> repository = mock(EntityRepository.class);
    entity.when(() -> Entity.getEntityRepository(Entity.MESSAGING_SERVICE)).thenReturn(repository);
    when(repository.getFields(anyString())).thenReturn(mock(Fields.class));
    when(repository.listAll(any(Fields.class), any())).thenReturn(Arrays.asList(services));
  }

  private static void stubTopics(MockedStatic<Entity> entity, Set<String> existingTopicFqns) {
    entity
        .when(
            () ->
                Entity.getEntityReferenceByName(
                    eq(Entity.TOPIC), anyString(), eq(Include.NON_DELETED)))
        .thenAnswer(
            invocation -> {
              String fqn = invocation.getArgument(1);
              if (!existingTopicFqns.contains(fqn)) {
                throw new EntityNotFoundException("Topic not found: " + fqn);
              }
              return new EntityReference()
                  .withId(UUID.randomUUID())
                  .withType(Entity.TOPIC)
                  .withFullyQualifiedName(fqn);
            });
  }

  private static EntityReference assertResolved(OpenLineageResolution resolution) {
    return assertInstanceOf(OpenLineageResolution.Resolved.class, resolution).entity();
  }

  private static OpenLineageResolution.Unresolved assertUnresolved(
      OpenLineageResolution resolution, UnresolvedReason reason) {
    OpenLineageResolution.Unresolved unresolved =
        assertInstanceOf(OpenLineageResolution.Unresolved.class, resolution);
    assertEquals(reason, unresolved.reason(), unresolved.message());
    return unresolved;
  }
}
