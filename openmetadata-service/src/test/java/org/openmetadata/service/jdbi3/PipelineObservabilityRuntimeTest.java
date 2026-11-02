package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.PipelineObservability;
import org.openmetadata.schema.type.PipelineObservabilityResponse;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class PipelineObservabilityRuntimeTest {
  private static final String FQN = "pipeline_service.demo_pipeline";
  private static final String EXTENSION = "table.pipelineObservability." + FQN;

  @Test
  void tablesShareOneCompleteRuntimeSnapshotAndTheNextRequestRecalculates() {
    long now = System.currentTimeMillis();
    List<PipelineStatus> statuses = new ArrayList<>();
    for (int i = 0; i < 1000; i++) {
      statuses.add(new PipelineStatus().withTimestamp(now - i - 1).withEndTime(now - i + 39));
    }
    statuses.add(
        new PipelineStatus()
            .withTimestamp(now - 2000)
            .withEndTime(now + 10000)
            .withTaskStatus(
                List.of(
                    new Status().withStartTime(10L).withEndTime(110L),
                    new Status().withStartTime(-1000L),
                    new Status().withEndTime(9000L))));
    statuses.add(new PipelineStatus().withTimestamp(now - 3000).withEndTime(now - 3000));
    statuses.add(new PipelineStatus().withTimestamp(now - 4000).withEndTime(now - 5000));
    statuses.add(
        new PipelineStatus().withTimestamp(now - 31L * 24 * 60 * 60 * 1000).withEndTime(now));

    try (RuntimeFixture fixture = new RuntimeFixture(statuses)) {
      PipelineObservabilityResponse first = fixture.repository.getPipelineObservability(FQN);
      assertRuntimes(first, (1000 * 40.0 + 100.0) / 1001);
      assertRuntimes(fixture.repository.getPipelineObservability(FQN), 900.0);
    }
  }

  @Test
  void missingRuntimeIsReusedAcrossTablesButNotAcrossRequests() {
    try (RuntimeFixture fixture = new RuntimeFixture(List.of())) {
      PipelineObservabilityResponse response = fixture.repository.getPipelineObservability(FQN);
      assertEquals(2, response.getTableObservabilityData().size());
      response
          .getTableObservabilityData()
          .forEach(
              table -> assertNull(table.getObservabilityData().getFirst().getAverageRunTime()));
      assertRuntimes(fixture.repository.getPipelineObservability(FQN), 900.0);
    }
  }

  private static void assertRuntimes(PipelineObservabilityResponse response, double expected) {
    assertEquals(2, response.getTableObservabilityData().size());
    assertEquals(2, response.getPaging().getTotal());
    response
        .getTableObservabilityData()
        .forEach(
            table ->
                assertEquals(
                    expected,
                    table.getObservabilityData().getFirst().getAverageRunTime(),
                    0.00001));
  }

  private static class RuntimeFixture implements AutoCloseable {
    private final MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS);
    private final PipelineRepository repository;

    RuntimeFixture(List<PipelineStatus> initialStatuses) {
      CollectionDAO collectionDAO = mock(CollectionDAO.class);
      CollectionDAO.EntityExtensionDAO extensionDAO = mock(CollectionDAO.EntityExtensionDAO.class);
      CollectionDAO.EntityExtensionTimeSeriesDAO timeSeriesDAO =
          mock(CollectionDAO.EntityExtensionTimeSeriesDAO.class);
      when(collectionDAO.entityExtensionDAO()).thenReturn(extensionDAO);
      when(collectionDAO.entityExtensionTimeSeriesDao()).thenReturn(timeSeriesDAO);
      entities.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      entities
          .when(() -> Entity.registerEntity(any(), any(), any(PipelineRepository.class)))
          .thenAnswer(call -> null);
      repository = spy(new PipelineRepository());
      doReturn(new Pipeline().withId(UUID.randomUUID()).withFullyQualifiedName(FQN))
          .when(repository)
          .findByName(FQN, Include.NON_DELETED);

      List<CollectionDAO.ExtensionWithIdAndSchemaObject> records = new ArrayList<>();
      for (int i = 0; i < 2; i++) {
        UUID tableId = UUID.randomUUID();
        entities
            .when(() -> Entity.getEntityReferenceById(Entity.TABLE, tableId, Include.NON_DELETED))
            .thenReturn(new EntityReference().withFullyQualifiedName("demo_db.schema.table_" + i));
        records.add(
            CollectionDAO.ExtensionWithIdAndSchemaObject.builder()
                .id(tableId.toString())
                .extension(EXTENSION)
                .json(
                    JsonUtils.pojoToJson(
                        new PipelineObservability()
                            .withPipeline(new EntityReference().withFullyQualifiedName(FQN))))
                .build());
      }
      when(extensionDAO.getExtensionsByPrefixBatch(EXTENSION)).thenReturn(records);
      AtomicInteger snapshots = new AtomicInteger();
      when(timeSeriesDAO.listBetweenTimestampsByOrder(
              eq(FQN),
              eq(PipelineRepository.PIPELINE_STATUS_EXTENSION),
              anyLong(),
              anyLong(),
              eq(EntityTimeSeriesDAO.OrderBy.DESC)))
          .thenAnswer(
              call -> {
                long start = call.getArgument(2);
                long end = call.getArgument(3);
                List<PipelineStatus> snapshot =
                    snapshots.getAndIncrement() == 0
                        ? initialStatuses
                        : List.of(
                            new PipelineStatus().withTimestamp(end - 1000).withEndTime(end - 100));
                return snapshot.stream()
                    .filter(
                        status -> status.getTimestamp() >= start && status.getTimestamp() <= end)
                    .map(JsonUtils::pojoToJson)
                    .toList();
              });
    }

    @Override
    public void close() {
      entities.close();
    }
  }
}
