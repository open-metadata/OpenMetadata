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
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.PipelineObservability;
import org.openmetadata.schema.type.PipelineObservabilityResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * The average runtime is computed in SQL (covered by PipelineStatusPaginationSqlTest); here, once
 * per request over the last 30 days, and shared by every table in the response.
 */
class PipelineObservabilityRuntimeTest {
  private static final String FQN = "pipeline_service.demo_pipeline";
  private static final String EXTENSION = "table.pipelineObservability." + FQN;
  private static final long THIRTY_DAYS = 30L * 24 * 60 * 60 * 1000;

  @Test
  void tablesShareOneRuntimePerRequestAndTheNextRequestRecalculates() {
    try (RuntimeFixture fixture = new RuntimeFixture(66.5, 900.0)) {
      assertRuntimes(fixture.repository.getPipelineObservability(FQN), 66.5);
      assertRuntimes(fixture.repository.getPipelineObservability(FQN), 900.0);
      assertEquals(List.of(THIRTY_DAYS, THIRTY_DAYS), fixture.windows);
    }
  }

  @Test
  void missingRuntimeIsReusedAcrossTablesButNotAcrossRequests() {
    try (RuntimeFixture fixture = new RuntimeFixture(null, 900.0)) {
      PipelineObservabilityResponse response = fixture.repository.getPipelineObservability(FQN);
      assertEquals(2, response.getTableObservabilityData().size());
      response
          .getTableObservabilityData()
          .forEach(
              table -> assertNull(table.getObservabilityData().getFirst().getAverageRunTime()));
      assertEquals(1, fixture.windows.size());
      assertRuntimes(fixture.repository.getPipelineObservability(FQN), 900.0);
      assertEquals(2, fixture.windows.size());
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

  /** Two tables observing the pipeline; each average the database computes records its window. */
  private static class RuntimeFixture implements AutoCloseable {
    private final MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS);
    private final List<Long> windows = new ArrayList<>();
    private final PipelineRepository repository;

    RuntimeFixture(Double... averages) {
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
      Iterator<Double> results = Arrays.asList(averages).iterator();
      when(timeSeriesDAO.averagePipelineRuntime(eq(FQN), anyLong(), anyLong()))
          .thenAnswer(
              call -> {
                windows.add(call.<Long>getArgument(2) - call.<Long>getArgument(1));
                return results.next();
              });
    }

    @Override
    public void close() {
      entities.close();
    }
  }
}
