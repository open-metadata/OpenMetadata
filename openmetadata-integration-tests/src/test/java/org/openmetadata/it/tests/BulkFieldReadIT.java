package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.function.Function;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.sdk.fluent.Pipelines;
import org.openmetadata.sdk.fluent.Topics;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.util.RequestEntityCache;

@Isolated("Measures bulk field queries on the request thread")
@ExtendWith(TestNamespaceExtension.class)
class BulkFieldReadIT {

  @Test
  void pipelineUsageSummaryLoadsOncePerBatch(TestNamespace ns) {
    final String type = Entity.PIPELINE;
    final var entities = entities(type, ns);
    final var repository = repository(type);
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_usage")) {
      repository.setFieldsInBulk(repository.fieldPolicy().parse("usageSummary"), entities);
      assertEquals(1, queries.count());
    } finally {
      RequestEntityCache.clear();
    }
    for (final var entity : entities) {
      final var usage = ((Pipeline) entity).getUsageSummary();
      assertNotNull(usage);
      assertEquals(0, usage.getDailyStats().getCount());
    }
  }

  @Test
  void pipelineStatusesLoadEachPipelineOnce(TestNamespace ns) {
    final var pipelines = entities(Entity.PIPELINE, ns);
    final var repository = repository(Entity.PIPELINE);
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_extension_time_series")) {
      repository.setFieldsInBulk(repository.fieldPolicy().parse("pipelineStatus"), pipelines);
      assertEquals(pipelines.size(), queries.count());
    } finally {
      RequestEntityCache.clear();
    }
    pipelines.forEach(pipeline -> assertNull(((Pipeline) pipeline).getPipelineStatus()));
  }

  @Test
  void explicitTopicServiceReusesTheRequiredServiceProjection(TestNamespace ns) {
    final var topics = entities(Entity.TOPIC, ns);
    final var expected = ((Topic) topics.getFirst()).getService();
    final var repository = repository(Entity.TOPIC);
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_relationship")) {
      repository.setFieldsInBulk(repository.fieldPolicy().parse("service"), topics);
      assertEquals(1, queries.count());
    } finally {
      RequestEntityCache.clear();
    }
    topics.forEach(topic -> assertEquals(expected.getId(), ((Topic) topic).getService().getId()));
  }

  @Test
  void topicUsageProjectionRemainsUnsupported() {
    SdkClients.adminClient();
    assertThrows(
        IllegalArgumentException.class,
        () -> repository(Entity.TOPIC).fieldPolicy().parse("usageSummary"));
  }

  private List<EntityInterface> entities(String type, TestNamespace ns) {
    SdkClients.adminClient();
    final Function<String, ? extends EntityInterface> create;
    if (Entity.PIPELINE.equals(type)) {
      final var service = PipelineServiceTestFactory.createAirflow(ns).getFullyQualifiedName();
      create = name -> Pipelines.create().name(name).in(service).execute();
    } else {
      final var service = MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName();
      create = name -> Topics.create().name(name).in(service).withPartitions(3).execute();
    }
    return IntStream.range(0, 3)
        .mapToObj(index -> (EntityInterface) create.apply(ns.prefix("entity_" + index)))
        .toList();
  }

  @SuppressWarnings("unchecked")
  private EntityPolicy<EntityInterface> repository(String type) {
    return (EntityPolicy<EntityInterface>) Entity.getEntityRepository(type);
  }
}
