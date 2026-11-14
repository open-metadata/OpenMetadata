package org.openmetadata.service.migration.utils.v150;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;

class MigrationUtilTest {

  @Test
  void deleteLegacyDataInsightPipelines_noPipeline_doesNotCallSupplier() {
    // Given: no Data Insights pipeline in the database
    @SuppressWarnings("unchecked")
    Supplier<PipelineServiceClientInterface> supplier = mock(Supplier.class);

    try (MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
      entityStatic
          .when(
              () ->
                  Entity.getEntityByName(
                      eq(Entity.INGESTION_PIPELINE),
                      eq("OpenMetadata.OpenMetadata_dataInsight"),
                      eq("*"),
                      eq(Include.NON_DELETED)))
          .thenThrow(new EntityNotFoundException("not found"));

      // When
      assertDoesNotThrow(() -> MigrationUtil.deleteLegacyDataInsightPipelines(supplier));

      // Then: the pipeline service client must never be built
      verify(supplier, never()).get();
    }
  }

  @Test
  void deleteLegacyDataInsightPipelines_pipelinePresent_callsSupplierAndDeletes() {
    // Given: a Data Insights pipeline exists
    IngestionPipeline pipeline = mock(IngestionPipeline.class);
    when(pipeline.getId()).thenReturn(UUID.randomUUID());

    PipelineServiceClientInterface client = mock(PipelineServiceClientInterface.class);
    @SuppressWarnings("unchecked")
    Supplier<PipelineServiceClientInterface> supplier = mock(Supplier.class);
    when(supplier.get()).thenReturn(client);

    IngestionPipelineRepository repo = mock(IngestionPipelineRepository.class);

    try (MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
      entityStatic
          .when(
              () ->
                  Entity.getEntityByName(
                      eq(Entity.INGESTION_PIPELINE),
                      eq("OpenMetadata.OpenMetadata_dataInsight"),
                      eq("*"),
                      eq(Include.NON_DELETED)))
          .thenReturn(pipeline);
      entityStatic
          .when(() -> Entity.getEntityRepository(eq(Entity.INGESTION_PIPELINE)))
          .thenReturn(repo);

      // When
      assertDoesNotThrow(() -> MigrationUtil.deleteLegacyDataInsightPipelines(supplier));

      // Then: the client was built and setPipelineServiceClient was called
      verify(supplier).get();
      verify(repo).setPipelineServiceClient(eq(client));
      verify(repo).delete(eq("admin"), any(UUID.class), eq(true), eq(true));
    }
  }
}
