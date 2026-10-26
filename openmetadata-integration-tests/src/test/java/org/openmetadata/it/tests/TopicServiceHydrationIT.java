package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TopicRepository;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FreshReadScope;

/** Bulk topic hydration resolves every messaging service in one batch and rejects missing ones. */
@Isolated("Counts the embedded server's SQL statements while hydrating topics")
@ExtendWith(TestNamespaceExtension.class)
class TopicServiceHydrationIT {
  @Test
  void topicServiceHydrationReadsStayConstantWithoutCaches(final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final var service = MessagingServiceTestFactory.createKafka(ns);
    final var repository = (TopicRepository) Entity.getEntityRepository(Entity.TOPIC);
    final List<Topic> topics =
        IntStream.range(0, 24)
            .mapToObj(
                ignored ->
                    repository
                        .getDao()
                        .findEntityById(
                            TopicTestFactory.createSimple(ns, service.getFullyQualifiedName())
                                .getId()))
            .toList();
    final var reads = new ArrayList<Integer>();
    for (final int width : List.of(4, 24)) {
      final var batch = topics.subList(0, width);
      try (var fresh = FreshReadScope.enter();
          var bypass = EntityCacheBypass.skip();
          var queries = new SqlQueryCounter(Entity.getJdbi(), "select")) {
        repository.setFieldsInBulk(Fields.EMPTY_FIELDS, batch);
        reads.add(queries.count());
      }
      batch.forEach(topic -> assertEquals(service.getId(), topic.getService().getId()));
    }
    assertTrue(reads.getFirst() > 0, "The SQL counter must observe topic hydration");
    assertEquals(
        reads.getFirst(), reads.getLast(), "Topic service reads must not grow with topics");
  }

  @Test
  void topicServiceHydrationMapsDistinctParentsInOneBatch(final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final var services =
        IntStream.range(0, 3)
            .mapToObj(ignored -> MessagingServiceTestFactory.createKafka(ns))
            .toList();
    final var repository = (TopicRepository) Entity.getEntityRepository(Entity.TOPIC);
    final List<Topic> topics =
        IntStream.range(0, 24)
            .mapToObj(
                index ->
                    repository
                        .getDao()
                        .findEntityById(
                            TopicTestFactory.createSimple(
                                    ns,
                                    services.get(index % services.size()).getFullyQualifiedName())
                                .getId()))
            .toList();
    final var reads = new ArrayList<Integer>();
    for (final int width : List.of(6, 24)) {
      final var batch = topics.subList(0, width);
      try (var fresh = FreshReadScope.enter();
          var bypass = EntityCacheBypass.skip();
          var queries = new SqlQueryCounter(Entity.getJdbi(), "select")) {
        repository.setFieldsInBulk(Fields.EMPTY_FIELDS, batch);
        reads.add(queries.count());
      }
      for (int index = 0; index < width; index++) {
        assertEquals(
            services.get(index % services.size()).getId(), batch.get(index).getService().getId());
      }
    }
    assertTrue(reads.getFirst() > 0, "The SQL counter must observe topic hydration");
    assertEquals(
        reads.getFirst(), reads.getLast(), "Distinct service reads must not grow with topics");
  }

  @Test
  void topicServiceHydrationRejectsMissingParent(final TestNamespace ns) {
    final var service = MessagingServiceTestFactory.createKafka(ns);
    final var topic = TopicTestFactory.createSimple(ns, service.getFullyQualifiedName());
    final var repository = (TopicRepository) Entity.getEntityRepository(Entity.TOPIC);
    final var row = repository.getDao().findEntityById(topic.getId());
    final var relationships = Entity.getCollectionDAO().relationshipDAO();
    final var missingId = UUID.randomUUID();
    try (var fresh = FreshReadScope.enter();
        var bypass = EntityCacheBypass.skip()) {
      relationships.deleteTo(
          topic.getId(), Entity.TOPIC, Relationship.CONTAINS.ordinal(), Entity.MESSAGING_SERVICE);
      relationships.insert(
          missingId,
          topic.getId(),
          Entity.MESSAGING_SERVICE,
          Entity.TOPIC,
          Relationship.CONTAINS.ordinal());
      final var error =
          assertThrows(
              EntityNotFoundException.class,
              () -> repository.setFieldsInBulk(Fields.EMPTY_FIELDS, List.of(row)));
      assertEquals(
          CatalogExceptionMessage.entityNotFound(Entity.MESSAGING_SERVICE, missingId),
          error.getMessage());
    } finally {
      relationships.deleteTo(
          topic.getId(), Entity.TOPIC, Relationship.CONTAINS.ordinal(), Entity.MESSAGING_SERVICE);
      relationships.insert(
          service.getId(),
          topic.getId(),
          Entity.MESSAGING_SERVICE,
          Entity.TOPIC,
          Relationship.CONTAINS.ordinal());
    }
  }

  @Test
  void topicServiceHydrationRejectsSoftDeletedParent(final TestNamespace ns) {
    final var service = MessagingServiceTestFactory.createKafka(ns);
    final var topic = TopicTestFactory.createSimple(ns, service.getFullyQualifiedName());
    final var repository = (TopicRepository) Entity.getEntityRepository(Entity.TOPIC);
    final var row = repository.getDao().findEntityById(topic.getId());
    final var services = Entity.getCollectionDAO().messagingServiceDAO();
    try (var fresh = FreshReadScope.enter();
        var bypass = EntityCacheBypass.skip()) {
      services.update(service.withDeleted(true));
      final var error =
          assertThrows(
              EntityNotFoundException.class,
              () -> repository.setFieldsInBulk(Fields.EMPTY_FIELDS, List.of(row)));
      assertEquals(
          CatalogExceptionMessage.entityNotFound(Entity.MESSAGING_SERVICE, service.getId()),
          error.getMessage());
    } finally {
      services.update(service.withDeleted(false));
    }
  }
}
