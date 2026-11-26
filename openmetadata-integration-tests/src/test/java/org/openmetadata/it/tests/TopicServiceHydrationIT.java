package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.IntFunction;
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
    final var topics = persistedTopics(ns, 24, index -> service.getFullyQualifiedName());
    final var reads = new ArrayList<Integer>();
    for (final int width : List.of(4, 24)) {
      final var batch = topics.subList(0, width);
      reads.add(countHydrationReads(batch));
      batch.forEach(topic -> assertEquals(service.getId(), topic.getService().getId()));
    }
    assertReadsStayConstant(reads, "Topic service reads must not grow with topics");
  }

  @Test
  void topicServiceHydrationMapsDistinctParentsInOneBatch(final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final var services =
        IntStream.range(0, 3)
            .mapToObj(ignored -> MessagingServiceTestFactory.createKafka(ns))
            .toList();
    final var topics =
        persistedTopics(
            ns, 24, index -> services.get(index % services.size()).getFullyQualifiedName());
    final var reads = new ArrayList<Integer>();
    for (final int width : List.of(6, 24)) {
      final var batch = topics.subList(0, width);
      reads.add(countHydrationReads(batch));
      for (int index = 0; index < width; index++) {
        assertEquals(
            services.get(index % services.size()).getId(), batch.get(index).getService().getId());
      }
    }
    assertReadsStayConstant(reads, "Distinct service reads must not grow with topics");
  }

  @Test
  void topicServiceHydrationRejectsMissingParent(final TestNamespace ns) {
    final var service = MessagingServiceTestFactory.createKafka(ns);
    final var topic = TopicTestFactory.createSimple(ns, service.getFullyQualifiedName());
    final var row = topicRepository().getDao().findEntityById(topic.getId());
    final var missingId = UUID.randomUUID();
    try (var fresh = FreshReadScope.enter();
        var bypass = EntityCacheBypass.skip()) {
      repointContainment(topic, missingId);
      assertHydrationRejects(row, missingId);
    } finally {
      repointContainment(topic, service.getId());
    }
  }

  @Test
  void topicServiceHydrationRejectsSoftDeletedParent(final TestNamespace ns) {
    final var service = MessagingServiceTestFactory.createKafka(ns);
    final var topic = TopicTestFactory.createSimple(ns, service.getFullyQualifiedName());
    final var row = topicRepository().getDao().findEntityById(topic.getId());
    final var services = Entity.getCollectionDAO().messagingServiceDAO();
    try (var fresh = FreshReadScope.enter();
        var bypass = EntityCacheBypass.skip()) {
      services.update(service.withDeleted(true));
      assertHydrationRejects(row, service.getId());
    } finally {
      services.update(service.withDeleted(false));
    }
  }

  private static TopicRepository topicRepository() {
    return (TopicRepository) Entity.getEntityRepository(Entity.TOPIC);
  }

  private static List<Topic> persistedTopics(
      final TestNamespace ns, final int count, final IntFunction<String> serviceFqnAt) {
    return IntStream.range(0, count)
        .mapToObj(
            index ->
                topicRepository()
                    .getDao()
                    .findEntityById(
                        TopicTestFactory.createSimple(ns, serviceFqnAt.apply(index)).getId()))
        .toList();
  }

  private static int countHydrationReads(final List<Topic> batch) {
    try (var fresh = FreshReadScope.enter();
        var bypass = EntityCacheBypass.skip();
        var queries = new SqlQueryCounter(Entity.getJdbi(), "select")) {
      topicRepository().setFieldsInBulk(Fields.EMPTY_FIELDS, batch);
      return queries.count();
    }
  }

  private static void assertReadsStayConstant(final List<Integer> reads, final String message) {
    assertTrue(reads.getFirst() > 0, "The SQL counter must observe topic hydration");
    assertEquals(reads.getFirst(), reads.getLast(), message);
  }

  private static void repointContainment(final Topic topic, final UUID serviceId) {
    final var relationships = Entity.getCollectionDAO().relationshipDAO();
    relationships.deleteTo(
        topic.getId(), Entity.TOPIC, Relationship.CONTAINS.ordinal(), Entity.MESSAGING_SERVICE);
    relationships.insert(
        serviceId,
        topic.getId(),
        Entity.MESSAGING_SERVICE,
        Entity.TOPIC,
        Relationship.CONTAINS.ordinal());
  }

  private static void assertHydrationRejects(final Topic row, final UUID missingServiceId) {
    final var error =
        assertThrows(
            EntityNotFoundException.class,
            () -> topicRepository().setFieldsInBulk(Fields.EMPTY_FIELDS, List.of(row)));
    assertEquals(
        CatalogExceptionMessage.entityNotFound(Entity.MESSAGING_SERVICE, missingServiceId),
        error.getMessage());
  }
}
